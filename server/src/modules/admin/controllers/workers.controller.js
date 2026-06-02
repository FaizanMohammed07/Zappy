const Worker = require('../../worker/worker.model');
const Order = require('../../order/order.model');
const { redis } = require('../../../config/redis');
const auditService = require('../audit.service');

async function listWorkers(req, res, next) {
  try {
    const { q, skill, online, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (q) {
      // Escape special regex characters to prevent ReDoS attacks.
      const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: new RegExp(safeQ, 'i') },
        { phone: new RegExp(safeQ, 'i') },
      ];
    }
    if (skill) filter.skills = skill;
    if (online !== undefined) filter.isOnline = online === 'true';
    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Worker.countDocuments(filter),
    ]);
    res.json({ workers, total });
  } catch (err) {
    next(err);
  }
}

async function blockWorker(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id)
      .select('isBlocked')
      .lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isBlocked: req.body.blocked,
          isOnline: false,
          isAvailable: false,
        },
      },
      { new: true },
    );

    // Full geo pool removal (geo hash + skills sets + alive zset) not just zrem.
    const geoService = require('../../worker/geo.service');
    await geoService.markOffline(String(req.params.id));

    // When BLOCKING: find any active order and re-dispatch so the user is not
    // left stranded with an assigned-but-blocked worker.
    if (req.body.blocked) {
      const activeOrder = await Order.findOne({
        workerId: req.params.id,
        status: { $in: ['assigned', 'on_the_way', 'arrived'] },
      }).lean();
      if (activeOrder) {
        const orderService = require('../../order/order.service');
        await orderService
          .workerCancel({
            orderId: String(activeOrder._id),
            workerId: String(req.params.id),
            reason: 'admin_blocked_worker',
          })
          .catch((err) => {
            // Best-effort — log but don't fail the block action.
            const logger = require('../../../utils/logger');
            logger.error(
              { err: err.message, orderId: activeOrder._id },
              'Failed to re-dispatch on worker block',
            );
          });
      }
    }

    await auditService.fromRequest(
      req,
      req.body.blocked ? 'admin.worker_block' : 'admin.worker_unblock',
      { kind: 'worker', id: req.params.id },
      { isBlocked: before.isBlocked },
      { isBlocked: worker.isBlocked },
    );
    res.json({ worker });
  } catch (err) {
    next(err);
  }
}

async function approveKyc(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id).select('kyc').lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'kyc.status': 'approved',
          'kyc.reviewedAt': new Date(),
          'kyc.reviewedBy': req.auth.sub,
          'kyc.rejectionReason': null,
        },
      },
      { new: true },
    );
    await auditService.fromRequest(
      req,
      'admin.kyc_approve',
      { kind: 'worker', id: req.params.id },
      before.kyc,
      worker.kyc,
    );
    res.json({ worker });
  } catch (err) {
    next(err);
  }
}

async function rejectKyc(req, res, next) {
  try {
    const before = await Worker.findById(req.params.id).select('kyc').lean();
    if (!before) return res.status(404).json({ error: 'Worker not found' });
    const now = new Date();
    const newRejectionCount = (before.kyc?.rejectionCount || 0) + 1;
    const SUSPENSION_THRESHOLD = 5;
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'kyc.status':
            newRejectionCount >= SUSPENSION_THRESHOLD
              ? 'suspended'
              : 'rejected',
          'kyc.reviewedAt': now,
          'kyc.reviewedBy': req.auth.sub,
          'kyc.rejectionReason': req.body.reason,
          'kyc.lastRejectedAt': now, // cooldown reference (#86)
          'kyc.rejectionCount': newRejectionCount,
          isOnline: false,
          isAvailable: false,
        },
        // Mark the latest history entry as rejected
        $set: {
          'kyc.submissionHistory.$[last].outcome': 'rejected',
          'kyc.submissionHistory.$[last].rejectionReason': req.body.reason,
        },
      },
      {
        new: true,
        arrayFilters: [{ 'last.outcome': 'pending' }],
      },
    );
    await redis.zrem('workers:online', String(req.params.id));
    await auditService.fromRequest(
      req,
      'admin.kyc_reject',
      { kind: 'worker', id: req.params.id },
      before.kyc,
      worker.kyc,
    );
    res.json({ worker, suspended: newRejectionCount >= SUSPENSION_THRESHOLD });
  } catch (err) {
    next(err);
  }
}

async function listKycPending(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 50;
    const [workers, total] = await Promise.all([
      Worker.find({ 'kyc.status': 'pending_review' })
        .sort({ 'kyc.submittedAt': 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Worker.countDocuments({ 'kyc.status': 'pending_review' }),
    ]);
    res.json({ workers, total });
  } catch (err) {
    next(err);
  }
}

async function getWorkerPenaltyStats(req, res, next) {
  try {
    const worker = await Worker.findById(req.params.id)
      .select(
        'name phone penalties rating completedJobs totalJobs isBlocked isAvailable',
      )
      .lean();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const { redis: redisClient } = require('../../../config/redis');
    const rejectWindowRaw = await redisClient.lrange(
      `worker:offers:${req.params.id}`,
      0,
      -1,
    );
    const cancelStrikesRaw = await redisClient.get(
      `cancel:strikes:${req.params.id}`,
    );

    const recentRejectRate =
      rejectWindowRaw.length > 0
        ? rejectWindowRaw.filter((i) => i === 'reject' || i === 'timeout')
            .length / rejectWindowRaw.length
        : 0;

    const lifetimeRejectRate =
      (worker.penalties?.totalOffers || 0) > 0
        ? (worker.penalties.totalRejects || 0) / worker.penalties.totalOffers
        : 0;
    const lifetimeCancelRate =
      (worker.completedJobs || 0) > 0
        ? (worker.penalties?.totalCancels || 0) / worker.completedJobs
        : 0;

    res.json({
      worker: {
        _id: worker._id,
        name: worker.name,
        phone: worker.phone,
        isBlocked: worker.isBlocked,
        isAvailable: worker.isAvailable,
      },
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
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWorkers,
  blockWorker,
  approveKyc,
  rejectKyc,
  listKycPending,
  getWorkerPenaltyStats,
};
