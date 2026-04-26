/**
 * Shared test helpers.
 *
 * Uses:
 *   - mongodb-memory-server → real MongoDB semantics, no external service
 *   - ioredis-mock         → in-process Redis that supports all the commands
 *                            we use (GEO, scripts, pub/sub, SET NX EX)
 *
 * NOTE on transactions: mongodb-memory-server's standalone doesn't support
 * multi-doc transactions. To test the Mongo txn path specifically, you'd
 * start a replica set via `MongoMemoryReplSet`. We keep the default here
 * because most tests don't need transactions; the transaction code path
 * is exercised via higher-level harnesses in integration environments.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const IORedisMock = require('ioredis-mock');

let mongoServer;

// Monkey-patch the redis module BEFORE the app imports it.
// Every require('./config/redis') will see the mock.
jest.mock('../src/config/redis', () => {
  const base = new IORedisMock();
  return {
    redis: base,
    createBullConnection: () => new IORedisMock(),
    createPubSubPair: () => ({ pubClient: new IORedisMock(), subClient: new IORedisMock() }),
  };
});

// Disable BullMQ interactions during unit tests — the queue is mocked.
jest.mock('../src/queues', () => ({
  QUEUES: { DISPATCH: 'dispatch', NOTIFICATIONS: 'notifications', PAYMENTS: 'payments' },
  dispatchQueue: { add: jest.fn().mockResolvedValue({ id: 'mock' }), getJob: jest.fn().mockResolvedValue(null) },
  notificationsQueue: { add: jest.fn().mockResolvedValue({ id: 'mock' }) },
  paymentsQueue: { add: jest.fn().mockResolvedValue({ id: 'mock' }) },
  dispatchEvents: { on: jest.fn() },
}));

async function startMongo() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function stopMongo() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}

async function resetDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

module.exports = { startMongo, stopMongo, resetDb };
