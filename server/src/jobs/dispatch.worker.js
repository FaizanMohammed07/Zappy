/**
 * Dispatch Worker Process
 * ----------------------------------------------------------------------------
 * Runs independently from the API process. Consumes jobs from the `dispatch`
 * queue and implements the sequential-offer matching algorithm:
 *
 *   1. Load order + find ranked candidates via geo.service.
 *   2. Offer to candidate #1 for OFFER_TIMEOUT_MS.
 *   3. Wait for a Redis pub/sub signal: `dispatch:accepted:<orderId>`.
 *   4. If accepted → lock worker to order, emit `order.assigned`, done.
 *   5. If timeout/rejected → mark candidate as attempted, re-enqueue.
 *   6. Cap at N attempts; if exhausted → emit `order.failed` (no workers).
 *
 * Why sequential (not broadcast)? Avoids accept races, gives the nearest
 * worker priority, and makes cancellations/retries deterministic.
 * ----------------------------------------------------------------------------
 */

require('dotenv').config();
const { Worker: BullWorker } = require('bullmq');
const { createBullConnection, redis } = require('../config/redis');
const { connectMongo } = require('../config/mongo');
const Order = require('../modules/order/order.model');
const WorkerModel = require('../modules/worker/worker.model');
const geoService = require('../modules/worker/geo.service');
const config = require('../config');
const logger = require('../utils/logger');
const { QUEUES, notificationsQueue } = require('./index');

const MAX_ATTEMPTS = 8;

async function processDispatchJob(job) {
  const { orderId, attempt = 0 } = job.data;
  logger.info({ orderId, attempt }, 'Dispatch job picked up');

  const order = await Order.findById(orderId);
  if (!order) {
    logger.warn({ orderId }, 'Order not found, dropping dispatch');
    return { ok: false, reason: 'order_not_found' };
  }
  if (!['created', 'searching'].includes(order.status)) {
    logger.info({ orderId, status: order.status }, 'Order no longer dispatchable');
    return { ok: false, reason: 'bad_status' };
  }
  if (attempt >= MAX_ATTEMPTS) {
    await markOrderFailed(order, 'no_workers_available');
    return { ok: false, reason: 'max_attempts' };
  }

  if (order.status === 'created') {
    order.status = 'searching';
    order.statusHistory.push({ status: 'searching' });
    await order.save();
    await emitToOrderRoom(order._id, 'order.status', { status: 'searching' });
  }

  const [lng, lat] = order.pickupLocation.coordinates;
  const candidates = await geoService.findCandidates({
    lng,
    lat,
    skill: order.service,
    excludeIds: order.dispatch.attemptedWorkerIds,
  });

  if (candidates.length === 0) {
    if (attempt < 3) {
      logger.info({ orderId, attempt }, 'No candidates, retrying with delay');
      await job.queue.add(
        'dispatch',
        { orderId, attempt: attempt + 1 },
        { delay: 3000 }
      );
      return { ok: false, reason: 'no_candidates_retry' };
    }
    await markOrderFailed(order, 'no_workers_in_area');
    return { ok: false, reason: 'no_candidates_final' };
  }

  const workerId = candidates[0];
  const offerExpiresAt = new Date(Date.now() + config.dispatch.offerTimeoutMs);

  order.dispatch.currentOfferWorkerId = workerId;
  order.dispatch.offerExpiresAt = offerExpiresAt;
  order.dispatch.attempts = (order.dispatch.attempts || 0) + 1;
  await order.save();

  await redis.publish(
    'worker:offer',
    JSON.stringify({
      workerId,
      order: {
        _id: String(order._id),
        service: order.service,
        pickupAddress: order.pickupLocation.address,
        pickupCoords: order.pickupLocation.coordinates,
        price: order.pricing.total,
        expiresAt: offerExpiresAt.toISOString(),
      },
    })
  );

  await notificationsQueue.add('worker_offer', {
    workerId,
    orderId: String(order._id),
  });

  const outcome = await waitForAcceptance(String(order._id), workerId, config.dispatch.offerTimeoutMs);
  // outcome is 'accept' | 'reject' | 'timeout'

  const abuseService = require('../modules/order/abuse.service');
  abuseService.recordWorkerOutcome(workerId, outcome).catch(() => {});

  if (outcome === 'accept') {
    const locked = await lockOrderToWorker(order._id, workerId);
    if (locked) {
      logger.info({ orderId, workerId }, 'Order assigned');
      await emitToOrderRoom(order._id, 'order.assigned', {
        workerId,
        orderId: String(order._id),
      });
      try {
        const notificationService = require('../modules/notification/notification.service');
        const worker = await WorkerModel.findById(workerId).select('name rating').lean();
        await notificationService.notify({
          recipient: { kind: 'user', id: order.userId },
          type: 'worker_assigned',
          title: '✅ Worker assigned!',
          body: worker
            ? `${worker.name} (⭐ ${worker.rating}) will be with you shortly`
            : 'A worker is on the way',
          deepLink: `/orders/${order._id}`,
          data: { orderId: String(order._id), workerId: String(workerId) },
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Assignment notification failed');
      }
      return { ok: true, workerId };
    }
  }

  logger.info({ orderId, workerId, outcome }, 'Offer not taken, trying next');
  await Order.updateOne(
    { _id: order._id },
    {
      $addToSet: { 'dispatch.attemptedWorkerIds': workerId },
      $set: { 'dispatch.currentOfferWorkerId': null, 'dispatch.offerExpiresAt': null },
    }
  );

  await job.queue.add('dispatch', { orderId, attempt: attempt + 1 });
  return { ok: false, reason: outcome };
}

function waitForAcceptance(orderId, expectedWorkerId, timeoutMs) {
  return new Promise((resolve) => {
    const channel = `dispatch:accepted:${orderId}`;
    const rejectChannel = `dispatch:rejected:${orderId}`;
    const sub = createBullConnection();

    const cleanup = () => {
      clearTimeout(timer);
      sub.unsubscribe().catch(() => {});
      sub.quit().catch(() => {});
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve('timeout');
    }, timeoutMs);

    sub.on('message', (ch, message) => {
      try {
        const data = JSON.parse(message);
        if (ch === channel && String(data.workerId) === String(expectedWorkerId)) {
          cleanup();
          resolve('accept');
        } else if (ch === rejectChannel && String(data.workerId) === String(expectedWorkerId)) {
          cleanup();
          resolve('reject');
        }
      } catch {
        /* ignore malformed */
      }
    });

    sub.subscribe(channel, rejectChannel).catch(() => {
      cleanup();
      resolve('timeout');
    });
  });
}

async function lockOrderToWorker(orderId, workerId) {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  try {
    let updated = null;
    await session.withTransaction(async () => {
      updated = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: { $in: ['searching', 'created'] },
          workerId: null,
        },
        {
          $set: {
            workerId,
            status: 'assigned',
            'dispatch.currentOfferWorkerId': null,
            'dispatch.offerExpiresAt': null,
          },
          $push: { statusHistory: { status: 'assigned', at: new Date(), meta: { workerId } } },
        },
        { new: true, session }
      );
      if (!updated) {
        throw Object.assign(new Error('ORDER_NOT_LOCKABLE'), { abort: true });
      }

      const workerUpd = await WorkerModel.updateOne(
        { _id: workerId, isAvailable: true, isBlocked: false },
        { $set: { isAvailable: false, currentOrderId: orderId } },
        { session }
      );
      if (workerUpd.matchedCount === 0) {
        throw Object.assign(new Error('WORKER_NOT_AVAILABLE'), { abort: true });
      }
    });

    if (!updated) return false;

    await geoService.setAvailability(workerId, false);
    return true;
  } catch (err) {
    if (err.abort) {
      logger.info({ orderId, workerId, reason: err.message }, 'Lock transaction aborted');
      return false;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function markOrderFailed(order, reason) {
  order.status = 'failed';
  order.cancellationReason = reason;
  order.statusHistory.push({ status: 'failed', meta: { reason } });
  await order.save();
  await emitToOrderRoom(order._id, 'order.failed', { reason });
}

async function emitToOrderRoom(orderId, event, payload) {
  await redis.publish(
    'order:event',
    JSON.stringify({ orderId: String(orderId), event, payload })
  );
}

async function main() {
  await connectMongo();

  const bullWorker = new BullWorker(
    QUEUES.DISPATCH,
    processDispatchJob,
    {
      connection: createBullConnection(),
      concurrency: 50,
      lockDuration: 60000,
    }
  );

  bullWorker.on('completed', (job, result) =>
    logger.info({ jobId: job.id, result }, 'Dispatch completed')
  );
  bullWorker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Dispatch failed')
  );

  logger.info('Dispatch worker started');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Dispatch worker crashed');
    process.exit(1);
  });
}

module.exports = { processDispatchJob };
