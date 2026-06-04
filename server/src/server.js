const http = require('http');
const buildApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectMongo } = require('./config/mongo');
const { initSockets } = require('./sockets');
const { ensureAdminSeeded } = require('./modules/admin/admin.seed');
const { seedPlans } = require('./modules/subscription/plan.seed');
const { seedEventCategories } = require('./modules/events/event-category.seed');
const EventBooking = require('./modules/events/event-booking.model');

/**
 * Startup reconciliation: reset workers who are marked unavailable but whose
 * current order has already reached a terminal state (completed/cancelled/failed).
 * This handles crashes or restarts that left worker state inconsistent.
 */
async function reconcileWorkers() {
  try {
    const Worker = require('./modules/worker/worker.model');
    const Order = require('./modules/order/order.model');
    const geoService = require('./modules/worker/geo.service');

    const TERMINAL_STATUSES = ['completed', 'cancelled', 'failed'];

    const stuckWorkers = await Worker.find({
      isAvailable: false,
      currentOrderId: { $ne: null },
    }).select('_id currentOrderId').lean();

    if (stuckWorkers.length === 0) {
      logger.info('[RECONCILE] No stuck workers found');
      return;
    }

    logger.info({ count: stuckWorkers.length }, '[RECONCILE] Checking stuck workers');

    let resetCount = 0;
    for (const worker of stuckWorkers) {
      const order = await Order.findById(worker.currentOrderId).select('status').lean();
      if (!order || TERMINAL_STATUSES.includes(order.status)) {
        await Worker.updateOne(
          { _id: worker._id },
          { $set: { isAvailable: true, currentOrderId: null } },
        );
        await geoService.setAvailability(String(worker._id), true);
        resetCount++;
        logger.info({ workerId: worker._id, orderId: worker.currentOrderId, orderStatus: order?.status || 'missing' }, '[RECONCILE] Worker reset');
      }
    }

    logger.info({ checked: stuckWorkers.length, reset: resetCount }, '[RECONCILE] Worker reconciliation complete');
  } catch (err) {
    logger.error({ err: err.message }, '[RECONCILE] Worker reconciliation failed — continuing startup');
  }
}

async function start() {
  await connectMongo();
  await reconcileWorkers();
  await ensureAdminSeeded();
  await seedPlans();
  await seedEventCategories();

  const app = buildApp();
  const server = http.createServer(app);
  initSockets(server);

  /* ── Start all workers in-process ──────────────────────────────
     No separate terminals needed. All three BullMQ workers run
     alongside Express in the same Node.js process.
     In production you can split them out into separate containers,
     but for dev/single-node this is simpler. */
  startDispatchWorker();
  startNotificationsWorker();
  startStaleOrderWorker();
  startShieldPayoutWorker();

  // Expire pending_payment event bookings older than 30 minutes every 5 min
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);
      const expired = await EventBooking.updateMany(
        { status: 'pending_payment', createdAt: { $lt: cutoff } },
        { $set: { status: 'cancelled', cancellationReason: 'payment_timeout' },
          $push: { statusHistory: { status: 'cancelled', meta: { reason: 'payment_timeout' } } } }
      );
      if (expired.modifiedCount > 0) {
        logger.info({ count: expired.modifiedCount }, '[EVENT] Expired pending_payment bookings cancelled');
      }
    } catch (err) { logger.warn({ err: err.message }, '[EVENT] Booking expiry sweep failed'); }
  }, 5 * 60 * 1000);

  server.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API server listening');
  });

  const shutdown = (signal) => async () => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });
}

function startDispatchWorker() {
  try {
    const { Worker: BullWorker } = require('bullmq');
    const { createBullConnection } = require('./config/redis');
    const { QUEUES } = require('./jobs');
    const { processDispatchJob } = require('./jobs/dispatch.worker');

    const worker = new BullWorker(
      QUEUES.DISPATCH,
      processDispatchJob,
      {
        connection:   createBullConnection(),
        concurrency:  10,
        lockDuration: 300_000,
      },
    );

    worker.on('completed', (job, result) =>
      logger.info({ jobId: job.id, result }, '[DISPATCH] Job completed'),
    );
    worker.on('failed', (job, err) =>
      logger.error({ jobId: job?.id, err: err.message }, '[DISPATCH] Job failed'),
    );
    worker.on('error', (err) =>
      logger.error({ err: err.message }, '[DISPATCH] Worker error'),
    );

    logger.info('[DISPATCH] Worker running in-process');
  } catch (err) {
    logger.error({ err: err.message }, '[DISPATCH] Failed to start worker — dispatch will not work');
  }
}

function startNotificationsWorker() {
  try {
    const { Worker: BullWorker } = require('bullmq');
    const { createBullConnection } = require('./config/redis');
    const { QUEUES } = require('./jobs');
    const { processJob } = require('./jobs/notifications.worker');

    const worker = new BullWorker(
      QUEUES.NOTIFICATIONS,
      processJob,
      { connection: createBullConnection(), concurrency: 5 },
    );
    worker.on('failed', (job, err) =>
      logger.error({ jobId: job?.id, err: err.message }, '[NOTIFICATIONS] Job failed'),
    );
    worker.on('error', (err) =>
      logger.error({ err: err.message }, '[NOTIFICATIONS] Worker error'),
    );
    logger.info('[NOTIFICATIONS] Worker running in-process');
  } catch (err) {
    logger.error({ err: err.message }, '[NOTIFICATIONS] Failed to start worker');
  }
}

function startStaleOrderWorker() {
  try {
    const { sweep } = require('./jobs/stale-order.worker');
    // Run sweep immediately on start, then every 2 minutes
    sweep().catch((err) => logger.error({ err: err.message }, '[STALE] Initial sweep failed'));
    setInterval(() => sweep().catch((err) => logger.error({ err: err.message }, '[STALE] Sweep failed')), 2 * 60 * 1000);
    logger.info('[STALE] Stale-order watchdog running in-process (sweeps every 2 minutes)');
  } catch (err) {
    logger.error({ err: err.message }, '[STALE] Failed to start watchdog');
  }
}

function startShieldPayoutWorker() {
  try {
    require('./jobs/shield-payout.worker');
    logger.info('[SHIELD] Shield payout worker running in-process');
  } catch (err) {
    logger.error({ err: err.message }, '[SHIELD] Failed to start shield payout worker');
  }
}

start().catch((err) => {
  logger.error({ err }, 'Startup failure');
  process.exit(1);
});
