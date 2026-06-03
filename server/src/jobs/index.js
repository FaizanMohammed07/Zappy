const { Queue, QueueEvents } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const EventEmitter = require('events');

// BullMQ's internal Bus attaches many listeners — raise the limit to suppress warning
EventEmitter.defaultMaxListeners = 25;

const connection = createBullConnection();

const QUEUES = {
  DISPATCH:      'dispatch',
  NOTIFICATIONS: 'notifications',
  PAYMENTS:      'payments',
  DLQ:           'dead-letter',   // Orders that exhausted all dispatch retries
};

const dispatchQueue = new Queue(QUEUES.DISPATCH, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 1000 },
    // Keep failed jobs for 48h in BullMQ UI visibility; DLQ handles recovery.
    removeOnFail: { age: 172800 },
  },
});

const notificationsQueue = new Queue(QUEUES.NOTIFICATIONS, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: { age: 86400 },
  },
});

const paymentsQueue = new Queue(QUEUES.PAYMENTS, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000, maxDelay: 60000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 }, // 7 days — payment failures need audit trail
  },
});

// Dead Letter Queue — receives orders that failed all dispatch retries.
// A separate worker (dlq.worker.js) processes these: alerts support + triggers refund.
const dlqQueue = new Queue(QUEUES.DLQ, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 604800 }, // 7 days visibility for ops
    removeOnFail:    { age: 604800 },
  },
});

// Shield Fund queue — weekly payouts + deferred fee collection
const shieldQueue = new Queue('shield', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 604800 }, // 7 days
    removeOnFail:    { age: 1209600 }, // 14 days
  },
});

// Schedule the weekly Monday payout at 08:00 IST (02:30 UTC).
// BullMQ repeat jobs are idempotent on jobId — safe to re-register on every restart.
shieldQueue.add(
  'weekly_payout',
  {},
  {
    jobId:  'shield:weekly_payout',
    repeat: { pattern: '30 2 * * 1' }, // 02:30 UTC = 08:00 IST every Monday
  }
).catch(() => {}); // non-fatal if Redis is unavailable at startup

const dispatchEvents = new QueueEvents(QUEUES.DISPATCH, { connection: createBullConnection() });

// Listen for exhausted dispatch jobs and route to DLQ
dispatchEvents.on('failed', async ({ jobId, failedReason }) => {
  try {
    const job = await dispatchQueue.getJob(jobId);
    if (!job) return;
    const { orderId } = job.data || {};
    if (!orderId) return;
    // Only escalate if all attempts are truly exhausted (BullMQ sets attemptsMade = attempts on final failure)
    if (job.attemptsMade < (job.opts?.attempts ?? 2)) return;
    await dlqQueue.add('dispatch_failed', { orderId, failedReason, originalJobId: jobId, failedAt: new Date().toISOString() }, {
      jobId: `dlq_${orderId}`,
      // Deduplicate: if the same order is already in DLQ, don't add again
    });
  } catch { /* DLQ routing failure must never crash the event emitter */ }
});

module.exports = {
  QUEUES,
  dispatchQueue,
  notificationsQueue,
  paymentsQueue,
  dlqQueue,
  shieldQueue,
  dispatchEvents,
};
