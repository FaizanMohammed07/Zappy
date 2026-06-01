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
async function createOrder({ userId, service, subCategory, pickupLocation, dropLocation, description, images, scheduledAt, paymentMethod, priority, promoCode,
  deviceBrand, deviceModel, serviceMode, vehicleType, pricingModel, estimatedHours,
  teamSize, diagnosisAnswers, diagnosisUrgency, quotedTotalRupees,
}) {
  // Dispatch queue depth circuit breaker — shed load before the queue backs up
  // and adds latency to ALL in-flight orders. (#62/#63)
  // Cap: 2,000 waiting jobs ≈ ~33 min of dispatch capacity at normal throughput.
  // Emergency orders bypass the cap — they're always urgent.
  const DISPATCH_QUEUE_HARD_CAP = 2000;
  if (priority !== 'emergency') {
    try {
      const waitingCount = await dispatchQueue.getWaitingCount();
      if (waitingCount >= DISPATCH_QUEUE_HARD_CAP) {
        throw Object.assign(
          new Error('Service is at capacity. Please try again in a few minutes.'),
          { status: 503, code: 'QUEUE_AT_CAPACITY', waitingJobs: waitingCount }
        );
      }
    } catch (err) {
      if (err.code === 'QUEUE_AT_CAPACITY') throw err;
      // Redis error checking queue depth — fail open, don't block orders
    }
  }

  // Geo-readiness check: if there are zero approved workers within 25km of the
  // pickup location, fail fast with a user-friendly message instead of creating
  // an order that will sit in 'searching' until the 5-minute dispatch window
  // exhausts and then silently fails. (#85)
  if (!scheduledAt) {
    try {
      const geoService = require('../worker/geo.service');
      const candidates = await geoService.findCandidates({
        lat: pickupLocation.lat,
        lng: pickupLocation.lng,
        skill: service,
        radiusKm: 25,
      });
      if (candidates.length === 0) {
        throw Object.assign(
          new Error('No service providers are available in your area right now. Please try again later or schedule for a future time.'),
          { status: 503, code: 'NO_WORKERS_IN_AREA' }
        );
      }
    } catch (err) {
      if (err.code === 'NO_WORKERS_IN_AREA') throw err;
      // Redis/geo error — fail open, let dispatch handle it
    }
  }

  // Abuse gate FIRST — cheap Redis checks before any Mongo writes.
  await abuseService.assertCanBook(userId);

  // One-at-a-time semantic — only one non-terminal order per user at a time.
  // Scheduled orders are exempt: they don't occupy the user's "slot" until dispatch.
  if (!scheduledAt) {
    const existingActive = await orderRepo.findActiveByUser(userId);
    if (existingActive) {
      throw Object.assign(
        new Error('You already have an active order. Complete or cancel it before placing a new one.'),
        { status: 409, code: 'ACTIVE_ORDER_EXISTS', activeOrderId: String(existingActive._id) }
      );
    }
  }

  const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
  // For home services without a drop location, use a tiny 50m nominal dest so
  // the pricing engine can call getDistanceAndEta without a zero-distance edge
  // case, but the resulting distanceFee is negligible (0.05km × perKmRate ≈ ₹0–1).
  // Previously this was 0.01° (~1.11km) which inflated quotes by ₹10-20 on every
  // home service booking.
  const dest = dropLocation
    ? { lat: dropLocation.lat, lng: dropLocation.lng }
    : { lat: pickupLocation.lat + 0.00045, lng: pickupLocation.lng }; // ~50m nominal

  let pricing = await pricingService.quote({ origin, dest, service, userId });

  // Snapshot the commission rate that will apply at settlement so mid-order
  // rate changes by admin don't retroactively alter worker payouts.
  const earningPreview = await pricingService.calculateEarnings({
    totalPaise: Math.round((pricing.total || 0) * 100),
    workerId: null, // worker unknown yet; Pro discount applied separately at settlement
  });
  pricing = {
    ...pricing,
    totalPaise: Math.round((pricing.total || 0) * 100),
    snapshotCommissionRate: earningPreview.commissionRate,
  };

  // Surge price protection: if the user was shown a quote and the fresh price
  // has risen by more than 20%, reject. This prevents silent surge bait-and-switch.
  // Only applies when quotedTotalRupees is provided (clients should always send it).
  if (quotedTotalRupees != null && quotedTotalRupees > 0) {
    const freshTotal = pricing.total || 0;
    const priceIncreasePct = (freshTotal - quotedTotalRupees) / quotedTotalRupees;
    if (priceIncreasePct > 0.20) {
      throw Object.assign(
        new Error(`Price changed since your quote (was ₹${quotedTotalRupees}, now ₹${Math.round(freshTotal)}). Please re-check the new price.`),
        { status: 409, code: 'PRICE_CHANGED', quotedTotal: quotedTotalRupees, freshTotal: Math.round(freshTotal) }
      );
    }
  }

  // Emergency mode — 1.5× surcharge + dispatch priority flag
  const isEmergency = priority === 'emergency';
  if (isEmergency) {
    const emergencyService = require('./emergency.service');
    pricing = emergencyService.applyEmergencySurcharge(pricing);
  }

  // Record demand for surge calculation.
  await pricingService.recordDemand(origin.lat, origin.lng);

  // Apply promo code discount
  let appliedPromo = null;
  if (promoCode) {
    try {
      const promoService = require('../promo/promo.service');
      appliedPromo = await promoService.applyPromo({
        code: promoCode,
        userId,
        orderTotalPaise: Math.round((pricing.total || 0) * 100),
        service,
      });
      // Reduce total by discount amount
      const discountRupees = appliedPromo.discountPaise / 100;
      pricing = { ...pricing, total: Math.max(0, pricing.total - discountRupees) };
    } catch (err) {
      // Invalid promo codes are a soft fail — order proceeds at full price
      logger.warn({ userId, promoCode, err: err.message }, 'Promo code rejected at order creation');
      appliedPromo = null;
    }
  }

  const otp = crypto.randomInt(100000, 999999).toString();

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
    promoCode: appliedPromo ? appliedPromo.code : undefined,
    discountPaise: appliedPromo ? appliedPromo.discountPaise : 0,
    otp,
    // Vertical-specific fields
    ...(deviceBrand && { deviceBrand }),
    ...(deviceModel && { deviceModel }),
    ...(serviceMode && { serviceMode }),
    ...(vehicleType && { vehicleType }),
    ...(pricingModel && { pricingModel }),
    ...(estimatedHours && { estimatedHours }),
    // Team size: multi-worker dispatch is not yet implemented (#74).
    // Cap at 1 silently so the order still proceeds; worker counts > 1
    // will display as a "coordination needed" note to the assigned worker.
    ...(teamSize && { teamSize: Math.min(Number(teamSize) || 1, 1) }),
    ...(diagnosisAnswers && { diagnosisAnswers }),
    ...(diagnosisUrgency && diagnosisUrgency !== 'normal' && { diagnosisUrgency }),
  });

  // Record promo usage after order is persisted
  if (appliedPromo) {
    const promoService = require('../promo/promo.service');
    promoService.recordUsage({
      code: appliedPromo.code,
      userId,
      orderId: order._id,
      discountPaise: appliedPromo.discountPaise,
    }).catch((err) => logger.warn({ err: err.message, promoCode: appliedPromo.code }, 'Promo usage record failed'));
  }

  // Enqueue dispatch with optional delay for scheduled orders.
  const schedDelay = scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0;
  await dispatchQueue.add(
    'dispatch',
    { orderId: String(order._id), attempt: 0 },
    {
      jobId: `order_${order._id}`,
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
 * first one atomically.
 */
async function acceptOffer({ orderId, workerId }) {
  // Parallel fetch — both reads needed before we can proceed.
  const [order, worker] = await Promise.all([
    orderRepo.findById(orderId),
    Worker.findById(workerId).select('isBlocked isOnline').lean(),
  ]);

  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (order.status !== 'searching') {
    throw Object.assign(new Error('Offer no longer available'), { status: 410 });
  }
  if (!worker || worker.isBlocked || !worker.isOnline) {
    throw Object.assign(new Error('Worker not eligible to accept orders'), { status: 403 });
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

// Max distance (km) allowed between worker's GPS and pickup pin to mark arrived.
// 500m is generous enough to handle GPS drift and multi-floor buildings.
// We WARN above 200m but only BLOCK above 500m to avoid false positives.
const ARRIVE_WARN_KM  = 0.20;
const ARRIVE_BLOCK_KM = 0.50;

async function workerArrive({ orderId, workerId, workerLat, workerLng }) {
  // Proximity check — if coordinates supplied by the client, verify the worker
  // is actually near the pickup. This catches slow-walk GPS spoofing where the
  // velocity guard doesn't trigger (the worker fakes being close gradually).
  if (workerLat != null && workerLng != null) {
    const order = await orderRepo.findByIdLean(orderId);
    if (order?.pickupLocation?.coordinates) {
      const [pickupLng, pickupLat] = order.pickupLocation.coordinates;
      const { haversineKm } = require('../worker/maps.service');
      const distKm = haversineKm(
        { lat: workerLat, lng: workerLng },
        { lat: pickupLat, lng: pickupLng },
      );
      if (distKm > ARRIVE_BLOCK_KM) {
        logger.warn(
          { workerId, orderId, distKm: distKm.toFixed(3) },
          '[ARRIVE] Worker too far from pickup — possible GPS spoof',
        );
        throw Object.assign(
          new Error(`You are ${Math.round(distKm * 1000)}m from the pickup location. Get closer before marking arrived.`),
          { status: 409, code: 'WORKER_TOO_FAR', distanceMetres: Math.round(distKm * 1000) },
        );
      }
      if (distKm > ARRIVE_WARN_KM) {
        logger.info({ workerId, orderId, distKm: distKm.toFixed(3) }, '[ARRIVE] Worker arrived with marginal GPS accuracy');
      }
    }
  }
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

// Per-service minimum durations (seconds). Flat 60s was trivially bypassed.
// Workers who mark complete before these thresholds are flagged for review.
const SERVICE_MIN_DURATION_SEC = {
  // Mobile repairs — physical component work, cannot be done in seconds
  screen_replacement:     20 * 60,  // 20 min minimum
  battery_replacement:    15 * 60,
  charging_issue:         10 * 60,
  speaker_mic_issue:      10 * 60,
  microphone_issue:       10 * 60,
  software_issue:         15 * 60,
  water_damage:           20 * 60,
  camera_issue:           15 * 60,
  data_recovery:          30 * 60,
  device_not_turning_on:  15 * 60,
  // Laptop repairs
  laptop_slow:            20 * 60,
  laptop_ssd_upgrade:     30 * 60,
  laptop_ram_upgrade:     20 * 60,
  laptop_keyboard_issue:  25 * 60,
  laptop_motherboard_issue: 45 * 60,
  laptop_charging_issue:  20 * 60,
  laptop_screen_issue:    30 * 60,
  laptop_virus_removal:   30 * 60,
  laptop_data_recovery:   30 * 60,
  // Smart devices
  smart_tv_install:       20 * 60,
  smart_tv_repair:        20 * 60,
  cctv_install:           30 * 60,
  // Vehicle
  puncture:                8 * 60,  // tyre repair ~8 min
  bike_service:           30 * 60,
  car_service:            45 * 60,
  car_detailing:          60 * 60,
  // Default for anything not listed
  _default:               90,       // 90 seconds — enough for delivery/companion services
};

// Services that require at least 1 completion photo (proof of work).
const PHOTO_REQUIRED_SERVICES = new Set([
  'screen_replacement', 'battery_replacement', 'charging_issue',
  'speaker_mic_issue', 'microphone_issue', 'software_issue',
  'water_damage', 'camera_issue', 'data_recovery', 'device_not_turning_on',
  'laptop_slow', 'laptop_ssd_upgrade', 'laptop_ram_upgrade',
  'laptop_keyboard_issue', 'laptop_motherboard_issue', 'laptop_charging_issue',
  'laptop_screen_issue', 'laptop_virus_removal', 'laptop_data_recovery',
  'smart_tv_install', 'smart_tv_repair', 'cctv_install', 'cctv_repair',
  'smart_lock_install', 'puncture', 'car_puncture', 'bike_breakdown',
  'car_breakdown', 'battery_jump_start',
]);

async function workerComplete({ orderId, workerId, completionPhotos = [] }) {
  const orderCheck = await orderRepo.findByIdLean(orderId);
  if (!orderCheck) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(orderCheck.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (!['in_progress', 'arrived'].includes(orderCheck.status)) {
    throw Object.assign(new Error(`Cannot complete from status: ${orderCheck.status}`), { status: 409 });
  }

  // Test 37: Service-specific minimum duration.
  const minDurationSec = SERVICE_MIN_DURATION_SEC[orderCheck.service] ?? SERVICE_MIN_DURATION_SEC._default;
  const startedEntry = [...(orderCheck.statusHistory || [])].reverse()
    .find((h) => h.status === 'in_progress');
  if (startedEntry) {
    const elapsedSec = (Date.now() - new Date(startedEntry.at).getTime()) / 1000;
    if (elapsedSec < minDurationSec) {
      const mins = Math.ceil(minDurationSec / 60);
      throw Object.assign(
        new Error(`This service requires at least ${mins} minutes. ${Math.ceil((minDurationSec - elapsedSec) / 60)} more minute(s) remaining.`),
        { status: 409, code: 'TOO_EARLY_COMPLETE', elapsedSec: Math.round(elapsedSec), minDurationSec }
      );
    }
  }

  // Test 37: Require completion photos for repair/installation services.
  if (PHOTO_REQUIRED_SERVICES.has(orderCheck.service) && completionPhotos.length === 0) {
    throw Object.assign(
      new Error('This service requires at least 1 completion photo as proof of work.'),
      { status: 400, code: 'COMPLETION_PHOTO_REQUIRED' }
    );
  }

  const order = await guardedTransition(
    orderId,
    workerId,
    ['in_progress', 'arrived'],
    'completed',
    { completedAt: new Date(), ...(completionPhotos.length ? { completionPhotos } : {}) }
  );

  // --- Earnings: Pro-aware commission split ---
  // Use totalPaise field for precision; fall back to total*100 for old orders.
  const totalPaise = order.pricing.totalPaise ?? Math.round(order.pricing.total * 100);
  // Pass the snapshotted commission rate so admin changes mid-order don't affect
  // this order's split. Pro discount is still applied on top of the snapshot.
  const earnings = await pricingService.calculateEarnings({
    totalPaise,
    workerId,
    snapshotCommissionRate: order.pricing.snapshotCommissionRate,
  });

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

  // User gamification — award XP for completed order
  const gamificationService = require('../engagement/user-gamification.service');
  gamificationService.onOrderCompleted({
    userId: order.userId,
    workerRatingGiven: order.workerRating || null,
  }).catch((err) => logger.warn({ err: err.message, orderId: order._id }, 'Gamification update failed'));

  // Incentive milestone check — passes the order so the service can enforce
  // the quality gate (no milestone credit for unrated or 1-star completions).
  const incentiveService = require('../worker/incentive.service');
  Worker.findById(workerId).select('completedJobs rating').lean().then((w) => {
    if (!w) return;
    return incentiveService.onJobCompleted({
      workerId,
      completedJobs: w.completedJobs,
      workerRating: w.rating,
      orderId: String(order._id),
    });
  }).catch((err) =>
    logger.error({ err: err.message, orderId: order._id }, 'Incentive check failed')
  );

  // --- Post-completion side-effects (best-effort, non-blocking) ---
  const cashbackService    = require('../wallet/cashback.service');
  const referralService    = require('../referral/referral.service');
  const notificationService = require('../notification/notification.service');

  /* Shift slot progress tracking */
  const availService = require('../worker/availability.service');
  const [wLng, wLat] = order.pickupLocation.coordinates;
  availService.onOrderCompleted({
    workerId,
    lat: wLat, lng: wLng,
    earningsPaise: earnings.workerPaise,
  }).catch(() => {});

  /* Wellness check — detects burnout, may send intervention notification */
  const wellnessService = require('../worker/wellness.service');
  wellnessService.checkAndMaybeIntervene(workerId).catch(() => {});

  /* Service Memory — record appliance/home history for customer */
  const serviceMemoryService = require('../service/service-memory.service');
  serviceMemoryService.recordServiceCompletion({ order }).catch((err) =>
    logger.warn({ err: err.message, orderId: order._id }, 'ServiceMemory record failed')
  );

  /* Warranty Card — issue if service has warranty */
  const verticalConfigService = require('../service/vertical-config.service');
  verticalConfigService.getConfig('mobile').then(async (mobileCfg) => {
    const warrantyDays = mobileCfg?.warrantyDays || 0;
    const WARRANTED_SERVICES = new Set([
      // Electronics — all repairs carry a warranty
      'screen_replacement', 'battery_replacement', 'charging_issue',
      'speaker_mic_issue', 'microphone_issue', 'software_issue',
      'water_damage', 'camera_issue', 'data_recovery', 'device_not_turning_on',
      'laptop_slow', 'laptop_ssd_upgrade', 'laptop_ram_upgrade',
      'laptop_keyboard_issue', 'laptop_motherboard_issue', 'laptop_charging_issue',
      'laptop_screen_issue', 'laptop_virus_removal', 'laptop_data_recovery',
      'smart_tv_repair', 'router_setup', 'cctv_install', 'cctv_repair',
      'smart_lock_install',
    ]);
    if (WARRANTED_SERVICES.has(order.service) && warrantyDays > 0) {
      const warrantyService = require('../service/warranty.service');
      warrantyService.issueWarranty({ order, warrantyDays }).catch(() => {});
    }
  }).catch(() => {});

  /* Emergency Fund — contribute 0.5% of platform commission to worker mutual aid */
  const emergencyFundService = require('../worker/emergency-fund.service');
  emergencyFundService.contributeFromOrder(earnings.platformPaise).catch(() => {});

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

  // Rating request — sent 2 min after completion to avoid race with celebration screen
  setTimeout(() => {
    notificationService.notify({
      recipient: { kind: 'user', id: order.userId },
      type: 'rating_request',
      title: '⭐ How was your service?',
      body: `Rate your ${order.service.replace(/_/g, ' ')} — it only takes 5 seconds.`,
      deepLink: `/orders/${order._id}`,
      data: { orderId: String(order._id) },
    }).catch(() => {});
  }, 2 * 60 * 1000);

  // Re-engagement trigger (#99): schedule a "book again" nudge for 7 days later.
  // Only fires if the user hasn't placed another order in that window.
  // Uses a Redis deferred key so we don't need a cron job.
  const reengagementKey = `reengagement:${order.userId}:scheduled`;
  redis.set(reengagementKey, String(order._id), 'EX', 7 * 24 * 3600, 'NX').catch(() => {});
  // The BullMQ notifications worker can check this key on a daily scan,
  // but for now the key acts as a signal for the next time the user opens the app.

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
      body: 'Share your 6-digit OTP with the worker to start the service',
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
  // Users can cancel up to and including 'arrived' (with the maximum fee applied).
  // Once service is 'in_progress' or later, cancellation is blocked.
  if (!['created', 'searching', 'assigned', 'on_the_way', 'arrived'].includes(order.status)) {
    throw Object.assign(new Error('Too late to cancel — service is already in progress'), { status: 409 });
  }

  // Cancellation fee policy
  const cancellationService = require('./cancellation.service');
  const { feePaise, reason: feeReason, workerCompensationPaise = 0 } = await cancellationService.calculateUserCancelFee(order);

  if (feePaise > 0) {
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
      // Compensate worker based on how far they got
      if (order.workerId && workerCompensationPaise > 0) {
        await walletService.apply({
          kind: 'worker',
          id: order.workerId,
          type: 'credit',
          amountPaise: workerCompensationPaise,
          reason: Transaction.REASONS.WORKER_EARNING,
          idempotencyKey: `cancelcomp:${orderId}`,
          refs: { orderId },
          description: `Compensation — user cancelled (${order.status})`,
        });
      }
    } catch (err) {
      if (err.code === 'WALLET_INSUFFICIENT') {
        // User has insufficient funds — the cancellation still proceeds (we don't
        // hold the order hostage) but the revenue leak is recorded as a pending
        // Transaction so admin can review and chase recovery if needed.
        logger.warn({ orderId, userId, feePaise }, 'Cancellation fee not collected — user wallet empty');
        Transaction.create({
          type: 'debit',
          owner: { kind: 'user', id: userId },
          amountPaise: -feePaise,          // negative = uncollected debt (informational)
          reason: Transaction.REASONS.ADMIN_ADJUSTMENT_DEBIT,
          refOrderId: orderId,
          idempotencyKey: `cancelfee:uncollected:${orderId}`,
          description: `Cancellation fee uncollected (wallet empty) — ${feeReason}`,
          status: 'reversed',             // marks it as a failed/pending debt for admin review
        }).catch(() => {});
      } else {
        logger.warn({ orderId, userId, feePaise, err: err.message }, 'Cancellation fee collection error');
      }
    }
  }

  const updated = await orderRepo.transitionStatus(
    orderId,
    ['created', 'searching', 'assigned', 'on_the_way', 'arrived'],
    'cancelled',
    { cancelledAt: new Date(), cancellationReason: reason || 'user_cancelled' }
  );

  // Track cancel in abuse service — split by whether a worker was involved.
  // Pre-assignment cancels (searching/created) catch bot patterns (test 41).
  // Post-assignment cancels trigger escalating freezes (test 42).
  const neverHadWorker = ['created', 'searching'].includes(order.status);
  if (neverHadWorker) {
    abuseService.recordPreAssignmentCancel(userId).catch(() => {});
  }

  // Free the worker — mark available again in both Mongo + Redis
  if (updated.workerId) {
    await Worker.updateOne(
      { _id: updated.workerId },
      { $set: { isAvailable: true, currentOrderId: null } }
    );
    await geoService.setAvailability(updated.workerId, true);
    // Refresh alive timestamp so worker stays discoverable immediately
    await redis.zadd('workers:alive', Date.now(), String(updated.workerId));

    const hadWorker = ['assigned', 'on_the_way', 'arrived'].includes(order.status);
    if (hadWorker) {
      await abuseService.recordCancelAfterAssignment(userId);
      // Notify worker their assignment was cancelled
      const notificationService = require('../notification/notification.service');
      notificationService.notify({
        recipient: { kind: 'worker', id: updated.workerId },
        type:  'order_cancelled',
        title: '❌ Order cancelled by customer',
        body:  feePaise > 0
          ? `You received ₹${Math.round((workerCompensationPaise || 0) / 100)} compensation`
          : 'The customer cancelled before you arrived',
        deepLink: '/worker',
        data:  { orderId: String(orderId) },
      }).catch(() => {});
    }
  }

  if (order.payment?.status === 'paid') {
    ledgerService.recordRefund(updated, reason).catch((err) =>
      logger.error({ err: err.message, orderId }, 'Refund ledger write failed')
    );
  }

  // Remove any pending dispatch jobs for this order
  const dispatchJobIds = [
    `order_${orderId}`,
    `order_${orderId}_retry_1`,
    `order_${orderId}_retry_2`,
  ];
  await Promise.all(
    dispatchJobIds.map((jid) =>
      dispatchQueue.getJob(jid).then((j) => j?.remove().catch(() => {})).catch(() => {})
    )
  );

  await redis.publish(
    'order:event',
    JSON.stringify({
      orderId: String(orderId),
      event: 'order.cancelled',
      payload: { reason: reason || 'user_cancelled', feePaise },
    })
  );

  return {
    order: updated,
    feePaise,
    feeRupees: Math.round(feePaise / 100),
    feeReason,
    workerCompensationPaise: workerCompensationPaise || 0,
  };
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

  // Atomically transition from assigned/on_the_way/arrived directly to searching
  // (bypassing the transient 'cancelled' state avoids a race window where the
  // dispatch worker or another process could see the order as permanently cancelled).
  const existingAttempted = (order.dispatch?.attemptedWorkerIds || []).map(String);
  if (!existingAttempted.includes(String(workerId))) {
    existingAttempted.push(String(workerId));
  }

  const updated = await orderRepo.model().findOneAndUpdate(
    { _id: orderId, status: { $in: ['assigned', 'on_the_way', 'arrived'] } },
    {
      $set: {
        status: 'searching',
        workerId: null,
        'dispatch.currentOfferWorkerId': null,
        'dispatch.offerExpiresAt': null,
        'dispatch.attemptedWorkerIds': existingAttempted,
      },
      $push: {
        statusHistory: {
          $each: [
            { status: 'searching', at: new Date(), meta: { requeued: true, workerCancelled: true } },
          ],
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    // Another process already changed status — safe no-op.
    return { ok: true, penaltyPaise, penaltyReason };
  }

  // Broadcast worker-cancelled event so the user's tracking page updates immediately.
  await redis.publish(
    'order:event',
    JSON.stringify({
      orderId: String(orderId),
      event: 'order.worker_cancelled',
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
      ? 'Your worker cancelled after being on the way. Finding another for you now.'
      : 'Your assigned worker cancelled. Finding another for you now.',
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  await dispatchQueue.add(
    'dispatch',
    { orderId: String(orderId) },
    { jobId: `order_${orderId}_redispatch_${Date.now()}` }
  );

  return { ok: true, penaltyPaise, penaltyReason };
}

/**
 * Worker arrived but customer didn't respond after waiting. (#73)
 * Penalty-free for worker. Customer charged arrived-cancellation fee.
 * Worker receives arrival compensation. Support ticket auto-created.
 */
async function workerNoResponseCancel({ orderId, workerId }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (order.status !== 'arrived') {
    throw Object.assign(new Error('Can only report no-response after arriving'), { status: 409 });
  }

  const cancellationService = require('./cancellation.service');
  const walletService   = require('../wallet/wallet.service');
  const Transaction     = require('../payment/transaction.model');

  const cfg = await cancellationService.getConfig();
  const feePaise = cfg.userCancelFeeArrivedPaise ?? 5000; // ₹50 — same as user-arrived-cancel fee
  const workerCompPaise = Math.round(feePaise * 0.70);   // 70% to worker

  // Charge customer the arrived-cancel fee (best-effort)
  try {
    await walletService.apply({
      kind: 'user', id: order.userId, type: 'debit',
      amountPaise: feePaise,
      reason: Transaction.REASONS.ADMIN_ADJUSTMENT_DEBIT,
      idempotencyKey: `noresponse:user:${orderId}`,
      refs: { orderId },
      description: 'No-response fee — worker arrived but customer unreachable',
    });
  } catch (err) {
    logger.warn({ orderId, err: err.message }, '[NO_RESPONSE] Fee collection failed — proceeding');
  }

  // Credit worker for showing up (no penalty)
  if (workerCompPaise > 0) {
    await walletService.apply({
      kind: 'worker', id: workerId, type: 'credit',
      amountPaise: workerCompPaise,
      reason: Transaction.REASONS.WORKER_EARNING,
      idempotencyKey: `noresponse:worker:${orderId}`,
      refs: { orderId },
      description: 'Arrival compensation — customer didn\'t respond',
    }).catch(() => {});
  }

  // Free the worker immediately (no penalty flag, no counter increment)
  await Worker.updateOne({ _id: workerId }, { $set: { isAvailable: true, currentOrderId: null } });
  await geoService.setAvailability(workerId, true);

  await orderRepo.transitionStatus(orderId, ['arrived'], 'cancelled', {
    cancelledAt: new Date(),
    cancellationReason: 'customer_no_response',
  });

  // Notify customer
  const notificationService = require('../notification/notification.service');
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_cancelled',
    title: '❌ Order cancelled — No response',
    body: 'Your worker arrived but could not reach you. A ₹50 arrival fee was charged.',
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  // Auto-create support ticket for admin review
  try {
    const SupportTicket = require('../support/support-ticket.model');
    await SupportTicket.create({
      orderId: order._id,
      userId: order.userId,
      workerId,
      subject: 'Customer no-response — worker cancelled',
      body: `Worker arrived for order ${order._id} but customer did not respond. Arrival fee of ₹${feePaise / 100} charged. Worker compensated ₹${workerCompPaise / 100}.`,
      source: 'system',
      status: 'open',
    });
  } catch (_) { /* non-fatal */ }

  return { ok: true, feePaise, workerCompPaise, reason: 'customer_no_response' };
}

/**
 * Worker cannot complete job because required spare part is unavailable. (#71)
 * Worker receives a diagnostic fee. Customer refunded minus diagnostic fee.
 * Part request logged for admin to source.
 */
async function workerPartUnavailableCancel({ orderId, workerId, partName, notes }) {
  const order = await orderRepo.findById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.workerId) !== String(workerId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }
  if (!['arrived', 'in_progress'].includes(order.status)) {
    throw Object.assign(new Error('Part unavailable report only valid during active service'), { status: 409 });
  }

  const DIAGNOSTIC_FEE_PAISE = 15000; // ₹150 — worker visited and diagnosed
  const walletService   = require('../wallet/wallet.service');
  const Transaction     = require('../payment/transaction.model');
  const pricingService  = require('../pricing/pricing.service');

  // Credit diagnostic fee to worker
  await walletService.apply({
    kind: 'worker', id: workerId, type: 'credit',
    amountPaise: DIAGNOSTIC_FEE_PAISE,
    reason: Transaction.REASONS.WORKER_EARNING,
    idempotencyKey: `partunav:worker:${orderId}`,
    refs: { orderId },
    description: `Diagnostic fee — spare part (${partName}) unavailable`,
  }).catch(() => {});

  // Deduct diagnostic fee from customer refund — charge partial
  const orderTotalPaise = order.pricing?.totalPaise ?? Math.round((order.pricing?.total ?? 0) * 100);
  const refundPaise = Math.max(0, orderTotalPaise - DIAGNOSTIC_FEE_PAISE);
  if (refundPaise > 0 && order.payment?.transactionId) {
    try {
      const paymentService = require('../payment/payment.service');
      await paymentService.refund({ orderId: String(order._id), amountPaise: refundPaise, reason: 'part_unavailable' });
    } catch (err) {
      logger.warn({ orderId, err: err.message }, '[PART_UNAVAILABLE] Refund failed — admin review needed');
    }
  }

  // Cancel order — no worker penalty counter
  await Worker.updateOne({ _id: workerId }, { $set: { isAvailable: true, currentOrderId: null } });
  await geoService.setAvailability(workerId, true);

  await orderRepo.transitionStatus(orderId, ['arrived', 'in_progress'], 'cancelled', {
    cancelledAt: new Date(),
    cancellationReason: 'part_unavailable',
    cancellationNotes: `Part: ${partName}. ${notes || ''}`,
  });

  // Log unfulfilable part for admin sourcing
  try {
    const SupportTicket = require('../support/support-ticket.model');
    await SupportTicket.create({
      orderId: order._id,
      userId: order.userId,
      workerId,
      subject: `Spare part unavailable: ${partName}`,
      body: `Order ${order._id} (${order.service}) could not be completed. Part "${partName}" unavailable. Notes: ${notes || 'none'}. Diagnostic fee ₹${DIAGNOSTIC_FEE_PAISE / 100} retained. Refund ₹${refundPaise / 100} issued.`,
      source: 'system',
      status: 'open',
    });
  } catch (_) { /* non-fatal */ }

  const notificationService = require('../notification/notification.service');
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_cancelled',
    title: '🔧 Part unavailable — order closed',
    body: `Worker couldn't complete the job — ${partName} is out of stock. Refund of ₹${Math.round(refundPaise / 100)} is on its way.`,
    deepLink: `/orders/${order._id}`,
    data: { orderId: String(order._id) },
  }).catch(() => {});

  return { ok: true, diagnosticFeePaise: DIAGNOSTIC_FEE_PAISE, refundPaise, partName };
}

const RATING_WINDOW_SEC = 7 * 24 * 3600; // 7 days to rate after completion

// Basic spam-word filter for review text (#88)
const REVIEW_SPAM_WORDS = ['http://', 'https://', 'whatsapp', 'telegram', 'instagram', 'call me at', 'contact me'];
function containsSpam(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return REVIEW_SPAM_WORDS.some((w) => lower.includes(w));
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
  // Anti-manipulation: ratings must be submitted within 7 days of completion.
  if (order.completedAt) {
    const ageSec = (Date.now() - new Date(order.completedAt).getTime()) / 1000;
    if (ageSec > RATING_WINDOW_SEC) {
      throw Object.assign(new Error('Rating window expired — must rate within 7 days of completion'), {
        status: 409, code: 'RATING_EXPIRED',
      });
    }
  }

  // Review spam check (#88)
  if (review && containsSpam(review)) {
    throw Object.assign(
      new Error('Review contains prohibited content (URLs or contact details not allowed)'),
      { status: 400, code: 'REVIEW_SPAM' }
    );
  }
  if (review && review.length > 1000) {
    throw Object.assign(new Error('Review must be under 1000 characters'), { status: 400 });
  }

  // Velocity limit: max 5 ratings per user per day (#87)
  // Blocks fake-account farms: new phone numbers batch-rating one worker.
  const ratingVelocityKey = `rating:velocity:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const { redis: r } = require('../../config/redis');
  const dailyCount = await r.incr(ratingVelocityKey).catch(() => 0);
  if (dailyCount === 1) await r.expire(ratingVelocityKey, 86400).catch(() => {});
  if (dailyCount > 5) {
    await r.decr(ratingVelocityKey).catch(() => {}); // don't count this attempt
    throw Object.assign(
      new Error('You\'ve submitted too many ratings today. Please try again tomorrow.'),
      { status: 429, code: 'RATING_VELOCITY_LIMIT' }
    );
  }

  // Cross-order duplicate guard: same user rating same worker within 48h (#87)
  if (order.workerId) {
    const recent48h = new Date(Date.now() - 48 * 3600 * 1000);
    const recentRating = await orderRepo.model().findOne({
      userId,
      workerId:   order.workerId,
      userRating: { $exists: true, $ne: null },
      completedAt: { $gte: recent48h },
      _id: { $ne: order._id },
    }).select('_id').lean();
    if (recentRating) {
      // Flag suspicious but don't hard-block: allow rating, mark for review
      logger.warn({ userId, workerId: order.workerId, orderId }, '[RATING] Possible duplicate rating — same worker within 48h');
    }
  }

  order.userRating = rating;
  order.ratingSubmittedAt = new Date(); // immutability timestamp (#88)
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
  workerNoResponseCancel,
  workerPartUnavailableCancel,
  rateOrder,
  workerRateUser,
  getOrder: (id) => orderRepo.findByIdWithOtp(id),
  listByUser: async (userId, opts) => {
    const [orders, total] = await Promise.all([
      orderRepo.listByUser(userId, opts),
      orderRepo.countByUser(userId),
    ]);
    return [orders, total];
  },
  listByWorker: (workerId, opts) => orderRepo.listByWorker(workerId, opts),
};
