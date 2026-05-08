const http = require('http');
const buildApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectMongo } = require('./config/mongo');
const { initSockets } = require('./sockets');
const { ensureAdminSeeded } = require('./modules/admin/admin.seed');
const { seedPlans } = require('./modules/subscription/plan.seed');

async function start() {
  await connectMongo();
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
