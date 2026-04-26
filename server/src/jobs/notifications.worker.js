/**
 * Notifications Worker
 * Sends push notifications via FCM / OneSignal. Decoupled from the API so a
 * slow provider can never back-pressure order creation.
 */
require('dotenv').config();
const { Worker: BullWorker } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const { connectMongo } = require('../config/mongo');
const WorkerModel = require('../modules/worker/worker.model');
const Order = require('../modules/order/order.model');
const logger = require('../utils/logger');
const { QUEUES } = require('./index');

async function sendFcm({ tokens, title, body, data }) {
  logger.info({ tokens: tokens.length, title, body, data }, '[FCM] push (stub)');
  return { successCount: tokens.length };
}

async function processJob(job) {
  if (job.name === 'worker_offer') {
    const { workerId, orderId } = job.data;
    const [worker, order] = await Promise.all([
      WorkerModel.findById(workerId).select('deviceTokens').lean(),
      Order.findById(orderId).select('service pricing pickupLocation').lean(),
    ]);
    if (!worker?.deviceTokens?.length) return { skipped: true };

    await sendFcm({
      tokens: worker.deviceTokens,
      title: '🔔 New job offer',
      body: `${order.service} · ₹${order.pricing.total} · ${order.pickupLocation.address}`,
      data: { type: 'offer', orderId: String(orderId) },
    });
    return { ok: true };
  }

  if (job.name === 'order_status') {
    const { userId, orderId, status } = job.data;
    logger.info({ userId, orderId, status }, '[FCM] would send status update');
    return { ok: true };
  }

  logger.warn({ name: job.name }, 'Unknown notification job');
  return { ok: false };
}

async function main() {
  await connectMongo();
  const bullWorker = new BullWorker(QUEUES.NOTIFICATIONS, processJob, {
    connection: createBullConnection(),
    concurrency: 20,
  });
  bullWorker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Notification failed')
  );
  logger.info('Notifications worker started');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Notifications worker crashed');
    process.exit(1);
  });
}
