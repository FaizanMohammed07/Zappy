const http = require('http');
const buildApp = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectMongo } = require('./config/mongo');
const { initSockets } = require('./sockets');

async function start() {
  await connectMongo();

  const app = buildApp();
  const server = http.createServer(app);
  initSockets(server);

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

start().catch((err) => {
  logger.error({ err }, 'Startup failure');
  process.exit(1);
});
