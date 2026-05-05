/**
 * Dispatch Worker — Progressive Radius Broadcast Engine
 * ----------------------------------------------------------------------------
 * Flow:
 *   1. Transition order to 'searching'.
 *   2. Walk RADIUS_STEPS: 0.1 → 0.3 → 0.7 → 1.5 → 3 → 5 km.
 *   3. At each step, find ALL available workers in that radius (excluding
 *      already-notified ones) and broadcast 'new_job_request' to all of them
 *      simultaneously.
 *   4. Wait STEP_WINDOW_MS for any accept signal.
 *   5. First accept wins — lock with atomic Mongo transaction.
 *   6. If no accept: record all batch workers as attempted, expand radius.
 *   7. Only fail the order after all radius steps are exhausted.
 *
 * Never rejects an order early — keeps searching until max radius reached.
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

const MAX_BATCH_SIZE = 10; // max workers notified per radius step

async function processDispatchJob(job) {
  const { orderId } = job.data;
  logger.info({ orderId }, '[DISPATCH] Job picked up');

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

  /* Workers already notified across all steps — never re-notify */
  const alreadyNotified = new Set(
    (order.dispatch?.attemptedWorkerIds || []).map(String)
  );

  /* ── Walk radius steps ── */
  for (let stepIdx = 0; stepIdx < radiusSteps.length; stepIdx++) {
    const radiusKm = radiusSteps[stepIdx];

    /* Re-check order status — may have been accepted by a concurrent step
       or cancelled externally */
    const fresh = await Order.findById(orderId).select('status').lean();
    if (!fresh || fresh.status !== 'searching') {
      logger.info({ orderId, status: fresh?.status }, '[DISPATCH] Order no longer searching, stopping');
      return { ok: false, reason: 'status_changed' };
    }

    logger.info(
      { orderId, stepIdx: stepIdx + 1, totalSteps: radiusSteps.length, radiusKm },
      `[DISPATCH] Step ${stepIdx + 1}/${radiusSteps.length} — searching ${radiusKm}km`
    );

    const candidates = await geoService.findCandidates({
      lng, lat,
      skill: order.service,
      excludeIds: [...alreadyNotified],
      radiusKm,
    });

    logger.info(
      { orderId, radiusKm, found: candidates.length, alreadyNotified: alreadyNotified.size },
      `[DISPATCH] Workers found: ${candidates.length}`
    );

    if (candidates.length === 0) {
      logger.info({ orderId, radiusKm }, '[DISPATCH] No new workers at this radius, expanding…');
      if (stepIdx > 0) {
        await emitToOrderRoom(order._id, 'order.dispatch_update', {
          message: `Expanding search area to ${radiusKm > 1 ? `${radiusKm}km` : `${radiusKm * 1000}m`}…`,
          radiusKm,
        });
      }
      continue;
    }

    const batchWorkers = candidates.slice(0, MAX_BATCH_SIZE).map(String);
    const expiresAt = new Date(Date.now() + stepWindowMs);

    /* ── User status message ── */
    const userMsg = stepIdx === 0
      ? 'Searching nearby helpers…'
      : `Expanding search area to ${radiusKm > 1 ? `${radiusKm}km` : `${radiusKm * 1000}m`}…`;
    await emitToOrderRoom(order._id, 'order.dispatch_update', {
      message: userMsg,
      radiusKm,
    });

    /* ── Broadcast to all workers in batch ── */
    logger.info(
      { orderId, radiusKm, notifying: batchWorkers.length, workers: batchWorkers },
      `[DISPATCH] Notifying ${batchWorkers.length} workers`
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

    /* ── Wait for any accept in this window ── */
    const result = await waitForBatchWindow(String(order._id), batchWorkers, stepWindowMs);

    logger.info(
      {
        orderId, radiusKm,
        acceptedBy:  result.acceptedBy,
        rejected:    result.rejected.length,
        ignored:     result.ignored.length,
      },
      '[DISPATCH] Step window closed'
    );

    /* ── Handle accept ── */
    if (result.acceptedBy) {
      const locked = await lockOrderToWorker(order._id, result.acceptedBy);
      if (locked) {
        logger.info({ orderId, workerId: result.acceptedBy }, '[DISPATCH] ✅ Order assigned');
        await emitToOrderRoom(order._id, 'order.assigned', {
          workerId: result.acceptedBy,
          orderId:  String(order._id),
        });

        /* Notify user */
        try {
          const notificationService = require('../modules/notification/notification.service');
          const worker = await WorkerModel.findById(result.acceptedBy).select('name rating').lean();
          await notificationService.notify({
            recipient: { kind: 'user', id: order.userId },
            type:      'worker_assigned',
            title:     '✅ Worker assigned!',
            body:      worker
              ? `${worker.name} (⭐ ${worker.rating}) will be with you shortly`
              : 'A worker is on the way',
            deepLink: `/orders/${order._id}`,
            data:     { orderId: String(order._id), workerId: result.acceptedBy },
          });
        } catch (err) {
          logger.warn({ err: err.message }, '[DISPATCH] Assignment notification failed');
        }

        /* Cancel offer for all other workers in the batch */
        const losers = [...result.rejected, ...result.ignored];
        for (const wId of losers) {
          redis.publish('worker:offer_cancel', JSON.stringify({
            workerId: wId,
            orderId:  String(order._id),
          })).catch(() => {});
        }
        if (losers.length) {
          logger.info({ orderId, losers: losers.length }, '[DISPATCH] Cancelled offer for non-winning workers');
        }

        /* Record outcomes */
        recordOutcomes(result.acceptedBy, 'accept', result.rejected, result.ignored);
        return { ok: true, workerId: result.acceptedBy };
      }

      /* Lock failed (race) — fall through and continue to next step */
      logger.warn({ orderId, workerId: result.acceptedBy }, '[DISPATCH] Lock failed after accept, continuing');
    }

    /* Record outcomes for this batch */
    recordOutcomes(null, null, result.rejected, result.ignored);

    /* Mark entire batch as attempted so they're skipped in future steps */
    await Order.updateOne(
      { _id: order._id },
      { $addToSet: { 'dispatch.attemptedWorkerIds': { $each: batchWorkers } } }
    );
  }

  /* ── All radius steps exhausted ── */
  logger.info({ orderId }, '[DISPATCH] All radius steps exhausted — no workers found');
  const finalOrder = await Order.findById(orderId);
  if (finalOrder && finalOrder.status === 'searching') {
    await markOrderFailed(finalOrder, 'no_workers_available');
  }
  return { ok: false, reason: 'all_radii_exhausted' };
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
        if (!remaining.has(wId)) return;  // not our batch

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
        { new: true, session }
      );
      if (!updated) throw Object.assign(new Error('ORDER_NOT_LOCKABLE'), { abort: true });

      const upd = await WorkerModel.updateOne(
        { _id: workerId, isAvailable: true, isBlocked: false },
        { $set: { isAvailable: false, currentOrderId: orderId } },
        { session }
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
  await redis.publish('order:event', JSON.stringify({ orderId: String(orderId), event, payload }));
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
      lockDuration: 120000, // raised: each job now runs up to ~72s (6 steps × 12s)
    }
  );

  bullWorker.on('completed', (job, result) =>
    logger.info({ jobId: job.id, result }, '[DISPATCH] Job completed')
  );
  bullWorker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, '[DISPATCH] Job failed')
  );

  logger.info('[DISPATCH] Progressive radius worker started');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, '[DISPATCH] Worker crashed');
    process.exit(1);
  });
}

module.exports = { processDispatchJob };
