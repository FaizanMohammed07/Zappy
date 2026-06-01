/**
 * Subscription Maintenance Plans
 * Create, manage, and auto-trigger recurring service bookings.
 * A cron job calls triggerDuePlans() daily to auto-create orders.
 */
const MaintenancePlan = require('./maintenance-plan.model');
const logger = require('../../utils/logger');

/* Discount for subscribers */
const SUBSCRIBER_DISCOUNT_PCT = 10;

/* Recommended frequencies per service (days) */
const DEFAULT_FREQUENCIES = {
  cleaning:    30,
  ac_repair:   90,
  plumbing:   365,
  electrical: 365,
  carpenter:  365,
  painting:  1825,
};

async function createPlan({ userId, service, frequencyDays, pickupLocation, paymentMethod, preferredWorkerId, basePriceRupees }) {
  const freq = frequencyDays || DEFAULT_FREQUENCIES[service] || 90;
  const disc = Math.round(basePriceRupees * SUBSCRIBER_DISCOUNT_PCT / 100);
  const effectivePriceRupees = basePriceRupees - disc;
  const nextScheduledAt = new Date(Date.now() + freq * 86400000);

  const plan = await MaintenancePlan.create({
    userId, service,
    label: `${service.replace(/_/g, ' ')} every ${freq} days`,
    frequencyDays: freq,
    preferredWorkerId: preferredWorkerId || null,
    pickupLocation,
    basePriceRupees,
    discountPct: SUBSCRIBER_DISCOUNT_PCT,
    effectivePriceRupees,
    status: 'active',
    nextScheduledAt,
    paymentMethod: paymentMethod || 'upi',
  });

  logger.info({ userId, service, freq, nextScheduledAt }, '[MaintenancePlan] Created');
  return { plan, savingsRupees: disc };
}

async function getMyPlans(userId) {
  return MaintenancePlan.find({ userId }).sort({ nextScheduledAt: 1 }).lean();
}

async function pausePlan(planId, userId) {
  return MaintenancePlan.findOneAndUpdate(
    { _id: planId, userId },
    { $set: { status: 'paused' } },
    { new: true }
  );
}

async function resumePlan(planId, userId) {
  const plan = await MaintenancePlan.findOne({ _id: planId, userId });
  if (!plan || plan.status !== 'paused') throw Object.assign(new Error('Plan not found or not paused'), { status: 404 });
  plan.status          = 'active';
  plan.nextScheduledAt = new Date(Date.now() + plan.frequencyDays * 86400000);
  await plan.save();
  return plan;
}

async function cancelPlan(planId, userId) {
  return MaintenancePlan.findOneAndUpdate(
    { _id: planId, userId },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
}

/** Called by a daily cron/scheduler. Creates orders for due plans. */
async function triggerDuePlans() {
  const now = new Date();
  const duePlans = await MaintenancePlan.find({
    status: 'active',
    nextScheduledAt: { $lte: now },
  }).lean();

  logger.info({ count: duePlans.length }, '[MaintenancePlan] Triggering due plans');

  for (const plan of duePlans) {
    try {
      const crypto = require('crypto');
      const Order  = require('../order/order.model');
      const order  = await Order.create({
        userId:   plan.userId,
        service:  plan.service,
        description: `Maintenance plan auto-booking (${plan.label})`,
        pickupLocation: plan.pickupLocation,
        pricing: {
          total:       plan.effectivePriceRupees,
          baseFee:     plan.basePriceRupees,
          discountPct: plan.discountPct,
          currency:    'INR',
        },
        status: 'created',
        statusHistory: [{ status: 'created', meta: { maintenancePlan: String(plan._id) } }],
        payment: { method: plan.paymentMethod, status: 'pending' },
        otp: crypto.randomInt(1000, 9999).toString(),
        priority: 'normal',
      });

      /* Dispatch with preferred worker priority */
      const { dispatchQueue } = require('../../jobs');
      await dispatchQueue.add('dispatch', {
        orderId: String(order._id),
        preferredWorkerId: plan.preferredWorkerId ? String(plan.preferredWorkerId) : null,
      });

      /* Advance next schedule */
      await MaintenancePlan.findByIdAndUpdate(plan._id, {
        $set: {
          lastCompletedAt: now,
          nextScheduledAt: new Date(now.getTime() + plan.frequencyDays * 86400000),
        },
        $inc: { totalCompleted: 1 },
        $push: { orderHistory: order._id },
      });

      /* Notify user */
      const notifService = require('../notification/notification.service');
      notifService.notify({
        recipient: { kind: 'user', id: plan.userId },
        type:  'order_placed',
        title: `🔄 Maintenance booking created`,
        body:  `Your scheduled ${plan.service.replace(/_/g, ' ')} is booked at ₹${plan.effectivePriceRupees}`,
        deepLink: `/orders/${order._id}`,
        data: { orderId: String(order._id) },
      }).catch(() => {});

      logger.info({ planId: plan._id, orderId: order._id }, '[MaintenancePlan] Auto-order created');
    } catch (err) {
      logger.error({ err: err.message, planId: plan._id }, '[MaintenancePlan] Trigger failed');
    }
  }

  return { triggered: duePlans.length };
}

module.exports = {
  createPlan, getMyPlans, pausePlan, resumePlan, cancelPlan, triggerDuePlans, DEFAULT_FREQUENCIES,
};
