/**
 * Dispatch Worker — Progressive Radius Broadcast + Force-Assign Engine
 * ----------------------------------------------------------------------------
 * Flow:
 *   1. Transition order to 'searching'.
 *   2. Walk RADIUS_STEPS: 1 → 2 → 3 → 5 → 8 → 12 km.
 *   3. At each step, find ALL available workers in that radius (excluding
 *      already-notified ones) and broadcast 'new_job_request' simultaneously.
 *   4. Wait STEP_WINDOW_MS for any accept signal (30s default).
 *   5. First accept wins — lock with atomic Mongo transaction.
 *   6. If no accept after all steps → FORCE-ASSIGN nearest available worker.
 *   7. If force-assign fails → re-queue with delay (max MAX_RETRIES times).
 *   8. Only mark failed after all retries and force-assign attempts exhausted.
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
const { QUEUES, notificationsQueue, dispatchQueue } = require('./index');

const MAX_BATCH_SIZE = 10;
const FORCE_ASSIGN_RADIUS_KM = 25; // last-resort: search up to 25km for any worker
const MAX_RETRIES = 2;             // re-queue attempts before giving up
const RETRY_DELAY_MS = 90_000;     // 90s between retry attempts

/* ─── Main job processor ────────────────────────────────────────── */

async function processDispatchJob(job) {
  const { orderId, retryCount = 0 } = job.data;
  logger.info({ orderId, retryCount }, '[DISPATCH] Job picked up');

  const order = await Order.findById(orderId);
  if (!order) {
    logger.warn({ orderId }, '[DISPATCH] Order not found, dropping');
    return { ok: false, reason: 'order_not_found' };
  }
  if (!['created', 'searching'].includes(order.status)) {
    logger.info({ orderId, status: order.status }, '[DISPATCH] Order not dispatchable');
    return { ok: false, reason: 'bad_status' };
  }

  /* ── Transition to searching ── */
  if (order.status === 'created') {
    order.status = 'searching';
    order.statusHistory.push({ status: 'searching' });
    await order.save();
    await emitToOrderRoom(order._id, 'order.status', { status: 'searching' });
  }

  const [lng, lat] = order.pickupLocation.coordinates;
  const radiusSteps = config.dispatch.radiusSteps;
  const stepWindowMs = config.dispatch.stepWindowMs;

  const alreadyNotified = new Set(
    (order.dispatch?.attemptedWorkerIds || []).map(String)
  );

  /* ── Walk radius steps ── */
  for (let stepIdx = 0; stepIdx < radiusSteps.length; stepIdx++) {
    const radiusKm = radiusSteps[stepIdx];

    /* Keep BullMQ lock alive — ping every 60s so the lock isn't stolen */
    const keepAlive = setInterval(
      () => job.updateProgress({ step: stepIdx, alive: true }).catch(() => {}),
      60_000,
    );

    try {
      const fresh = await Order.findById(orderId).select('status').lean();
      if (!fresh || fresh.status !== 'searching') {
        logger.info({ orderId, status: fresh?.status }, '[DISPATCH] Order no longer searching, stopping');
        return { ok: false, reason: 'status_changed' };
      }

      logger.info(
        { orderId, stepIdx: stepIdx + 1, totalSteps: radiusSteps.length, radiusKm },
        `[DISPATCH] Step ${stepIdx + 1}/${radiusSteps.length} — searching ${radiusKm}km`,
      );

      const userMsg = stepIdx === 0
        ? 'Searching for nearby workers…'
        : `Expanding search to ${radiusKm}km — still looking…`;

      await emitToOrderRoom(order._id, 'order.dispatch_update', {
        message: userMsg,
        radiusKm,
        step: stepIdx + 1,
        totalSteps: radiusSteps.length,
      });

      const candidates = await geoService.findCandidates({
        lng, lat,
        skill: order.service,
        excludeIds: [...alreadyNotified],
        radiusKm,
      });

      logger.info(
        { orderId, radiusKm, found: candidates.length, alreadyNotified: alreadyNotified.size },
        `[DISPATCH] Workers found: ${candidates.length}`,
      );

      if (candidates.length === 0) {
        logger.info({ orderId, radiusKm }, '[DISPATCH] No new workers at this radius, expanding…');
        continue;
      }

      const batchWorkers = candidates.slice(0, MAX_BATCH_SIZE).map(String);
      const expiresAt = new Date(Date.now() + stepWindowMs);

      /* ── Broadcast offer to all workers in batch simultaneously ── */
      logger.info(
        { orderId, radiusKm, notifying: batchWorkers.length },
        `[DISPATCH] Notifying ${batchWorkers.length} workers`,
      );

      for (const workerId of batchWorkers) {
        alreadyNotified.add(workerId);
        redis.publish('worker:offer', JSON.stringify({
          workerId,
          order: {
            _id:           String(order._id),
            service:       order.service,
            pickupAddress: order.pickupLocation.address,
            pickupCoords:  order.pickupLocation.coordinates,
            price:         order.pricing.total,
            distanceKm:    order.pricing?.distanceKm
              ? parseFloat(order.pricing.distanceKm).toFixed(1)
              : null,
            etaMinutes:    order.pricing?.etaMinutes || null,
            expiresAt:     expiresAt.toISOString(),
          },
        })).catch(() => {});

        notificationsQueue.add('worker_offer', {
          workerId,
          orderId: String(order._id),
        }).catch(() => {});
      }

      /* ── Wait step window for any accept ── */
      const result = await waitForBatchWindow(String(order._id), batchWorkers, stepWindowMs);

      logger.info(
        {
          orderId, radiusKm,
          acceptedBy: result.acceptedBy,
          rejected:   result.rejected.length,
          ignored:    result.ignored.length,
        },
        '[DISPATCH] Step window closed',
      );

      if (result.acceptedBy) {
        const locked = await lockOrderToWorker(order._id, result.acceptedBy);
        if (locked) {
          logger.info({ orderId, workerId: result.acceptedBy }, '[DISPATCH] ✅ Order assigned via accept');
          await onOrderAssigned(order, result.acceptedBy, [...result.rejected, ...result.ignored]);
          recordOutcomes(result.acceptedBy, 'accept', result.rejected, result.ignored);
          return { ok: true, workerId: result.acceptedBy };
        }
        logger.warn({ orderId, workerId: result.acceptedBy }, '[DISPATCH] Lock failed after accept, continuing');
      }

      recordOutcomes(null, null, result.rejected, result.ignored);
      await Order.updateOne(
        { _id: order._id },
        { $addToSet: { 'dispatch.attemptedWorkerIds': { $each: batchWorkers } } },
      );
    } finally {
      clearInterval(keepAlive);
    }
  }

  /* ── All voluntary radius steps exhausted — FORCE-ASSIGN nearest ── */
  logger.info({ orderId }, '[DISPATCH] All voluntary steps exhausted — attempting force-assign');
  await emitToOrderRoom(order._id, 'order.dispatch_update', {
    message: 'Assigning the nearest available worker…',
  });

  const forceResult = await attemptForceAssign(order, FORCE_ASSIGN_RADIUS_KM);
  if (forceResult.ok) {
    logger.info({ orderId, workerId: forceResult.workerId }, '[DISPATCH] ✅ Force-assigned');
    return forceResult;
  }

  /* ── Retry dispatch if under limit ── */
  if (retryCount < MAX_RETRIES) {
    const nextRetry = retryCount + 1;
    logger.info({ orderId, nextRetry }, '[DISPATCH] No workers found — scheduling retry');

    await dispatchQueue.add(
      'dispatch',
      { orderId: String(order._id), retryCount: nextRetry, attempt: nextRetry },
      {
        jobId: `order_${order._id}_retry_${nextRetry}`,
        delay: RETRY_DELAY_MS,
        priority: 1, // high priority retry
      },
    );

    await emitToOrderRoom(order._id, 'order.dispatch_update', {
      message: 'No workers nearby right now — retrying in 90 seconds…',
    });

    return { ok: false, reason: 'retrying', retryCount: nextRetry };
  }

  /* ── Truly no workers after all retries ── */
  logger.info({ orderId }, '[DISPATCH] All attempts exhausted — marking failed');
  const finalOrder = await Order.findById(orderId);
  if (finalOrder && finalOrder.status === 'searching') {
    await markOrderFailed(finalOrder, 'no_workers_available');
  }
  return { ok: false, reason: 'all_attempts_exhausted' };
}

/* ─── Force-assign: bypass accept, lock directly to nearest worker ─ */

async function attemptForceAssign(order, radiusKm) {
  const orderId = String(order._id);
  const [lng, lat] = order.pickupLocation.coordinates;

  // Try with skill filter first, then without as absolute last resort
  const searchVariants = [
    { skill: order.service, radiusKm, label: 'skilled' },
    { skill: null,          radiusKm, label: 'any-skill' },
  ];

  for (const { skill, radiusKm: r, label } of searchVariants) {
    const candidates = await geoService.findCandidates({
      lng, lat,
      skill: skill || order.service,
      excludeIds: [],
      radiusKm: r,
      skipSkillFilter: !skill,
    });

    logger.info({ orderId, label, found: candidates.length }, '[DISPATCH] Force-assign candidates');

    for (const workerId of candidates.slice(0, 5)) {
      const locked = await lockOrderToWorker(order._id, workerId);
      if (locked) {
        await onForceAssigned(order, workerId);
        return { ok: true, workerId, forceAssigned: true };
      }
    }
  }

  return { ok: false, reason: 'no_lockable_workers' };
}

/* ─── Shared post-assignment actions ────────────────────────────── */

async function onOrderAssigned(order, workerId, losers = []) {
  const orderId = String(order._id);

  await emitToOrderRoom(order._id, 'order.assigned', { workerId, orderId });

  /* Cancel offers for workers who lost the race */
  for (const wId of losers) {
    redis.publish('worker:offer_cancel', JSON.stringify({
      workerId: wId,
      orderId,
    })).catch(() => {});
  }

  /* Notify user */
  try {
    const notificationService = require('../modules/notification/notification.service');
    const worker = await WorkerModel.findById(workerId).select('name rating').lean();
    await notificationService.notify({
      recipient: { kind: 'user', id: order.userId },
      type:      'worker_assigned',
      title:     '✅ Worker assigned!',
      body:      worker
        ? `${worker.name} (⭐ ${worker.rating?.toFixed(1) ?? '5.0'}) is on the way`
        : 'A worker is on the way',
      deepLink: `/orders/${orderId}`,
      data:     { orderId, workerId },
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[DISPATCH] Assignment user notification failed');
  }
}

async function onForceAssigned(order, workerId) {
  const orderId = String(order._id);

  await emitToOrderRoom(order._id, 'order.assigned', { workerId, orderId });

  /* Push `job.assigned` to the worker's own socket room */
  await redis.publish('worker:assigned', JSON.stringify({
    workerId,
    orderId,
    service:       order.service,
    pickupAddress: order.pickupLocation.address,
    price:         order.pricing.total,
  })).catch(() => {});

  /* Notify both sides */
  try {
    const notificationService = require('../modules/notification/notification.service');
    const worker = await WorkerModel.findById(workerId).select('name rating').lean();

    await Promise.all([
      notificationService.notify({
        recipient: { kind: 'user', id: order.userId },
        type:  'worker_assigned',
        title: '✅ Worker assigned!',
        body:  worker ? `${worker.name} is on the way` : 'A worker is on the way',
        deepLink: `/orders/${orderId}`,
        data: { orderId, workerId },
      }),
      notificationService.notify({
        recipient: { kind: 'worker', id: workerId },
        type:  'job_assigned',
        title: '🚀 New job assigned to you!',
        body:  `${order.service.replace(/_/g, ' ')} — ₹${order.pricing.total}`,
        deepLink: `/worker/jobs/${orderId}`,
        data: { orderId },
      }),
    ]);
  } catch (err) {
    logger.warn({ err: err.message }, '[DISPATCH] Force-assign notifications failed');
  }
}

/* ─── Wait for any worker in the batch to accept within the window ─ */

function waitForBatchWindow(orderId, workerIds, windowMs) {
  return new Promise((resolve) => {
    const acceptCh = `dispatch:accepted:${orderId}`;
    const rejectCh = `dispatch:rejected:${orderId}`;
    const sub = createBullConnection();

    const remaining = new Set(workerIds.map(String));
    const rejected  = [];

    const cleanup = () => {
      clearTimeout(timer);
      sub.unsubscribe(acceptCh, rejectCh).catch(() => {});
      sub.quit().catch(() => {});
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({ acceptedBy: null, rejected, ignored: [...remaining] });
    }, windowMs);

    sub.on('message', (ch, raw) => {
      try {
        const data = JSON.parse(raw);
        const wId  = String(data.workerId);
        if (!remaining.has(wId)) return;

        if (ch === acceptCh) {
          cleanup();
          remaining.delete(wId);
          resolve({ acceptedBy: wId, rejected, ignored: [...remaining] });
        } else if (ch === rejectCh) {
          remaining.delete(wId);
          rejected.push(wId);
          if (remaining.size === 0) {
            cleanup();
            resolve({ acceptedBy: null, rejected, ignored: [] });
          }
        }
      } catch { /* ignore */ }
    });

    sub.subscribe(acceptCh, rejectCh).catch(() => {
      cleanup();
      resolve({ acceptedBy: null, rejected: [], ignored: [...workerIds] });
    });
  });
}

/* ─── Atomic order + worker lock ───────────────────────────────── */

async function lockOrderToWorker(orderId, workerId) {
  const mongoose = require('mongoose');
  const session  = await mongoose.startSession();
  try {
    let updated = null;
    await session.withTransaction(async () => {
      updated = await Order.findOneAndUpdate(
        { _id: orderId, status: { $in: ['searching', 'created'] }, workerId: null },
        {
          $set: {
            workerId,
            status: 'assigned',
            'dispatch.currentOfferWorkerId': null,
            'dispatch.offerExpiresAt': null,
          },
          $push: { statusHistory: { status: 'assigned', at: new Date(), meta: { workerId } } },
        },
        { new: true, session },
      );
      if (!updated) throw Object.assign(new Error('ORDER_NOT_LOCKABLE'), { abort: true });

      const upd = await WorkerModel.updateOne(
        { _id: workerId, isAvailable: true, isBlocked: false },
        { $set: { isAvailable: false, currentOrderId: orderId } },
        { session },
      );
      if (upd.matchedCount === 0) throw Object.assign(new Error('WORKER_NOT_AVAILABLE'), { abort: true });
    });

    if (!updated) return false;
    await geoService.setAvailability(workerId, false);
    return true;
  } catch (err) {
    if (err.abort) {
      logger.info({ orderId, workerId, reason: err.message }, '[DISPATCH] Lock aborted');
      return false;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

/* ─── Record abuse-service outcomes (fire-and-forget) ──────────── */

function recordOutcomes(acceptedBy, acceptOutcome, rejected, ignored) {
  const abuseService = require('../modules/order/abuse.service');
  if (acceptedBy && acceptOutcome) {
    abuseService.recordWorkerOutcome(acceptedBy, acceptOutcome).catch(() => {});
  }
  for (const wId of rejected) {
    abuseService.recordWorkerOutcome(wId, 'reject').catch(() => {});
  }
  for (const wId of ignored) {
    abuseService.recordWorkerOutcome(wId, 'timeout').catch(() => {});
  }
}

/* ─── Helpers ───────────────────────────────────────────────────── */

async function markOrderFailed(order, reason) {
  order.status = 'failed';
  order.cancellationReason = reason;
  order.statusHistory.push({ status: 'failed', meta: { reason } });
  await order.save();
  await emitToOrderRoom(order._id, 'order.failed', { reason });
  logger.info({ orderId: order._id, reason }, '[DISPATCH] Order marked failed');
}

async function emitToOrderRoom(orderId, event, payload) {
  await redis.publish('order:event', JSON.stringify({
    orderId: String(orderId),
    event,
    payload,
  }));
}

/* ─── BullMQ worker bootstrap ───────────────────────────────────── */

async function main() {
  await connectMongo();

  const bullWorker = new BullWorker(
    QUEUES.DISPATCH,
    processDispatchJob,
    {
      connection:   createBullConnection(),
      concurrency:  50,
      lockDuration: 300_000, // 5 min — keepAlive extends it every 60s
    },
  );

  bullWorker.on('completed', (job, result) =>
    logger.info({ jobId: job.id, result }, '[DISPATCH] Job completed'),
  );
  bullWorker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, '[DISPATCH] Job failed'),
  );
  bullWorker.on('error', (err) =>
    logger.error({ err: err.message }, '[DISPATCH] Worker error'),
  );

  logger.info('[DISPATCH] Progressive radius + force-assign worker started');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, '[DISPATCH] Worker crashed');
    process.exit(1);
  });
}

module.exports = { processDispatchJob };
