/**
 * Stale Order Watchdog
 * ----------------------------------------------------------------------------
 * Runs every 2 minutes. For a hyperlocal <30-min service, orders should never
 * sit idle after assignment. This worker handles two failure modes:
 *
 *  1. ASSIGNED but worker never starts trip:
 *     - >15 min: nudge worker (push) + warn user
 *     - >25 min: strip the worker, re-dispatch, penalise
 *
 *  2. SEARCHING too long without a dispatch job running:
 *     - >12 min in searching with no BullMQ job: re-queue dispatch
 *     (catches dispatch worker crash/restart mid-job)
 *
 *  3. ON_THE_WAY too long (worker stuck or GPS off):
 *     - >45 min: notify admin channel, nudge worker
 * ----------------------------------------------------------------------------
 */

require('dotenv').config();
const { redis } = require('../config/redis');
const { connectMongo } = require('../config/mongo');
const Order  = require('../modules/order/order.model');
const Worker = require('../modules/worker/worker.model');
const geoService = require('../modules/worker/geo.service');
const logger = require('../utils/logger');
const { dispatchQueue } = require('./index');

// Defaults — overridden by admin pricing config at runtime
let ASSIGNED_NUDGE_MIN      = 5;
let ASSIGNED_REDISPATCH_MIN = 10;
let OTW_ALERT_MIN           = 20;
const SEARCHING_STALE_MIN   = 6;   // always fixed — dispatch restart threshold
const ARRIVED_STALE_MIN     = 15;  // worker marked arrived but never entered OTP — auto-cancel after 15 min
const IN_PROGRESS_MAX_MIN   = 180; // 3 hours absolute max for any in_progress order

async function loadThresholds() {
  try {
    const PricingConfig = require('../modules/pricing/pricing-config.model');
    const cfg = await PricingConfig.findOne({ isActive: true })
      .select('staleNudgeMinutes staleRedispatchMinutes staleOtwAlertMinutes')
      .lean();
    if (cfg) {
      if (cfg.staleNudgeMinutes)      ASSIGNED_NUDGE_MIN      = cfg.staleNudgeMinutes;
      if (cfg.staleRedispatchMinutes) ASSIGNED_REDISPATCH_MIN = cfg.staleRedispatchMinutes;
      if (cfg.staleOtwAlertMinutes)   OTW_ALERT_MIN           = cfg.staleOtwAlertMinutes;
    }
  } catch { /* keep defaults */ }
}

/* ─── Main sweep ────────────────────────────────────────────── */

async function sweep() {
  const now = new Date();

  await Promise.all([
    handleStaleAssigned(now),
    handleStaleSearching(now),
    handleStaleOnTheWay(now),
    handleStaleArrived(now),
    handleStaleInProgress(now),
  ]);
}

/* ── 1. Assigned orders where worker never started the trip ── */

async function handleStaleAssigned(now) {
  const nudgeThreshold     = new Date(now - ASSIGNED_NUDGE_MIN * 60 * 1000);
  const redispatchThreshold = new Date(now - ASSIGNED_REDISPATCH_MIN * 60 * 1000);

  // Find all assigned orders older than nudge threshold
  const stale = await Order.find({
    status: 'assigned',
    updatedAt: { $lt: nudgeThreshold },
  })
    .select('_id userId workerId service pricing pickupLocation statusHistory dispatch updatedAt')
    .lean();

  for (const order of stale) {
    const assignedEntry = [...(order.statusHistory || [])]
      .reverse()
      .find((h) => h.status === 'assigned');
    const assignedAt = assignedEntry?.at ? new Date(assignedEntry.at) : new Date(order.updatedAt);

    const minutesSinceAssign = (now - assignedAt) / 60000;

    const alreadyNudged = await redis.get(`stale:nudged:${order._id}`);

    if (minutesSinceAssign >= ASSIGNED_REDISPATCH_MIN) {
      // Hard: re-dispatch. Worker ignored the assignment.
      await redispatchFromAssigned(order);
    } else if (minutesSinceAssign >= ASSIGNED_NUDGE_MIN && !alreadyNudged) {
      await nudgeStaleAssigned(order);
      await redis.setex(`stale:nudged:${order._id}`, 600, '1'); // don't nudge twice within 10min
    }
  }
}

async function nudgeStaleAssigned(order) {
  const notificationService = require('../modules/notification/notification.service');
  const orderId = String(order._id);

  logger.info({ orderId, workerId: order.workerId }, '[STALE] Nudging worker for slow trip start');

  // Push worker to start the trip NOW
  if (order.workerId) {
    notificationService.notify({
      recipient: { kind: 'worker', id: order.workerId },
      type: 'job_reminder',
      title: 'Please start your trip',
      body: `Customer is waiting. Tap to navigate and start the trip for your ${order.service.replace(/_/g, ' ')} job.`,
      deepLink: `/worker/jobs/${orderId}`,
      data: { orderId, urgent: 'true' },
    }).catch(() => {});
  }

  // Reassure user
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_delayed',
    title: 'Worker is on their way',
    body: 'Your worker will start shortly. We are monitoring your order.',
    deepLink: `/orders/${orderId}`,
    data: { orderId },
  }).catch(() => {});

  await redis.publish('order:event', JSON.stringify({
    orderId,
    event: 'order.dispatch_update',
    payload: { message: 'Worker confirmed — starting your service shortly' },
  }));
}

async function redispatchFromAssigned(order) {
  const orderId = String(order._id);
  const workerId = order.workerId;

  // Idempotency — only re-dispatch once per order
  const alreadyRedispatching = await redis.get(`stale:redispatch:${orderId}`);
  if (alreadyRedispatching) return;
  await redis.setex(`stale:redispatch:${orderId}`, 1800, '1');

  logger.warn({ orderId, workerId }, '[STALE] Re-dispatching assigned order — worker never started trip');

  const notificationService = require('../modules/notification/notification.service');

  // Penalise the unresponsive worker
  if (workerId) {
    await Worker.updateOne(
      { _id: workerId },
      {
        $set: { isAvailable: true, currentOrderId: null },
        $inc: { 'penalties.totalCancels': 1, 'penalties.totalOffers': 1, 'penalties.totalRejects': 1 },
      }
    );
    await geoService.setAvailability(workerId, true);

    notificationService.notify({
      recipient: { kind: 'worker', id: workerId },
      type: 'job_removed',
      title: 'Job reassigned — please respond faster',
      body: 'You were assigned a job but did not start the trip in time. Your dispatch priority has been reduced.',
      deepLink: '/worker',
      data: { orderId },
    }).catch(() => {});
  }

  // Reset order to searching, exclude the unresponsive worker
  const existingAttempted = (order.dispatch?.attemptedWorkerIds || []).map(String);
  if (workerId && !existingAttempted.includes(String(workerId))) {
    existingAttempted.push(String(workerId));
  }

  await Order.findByIdAndUpdate(orderId, {
    $set: {
      status: 'searching',
      workerId: null,
      'dispatch.currentOfferWorkerId': null,
      'dispatch.offerExpiresAt': null,
      'dispatch.attemptedWorkerIds': existingAttempted,
    },
    $push: { statusHistory: { status: 'searching', at: new Date(), meta: { requeued: 'stale_assigned', prevWorkerId: workerId } } },
  });

  // Re-queue dispatch
  await dispatchQueue.add(
    'dispatch',
    { orderId, retryCount: 0 },
    { jobId: `order_${orderId}_stale_redispatch_${Date.now()}`, priority: 1 }
  );

  // Notify user
  notificationService.notify({
    recipient: { kind: 'user', id: order.userId },
    type: 'order_reassigned',
    title: 'Finding a new worker',
    body: 'Your previous worker was unresponsive. Finding the next available worker now.',
    deepLink: `/orders/${orderId}`,
    data: { orderId },
  }).catch(() => {});

  await redis.publish('order:event', JSON.stringify({
    orderId,
    event: 'order.dispatch_update',
    payload: { message: 'Reassigning — finding a new worker for you…' },
  }));
}

/* ── 2. Orders stuck in searching (dispatch job dead/crashed) ── */

async function handleStaleSearching(now) {
  const threshold = new Date(now - SEARCHING_STALE_MIN * 60 * 1000);

  const stale = await Order.find({
    status: 'searching',
    updatedAt: { $lt: threshold },
  })
    .select('_id updatedAt')
    .lean();

  for (const order of stale) {
    const orderId = String(order._id);

    // Check if there's already an active BullMQ dispatch job for this order
    const existingJob = await dispatchQueue.getJob(`order_${orderId}`).catch(() => null);
    if (existingJob) {
      const state = await existingJob.getState().catch(() => null);
      if (state === 'active' || state === 'waiting' || state === 'delayed') continue;
    }

    const alreadyRequeued = await redis.get(`stale:search_requeue:${orderId}`);
    if (alreadyRequeued) continue;

    logger.warn({ orderId }, '[STALE] Order stuck in searching — re-queuing dispatch');
    await redis.setex(`stale:search_requeue:${orderId}`, 900, '1');

    await dispatchQueue.add(
      'dispatch',
      { orderId, retryCount: 0 },
      { jobId: `order_${orderId}_stale_search_${Date.now()}`, priority: 1 }
    );
  }
}

/* ── 3. On-the-way too long (worker GPS off or stuck) ── */

async function handleStaleOnTheWay(now) {
  const threshold = new Date(now - OTW_ALERT_MIN * 60 * 1000);

  const stale = await Order.find({
    status: 'on_the_way',
    updatedAt: { $lt: threshold },
  })
    .select('_id userId workerId service updatedAt')
    .lean();

  for (const order of stale) {
    const orderId = String(order._id);
    const alreadyAlerted = await redis.get(`stale:otw_alert:${orderId}`);
    if (alreadyAlerted) continue;

    logger.warn({ orderId, workerId: order.workerId, minutesOtw: OTW_ALERT_MIN }, '[STALE] Worker on_the_way too long');
    await redis.setex(`stale:otw_alert:${orderId}`, 3600, '1');

    const notificationService = require('../modules/notification/notification.service');

    if (order.workerId) {
      notificationService.notify({
        recipient: { kind: 'worker', id: order.workerId },
        type: 'job_reminder',
        title: 'Are you on the way?',
        body: 'Customer is still waiting. Tap to update your status.',
        deepLink: `/worker/jobs/${orderId}`,
        data: { orderId },
      }).catch(() => {});
    }

    notificationService.notify({
      recipient: { kind: 'user', id: order.userId },
      type: 'order_delayed',
      title: 'Worker update',
      body: 'Your worker is on the way. We have pinged them for an update.',
      deepLink: `/orders/${orderId}`,
      data: { orderId },
    }).catch(() => {});
  }
}

/* ── 4. Arrived but OTP never entered (worker present but service not started) ── */

async function handleStaleArrived(now) {
  const threshold = new Date(now - ARRIVED_STALE_MIN * 60 * 1000);

  const stale = await Order.find({
    status: 'arrived',
    updatedAt: { $lt: threshold },
  })
    .select('_id userId workerId service updatedAt dispatch')
    .lean();

  for (const order of stale) {
    const orderId = String(order._id);
    const alreadyHandled = await redis.get(`stale:arrived:${orderId}`);
    if (alreadyHandled) continue;
    await redis.setex(`stale:arrived:${orderId}`, 3600, '1');

    logger.warn({ orderId, workerId: order.workerId, minutes: ARRIVED_STALE_MIN },
      '[STALE] Worker arrived but OTP never entered — cancelling and re-dispatching');

    const notificationService = require('../modules/notification/notification.service');

    // Penalise worker for no-show after arriving
    if (order.workerId) {
      await Worker.updateOne(
        { _id: order.workerId },
        {
          $set: { isAvailable: true, currentOrderId: null },
          $inc: { 'penalties.totalCancels': 1, 'penalties.totalNoShows': 1 },
        }
      );
      await geoService.setAvailability(order.workerId, true);
      notificationService.notify({
        recipient: { kind: 'worker', id: order.workerId },
        type: 'job_removed',
        title: 'Job cancelled — no-show after arriving',
        body: 'You marked arrived but did not start the service. Penalty recorded.',
        deepLink: '/worker',
        data: { orderId },
      }).catch(() => {});
    }

    const existingAttempted = (order.dispatch?.attemptedWorkerIds || []).map(String);
    if (order.workerId && !existingAttempted.includes(String(order.workerId))) {
      existingAttempted.push(String(order.workerId));
    }

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        status: 'searching',
        workerId: null,
        'dispatch.currentOfferWorkerId': null,
        'dispatch.offerExpiresAt': null,
        'dispatch.attemptedWorkerIds': existingAttempted,
      },
      $push: { statusHistory: { status: 'searching', at: new Date(), meta: { requeued: 'stale_arrived' } } },
    });

    await dispatchQueue.add('dispatch', { orderId, retryCount: 0 }, {
      jobId: `order_${orderId}_stale_arrived_${Date.now()}`, priority: 1,
    });

    notificationService.notify({
      recipient: { kind: 'user', id: order.userId },
      type: 'order_reassigned',
      title: 'Finding a new worker',
      body: 'Your worker did not start the service. We are sending someone else now.',
      deepLink: `/orders/${orderId}`,
      data: { orderId },
    }).catch(() => {});

    await redis.publish('order:event', JSON.stringify({
      orderId,
      event: 'order.dispatch_update',
      payload: { message: 'Worker did not start service — finding a replacement…' },
    }));
  }
}

/* ── 5. In-progress too long — worker abandoned the job ── */

async function handleStaleInProgress(now) {
  const nudgeThreshold  = new Date(now - 60 * 60 * 1000);    // 1 hour: nudge
  const adminThreshold  = new Date(now - IN_PROGRESS_MAX_MIN * 60 * 1000); // 3 hours: admin alert

  // Nudge first
  const longRunning = await Order.find({
    status: 'in_progress',
    updatedAt: { $lt: nudgeThreshold },
  })
    .select('_id userId workerId service updatedAt')
    .lean();

  const notificationService = require('../modules/notification/notification.service');

  for (const order of longRunning) {
    const orderId = String(order._id);
    const minutesIn = Math.round((now - new Date(order.updatedAt)) / 60000);

    if (minutesIn >= IN_PROGRESS_MAX_MIN) {
      // Admin alert — order has been in_progress for 3+ hours
      const alreadyAlerting = await redis.get(`stale:inprogress:admin:${orderId}`);
      if (!alreadyAlerting) {
        await redis.setex(`stale:inprogress:admin:${orderId}`, 7200, '1');
        logger.error(
          { orderId, workerId: order.workerId, minutesIn },
          '[STALE] IN_PROGRESS > 3 hours — admin alert required'
        );
        // Publish to admin channel for manual investigation
        await redis.publish('order:event', JSON.stringify({
          orderId,
          event: 'order.admin_alert',
          payload: {
            reason: 'in_progress_too_long',
            minutesIn,
            message: `Order in_progress for ${minutesIn} minutes — possible abandonment`,
          },
        }));
        // Notify user so they know to contact support
        notificationService.notify({
          recipient: { kind: 'user', id: order.userId },
          type: 'order_delayed',
          title: 'Service update',
          body: 'Your service has been running for a long time. Contact support if there is an issue.',
          deepLink: `/orders/${orderId}`,
          data: { orderId, support: 'true' },
        }).catch(() => {});
      }
      continue;
    }

    // 1-hour nudge
    const alreadyNudged = await redis.get(`stale:inprogress:nudge:${orderId}`);
    if (alreadyNudged) continue;
    await redis.setex(`stale:inprogress:nudge:${orderId}`, 3600, '1');

    logger.warn({ orderId, workerId: order.workerId, minutesIn }, '[STALE] In-progress order running long — nudging worker');

    if (order.workerId) {
      notificationService.notify({
        recipient: { kind: 'worker', id: order.workerId },
        type: 'job_reminder',
        title: 'Please complete the job',
        body: `Your ${order.service.replace(/_/g, ' ')} job has been in progress for ${minutesIn} minutes. Mark complete when done.`,
        deepLink: `/worker/jobs/${orderId}`,
        data: { orderId },
      }).catch(() => {});
    }
  }
}

/* ─── Worker bootstrap ───────────────────────────────────── */

async function main() {
  await connectMongo();
  await loadThresholds();

  // Reload thresholds every 5 minutes in case admin changed them
  setInterval(() => loadThresholds().catch(() => {}), 5 * 60 * 1000);

  // Run sweep immediately on start, then every 2 minutes
  await sweep().catch((err) => logger.error({ err: err.message }, '[STALE] Initial sweep failed'));

  setInterval(() => {
    sweep().catch((err) => logger.error({ err: err.message }, '[STALE] Sweep failed'));
  }, 2 * 60 * 1000);

  logger.info('[STALE] Stale-order watchdog started (sweeps every 2 minutes)');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, '[STALE] Watchdog crashed');
    process.exit(1);
  });
}

module.exports = { sweep };
