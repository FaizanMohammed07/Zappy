const http = require('http');
const buildApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectMongo } = require('./config/mongo');
const { initSockets } = require('./sockets');
const { ensureAdminSeeded } = require('./modules/admin/admin.seed');
const { seedPlans } = require('./modules/subscription/plan.seed');

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

  const app = buildApp();
  const server = http.createServer(app);
  initSockets(server);

  /* ── Start dispatch worker in-process ──────────────────────────
     No separate terminal needed. BullMQ Worker runs alongside
     Express in the same Node.js process. In production you can
     split this out, but for dev/single-node it's simpler here. */
  startDispatchWorker();

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

start().catch((err) => {
  logger.error({ err }, 'Startup failure');
  process.exit(1);
});
