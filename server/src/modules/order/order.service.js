const crypto = require('crypto');
const orderRepo = require('./order.repository');
const pricingService = require('../pricing/pricing.service');
const geoService = require('../worker/geo.service');
const abuseService = require('./abuse.service');
const ledgerService = require('../wallet/ledger.service');
const Worker = require('../worker/worker.model');
const { dispatchQueue } = require('../../jobs');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

/**
 * Create a new service request.
 * 1. Abuse checks (rate cap, freeze from prior rapid-cancels).
 * 2. Reject if user has an active order (one-at-a-time semantic).
 * 3. Compute pricing snapshot and lock it.
 * 4. Generate 4-digit OTP for on-site worker verification.
 * 5. Enqueue dispatch — the dispatcher takes it from here.
 */
async function createOrder({ userId, service, subCategory, pickupLocation, dropLocation, description, images, scheduledAt, paymentMethod, priority }) {
  // Abuse gate FIRST — cheap Redis checks before any Mongo writes.
  await abuseService.assertCanBook(userId);

  const active = await orderRepo.findActiveByUser(userId);
  if (active) {
    await abuseService.releaseBookingSlot(userId); // don't count this as a booking
    throw Object.assign(new Error('You already have an active order'), { status: 409, code: 'ORDER_ACTIVE_EXISTS', activeOrderId: active._id });
  }

  const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
  // For services without a drop, use pickup as both endpoints (home service model).
  const dest = dropLocation
    ? { lat: dropLocation.lat, lng: dropLocation.lng }
    : { lat: pickupLocation.lat + 0.01, lng: pickupLocation.lng }; // nominal distance for fare floor

  let pricing = await pricingService.quote({ origin, dest, service, userId });

  // Emergency mode — 1.5× surcharge + dispatch priority flag
  const isEmergency = priority === 'emergency';
  if (isEmergency) {
    const emergencyService = require('./emergency.service');
    pricing = emergencyService.applyEmergencySurcharge(pricing);
  }

  // Record demand for surge calculation.
  await pricingService.recordDemand(origin.lat, origin.lng);

  const otp = crypto.randomInt(1000, 9999).toString();

  const order = await orderRepo.create({
    userId,
    service,
    subCategory: subCategory || undefined,
    description,
    images: images || [],
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    priority: isEmergency ? 'emergency' : 'normal',
    pickupLocation: {
      type: 'Point',
      coordinates: [pickupLocation.lng, pickupLocation.lat],
      address: pickupLocation.address,
      landmark: pickupLocation.landmark,
      flatNumber: pickupLocation.flatNumber,
      notes: pickupLocation.notes,
    },
    dropLocation: dropLocation
      ? {
          type: 'Point',
          coordinates: [dropLocation.lng, dropLocation.lat],
          address: dropLocation.address,
        }
      : undefined,
    pricing,
    status: 'created',
    statusHistory: [{ status: 'created' }],
    payment: { method: paymentMethod || 'upi', status: 'pending' },
    otp,
  });

  // Enqueue dispatch with optional delay for scheduled orders.
  const schedDelay = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;
  await dispatchQueue.add(
    'dispatch',
    { orderId: String(order._id), attempt: 0 },
    {
      jobId: `order:${order._id}`,
      priority: isEmergency ? 1 : 10,
      delay: schedDelay,
    }
  );

  logger.info({ orderId: order._id, service, userId, priority: order.priority }, 'Order created and dispatch enqueued');

  // Notify user: order placed
  const notificationService = require('../notification/notification.service');
  const notifyBody = scheduledAt
    ? `Your ${service.replace('_', ' ')} is scheduled for ${new Date(scheduledAt).toLocaleString('en-IN')}`
    : `Your ${service.replace('_', ' ')} request is being matched`;
  notificationService.notify({
    recipient: { kind: 'user', id: userId },
    type: 'order_placed',
    title: scheduledAt ? 'Booking scheduled' : 'Finding a nearby worker',
    body: notifyBody,
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  return order;
}

/**
 * Worker accepts a broadcast offer.
 * Broadcast model: all workers in the current radius batch receive the offer
 * simultaneously. Any of them can signal accept — dispatch process locks the
 * first one atomically. No per-worker offer address check needed here.
 */
async function acceptOffer({ orderId, workerId }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status !== 'searching') {
    throw Object.assign(new Error('Offer no longer available'), { status: 410 });
  }
  // Signal the dispatch worker — it owns the atomic lock (first accept wins).
  await redis.publish(
    `dispatch:accepted:${orderId}`,
    JSON.stringify({ workerId, at: new Date().toISOString() })
  );
  return { ok: true };
}

async function rejectOffer({ orderId, workerId }) {
  const order = await orderRepo.findById(orderId);
  if (!order) return { ok: true };
  if (order.status !== 'searching') return { ok: true };
  await redis.publish(
    `dispatch:rejected:${orderId}`,
    JSON.stringify({ workerId })
  );
  return { ok: true };
}

/**
 * Worker transitions: assigned → on_the_way → arrived → in_progress → completed.
 * Each transition is guarded by the current status to prevent races.
 */
async function workerStartTrip({ orderId, workerId }) {
  const order = await guardedTransition(orderId, workerId, ['assigned'], 'on_the_way');
  // Cache pickup coords so ETA service can compute without a Mongo hit
  if (order?.pickupLocation?.coordinates) {
    const [lng, lat] = order.pickupLocation.coordinates;
    const etaService = require('../worker/eta.service');
    etaService.cacheOrderPickup(String(order._id), lat, lng).catch(() => {});
  }
  return order;
}

async function workerArrive({ orderId, workerId }) {
  return guardedTransition(orderId, workerId, ['on_the_way'], 'arrived');
}

async function workerStartService({ orderId, workerId, otp }) {
  const order = await orderRepo.findById(orderId).select('+otp');
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (order.status !== 'arrived') {
    throw Object.assign(new Error(`Cannot start from ${order.status}`), { status: 409 });
  }
  if (order.otp !== otp) {
    throw Object.assign(new Error('Invalid OTP'), { status: 401 });
  }
  return guardedTransition(orderId, workerId, ['arrived'], 'in_progress');
}

async function workerComplete({ orderId, workerId }) {
  const order = await guardedTransition(
    orderId,
    workerId,
    ['in_progress', 'arrived'],
    'completed',
    { completedAt: new Date() }
  );

  // --- Earnings: Pro-aware commission split ---
  const totalPaise = order.pricing.total * 100;
  const earnings = await pricingService.calculateEarnings({ totalPaise, workerId });

  const walletService = require('../wallet/wallet.service');
  const Transaction = require('../payment/transaction.model');

  const paymentMethod = order.payment?.method || 'upi';
  const isCash = paymentMethod === 'cash';

  // ============================================================
  // ONLINE (UPI/card): user paid platform, platform credits worker
  //   - user side: charge was already captured (or will be via webhook)
  //   - worker gets ₹(total - commission) credited
  //   - platform books commission revenue
  //
  //   If the wallet is negative (existing dues), the credit naturally
  //   clears dues first because it's summed into the balance. Example:
  //     balance = -300, earning = 700 → new balance = 400
  //   No special code needed — that's how integer math works.
  //
  // CASH: user paid worker directly in cash, worker keeps full amount
  //   - worker's pocket: +total (not tracked in our system)
  //   - platform commission must be RECOVERED from wallet
  //   - worker wallet: DEBITED by commission (may go negative)
  //   - platform books commission revenue (same as online)
  // ============================================================

  // Persist earnings split on the order for analytics/audit.
  await orderRepo.model().findByIdAndUpdate(order._id, {  // eslint-disable-line
    $set: {
      earnings: {
        workerPaise:    earnings.workerPaise,
        platformPaise:  earnings.platformPaise,
        commissionRate: earnings.commissionRate,
        settledAt:      new Date(),
      },
    },
  });

  if (isCash) {
    // Record the fact that worker collected cash (information ledger row,
    // no balance movement on our side — money is already in their pocket).
    await Transaction.create({
      type: 'credit',
      owner: { kind: 'worker', id: workerId },
      amountPaise: 0, // informational — 0 balance effect
      reason: Transaction.REASONS.WORKER_EARNING,
      refOrderId: order._id,
      idempotencyKey: `cashrecord:${order._id}`,
      description: `Cash collected from customer: ₹${Math.round(totalPaise / 100)}`,
      metadata: { fullOrderPaise: totalPaise, paymentMethod: 'cash' },
      status: 'succeeded',
    }).catch((e) => { if (e.code !== 11000) throw e; });

    // DEBIT commission from worker wallet — may push it negative.
    // If they exceed hard limit the debit throws; we still mark the order
    // complete and record the attempted debit in the audit trail so admin
    // can reconcile. In practice hard-limit workers won't be dispatched
    // (matcher filter + goOnline guard), so this is a defensive path.
    try {
      await walletService.apply({
        kind: 'worker',
        id: workerId,
        type: 'debit',
        amountPaise: earnings.platformPaise,
        reason: Transaction.REASONS.PLATFORM_COMMISSION,
        idempotencyKey: `commission:${order._id}`,
        refs: { orderId: order._id },
        description: `Commission @ ${(earnings.commissionRate * 100).toFixed(1)}% on cash order`,
      });
    } catch (err) {
      if (err.code === 'WALLET_HARD_LIMIT') {
        // Edge case — log and continue. Admin can pursue recovery.
        logger.error(
          { workerId, orderId, hardLimitBreach: true },
          'Cash commission debit blocked by hard limit — order completed but commission unrecovered'
        );
      } else {
        throw err;
      }
    }

    // Soft-limit warning — if balance just crossed -₹200, notify the worker.
    const duesService = require('../worker/worker-dues.service');
    duesService.getDuesStatus(workerId).then((dues) => {
      if (dues.status === 'warning' || dues.status === 'blocked') {
        const notificationService = require('../notification/notification.service');
        notificationService.notify({
          recipient: { kind: 'worker', id: workerId },
          type: 'wallet_credited',
          title: dues.status === 'blocked' ? '🚫 Wallet blocked — add funds now' : '⚠️ Low wallet balance',
          body: dues.status === 'blocked'
            ? `Your dues (₹${dues.duesPaise / 100}) exceed the limit. Top up to continue working.`
            : `Your wallet balance is ₹${dues.balancePaise / 100}. Add funds to avoid being blocked.`,
          deepLink: '/wallet',
          data: { duesPaise: dues.duesPaise, status: dues.status },
        }).catch(() => {});
      }
    }).catch(() => {});
    // Mark the order payment status appropriately
    order.payment.status = 'paid';
    order.payment.paidAt = new Date();
    order.payment.transactionId = `cash:${order._id}`;
    await order.save();
  } else {
    // ONLINE flow — credit the worker; ledger row naturally clears any dues.
    await walletService.apply({
      kind: 'worker',
      id: workerId,
      type: 'credit',
      amountPaise: earnings.workerPaise,
      reason: Transaction.REASONS.WORKER_EARNING,
      idempotencyKey: `earning:${order._id}`,
      refs: { orderId: order._id },
      description: `Earning for ${order.service} order`,
    });
  }

  // Platform commission revenue — booked once regardless of payment method.
  await Transaction.create({
    type: 'credit',
    owner: { kind: 'platform', id: null },
    amountPaise: earnings.platformPaise,
    reason: Transaction.REASONS.PLATFORM_COMMISSION,
    refOrderId: order._id,
    idempotencyKey: `platform:commission:${order._id}`,
    description: `Commission @ ${(earnings.commissionRate * 100).toFixed(1)}% (${paymentMethod})`,
  }).catch((e) => { if (e.code !== 11000) throw e; });

  // Release the worker (denormalized counters)
  await Worker.updateOne(
    { _id: workerId },
    {
      $set: { isAvailable: true, currentOrderId: null },
      $inc: {
        totalJobs: 1,
        completedJobs: 1,
        'wallet.totalEarnings': Math.round(earnings.workerPaise / 100),
      },
    }
  );
  await geoService.setAvailability(workerId, true);

  // Incentive milestone check — best-effort, needs updated count
  const incentiveService = require('../worker/incentive.service');
  Worker.findById(workerId).select('completedJobs').lean().then((w) => {
    if (!w) return;
    return incentiveService.onJobCompleted({ workerId, completedJobs: w.completedJobs });
  }).catch((err) =>
    logger.error({ err: err.message, orderId: order._id }, 'Incentive check failed')
  );

  // --- Post-completion side-effects (best-effort, non-blocking) ---
  const cashbackService = require('../wallet/cashback.service');
  const referralService = require('../referral/referral.service');
  const notificationService = require('../notification/notification.service');

  // Cashback to user
  cashbackService.applyForOrder(order).catch((err) =>
    logger.error({ err: err.message, orderId: order._id }, 'Cashback failed')
  );

  // Referral reward (if this was the referee's first completed order)
  referralService.onRefereeFirstOrder({
    refereeKind: 'user',
    refereeId: order.userId,
    orderId: order._id,
  }).catch((err) =>
    logger.error({ err: err.message, orderId: order._id }, 'Referral check failed')
  );

  // Notifications — both parties
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_completed',
    title: '🎉 Service completed',
    body: `Your ${order.service.replace('_', ' ')} order is done. Tap to rate.`,
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  notificationService.notify({
    recipient: { kind: 'worker', id: workerId },
    type: 'order_completed',
    title: '✅ Job completed',
    body: `₹${Math.round(earnings.workerPaise / 100)} credited to your wallet`,
    deepLink: '/wallet',
  }).catch(() => {});

  return order;
}

async function guardedTransition(orderId, workerId, allowedFrom, toStatus, extra = {}) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  const updated = await orderRepo.transitionStatus(orderId, allowedFrom, toStatus, extra);
  if (!updated) {
    throw Object.assign(new Error(`Invalid transition from ${order.status} to ${toStatus}`), { status: 409 });
  }

  // Broadcast to order room for real-time UI updates.
  await redis.publish(
    'order:event',
    JSON.stringify({
      orderId: String(orderId),
      event: 'order.status',
      payload: { status: toStatus, at: new Date().toISOString() },
    })
  );

  // Per-status push notifications to the user (the worker sees status in-app)
  const notificationService = require('../notification/notification.service');
  const notifMap = {
    on_the_way: {
      type: 'worker_on_the_way',
      title: '🛵 Worker is on the way',
      body: 'Your worker has started the trip',
    },
    arrived: {
      type: 'worker_arrived',
      title: '📍 Worker has arrived',
      body: 'Share your 4-digit OTP to start the service',
    },
  };
  const n = notifMap[toStatus];
  if (n) {
    notificationService.notify({
      recipient: { kind: 'user', id: updated.userId },
      type: n.type,
      title: n.title,
      body: n.body,
      deepLink: `/orders/${updated._id}`,
      data: { orderId: String(updated._id) },
    }).catch(() => {});
  }

  return updated;
}

async function cancelByUser({ orderId, userId, reason }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.userId) !== String(userId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  // Users can only cancel before service actually starts.
  if (!['created', 'searching', 'assigned', 'on_the_way'].includes(order.status)) {
    throw Object.assign(new Error('Too late to cancel'), { status: 409 });
  }

  // Cancellation fee policy
  const cancellationService = require('./cancellation.service');
  const { feePaise, reason: feeReason } = await cancellationService.calculateUserCancelFee(order);

  if (feePaise > 0) {
    // Try to debit user wallet — may fail if insufficient. Either way, the
    // cancellation proceeds; an unpaid fee is recorded as a pending obligation
    // (a follow-up booking attempt would be blocked by abuse.assertCanBook
    // if we extended it; here we just record).
    const walletService = require('../wallet/wallet.service');
    const Transaction = require('../payment/transaction.model');
    try {
      await walletService.apply({
        kind: 'user',
        id: userId,
        type: 'debit',
        amountPaise: feePaise,
        reason: Transaction.REASONS.ADMIN_ADJUSTMENT_DEBIT,
        idempotencyKey: `cancelfee:${orderId}`,
        refs: { orderId },
        description: `Cancellation fee — ${feeReason}`,
      });
      // Credit the worker partially as compensation if they were already on the way
      if (order.workerId && order.status === 'on_the_way') {
        const workerCompensation = Math.round(feePaise * 0.5); // 50% goes to worker
        await walletService.apply({
          kind: 'worker',
          id: order.workerId,
          type: 'credit',
          amountPaise: workerCompensation,
          reason: Transaction.REASONS.WORKER_EARNING,
          idempotencyKey: `cancelcomp:${orderId}`,
          refs: { orderId },
          description: 'Compensation — user cancelled while you were on the way',
        });
      }
    } catch (err) {
      // Insufficient funds — log but allow cancellation
      logger.warn({ orderId, userId, feePaise, err: err.message }, 'Cancellation fee not collected');
    }
  }

  const updated = await orderRepo.transitionStatus(
    orderId,
    ['created', 'searching', 'assigned', 'on_the_way'],
    'cancelled',
    { cancelledAt: new Date(), cancellationReason: reason || 'user_cancelled' }
  );

  // Free the worker if one was assigned.
  if (updated.workerId) {
    await Worker.updateOne(
      { _id: updated.workerId },
      { $set: { isAvailable: true, currentOrderId: null } }
    );
    await geoService.setAvailability(updated.workerId, true);

    // Cancellation AFTER assignment burns a strike — protects workers from
    // being dispatched to bad-faith users who book and cancel repeatedly.
    const hadWorker = ['assigned', 'on_the_way'].includes(order.status);
    if (hadWorker) {
      await abuseService.recordCancelAfterAssignment(userId);
    }
  }

  // If a pre-charge exists (UPI/card), write the refund row.
  if (order.payment?.status === 'paid') {
    ledgerService.recordRefund(updated, reason).catch((err) =>
      logger.error({ err: err.message, orderId }, 'Refund ledger write failed')
    );
  }

  // Remove the dispatch job if still pending.
  const job = await dispatchQueue.getJob(`order:${orderId}`);
  if (job) await job.remove().catch(() => {});

  await redis.publish(
    'order:event',
    JSON.stringify({
      orderId: String(orderId),
      event: 'order.cancelled',
      payload: { reason: reason || 'user_cancelled' },
    })
  );

  return updated;
}

/**
 * Worker-initiated cancellation.
 * Allowed from: assigned, on_the_way, arrived.
 * Penalty: base or late (on_the_way/arrived = base × multiplier), debited from worker wallet.
 * Re-dispatches if the order was still assignable, otherwise marks it failed.
 */
async function workerCancel({ orderId, workerId, reason }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (!['assigned', 'on_the_way', 'arrived'].includes(order.status)) {
    throw Object.assign(new Error(`Cannot cancel from status: ${order.status}`), { status: 409 });
  }

  const cancellationService = require('./cancellation.service');
  const { penaltyPaise, reason: penaltyReason, isLate } = await cancellationService.calculateWorkerCancelPenalty(order);

  const walletService = require('../wallet/wallet.service');
  const Transaction = require('../payment/transaction.model');

  // Debit penalty from worker wallet (best-effort — cancellation proceeds regardless)
  if (penaltyPaise > 0) {
    try {
      await walletService.apply({
        kind: 'worker',
        id: workerId,
        type: 'debit',
        amountPaise: penaltyPaise,
        reason: Transaction.REASONS.ADMIN_ADJUSTMENT_DEBIT,
        idempotencyKey: `workercancel:${orderId}`,
        refs: { orderId },
        description: `Worker cancellation penalty — ${penaltyReason}`,
      });
    } catch (err) {
      if (err.code !== 'WALLET_HARD_LIMIT') throw err;
      logger.error({ workerId, orderId }, 'Worker cancel penalty blocked by hard limit — proceeding anyway');
    }
  }

  // Increment persistent cancel counter
  await Worker.updateOne(
    { _id: workerId },
    {
      $set: { isAvailable: true, currentOrderId: null, 'penalties.lastPenaltyAt': new Date() },
      $inc: { 'penalties.totalCancels': 1 },
    }
  );
  await geoService.setAvailability(workerId, true);

  // Transition order to cancelled
  const updated = await orderRepo.transitionStatus(
    orderId,
    ['assigned', 'on_the_way', 'arrived'],
    'cancelled',
    {
      cancelledAt: new Date(),
      cancellationReason: reason || 'worker_cancelled',
    }
  );

  // Broadcast cancellation event
  await redis.publish(
    'order:event',
    JSON.stringify({
      orderId: String(orderId),
      event: 'order.cancelled',
      payload: { reason: reason || 'worker_cancelled', cancelledBy: 'worker', isLate },
    })
  );

  // Notify user
  const notificationService = require('../notification/notification.service');
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_cancelled',
    title: '😔 Worker cancelled',
    body: isLate
      ? 'Your worker cancelled after being on the way. We are finding another.'
      : 'Your assigned worker cancelled. We are finding another.',
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  // Re-dispatch — add cancelled worker to attempted list so they are skipped.
  const existingAttempted = (order.dispatch?.attemptedWorkerIds || []).map(String);
  if (!existingAttempted.includes(String(workerId))) {
    existingAttempted.push(String(workerId));
  }

  await orderRepo.model().findByIdAndUpdate(orderId, {
    $set: {
      status: 'searching',
      workerId: null,
      'dispatch.currentOfferWorkerId': null,
      'dispatch.offerExpiresAt': null,
      'dispatch.attemptedWorkerIds': existingAttempted,
    },
    $push: { statusHistory: { status: 'searching', at: new Date(), meta: { requeued: true } } },
  });

  await dispatchQueue.add(
    'dispatch',
    { orderId: String(orderId), attempt: existingAttempted.length },
    { jobId: `order:${orderId}:redispatch:${Date.now()}` }
  );

  return { ok: true, penaltyPaise, penaltyReason };
}

async function rateOrder({ orderId, userId, rating, review }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.userId) !== String(userId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (order.status !== 'completed') {
    throw Object.assign(new Error('Can only rate completed orders'), { status: 409 });
  }
  if (order.userRating) {
    throw Object.assign(new Error('Already rated'), { status: 409, code: 'ALREADY_RATED' });
  }

  order.userRating = rating;
  if (review) order.statusHistory.push({ status: 'completed', at: new Date(), meta: { review } });
  await order.save();

  // Update worker rolling rating — true rolling average using (oldAvg*n + new)/(n+1)
  // We use completedJobs as N (the worker has at least 1 — this order).
  if (order.workerId) {
    const worker = await Worker.findById(order.workerId);
    if (worker && worker.completedJobs > 0) {
      const n = worker.completedJobs;
      const newRating = (worker.rating * (n - 1) + rating) / n;
      worker.rating = Number(newRating.toFixed(2));
      await worker.save();
    }
  }
  return order;
}

/**
 * Worker rates the user — symmetric to rateOrder. Affects user.rating
 * which flagged users dispatchers can later factor into access decisions.
 */
async function workerRateUser({ orderId, workerId, rating, review }) {
  const User = require('../user/user.model');
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId || '') !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (order.status !== 'completed') {
    throw Object.assign(new Error('Can only rate completed orders'), { status: 409 });
  }
  if (order.workerRating) {
    throw Object.assign(new Error('Already rated'), { status: 409, code: 'ALREADY_RATED' });
  }

  order.workerRating = rating;
  if (review) order.statusHistory.push({ status: 'completed', at: new Date(), meta: { workerReview: review } });
  await order.save();

  // Roll into the user's average. Count completed orders for this user to
  // get N.
  const totalCompleted = await require('./order.model').countDocuments({
    userId: order.userId, status: 'completed',
  });
  if (totalCompleted > 0) {
    const user = await User.findById(order.userId);
    if (user) {
      const n = totalCompleted;
      const newRating = (user.rating * (n - 1) + rating) / n;
      user.rating = Number(newRating.toFixed(2));
      await user.save();
    }
  }
  return order;
}

module.exports = {
  createOrder,
  acceptOffer,
  rejectOffer,
  workerStartTrip,
  workerArrive,
  workerStartService,
  workerComplete,
  cancelByUser,
  workerCancel,
  rateOrder,
  workerRateUser,
  getOrder: (id) => orderRepo.findByIdLean(id),
  listByUser: (userId, opts) => orderRepo.listByUser(userId, opts),
  listByWorker: (workerId, opts) => orderRepo.listByWorker(workerId, opts),
};
