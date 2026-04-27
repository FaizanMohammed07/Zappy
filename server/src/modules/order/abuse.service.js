/**
 * Abuse detection — all Redis-backed, bounded memory, cluster-wide consistent.
 *
 * Three signals:
 *  1. Booking rate cap per user
 *  2. Rapid-cancel strikes (cancelled after assignment)
 *  3. Worker reject-rate monitoring (sliding window)
 */

const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const BOOKING_WINDOW_SEC = 600; // 10 min
const BOOKING_MAX = 5;

const CANCEL_WINDOW_SEC = 60 * 60 * 24; // 24 h
const CANCEL_STRIKE_LIMIT = 3;
const CANCEL_COOLDOWN_SEC = 60 * 60; // 1 h freeze

const REJECT_WINDOW_SIZE = 20; // last N offers
const REJECT_THRESHOLD = 0.7; // 70%

// ---- 1. Booking rate cap ----
async function assertCanBook(userId) {
  // First check cooldown (from rapid cancels)
  const frozen = await redis.get(`user:frozen:${userId}`);
  if (frozen) {
    throw Object.assign(new Error('Booking temporarily disabled due to repeated cancellations. Try again later.'), {
      status: 429, code: 'USER_BOOKING_FROZEN',
    });
  }

  const key = `book:rate:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, BOOKING_WINDOW_SEC);
  if (count > BOOKING_MAX) {
    throw Object.assign(new Error(`Too many bookings — max ${BOOKING_MAX} per 10 minutes`), {
      status: 429, code: 'BOOKING_RATE_CAP',
    });
  }
}

// Revert the counter if an order ends up not being created for validation reasons.
async function releaseBookingSlot(userId) {
  await redis.decr(`book:rate:${userId}`);
}

// ---- 2. Rapid cancel strikes ----
async function recordCancelAfterAssignment(userId) {
  const key = `cancel:strikes:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, CANCEL_WINDOW_SEC);
  if (count >= CANCEL_STRIKE_LIMIT) {
    await redis.setex(`user:frozen:${userId}`, CANCEL_COOLDOWN_SEC, '1');
    logger.warn({ userId, strikes: count }, 'User booking frozen due to rapid cancellations');
  }
  return count;
}

// ---- 3. Worker reject rate (sliding window via Redis + Mongo persistence) ----
async function recordWorkerOutcome(workerId, outcome /* 'accept' | 'reject' | 'timeout' */) {
  const key = `worker:offers:${workerId}`;
  await redis.multi().lpush(key, outcome).ltrim(key, 0, REJECT_WINDOW_SIZE - 1).exec();

  // Persist lifetime counters to Mongo (non-blocking)
  const Worker = require('../worker/worker.model');
  const inc = { 'penalties.totalOffers': 1 };
  if (outcome === 'reject' || outcome === 'timeout') inc['penalties.totalRejects'] = 1;
  Worker.updateOne({ _id: workerId }, { $inc: inc }).catch(() => {});

  // Check reject rate after any rejection/timeout
  if (outcome === 'reject' || outcome === 'timeout') {
    const items = await redis.lrange(key, 0, -1);
    if (items.length >= REJECT_WINDOW_SIZE) {
      const rejects = items.filter((i) => i === 'reject' || i === 'timeout').length;
      const rate = rejects / items.length;
      if (rate >= REJECT_THRESHOLD) {
        const geoService = require('../worker/geo.service');
        await Worker.updateOne(
          { _id: workerId, isAvailable: true },
          { $set: { isAvailable: false } }
        );
        await geoService.setAvailability(workerId, false);
        logger.warn({ workerId, rate }, 'Worker auto-marked unavailable: high reject rate');
        await redis.del(key);
        return { autoUnavailable: true };
      }
    }
  }
  return {};
}

module.exports = {
  assertCanBook,
  releaseBookingSlot,
  recordCancelAfterAssignment,
  recordWorkerOutcome,
};
