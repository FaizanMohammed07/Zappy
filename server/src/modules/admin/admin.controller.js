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
    const days     = Math.min(Number(req.query.days) || 30, 180);
    const now      = Date.now();
    const since    = new Date(now - days * 86_400_000);
    const prevSince = new Date(now - days * 2 * 86_400_000); // previous period for comparison

    const [
      serviceStats,
      workerPerformance,
      dailyTrend,
      cohortSignups,
      orderFunnel,
      prevPeriodOrders,
      prevPeriodRevenue,
      operationalTimes,
      uniqueUsers,
      newUsersThisPeriod,
    ] = await Promise.all([
      // Full service stats: total, completed, cancelled, revenue, avg fare, avg duration
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$service',
          total:     { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          failed:    { $sum: { $cond: [{ $eq: ['$status', 'failed'] },    1, 0] } },
          revenuePaise: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $multiply: ['$pricing.total', 100] }, 0] } },
          avgFare:   { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', null] } },
        }},
        { $sort: { total: -1 } },
      ]),

      // Top worker earners with job counts + rating
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since }, workerId: { $ne: null } } },
        { $group: { _id: '$workerId', jobs: { $sum: 1 }, earningPaise: { $sum: '$earnings.workerPaise' }, avgRating: { $avg: '$userRating' } } },
        { $sort: { jobs: -1 } },
        { $limit: 15 },
        { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'w' } },
        { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$w.name', phone: '$w.phone', skills: '$w.skills', jobs: 1, earningPaise: 1, avgRating: 1 } },
      ]),

      // Daily trend: orders + revenue per day
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          orders:    { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          revenuePaise: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $multiply: ['$pricing.total', 100] }, 0] } },
        }},
        { $sort: { _id: 1 } },
      ]),

      // Weekly signups using isoWeek
      Promise.all([
        User.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { y: { $isoWeekYear: '$createdAt' }, w: { $isoWeek: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { '_id.y': 1, '_id.w': 1 } },
          { $project: { _id: { $concat: [{ $toString: '$_id.y' }, '-W', { $toString: '$_id.w' }] }, count: 1 } },
        ]),
        Worker.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { y: { $isoWeekYear: '$createdAt' }, w: { $isoWeek: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { '_id.y': 1, '_id.w': 1 } },
          { $project: { _id: { $concat: [{ $toString: '$_id.y' }, '-W', { $toString: '$_id.w' }] }, count: 1 } },
        ]),
      ]),

      // Full order funnel by status
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Previous period totals for comparison
      Order.aggregate([
        { $match: { createdAt: { $gte: prevSince, $lt: since } } },
        { $group: { _id: null,
          total:     { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          revenue:   { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $multiply: ['$pricing.total', 100] }, 0] } },
          avgFare:   { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', null] } },
        }},
      ]),

      // Previous period revenue from transactions
      Transaction.aggregate([
        { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: prevSince, $lt: since } } },
        { $group: { _id: null, revenuePaise: { $sum: '$amountPaise' } } },
      ]),

      // Operational times: avg dispatch time (created→assigned) and service time (in_progress→completed)
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since } } },
        { $project: {
          dispatchMs: { $subtract: ['$assignedAt', '$createdAt'] },
          serviceMs:  { $subtract: ['$completedAt', '$startedAt'] },
          waitMs:     { $subtract: ['$startedAt',   '$arrivedAt'] },
        }},
        { $group: {
          _id: null,
          avgDispatchMin: { $avg: { $divide: ['$dispatchMs', 60000] } },
          avgServiceMin:  { $avg: { $divide: ['$serviceMs',  60000] } },
          avgWaitMin:     { $avg: { $divide: ['$waitMs',     60000] } },
        }},
      ]),

      // Unique users who placed any order this period
      Order.distinct('userId', { createdAt: { $gte: since } }),

      // New users (signed up this period)
      User.countDocuments({ createdAt: { $gte: since } }),
    ]);

    const [userSignups, workerSignups] = cohortSignups;
    const funnelMap = Object.fromEntries(orderFunnel.map(f => [f._id, f.count]));
    const totalOrders    = orderFunnel.reduce((s, f) => s + f.count, 0);
    const completedCount = funnelMap.completed || 0;
    const cancelledCount = funnelMap.cancelled || 0;
    const totalRevPaise  = serviceStats.reduce((s, sv) => s + sv.revenuePaise, 0);
    const avgFareRupees  = completedCount > 0 ? Math.round(totalRevPaise / completedCount / 100) : 0;

    const prev = prevPeriodOrders[0] || { total: 0, completed: 0, cancelled: 0, revenue: 0, avgFare: 0 };
    const prevRevPaise = prevPeriodRevenue[0]?.revenuePaise || 0;

    const pctChange = (curr, prevVal) => {
      if (!prevVal) return null;
      return Math.round(((curr - prevVal) / prevVal) * 100);
    };

    res.json({
      sinceDays: days,

      // Current period totals
      totalOrders,
      completedOrders:  completedCount,
      cancelledOrders:  cancelledCount,
      totalRevPaise,
      totalRevRupees:   Math.round(totalRevPaise / 100),
      avgFareRupees,
      completionRate:   totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0,
      cancelRate:       totalOrders > 0 ? Math.round((cancelledCount / totalOrders) * 100) : 0,
      uniqueActiveUsers: uniqueUsers.length,
      newUsers: newUsersThisPeriod,

      // Period-over-period change (%)
      prev: {
        totalOrders:  prev.total,
        completedOrders: prev.completed,
        revenue:      prevRevPaise,
        avgFare:      Math.round((prev.avgFare || 0) * 100),
      },
      changes: {
        orders:    pctChange(totalOrders,    prev.total),
        completed: pctChange(completedCount, prev.completed),
        revenue:   pctChange(totalRevPaise,  prevRevPaise),
        avgFare:   pctChange(avgFareRupees,  Math.round((prev.avgFare || 0))),
      },

      // Operational efficiency
      ops: operationalTimes[0]
        ? {
            avgDispatchMin: Math.round((operationalTimes[0].avgDispatchMin || 0) * 10) / 10,
            avgServiceMin:  Math.round((operationalTimes[0].avgServiceMin  || 0) * 10) / 10,
            avgWaitMin:     Math.round((operationalTimes[0].avgWaitMin     || 0) * 10) / 10,
          }
        : { avgDispatchMin: null, avgServiceMin: null, avgWaitMin: null },

      // Service breakdown (all statuses)
      serviceBreakdown: serviceStats.map(s => ({
        service: s._id,
        total: s.total, completed: s.completed, cancelled: s.cancelled, failed: s.failed,
        revenuePaise: Math.round(s.revenuePaise),
        revenueRupees: Math.round(s.revenuePaise / 100),
        avgFareRupees: Math.round(s.avgFare || 0),
        completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        cancelRate:     s.total > 0 ? Math.round((s.cancelled / s.total) * 100) : 0,
      })),

      topWorkers: workerPerformance,
      dailyTrend: dailyTrend.map(d => ({
        date: d._id, orders: d.orders, completed: d.completed, cancelled: d.cancelled,
        revenuePaise: d.revenuePaise, revenueRupees: Math.round(d.revenuePaise / 100),
      })),
      weeklySignups: { users: userSignups, workers: workerSignups },
      orderFunnel: funnelMap,
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

// ── Geographic Analytics (Heatmap data) ───────────────────────────────────

async function getGeoAnalytics(req, res, next) {
  try {
    const days      = Math.min(Number(req.query.days) || 30, 180);
    const precision = Math.min(Math.max(Number(req.query.precision) || 2, 1), 3);
    const service   = req.query.service;
    const since     = new Date(Date.now() - days * 86_400_000);
    const factor    = Math.pow(10, precision);

    const match = { createdAt: { $gte: since } };
    if (service && service !== 'all') match.service = service;

    const [cells, topByService] = await Promise.all([
      // Main demand/revenue/cancel aggregation per grid cell
      Order.aggregate([
        { $match: match },
        { $project: {
          lat: { $divide: [{ $round: [{ $multiply: [{ $arrayElemAt: ['$pickupLocation.coordinates', 1] }, factor] }] }, factor] },
          lng: { $divide: [{ $round: [{ $multiply: [{ $arrayElemAt: ['$pickupLocation.coordinates', 0] }, factor] }] }, factor] },
          status: 1, service: 1, revenue: '$pricing.total',
        }},
        { $group: {
          _id: { lat: '$lat', lng: '$lng' },
          total:     { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          failed:    { $sum: { $cond: [{ $eq: ['$status', 'failed'] },    1, 0] } },
          revenue:   { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0] } },
          services:  { $addToSet: '$service' },
        }},
        { $project: {
          _id: 0,
          lat: '$_id.lat', lng: '$_id.lng',
          total: 1, completed: 1, cancelled: 1, failed: 1, services: 1,
          revenue: { $round: ['$revenue', 0] },
          cancelRate: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] }, 1] }, 0] },
          completionRate: { $cond: [{ $gt: ['$total', 0] }, { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 1] }, 0] },
        }},
        { $sort: { total: -1 } },
        { $limit: 10000 },
      ]),

      // Top zones per service
      Order.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $project: {
          lat: { $divide: [{ $round: [{ $multiply: [{ $arrayElemAt: ['$pickupLocation.coordinates', 1] }, factor] }] }, factor] },
          lng: { $divide: [{ $round: [{ $multiply: [{ $arrayElemAt: ['$pickupLocation.coordinates', 0] }, factor] }] }, factor] },
          service: 1, revenue: '$pricing.total',
        }},
        { $group: { _id: { lat: '$lat', lng: '$lng', service: '$service' }, count: { $sum: 1 }, revenue: { $sum: '$revenue' } } },
        { $sort: { count: -1 } },
        { $group: {
          _id: '$_id.service',
          topZones: { $push: { lat: '$_id.lat', lng: '$_id.lng', count: '$count', revenue: '$revenue' } },
        }},
      ]),
    ]);

    const totalOrders  = cells.reduce((s, c) => s + c.total, 0);
    const totalRevenue = cells.reduce((s, c) => s + c.revenue, 0);
    const topDemand    = cells.slice(0, 15);
    const topRevenue   = [...cells].sort((a, b) => b.revenue - a.revenue).slice(0, 15);
    const topCancel    = cells.filter(c => c.total >= 3).sort((a, b) => b.cancelRate - a.cancelRate).slice(0, 15);

    // Resolve place names for all unique top-zone coordinates (cached 48h in Redis)
    const { getZoneLabel } = require('../worker/maps.service');
    const uniqueCoords = new Map();
    for (const z of [...topDemand, ...topRevenue, ...topCancel]) {
      const k = `${z.lat},${z.lng}`;
      if (!uniqueCoords.has(k)) uniqueCoords.set(k, { lat: z.lat, lng: z.lng });
    }
    const labelEntries = await Promise.all(
      [...uniqueCoords.entries()].map(async ([k, { lat, lng }]) => [k, await getZoneLabel(lat, lng)])
    );
    const labelMap = Object.fromEntries(labelEntries);
    const withName = (z) => ({ ...z, name: labelMap[`${z.lat},${z.lng}`] || `${z.lat}, ${z.lng}` });

    res.json({
      sinceDays: days, precision,
      totalOrders, totalRevenue: Math.round(totalRevenue),
      cells,
      topByService: topByService.map(s => ({ service: s._id, zones: s.topZones.slice(0, 5) })),
      topZones: {
        byDemand:  topDemand.map(withName),
        byRevenue: topRevenue.map(withName),
        byCancel:  topCancel.map(withName),
      },
    });
  } catch (err) { next(err); }
}

// ── Demand Patterns (hourly + day-of-week) ─────────────────────────────────

async function getDemandPatterns(req, res, next) {
  try {
    const days    = Math.min(Number(req.query.days) || 30, 180);
    const service = req.query.service;
    const since   = new Date(Date.now() - days * 86_400_000);
    const match   = { createdAt: { $gte: since } };
    if (service && service !== 'all') match.service = service;

    const [hourly, byDow, byService, byDay] = await Promise.all([
      // Orders by hour-of-day (IST offset = +5:30 = +330 min from UTC)
      Order.aggregate([
        { $match: match },
        { $project: { hour: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } }, status: 1, revenue: '$pricing.total' } },
        { $group: { _id: '$hour', orders: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0] } } } },
        { $sort: { _id: 1 } },
      ]),

      // Orders by day-of-week (0=Sun, 6=Sat)
      Order.aggregate([
        { $match: match },
        { $project: { dow: { $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Kolkata' } }, status: 1, revenue: '$pricing.total' } },
        { $group: { _id: '$dow', orders: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0] } } } },
        { $sort: { _id: 1 } },
      ]),

      // Orders by service type
      Order.aggregate([
        { $match: match },
        { $group: { _id: '$service', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', 0] } }, avgFare: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', null] } } } },
        { $sort: { total: -1 } },
      ]),

      // Daily order volume trend
      Order.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, orders: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', 0] } } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const DOW_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    res.json({
      sinceDays: days,
      hourly: hourly.map(h => ({ hour: h._id, label: `${h._id}:00`, orders: h.orders, completed: h.completed, revenue: Math.round(h.revenue) })),
      byDow: byDow.map(d => ({ dow: d._id, label: DOW_NAMES[d._id] || `Day${d._id}`, orders: d.orders, completed: d.completed, revenue: Math.round(d.revenue) })),
      byService: byService.map(s => ({ service: s._id, total: s.total, completed: s.completed, cancelled: s.cancelled, revenue: Math.round(s.revenue), avgFare: Math.round(s.avgFare || 0), completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0 })),
      byDay: byDay.map(d => ({ date: d._id, orders: d.orders, completed: d.completed, revenue: Math.round(d.revenue) })),
      peakHour: hourly.reduce((max, h) => h.orders > (max?.orders || 0) ? h : max, null)?._id,
      peakDow: byDow.reduce((max, d) => d.orders > (max?.orders || 0) ? d : max, null)?._id,
    });
  } catch (err) { next(err); }
}

// ── System Health ──────────────────────────────────────────────────────────

async function getSystemHealth(req, res, next) {
  try {
    const { redis: redisClient } = require('../../config/redis');
    const { dispatchQueue, notificationsQueue, paymentsQueue } = require('../../jobs/index');
    const mongoose = require('mongoose');

    const [redisPing, dispatchCounts, notifCounts, paymentCounts] = await Promise.all([
      redisClient.ping().then(r => r === 'PONG').catch(() => false),
      dispatchQueue.getJobCounts('waiting', 'active', 'failed', 'delayed').catch(() => ({})),
      notificationsQueue.getJobCounts('waiting', 'active', 'failed', 'delayed').catch(() => ({})),
      paymentsQueue.getJobCounts('waiting', 'active', 'failed', 'delayed').catch(() => ({})),
    ]);

    const mongoState = mongoose.connection.readyState;
    const mem = process.memoryUsage();

    res.json({
      uptime: Math.round(process.uptime()),
      redis: { ok: redisPing },
      mongo: { ok: mongoState === 1 },
      queues: {
        dispatch: dispatchCounts,
        notifications: notifCounts,
        payments: paymentCounts,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// ── Feature Flags ──────────────────────────────────────────────────────────

const FLAG_KEY = 'admin:feature-flags';
const DEFAULT_FLAGS = {
  surge_pricing: true,
  promo_codes: true,
  gamification: true,
  ads: true,
  chat: true,
  live_tracking: true,
  worker_ratings: true,
  cashback: true,
  referrals: true,
  notifications: true,
};

async function getFeatureFlags(req, res, next) {
  try {
    const raw = await redis.get(FLAG_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    res.json({ flags: { ...DEFAULT_FLAGS, ...saved } });
  } catch (err) { next(err); }
}

async function setFeatureFlag(req, res, next) {
  try {
    const { flag, enabled } = req.body;
    if (!(flag in DEFAULT_FLAGS)) return res.status(400).json({ error: 'Unknown flag' });
    const raw = await redis.get(FLAG_KEY);
    const flags = { ...DEFAULT_FLAGS, ...(raw ? JSON.parse(raw) : {}) };
    flags[flag] = Boolean(enabled);
    await redis.set(FLAG_KEY, JSON.stringify(flags));
    await auditService.fromRequest(req, 'admin.feature_flag_update', { kind: 'system', id: null }, null, { flag, enabled });
    res.json({ flags });
  } catch (err) { next(err); }
}

// ── Alerts ─────────────────────────────────────────────────────────────────

async function getAlerts(req, res, next) {
  try {
    const now = new Date();
    const last1h = new Date(now - 3_600_000);

    const [onlineWorkers, activeOrders, recentCancels, recentCompleted, failedOrders, longSearching] = await Promise.all([
      Worker.countDocuments({ isOnline: true }),
      Order.countDocuments({ status: { $in: ['searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] } }),
      Order.countDocuments({ status: 'cancelled', updatedAt: { $gte: last1h } }),
      Order.countDocuments({ status: 'completed', completedAt: { $gte: last1h } }),
      Order.countDocuments({ status: 'failed', updatedAt: { $gte: last1h } }),
      Order.countDocuments({ status: 'searching', updatedAt: { $lt: new Date(now - 600_000) } }),
    ]);

    const alerts = [];

    if (onlineWorkers === 0 && activeOrders > 0) {
      alerts.push({ id: 'no_workers', severity: 'critical', title: 'No Online Workers', message: `${activeOrders} active order(s) with no workers online` });
    } else if (onlineWorkers < 3) {
      alerts.push({ id: 'low_workers', severity: 'warning', title: 'Low Worker Supply', message: `Only ${onlineWorkers} worker(s) currently online` });
    }

    const cancelTotal = recentCancels + recentCompleted;
    if (cancelTotal >= 5 && recentCancels / cancelTotal > 0.3) {
      alerts.push({ id: 'high_cancel', severity: 'warning', title: 'High Cancellation Rate', message: `${Math.round((recentCancels / cancelTotal) * 100)}% cancel rate in last hour (${recentCancels}/${cancelTotal})` });
    }

    if (failedOrders >= 3) {
      alerts.push({ id: 'failed_orders', severity: 'critical', title: 'Dispatch Failures Spike', message: `${failedOrders} order(s) failed dispatch in the last hour` });
    }

    if (longSearching > 0) {
      alerts.push({ id: 'long_search', severity: 'warning', title: 'Orders Stuck Searching', message: `${longSearching} order(s) have been searching for worker >10 minutes` });
    }

    if (alerts.length === 0) {
      alerts.push({ id: 'all_clear', severity: 'ok', title: 'All Systems Normal', message: 'No active alerts — platform is operating normally' });
    }

    res.json({ alerts, snapshot: { onlineWorkers, activeOrders, recentCancels, recentCompleted, failedOrders, longSearching }, checkedAt: now.toISOString() });
  } catch (err) { next(err); }
}

// ── Retention Cohorts ──────────────────────────────────────────────────────

async function getRetention(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 86_400_000);

    const [userCohort, workerCohort, dailyActiveUsers] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: since } } },
        { $group: { _id: '$userId', firstOrder: { $min: '$createdAt' }, lastOrder: { $max: '$createdAt' }, totalOrders: { $sum: 1 } } },
        { $project: {
          totalOrders: 1,
          returningD1:  { $cond: [{ $gte: [{ $subtract: ['$lastOrder', '$firstOrder'] }, 86_400_000] }, 1, 0] },
          returningD7:  { $cond: [{ $gte: [{ $subtract: ['$lastOrder', '$firstOrder'] }, 604_800_000] }, 1, 0] },
          returningD30: { $cond: [{ $gte: [{ $subtract: ['$lastOrder', '$firstOrder'] }, 2_592_000_000] }, 1, 0] },
        }},
        { $group: {
          _id: null,
          total:        { $sum: 1 },
          returningD1:  { $sum: '$returningD1' },
          returningD7:  { $sum: '$returningD7' },
          returningD30: { $sum: '$returningD30' },
          repeatBookers: { $sum: { $cond: [{ $gt: ['$totalOrders', 1] }, 1, 0] } },
        }},
      ]),

      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: since }, workerId: { $ne: null } } },
        { $group: { _id: { wid: '$workerId', week: { $week: '$createdAt' } } } },
        { $group: { _id: '$_id.wid', activeWeeks: { $sum: 1 } } },
        { $group: { _id: null, total: { $sum: 1 }, retained: { $sum: { $cond: [{ $gte: ['$activeWeeks', 2] }, 1, 0] } } } },
      ]),

      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, activeUsers: { $addToSet: '$userId' } } },
        { $project: { date: '$_id', dau: { $size: '$activeUsers' } } },
        { $sort: { date: 1 } },
      ]),
    ]);

    const u = userCohort[0] || { total: 0, returningD1: 0, returningD7: 0, returningD30: 0, repeatBookers: 0 };
    const w = workerCohort[0] || { total: 0, retained: 0 };
    const t = u.total || 1;

    res.json({
      sinceDays: days,
      users: {
        total: u.total,
        repeatBookers: u.repeatBookers,
        repeatRate:    Math.round((u.repeatBookers / t) * 100),
        d1Retention:   Math.round((u.returningD1  / t) * 100),
        d7Retention:   Math.round((u.returningD7  / t) * 100),
        d30Retention:  Math.round((u.returningD30 / t) * 100),
      },
      workers: {
        total: w.total,
        retained: w.retained,
        weeklyRetentionRate: w.total > 0 ? Math.round((w.retained / w.total) * 100) : 0,
      },
      dailyActiveUsers: dailyActiveUsers.map(d => ({ date: d.date, dau: d.dau })),
    });
  } catch (err) { next(err); }
}

// ── Support Tickets ────────────────────────────────────────────────────────

async function listSupportTickets(req, res, next) {
  try {
    const SupportTicket = require('../engagement/support-ticket.model');
    const page = Number(req.query.page) || 1;
    const limit = 30;
    const filter = {};
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ priority: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SupportTicket.countDocuments(filter),
    ]);
    res.json({ tickets, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

async function replyToSupportTicket(req, res, next) {
  try {
    const SupportTicket = require('../engagement/support-ticket.model');
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const update = {
      $push: { messages: { from: 'admin', fromId: req.auth.sub, text: req.body.text, at: new Date() } },
    };
    const setFields = {};
    if (!ticket.firstResponseAt) setFields.firstResponseAt = new Date();
    if (req.body.status) {
      setFields.status = req.body.status;
      if (req.body.status === 'resolved') setFields.resolvedAt = new Date();
    }
    if (Object.keys(setFields).length) update.$set = setFields;
    const updated = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true });
    await auditService.fromRequest(req, 'admin.support_reply', { kind: 'ticket', id: req.params.id }, null, { text: req.body.text, status: req.body.status });
    res.json({ ticket: updated });
  } catch (err) { next(err); }
}

// ── Live Operations ────────────────────────────────────────────────────────

async function getLiveOps(req, res, next) {
  try {
    const [activeOrders, workerIds] = await Promise.all([
      Order.find({ status: { $in: ['searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] } })
        .select('_id status service pickupLocation createdAt workerId')
        .lean(),
      redis.zrange('workers:online', 0, 199),
    ]);

    let workerLocations = [];
    if (workerIds.length > 0) {
      const positions = await redis.geopos('workers:online', ...workerIds);
      positions.forEach((pos, i) => {
        if (pos && pos[0] != null) {
          workerLocations.push({ id: workerIds[i], lng: parseFloat(pos[0]), lat: parseFloat(pos[1]) });
        }
      });
    }

    const byStatus = {};
    for (const o of activeOrders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

    res.json({
      activeOrders: activeOrders.map(o => ({
        _id: o._id,
        status: o.status,
        service: o.service,
        lat: o.pickupLocation?.coordinates?.[1] ?? null,
        lng: o.pickupLocation?.coordinates?.[0] ?? null,
        createdAt: o.createdAt,
        hasWorker: !!o.workerId,
      })),
      workerLocations,
      counts: { total: activeOrders.length, byStatus, onlineWorkers: workerIds.length },
      checkedAt: new Date().toISOString(),
    });
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
  getGeoAnalytics,
  getDemandPatterns,
  getSystemHealth,
  getFeatureFlags, setFeatureFlag,
  getAlerts,
  getRetention,
  listSupportTickets, replyToSupportTicket,
  getLiveOps,
};
