const { Queue, QueueEvents } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const EventEmitter = require('events');

// BullMQ's internal Bus attaches many listeners — raise the limit to suppress warning
EventEmitter.defaultMaxListeners = 25;

const connection = createBullConnection();

const QUEUES = {
  DISPATCH: 'dispatch',
  NOTIFICATIONS: 'notifications',
  PAYMENTS: 'payments',
};

const dispatchQueue = new Queue(QUEUES.DISPATCH, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 86400 },
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
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
  },
});

const dispatchEvents = new QueueEvents(QUEUES.DISPATCH, { connection: createBullConnection() });

module.exports = {
  QUEUES,
  dispatchQueue,
  notificationsQueue,
  paymentsQueue,
  dispatchEvents,
};
