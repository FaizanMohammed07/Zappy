const Order = require('../order/order.model');
const Worker = require('../worker/worker.model');
const User = require('../user/user.model');
const AuditLog = require('./audit-log.model');
const { redis } = require('../../config/redis');
const auditService = require('./audit.service');

// Analytics responses are cached in Redis to protect against expensive
// aggregation queries being fired on every dashboard refresh.
// Metrics: 30s TTL (near-real-time for ops). Revenue: 60s TTL.
async function cachedAnalytics(key, ttlSec, computeFn) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* Redis miss — fall through to compute */ }
  const result = await computeFn();
  try { await redis.set(key, JSON.stringify(result), 'EX', ttlSec); } catch (_) {}
  return result;
}

async function getRevenue(req, res, next) {
  try {
    const Transaction = require('../payment/transaction.model');
    const days = Math.min(Number(req.query.days) || 7, 90);
    // Cache keyed by day-window; 60s TTL since this is a historical report.
    const result = await cachedAnalytics(`admin:revenue:${days}`, 60, async () => {
      const since = new Date(Date.now() - days * 86400 * 1000);
      const [breakdown, byDay] = await Promise.all([
        Transaction.aggregate([
          { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: since } } },
          { $group: { _id: '$reason', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
        ]),
        Transaction.aggregate([
          { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: since } } },
          { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, totalPaise: { $sum: '$amountPaise' } } },
          { $sort: { '_id.day': 1 } },
        ]),
      ]);
      const totalPaise = breakdown.reduce((s, r) => s + r.totalPaise, 0);
      return {
        sinceDays: days, totalPaise, totalRupees: Math.round(totalPaise / 100),
        breakdown: breakdown.map((r) => ({ reason: r._id, totalPaise: r.totalPaise, totalRupees: Math.round(r.totalPaise / 100), count: r.count })),
        byDay: byDay.map((r) => ({ day: r._id.day, totalPaise: r.totalPaise, totalRupees: Math.round(r.totalPaise / 100) })),
      };
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function toggleDispatch(req, res, next) {
  try {
    const pricingService = require('../pricing/pricing.service');
    const { dispatchEnabled } = req.body;
    await pricingService.updateActiveConfig({ dispatchEnabled }, req.auth.sub);
    await auditService.fromRequest(req, 'admin.dispatch_toggle', { kind: 'system', id: null }, null, { dispatchEnabled });
    const activeOrderCount = await Order.countDocuments({
      status: { $in: ['created', 'searching'] },
    });
    res.json({
      dispatchEnabled,
      activeOrderCount,
      message: dispatchEnabled
        ? 'Dispatch enabled — queued orders will resume processing'
        : `Dispatch paused — ${activeOrderCount} order(s) will re-queue every 60s until re-enabled`,
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
    const Transaction = require('../payment/transaction.model');
    // 30-second cache: fresh enough for ops dashboards, avoids hammering Mongo on every poll.
    const result = await cachedAnalytics('admin:metrics', 30, async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [ordersToday, active, completedToday, orderRevenueAgg, platformRevenueAgg, onlineWorkers, totalWorkers, totalUsers] = await Promise.all([
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        Order.countDocuments({ status: { $in: ['searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] } }),
        Order.countDocuments({ status: 'completed', completedAt: { $gte: startOfDay } }),
        // GMV: prefer paise field (precise, added post-#51 fix); fall back to total×100 for old orders.
        Order.aggregate([
          { $match: { status: 'completed', completedAt: { $gte: startOfDay } } },
          {
            $group: {
              _id: null,
              gmvPaise: { $sum: { $ifNull: ['$pricing.totalPaise', { $multiply: ['$pricing.total', 100] }] } },
              avgFarePaise: { $avg: { $ifNull: ['$pricing.totalPaise', { $multiply: ['$pricing.total', 100] }] } },
            },
          },
        ]),
        // Platform revenue: commission credited to platform wallet from Transaction ledger (paise).
        Transaction.aggregate([
          { $match: { 'owner.kind': 'platform', status: 'succeeded', createdAt: { $gte: startOfDay } } },
          { $group: { _id: null, revenuePaise: { $sum: '$amountPaise' } } },
        ]),
        Worker.countDocuments({ isOnline: true }),
        Worker.countDocuments(),
        User.countDocuments(),
      ]);
      const gmvPaise         = orderRevenueAgg[0]?.gmvPaise || 0;
      const avgFarePaise     = orderRevenueAgg[0]?.avgFarePaise || 0;
      const platformRevPaise = platformRevenueAgg[0]?.revenuePaise || 0;
      // Implied commission sanity check: should be ≈ configured commission rate (#52).
      const impliedCommissionPct = gmvPaise > 0
        ? Math.round((platformRevPaise / gmvPaise) * 1000) / 10
        : null;
      return {
        ordersToday, active, completedToday,
        gmvToday: Math.round(gmvPaise / 100),
        gmvTodayPaise: gmvPaise,
        revenueToday: Math.round(platformRevPaise / 100),
        revenueTodayPaise: platformRevPaise,
        impliedCommissionPct,
        avgFare: Math.round(avgFarePaise / 100),
        onlineWorkers, totalWorkers, totalUsers,
      };
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function listOrders(req, res, next) {
  try {
    const { status, service, city, from, to, page = 1, limit = 50 } = req.query;
    const q = {};
    if (status) q.status = status;
    if (service) q.service = service;
    // Date range filter
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to)   q.createdAt.$lte = new Date(to);
    }
    // City filter via pickup address substring (case-insensitive, no RegExp injection).
    if (city) {
      // Escape special regex chars to prevent ReDoS.
      const safeCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q['pickupLocation.address'] = { $regex: safeCity, $options: 'i' };
    }
    const [orders, total] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit))
        .populate('userId', 'name phone').populate('workerId', 'name phone rating').lean(),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
}

async function listWorkers(req, res, next) {
  try {
    const { q, skill, online, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      // Escape special regex characters to prevent ReDoS attacks.
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: new RegExp(safeQ, 'i') }, { phone: new RegExp(safeQ, 'i') }];
    }
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

    // Full geo pool removal (geo hash + skills sets + alive zset) not just zrem.
    const geoService = require('../worker/geo.service');
    await geoService.markOffline(String(req.params.id));

    // When BLOCKING: find any active order and re-dispatch so the user is not
    // left stranded with an assigned-but-blocked worker.
    if (req.body.blocked) {
      const activeOrder = await Order.findOne({
        workerId: req.params.id,
        status: { $in: ['assigned', 'on_the_way', 'arrived'] },
      }).lean();
      if (activeOrder) {
        const orderService = require('../order/order.service');
        await orderService.workerCancel({
          orderId: String(activeOrder._id),
          workerId: String(req.params.id),
          reason: 'admin_blocked_worker',
        }).catch((err) => {
          // Best-effort — log but don't fail the block action.
          const logger = require('../../utils/logger');
          logger.error({ err: err.message, orderId: activeOrder._id }, 'Failed to re-dispatch on worker block');
        });
      }
    }

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
    const now = new Date();
    const newRejectionCount = (before.kyc?.rejectionCount || 0) + 1;
    const SUSPENSION_THRESHOLD = 5;
    const worker = await Worker.findByIdAndUpdate(req.params.id, {
      $set: {
        'kyc.status':          newRejectionCount >= SUSPENSION_THRESHOLD ? 'suspended' : 'rejected',
        'kyc.reviewedAt':      now,
        'kyc.reviewedBy':      req.auth.sub,
        'kyc.rejectionReason': req.body.reason,
        'kyc.lastRejectedAt':  now,        // cooldown reference (#86)
        'kyc.rejectionCount':  newRejectionCount,
        isOnline: false, isAvailable: false,
      },
      // Mark the latest history entry as rejected
      $set: { 'kyc.submissionHistory.$[last].outcome': 'rejected', 'kyc.submissionHistory.$[last].rejectionReason': req.body.reason },
    }, {
      new: true,
      arrayFilters: [{ 'last.outcome': 'pending' }],
    });
    await redis.zrem('workers:online', String(req.params.id));
    await auditService.fromRequest(req, 'admin.kyc_reject', { kind: 'worker', id: req.params.id }, before.kyc, worker.kyc);
    res.json({ worker, suspended: newRejectionCount >= SUSPENSION_THRESHOLD });
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
    await redis.set('config:pricing', JSON.stringify(req.body), 'EX', 86400);
    await auditService.fromRequest(req, 'admin.pricing_config_update', { kind: 'system', id: null }, before, req.body);
    res.json({ ok: true, config: req.body });
  } catch (err) { next(err); }
}

async function getHeatmap(req, res, next) {
  try {
    const minutes = Number(req.query.minutes) || 60;
    // 30s cache keyed by window size — heatmap visual doesn't need sub-second freshness.
    // Two uncached aggregations polled at 30s = expensive at scale.
    const result = await cachedAnalytics(`admin:heatmap:${minutes}`, 30, async () => {
      const since = new Date(Date.now() - minutes * 60 * 1000);
      const DemandEvent = require('../analytics/demand-event.model');
      const [demandPoints, recentOrders] = await Promise.all([
        DemandEvent.aggregate([
          { $match: { createdAt: { $gte: since } } },
          {
            $group: {
              _id: '$bucket',
              count: { $sum: 1 },
              lat: { $first: '$lat' },
              lng: { $first: '$lng' },
              services: { $addToSet: '$service' },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 500 },
        ]),
        Order.find({ createdAt: { $gte: since } })
          .select('pickupLocation status service').lean(),
      ]);
      return {
        points: recentOrders.map((o) => ({
          lng: o.pickupLocation.coordinates[0],
          lat: o.pickupLocation.coordinates[1],
          status: o.status,
          service: o.service,
        })),
        demandBuckets: demandPoints.map((b) => ({
          lat: b.lat, lng: b.lng,
          count: b.count,
          services: b.services.filter(Boolean),
        })),
        windowMinutes: minutes,
      };
    });
    res.json(result);
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

    // 5-minute cache — 10 parallel aggregations on potentially millions of Order docs.
    // Admin analytics is historical data; 5-min staleness is acceptable.
    const cached = await redis.get(`admin:analytics:${days}`).catch(() => null);
    if (cached) { try { return res.json(JSON.parse(cached)); } catch { /* fall through */ } }

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
    };
    redis.set(`admin:analytics:${days}`, JSON.stringify(payload), 'EX', 300).catch(() => {});
    res.json(payload);
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

// ── Payment Refund ─────────────────────────────────────────────────────────

async function refundOrder(req, res, next) {
  try {
    const PaymentIntent = require('../payment/payment-intent.model');
    const Transaction   = require('../payment/transaction.model');
    const walletService = require('../wallet/wallet.service');
    const razorpay      = require('../payment/razorpay.client');

    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    /* Only refund online-paid orders */
    if (order.payment?.method === 'cash') {
      return res.status(400).json({ error: 'Cash orders cannot be refunded through this endpoint' });
    }
    if (order.payment?.status !== 'paid') {
      return res.status(400).json({ error: 'Order has not been paid — nothing to refund' });
    }

    const intent = await PaymentIntent.findOne({
      orderId: order._id,
      status: 'captured',
    }).lean();

    if (!intent) {
      return res.status(404).json({ error: 'No captured payment found for this order' });
    }

    const refundPaise = req.body.amountPaise
      ? Math.min(Number(req.body.amountPaise), intent.amountPaise)
      : intent.amountPaise;

    /* Trigger Razorpay refund */
    let rzpRefund;
    try {
      rzpRefund = await razorpay.refundPayment(intent.razorpayPaymentId, refundPaise);
    } catch (err) {
      return res.status(502).json({ error: `Razorpay refund failed: ${err.message}` });
    }

    /* Credit user wallet with the refund amount */
    await walletService.apply({
      kind: 'user',
      id: order.userId,
      type: 'credit',
      amountPaise: refundPaise,
      reason: Transaction.REASONS.ADMIN_ADJUSTMENT_CREDIT,
      idempotencyKey: `refund:${rzpRefund.id}`,
      refs: { orderId: order._id, paymentIntentId: intent._id },
      description: `Refund for order ${order._id} — admin initiated`,
      metadata: { adminId: req.auth.sub, rzpRefundId: rzpRefund.id },
    });

    /* Mark payment intent refunded */
    await PaymentIntent.findByIdAndUpdate(intent._id, {
      $set: { status: 'refunded' },
      $push: { events: { event: 'admin.refund', payload: { refundId: rzpRefund.id, amountPaise: refundPaise, adminId: req.auth.sub } } },
    });

    /* Update order payment status */
    await Order.findByIdAndUpdate(order._id, { $set: { 'payment.status': 'refunded' } });

    await auditService.fromRequest(
      req, 'admin.order_refund',
      { kind: 'order', id: req.params.id },
      { paymentStatus: 'paid' },
      { refundPaise, rzpRefundId: rzpRefund.id }
    );

    logger.info({ orderId: order._id, refundPaise, rzpRefundId: rzpRefund.id, admin: req.auth.sub }, '[Admin] Order refunded');

    res.json({
      ok: true,
      refundPaise,
      refundRupees: Math.round(refundPaise / 100),
      rzpRefundId: rzpRefund.id,
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
    await redis.set(FLAG_KEY, JSON.stringify(flags), 'EX', 86400);
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
    // 10s cache — admin live-ops map updates fast enough at 10s; the full
    // Order.find() of all active orders is expensive at scale (~100+ docs × 30s poll).
    const result = await cachedAnalytics('admin:liveops', 10, async () => {
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

      return {
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
      };
    });
    res.json(result);
  } catch (err) { next(err); }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CASHBACK CONFIG + STATS
───────────────────────────────────────────────────────────────────────────── */

async function getCashbackConfig(req, res, next) {
  try {
    const cashbackService = require('../wallet/cashback.service');
    const rules = await cashbackService.getRules();
    res.json({ config: rules });
  } catch (err) { next(err); }
}

async function setCashbackConfig(req, res, next) {
  try {
    const cashbackService = require('../wallet/cashback.service');
    const updated = await cashbackService.setRules(req.body);
    await auditService.fromRequest(req, 'admin.cashback_config_update', { kind: 'system', id: null }, null, req.body);
    res.json({ config: updated });
  } catch (err) { next(err); }
}

async function getCashbackStats(req, res, next) {
  try {
    const Transaction = require('../payment/transaction.model');
    const days = Math.min(Number(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 86400_000);

    const [agg, byDay, topOrders] = await Promise.all([
      Transaction.aggregate([
        { $match: { reason: 'cashback', status: 'succeeded', createdAt: { $gte: since } } },
        { $group: { _id: null, totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { reason: 'cashback', status: 'succeeded', createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Transaction.find({ reason: 'cashback', status: 'succeeded', createdAt: { $gte: since } })
        .sort({ amountPaise: -1 }).limit(10)
        .select('amountPaise refOrderId owner createdAt description').lean(),
    ]);

    res.json({
      days,
      totalPaise:   agg[0]?.totalPaise || 0,
      totalRupees:  Math.round((agg[0]?.totalPaise || 0) / 100),
      totalCount:   agg[0]?.count || 0,
      avgPaise:     agg[0]?.count ? Math.round((agg[0].totalPaise || 0) / agg[0].count) : 0,
      byDay:        byDay.map((d) => ({ day: d._id, totalPaise: d.totalPaise, totalRupees: Math.round(d.totalPaise / 100), count: d.count })),
      topOrders:    topOrders.map((t) => ({ amountRupees: Math.round(t.amountPaise / 100), orderId: t.refOrderId, userId: t.owner?.id, at: t.createdAt, description: t.description })),
    });
  } catch (err) { next(err); }
}

/* ─────────────────────────────────────────────────────────────────────────────
   REFERRAL STATS
───────────────────────────────────────────────────────────────────────────── */

async function getReferralStats(req, res, next) {
  try {
    const { ReferralUse, ReferralCode } = require('../referral/referral.model');
    const Transaction = require('../payment/transaction.model');
    const days = Math.min(Number(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 86400_000);

    const [totalUses, rewarded, rewardSpend, topReferrers] = await Promise.all([
      ReferralUse.countDocuments({ createdAt: { $gte: since } }),
      ReferralUse.countDocuments({ status: 'rewarded', createdAt: { $gte: since } }),
      Transaction.aggregate([
        { $match: { reason: 'referral_reward', status: 'succeeded', createdAt: { $gte: since } } },
        { $group: { _id: null, totalPaise: { $sum: '$amountPaise' } } },
      ]),
      ReferralUse.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$referrer.id', count: { $sum: 1 }, rewarded: { $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      days,
      totalSignups:      totalUses,
      converted:         rewarded,
      conversionPct:     totalUses ? Math.round((rewarded / totalUses) * 100) : 0,
      totalSpendPaise:   rewardSpend[0]?.totalPaise || 0,
      totalSpendRupees:  Math.round((rewardSpend[0]?.totalPaise || 0) / 100),
      topReferrers:      topReferrers.map((r) => ({ referrerId: r._id, signups: r.count, converted: r.rewarded })),
    });
  } catch (err) { next(err); }
}

async function listRecentReferrals(req, res, next) {
  try {
    const { ReferralUse } = require('../referral/referral.model');
    const page = Number(req.query.page) || 1;
    const limit = 50;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const [uses, total] = await Promise.all([
      ReferralUse.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ReferralUse.countDocuments(filter),
    ]);
    res.json({ uses, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEFERRED MILESTONES
───────────────────────────────────────────────────────────────────────────── */

async function listDeferredMilestones(req, res, next) {
  try {
    const stream = redis.scanStream({ match: 'incentive:deferred:*:*', count: 200 });
    const keys = [];
    for await (const batch of stream) keys.push(...batch);

    const results = await Promise.all(keys.map(async (key) => {
      const raw = await redis.get(key);
      if (!raw) return null;
      try {
        const data = JSON.parse(raw);
        const parts = key.split(':'); // incentive:deferred:workerId:milestone
        return { workerId: parts[2], milestone: parts[3], ...data, key };
      } catch { return null; }
    }));

    res.json({ deferred: results.filter(Boolean), count: results.filter(Boolean).length });
  } catch (err) { next(err); }
}

async function releaseDeferredMilestone(req, res, next) {
  try {
    const { workerId, milestone } = req.params;
    const key = `incentive:deferred:${workerId}:${milestone}`;
    const raw = await redis.get(key);
    if (!raw) return res.status(404).json({ error: 'Deferred milestone not found or already released' });

    const data = JSON.parse(raw);
    const walletService = require('../wallet/wallet.service');
    const Transaction = require('../payment/transaction.model');

    await walletService.apply({
      kind: 'worker',
      id: workerId,
      type: 'credit',
      amountPaise: data.bonusPaise,
      reason: Transaction.REASONS.ADMIN_ADJUSTMENT_CREDIT,
      idempotencyKey: `incentive:milestone:${workerId}:${milestone}:admin_release`,
      description: `Milestone ${milestone} bonus — admin released after rating improvement`,
    });

    await redis.del(key);
    await auditService.fromRequest(req, 'admin.deferred_milestone_release',
      { kind: 'worker', id: workerId }, null, { milestone, bonusPaise: data.bonusPaise });

    const notificationService = require('../notification/notification.service');
    notificationService.notify({
      recipient: { kind: 'worker', id: workerId },
      type: 'wallet_credited',
      title: `🏆 Milestone #${milestone} bonus released!`,
      body: `₹${data.bonusPaise / 100} has been credited to your wallet`,
      deepLink: '/wallet',
    }).catch(() => {});

    res.json({ ok: true, bonusPaise: data.bonusPaise });
  } catch (err) { next(err); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUSINESS INTELLIGENCE ENDPOINTS (scenarios 81-85)
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Per-service P&L — revenue, worker cost, and platform margin. (#83)
 * Uses earnings snapshots locked at completion for accuracy.
 * GMV ≠ revenue: GMV is what the customer paid; revenue is the platform's cut.
 */
async function getServicePnL(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const since = new Date(Date.now() - days * 86_400_000);

    const pnl = await cachedAnalytics(`admin:pnl:${days}`, 120, async () => {
      const rows = await Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since } } },
        {
          $group: {
            _id: '$service',
            orders:        { $sum: 1 },
            // GMV: total paid by customers (prefer paise field for precision)
            gmvPaise:      { $sum: { $ifNull: ['$pricing.totalPaise', { $multiply: ['$pricing.total', 100] }] } },
            // Platform revenue: actual commission earned
            revenuePaise:  { $sum: { $ifNull: ['$earnings.platformPaise', 0] } },
            // Worker cost: what the platform paid out to workers
            workerPaise:   { $sum: { $ifNull: ['$earnings.workerPaise', 0] } },
            avgFare:       { $avg: { $ifNull: ['$pricing.totalPaise', { $multiply: ['$pricing.total', 100] }] } },
            avgCommission: { $avg: '$earnings.commissionRate' },
          },
        },
        { $sort: { gmvPaise: -1 } },
      ]);

      return rows.map((r) => {
        const marginPct = r.gmvPaise > 0
          ? Math.round((r.revenuePaise / r.gmvPaise) * 1000) / 10
          : 0;
        // Profitability signal: if commission rate drops well below config (e.g. due to Pro workers)
        const isLowMargin = marginPct < 15; // below 15% platform cut is a warning
        return {
          service:         r._id,
          orders:          r.orders,
          gmvRupees:       Math.round(r.gmvPaise / 100),
          revenueRupees:   Math.round(r.revenuePaise / 100),
          workerCostRupees: Math.round(r.workerPaise / 100),
          marginPct,
          avgFareRupees:   Math.round((r.avgFare || 0) / 100),
          avgCommissionPct: Math.round((r.avgCommission || 0) * 1000) / 10,
          isLowMargin,
          isUnprofitable: r.revenuePaise <= 0 && r.orders > 0,
        };
      });
    });

    res.json({ sinceDays: days, services: pnl });
  } catch (err) { next(err); }
}

/**
 * Worker churn risk — identifies workers at risk of leaving due to low earnings. (#81)
 * Thresholds are business-configurable in the response but default to:
 *   - Weekly earnings < ₹500 = at-risk
 *   - No job in 7 days but was active = dormant
 *   - Cancel/reject rate above 20% = quality risk (likely to be deactivated)
 */
async function getChurnRisk(req, res, next) {
  try {
    const EARNINGS_FLOOR_PAISE = 50_000; // ₹500/week threshold
    const since7d  = new Date(Date.now() - 7  * 86_400_000);
    const since14d = new Date(Date.now() - 14 * 86_400_000);

    const [lowEarners, dormant, highCancel] = await Promise.all([
      // Workers with < ₹500 earnings this week who have completed at least 1 job
      Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since7d }, workerId: { $ne: null } } },
        { $group: { _id: '$workerId', weeklyPaise: { $sum: '$earnings.workerPaise' }, jobs: { $sum: 1 } } },
        { $match: { weeklyPaise: { $lt: EARNINGS_FLOOR_PAISE } } },
        { $sort: { weeklyPaise: 1 } },
        { $limit: 50 },
        { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'w' } },
        { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
        { $project: {
          workerId: '$_id', name: '$w.name', phone: '$w.phone', skills: '$w.skills',
          weeklyPaise: 1, weeklyRupees: { $round: [{ $divide: ['$weeklyPaise', 100] }, 0] }, jobs: 1,
        }},
      ]),

      // Workers who were active 8-14 days ago but have 0 jobs in last 7 days (going dormant)
      Worker.aggregate([
        { $lookup: {
          from: 'orders',
          let: { wid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$workerId', '$$wid'] }, status: 'completed', completedAt: { $gte: since7d } } },
            { $count: 'n' },
          ],
          as: 'recent',
        }},
        { $lookup: {
          from: 'orders',
          let: { wid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$workerId', '$$wid'] }, status: 'completed', completedAt: { $gte: since14d, $lt: since7d } } },
            { $count: 'n' },
          ],
          as: 'prevWeek',
        }},
        { $match: {
          $expr: {
            $and: [
              { $eq: [{ $size: '$recent' }, 0] },
              { $gt: [{ $ifNull: [{ $first: '$prevWeek.n' }, 0] }, 0] },
            ],
          },
          isBlocked: false,
        }},
        { $project: { name: 1, phone: 1, skills: 1, completedJobs: 1 } },
        { $limit: 30 },
      ]),

      // High cancel/reject rate workers (likely to churn or be auto-deactivated)
      Worker.find(
        {
          isBlocked: false,
          'penalties.totalOffers': { $gt: 5 },
          $expr: { $gt: [{ $divide: ['$penalties.totalRejects', { $max: ['$penalties.totalOffers', 1] }] }, 0.4] },
        },
        { name: 1, phone: 1, skills: 1, penalties: 1, completedJobs: 1, rating: 1 }
      ).limit(30).lean(),
    ]);

    res.json({
      earningsFloorRupees: EARNINGS_FLOOR_PAISE / 100,
      lowEarners:   lowEarners.length,
      dormant:      dormant.length,
      highCancelRate: highCancel.length,
      total:        lowEarners.length + dormant.length + highCancel.length,
      details: { lowEarners, dormant, highCancelRate: highCancel },
    });
  } catch (err) { next(err); }
}

/**
 * Dead category report — services with 0 orders in the last N days. (#84)
 * Used to decide whether to disable a service and free up UX space.
 */
async function getDeadCategories(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const since = new Date(Date.now() - days * 86_400_000);
    const ServiceCatalog = require('../service/service-catalog.model');

    const [activeServices, usedServices] = await Promise.all([
      ServiceCatalog.find({ isActive: true }, { code: 1, name: 1, category: 1, priceRangeMinPaise: 1 }).lean(),
      Order.distinct('service', { createdAt: { $gte: since } }),
    ]);

    const usedSet = new Set(usedServices);
    const dead = activeServices
      .filter((s) => !usedSet.has(s.code))
      .map((s) => ({ code: s.code, name: s.name, category: s.category, daysSinceLastOrder: days }));

    // Also get last order date for partially-dead services (low usage)
    const lowUsage = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, service: { $in: activeServices.map((s) => s.code) } } },
      { $group: { _id: '$service', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
      { $match: { count: { $lte: 2 } } }, // less than 3 orders in the window
      { $sort: { count: 1 } },
    ]);

    res.json({
      windowDays: days,
      dead: { count: dead.length, services: dead },
      lowUsage: {
        count: lowUsage.length,
        threshold: 3,
        services: lowUsage.map((s) => ({
          service: s._id, count: s.count, lastOrderAt: s.last,
        })),
      },
      recommendation: dead.length > 0
        ? `${dead.length} active service(s) have had 0 orders in ${days} days. Consider disabling them.`
        : 'All active services received orders in the window.',
    });
  } catch (err) { next(err); }
}

/**
 * Geo readiness — tells admin whether a lat/lng area has enough workers
 * to reliably fulfil orders. Used before launching in a new city. (#85)
 */
async function getGeoReadiness(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(Number(req.query.radiusKm) || 15, 50);

    if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Valid lat and lng required' });
    }

    const [totalWorkers, approvedWorkers, onlineWorkers, recentOrders] = await Promise.all([
      // Total registered workers in radius
      Worker.countDocuments({
        currentLocation: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } },
      }),
      // KYC-approved workers
      Worker.countDocuments({
        currentLocation: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } },
        'kyc.status': 'approved',
        isBlocked: false,
      }),
      // Currently online workers (Redis GEO)
      (async () => {
        try {
          const { redis: r } = require('../../config/redis');
          const res2 = await r.geosearch('workers:online', 'FROMLONLAT', lng, lat, 'BYRADIUS', radiusKm, 'km', 'COUNT', 100).catch(() => []);
          return Array.isArray(res2) ? res2.length : 0;
        } catch { return 0; }
      })(),
      // Orders attempted in this area in the last 30 days
      Order.countDocuments({
        pickupLocation: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } },
        createdAt: { $gte: new Date(Date.now() - 30 * 86_400_000) },
      }),
    ]);

    // Skills coverage: which services have at least 1 approved worker?
    const workerSkills = await Worker.find(
      {
        currentLocation: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } },
        'kyc.status': 'approved', isBlocked: false,
      },
      { skills: 1 }
    ).lean();
    const coveredSkills = [...new Set(workerSkills.flatMap((w) => w.skills || []))].sort();

    const isReady = approvedWorkers >= 5; // minimum viable: 5 approved workers in radius
    const isOperational = onlineWorkers >= 2;

    res.json({
      lat, lng, radiusKm,
      totalWorkers,
      approvedWorkers,
      onlineWorkers,
      recentOrders,
      coveredSkills,
      isReady,
      isOperational,
      readinessScore: Math.min(100, Math.round((approvedWorkers / 5) * 60 + (onlineWorkers / 3) * 40)),
      recommendation: !isReady
        ? `Need ${Math.max(0, 5 - approvedWorkers)} more approved worker(s) before launching in this area.`
        : isOperational
          ? 'Area is operational — sufficient workers online and approved.'
          : 'Area has approved workers but none currently online. Arrange a soft launch.',
    });
  } catch (err) { next(err); }
}

/**
 * Quote abandonment stats — quotes fetched but no order placed within 10 min. (#82)
 * Proxy for price sensitivity: high abandonment at a given price = price too high.
 */
async function getQuoteAbandonmentStats(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 7, 30);
    const since = new Date(Date.now() - days * 86_400_000);
    const { redis: r } = require('../../config/redis');

    // Quote events are recorded in Redis sorted set: quote:{service}:{date} → count
    // (recorded by recordDemand calls from the quote endpoint)
    // We approximate abandonment as: quotes - orders placed in same window per service
    const [quoteCounts, orderCounts] = await Promise.all([
      // Orders that reached 'searching' or beyond = confirmed bookings
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$service', orders: { $sum: 1 } } },
      ]),
      // Total quotes: currently stored in demand Redis keys (approximate)
      // For a precise count, we'd need a separate quote-event log.
      // Return the data we have with a note about approximation.
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $in: ['cancelled', 'failed'] } } },
        { $group: { _id: '$service', earlyExits: { $sum: 1 } } },
      ]),
    ]);

    const orderMap    = Object.fromEntries(orderCounts.map((r2) => [r2._id, r2.orders]));
    const earlyExitMap = Object.fromEntries(quoteCounts.map((r2) => [r2._id, r2.earlyExits]));

    // High early-exit rate (cancelled/failed ÷ total) = proxy for price sensitivity
    const allServices = [...new Set([...Object.keys(orderMap), ...Object.keys(earlyExitMap)])];
    const sensitivity = allServices
      .map((svc) => {
        const total = orderMap[svc] || 0;
        const exits = earlyExitMap[svc] || 0;
        const exitRate = total > 0 ? Math.round((exits / total) * 100) : 0;
        return { service: svc, total, earlyExits: exits, exitRatePct: exitRate };
      })
      .filter((s) => s.total >= 5) // minimum sample
      .sort((a, b) => b.exitRatePct - a.exitRatePct);

    res.json({
      windowDays: days,
      note: 'exitRatePct = (cancelled+failed) ÷ total orders — proxy for price-driven abandonment',
      highSensitivity: sensitivity.filter((s) => s.exitRatePct > 30),
      all: sensitivity,
    });
  } catch (err) { next(err); }
}

module.exports = {
  getRevenue, updateToggles, toggleDispatch, getMetrics,
  listOrders, listWorkers, blockWorker,
  listUsers, blockUser,
  getAuditLogs, approveKyc, rejectKyc, listKycPending,
  getPricingConfig, setPricingConfig,
  getHeatmap, getAnalytics,
  getIncentiveConfig, setIncentiveMilestones, runRatingBonusSweep,
  getCashbackConfig, setCashbackConfig, getCashbackStats,
  getReferralStats, listRecentReferrals,
  listDeferredMilestones, releaseDeferredMilestone,
  adjustWallet, reconcileWallet,
  refundOrder,
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
  // Business intelligence (81-85)
  getServicePnL,
  getChurnRisk,
  getDeadCategories,
  getGeoReadiness,
  getQuoteAbandonmentStats,
};
