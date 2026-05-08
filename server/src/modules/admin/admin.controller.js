const Order = require('../order/order.model');
const Worker = require('../worker/worker.model');
const User = require('../user/user.model');
const AuditLog = require('./audit-log.model');
const { redis } = require('../../config/redis');
const auditService = require('./audit.service');

async function getRevenue(req, res, next) {
  try {
    const Transaction = require('../payment/transaction.model');
    const days = Math.min(Number(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 86400 * 1000);
    const breakdown = await Transaction.aggregate([
      { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: since } } },
      { $group: { _id: '$reason', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    ]);
    const byDay = await Transaction.aggregate([
      { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: since } } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, totalPaise: { $sum: '$amountPaise' } } },
      { $sort: { '_id.day': 1 } },
    ]);
    const totalPaise = breakdown.reduce((s, r) => s + r.totalPaise, 0);
    res.json({
      sinceDays: days, totalPaise, totalRupees: Math.round(totalPaise / 100),
      breakdown: breakdown.map((r) => ({ reason: r._id, totalPaise: r.totalPaise, totalRupees: Math.round(r.totalPaise / 100), count: r.count })),
      byDay: byDay.map((r) => ({ day: r._id.day, totalPaise: r.totalPaise, totalRupees: Math.round(r.totalPaise / 100) })),
    });
  } catch (err) { next(err); }
}

async function updateToggles(req, res, next) {
  try {
    const pricingService = require('../pricing/pricing.service');
    const updated = await pricingService.updateActiveConfig(req.body, req.auth.sub);
    await auditService.fromRequest(req, 'admin.toggles_update', { kind: 'system', id: null }, null, req.body);
    res.json({ pricing: updated });
  } catch (err) { next(err); }
}

async function getMetrics(req, res, next) {
  try {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [ordersToday, active, completedToday, revenueAgg, onlineWorkers, totalWorkers, totalUsers] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfDay } }),
      Order.countDocuments({ status: { $in: ['searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] } }),
      Order.countDocuments({ status: 'completed', completedAt: { $gte: startOfDay } }),
      Order.aggregate([{ $match: { status: 'completed', completedAt: { $gte: startOfDay } } }, { $group: { _id: null, revenue: { $sum: '$pricing.total' }, avg: { $avg: '$pricing.total' } } }]),
      Worker.countDocuments({ isOnline: true }),
      Worker.countDocuments(),
      User.countDocuments(),
    ]);
    res.json({ ordersToday, active, completedToday, revenueToday: revenueAgg[0]?.revenue || 0, avgFare: Math.round(revenueAgg[0]?.avg || 0), onlineWorkers, totalWorkers, totalUsers });
  } catch (err) { next(err); }
}

async function listOrders(req, res, next) {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const q = status ? { status } : {};
    const [orders, total] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('userId', 'name phone').populate('workerId', 'name phone rating').lean(),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

async function listWorkers(req, res, next) {
  try {
    const { q, skill, online, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
    if (skill) filter.skills = skill;
    if (online !== undefined) filter.isOnline = online === 'true';
    const [workers, total] = await Promise.all([
      Worker.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean(),
      Worker.countDocuments(filter),
    ]);
    res.json({ workers, total });
  } catch (err) { next(err); }
}

async function blockWorker(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id).select('isBlocked').lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const worker = await Worker.findByIdAndUpdate(req.params.id, { $set: { isBlocked: req.body.blocked, isOnline: false, isAvailable: false } }, { new: true });
    await redis.zrem('workers:online', String(req.params.id));
    await auditService.fromRequest(req, req.body.blocked ? 'admin.worker_block' : 'admin.worker_unblock', { kind: 'worker', id: req.params.id }, { isBlocked: before.isBlocked }, { isBlocked: worker.isBlocked });
    res.json({ worker });
  } catch (err) { next(err); }
}

async function getAuditLogs(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 50;
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actorId) filter['actor.id'] = req.query.actorId;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ logs, total });
  } catch (err) { next(err); }
}

async function approveKyc(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id).select('kyc').lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const worker = await Worker.findByIdAndUpdate(req.params.id, { $set: { 'kyc.status': 'approved', 'kyc.reviewedAt': new Date(), 'kyc.reviewedBy': req.auth.sub, 'kyc.rejectionReason': null } }, { new: true });
    await auditService.fromRequest(req, 'admin.kyc_approve', { kind: 'worker', id: req.params.id }, before.kyc, worker.kyc);
    res.json({ worker });
  } catch (err) { next(err); }
}

async function rejectKyc(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id).select('kyc').lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const worker = await Worker.findByIdAndUpdate(req.params.id, { $set: { 'kyc.status': 'rejected', 'kyc.reviewedAt': new Date(), 'kyc.reviewedBy': req.auth.sub, 'kyc.rejectionReason': req.body.reason, isOnline: false, isAvailable: false } }, { new: true });
    await redis.zrem('workers:online', String(req.params.id));
    await auditService.fromRequest(req, 'admin.kyc_reject', { kind: 'worker', id: req.params.id }, before.kyc, worker.kyc);
    res.json({ worker });
  } catch (err) { next(err); }
}

async function listKycPending(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 50;
    const [workers, total] = await Promise.all([
      Worker.find({ 'kyc.status': 'pending_review' }).sort({ 'kyc.submittedAt': 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Worker.countDocuments({ 'kyc.status': 'pending_review' }),
    ]);
    res.json({ workers, total });
  } catch (err) { next(err); }
}

async function getPricingConfig(req, res, next) {
  try {
    const raw = await redis.get('config:pricing');
    res.json(raw ? JSON.parse(raw) : {});
  } catch (err) { next(err); }
}

async function setPricingConfig(req, res, next) {
  try {
    const beforeRaw = await redis.get('config:pricing');
    const before = beforeRaw ? JSON.parse(beforeRaw) : {};
    await redis.set('config:pricing', JSON.stringify(req.body));
    await auditService.fromRequest(req, 'admin.pricing_config_update', { kind: 'system', id: null }, before, req.body);
    res.json({ ok: true, config: req.body });
  } catch (err) { next(err); }
}

async function getHeatmap(req, res, next) {
  try {
    const minutes = Number(req.query.minutes) || 15;
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const orders = await Order.find({ createdAt: { $gte: since } }).select('pickupLocation status service').lean();
    res.json({ points: orders.map((o) => ({ lng: o.pickupLocation.coordinates[0], lat: o.pickupLocation.coordinates[1], status: o.status, service: o.service })) });
  } catch (err) { next(err); }
}

// ── Wallet adjustment (admin direct credit/debit) ─────────────────────────

async function adjustWallet(req, res, next) {
  try {
    const walletService = require('../wallet/wallet.service');
    const Transaction = require('../payment/transaction.model');
    const { kind, id, type, amountPaise, description } = req.body;

    if (!['user', 'worker'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be user or worker' });
    }
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ error: 'type must be credit or debit' });
    }
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'amountPaise must be a positive integer' });
    }

    const reason = type === 'credit'
      ? Transaction.REASONS.ADMIN_ADJUSTMENT_CREDIT
      : Transaction.REASONS.ADMIN_ADJUSTMENT_DEBIT;

    const idempotencyKey = `admin:adj:${req.auth.sub}:${kind}:${id}:${Date.now()}`;

    const result = await walletService.apply({
      kind, id, type, amountPaise, reason, idempotencyKey,
      description: description || `Admin ${type} by ${req.auth.sub}`,
      metadata: { adminId: req.auth.sub },
    });

    await auditService.fromRequest(
      req,
      `admin.wallet_${type}`,
      { kind, id },
      null,
      { amountPaise, description }
    );

    res.json({
      transaction: result.transaction,
      newBalancePaise: result.wallet.balancePaise,
      newBalanceRupees: Math.round(result.wallet.balancePaise / 100),
    });
  } catch (err) { next(err); }
}

async function reconcileWallet(req, res, next) {
  try {
    const walletService = require('../wallet/wallet.service');
    const { kind, id } = req.params;
    const result = await walletService.reconcile({ kind, id });
    await auditService.fromRequest(req, 'admin.wallet_reconcile', { kind, id }, null, result);
    res.json(result);
  } catch (err) { next(err); }
}

// ── User management ────────────────────────────────────────────────────────

async function listUsers(req, res, next) {
  try {
    const { q, blocked, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
    if (blocked !== undefined) filter.isBlocked = blocked === 'true';
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean(),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
}

async function blockUser(req, res, next) {
  try {
    const before = await User.findById(req.params.id).select('isBlocked').lean();
    if (!before) return res.status(404).json({ error: 'User not found' });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { isBlocked: req.body.blocked } }, { new: true });
    await auditService.fromRequest(req, req.body.blocked ? 'admin.user_block' : 'admin.user_unblock', { kind: 'user', id: req.params.id }, { isBlocked: before.isBlocked }, { isBlocked: user.isBlocked });
    res.json({ user });
  } catch (err) { next(err); }
}

// ── Enhanced analytics ─────────────────────────────────────────────────────

async function getAnalytics(req, res, next) {
  try {
    const Transaction = require('../payment/transaction.model');
    const days = Math.min(Number(req.query.days) || 30, 180);
    const since = new Date(Date.now() - days * 86400 * 1000);

    const [
      serviceBreakdown,
      workerPerformance,
      dailyRevenue,
      cohortSignups,
      orderFunnel,
    ] = await Promise.all([
      // Revenue + order counts by service type
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since } } },
        { $group: { _id: '$service', orders: { $sum: 1 }, revenuePaise: { $sum: { $multiply: ['$pricing.total', 100] } }, avgFare: { $avg: '$pricing.total' } } },
        { $sort: { orders: -1 } },
      ]),

      // Top worker earners
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since }, workerId: { $ne: null } } },
        { $group: { _id: '$workerId', jobs: { $sum: 1 }, earningPaise: { $sum: '$earnings.workerPaise' }, avgRating: { $avg: '$userRating' } } },
        { $sort: { earningPaise: -1 } },
        { $limit: 20 },
        { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'worker' } },
        { $unwind: { path: '$worker', preserveNullAndEmpty: true } },
        { $project: { name: '$worker.name', phone: '$worker.phone', jobs: 1, earningPaise: 1, avgRating: 1 } },
      ]),

      // Daily P&L
      Transaction.aggregate([
        { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenuePaise: { $sum: '$amountPaise' }, txns: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),

      // New user + worker signups by week
      Promise.all([
        User.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%W', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Worker.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: '%Y-%W', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]),

      // Order funnel: created → assigned → completed + cancel rate
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const [userSignups, workerSignups] = cohortSignups;
    const totalRevenuePaise = dailyRevenue.reduce((s, r) => s + r.revenuePaise, 0);

    res.json({
      sinceDays: days,
      totalRevenuePaise,
      totalRevenueRupees: Math.round(totalRevenuePaise / 100),
      serviceBreakdown: serviceBreakdown.map((s) => ({
        service: s._id,
        orders: s.orders,
        revenuePaise: Math.round(s.revenuePaise),
        avgFareRupees: Math.round(s.avgFare),
      })),
      topWorkers: workerPerformance,
      dailyRevenue: dailyRevenue.map((d) => ({ date: d._id, revenuePaise: d.revenuePaise, txns: d.txns })),
      weeklySignups: { users: userSignups, workers: workerSignups },
      orderFunnel: Object.fromEntries(orderFunnel.map((f) => [f._id, f.count])),
    });
  } catch (err) { next(err); }
}

// ── Incentive config ───────────────────────────────────────────────────────

async function getIncentiveConfig(req, res, next) {
  try {
    const incentiveService = require('../worker/incentive.service');
    const [milestones, ratingBonus] = await Promise.all([
      incentiveService.getMilestones(),
      incentiveService.getRatingBonusConfig(),
    ]);
    res.json({ milestones, ratingBonus });
  } catch (err) { next(err); }
}

async function setIncentiveMilestones(req, res, next) {
  try {
    const incentiveService = require('../worker/incentive.service');
    const updated = await incentiveService.setMilestones(req.body.milestones);
    await auditService.fromRequest(req, 'admin.incentives_milestones_update', { kind: 'system', id: null }, null, updated);
    res.json({ milestones: updated });
  } catch (err) { next(err); }
}

async function runRatingBonusSweep(req, res, next) {
  try {
    const incentiveService = require('../worker/incentive.service');
    const result = await incentiveService.checkRatingBonuses();
    res.json(result);
  } catch (err) { next(err); }
}

// ── Cancellation config ────────────────────────────────────────────────────

async function getCancellationConfig(req, res, next) {
  try {
    const cancellationService = require('../order/cancellation.service');
    const cfg = await cancellationService.getConfig();
    res.json({ config: cfg });
  } catch (err) { next(err); }
}

async function updateCancellationConfig(req, res, next) {
  try {
    const cancellationService = require('../order/cancellation.service');
    const before = await cancellationService.getConfig();
    const updated = await cancellationService.updateConfig(req.body, req.auth.sub);
    await auditService.fromRequest(req, 'admin.cancellation_config_update', { kind: 'system', id: null }, before, req.body);
    res.json({ config: updated });
  } catch (err) { next(err); }
}

// ── Worker penalty stats ───────────────────────────────────────────────────

async function getWorkerPenaltyStats(req, res, next) {
  try {
    const worker = await Worker.findById(req.params.id)
      .select('name phone penalties rating completedJobs totalJobs isBlocked isAvailable')
      .lean();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const { redis: redisClient } = require('../../config/redis');
    const rejectWindowRaw = await redisClient.lrange(`worker:offers:${req.params.id}`, 0, -1);
    const cancelStrikesRaw = await redisClient.get(`cancel:strikes:${req.params.id}`);

    const recentRejectRate = rejectWindowRaw.length > 0
      ? rejectWindowRaw.filter((i) => i === 'reject' || i === 'timeout').length / rejectWindowRaw.length
      : 0;

    const lifetimeRejectRate = (worker.penalties?.totalOffers || 0) > 0
      ? (worker.penalties.totalRejects || 0) / worker.penalties.totalOffers
      : 0;
    const lifetimeCancelRate = (worker.completedJobs || 0) > 0
      ? (worker.penalties?.totalCancels || 0) / worker.completedJobs
      : 0;

    res.json({
      worker: { _id: worker._id, name: worker.name, phone: worker.phone, isBlocked: worker.isBlocked, isAvailable: worker.isAvailable },
      penalties: worker.penalties || {},
      recentWindow: {
        size: rejectWindowRaw.length,
        rejectRate: Math.round(recentRejectRate * 100) / 100,
        outcomes: rejectWindowRaw,
      },
      cancelStrikes: { active: parseInt(cancelStrikesRaw || '0', 10) },
      lifetimeRates: {
        rejectRate: Math.round(lifetimeRejectRate * 100) / 100,
        cancelRate: Math.round(lifetimeCancelRate * 100) / 100,
      },
    });
  } catch (err) { next(err); }
}

// ── Plan CRUD ────────────────────────────────────────────────────────────────
const Plan = require('../subscription/plan.model');

async function listAllPlans(req, res, next) {
  try {
    const plans = await Plan.find().sort({ audience: 1, sortOrder: 1, priceInPaise: 1 }).lean();
    res.json({ plans });
  } catch (err) { next(err); }
}

async function createPlan(req, res, next) {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Plan code already exists' });
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan });
  } catch (err) { next(err); }
}

async function deletePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = {
  getRevenue, updateToggles, getMetrics,
  listOrders, listWorkers, blockWorker,
  listUsers, blockUser,
  getAuditLogs, approveKyc, rejectKyc, listKycPending,
  getPricingConfig, setPricingConfig,
  getHeatmap, getAnalytics,
  getIncentiveConfig, setIncentiveMilestones, runRatingBonusSweep,
  adjustWallet, reconcileWallet,
  getCancellationConfig, updateCancellationConfig,
  getWorkerPenaltyStats,
  listAllPlans, createPlan, updatePlan, deletePlan,
};
