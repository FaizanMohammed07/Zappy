const express = require('express');
const Joi = require('joi');
const ctrl = require('./admin.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/revenue', ctrl.getRevenue);

router.patch(
  '/toggles',
  validate(Joi.object({
    surgeEnabled: Joi.boolean(),
    surgeMaxCap: Joi.number().min(1).max(3),
    commissionRate: Joi.number().min(0).max(0.45),
    dispatchEnabled: Joi.boolean(),
  })),
  ctrl.updateToggles
);

router.get('/metrics', ctrl.getMetrics);
router.get('/orders', ctrl.listOrders);
router.get('/workers', ctrl.listWorkers);
router.post('/workers/:id/block', validate(Joi.object({ blocked: Joi.boolean().required() })), ctrl.blockWorker);
router.get('/audit-logs', ctrl.getAuditLogs);
router.post('/workers/:id/kyc/approve', ctrl.approveKyc);
router.post('/workers/:id/kyc/reject', validate(Joi.object({ reason: Joi.string().min(3).max(500).required() })), ctrl.rejectKyc);
router.get('/kyc/pending', ctrl.listKycPending);

router.get('/pricing-config', ctrl.getPricingConfig);
router.put(
  '/pricing-config',
  validate(Joi.object({
    baseFee: Joi.number().min(0),
    perKmFee: Joi.number().min(0),
    perMinFee: Joi.number().min(0),
    platformFee: Joi.number().min(0).max(100),     // ₹100 max flat fee
    minFare: Joi.number().min(0).max(1000),         // ₹1000 max minimum fare
    surgeMaxMultiplier: Joi.number().min(1).max(3), // 3× hard cap
    commissionRate: Joi.number().min(0).max(0.45),  // 45% hard cap
    // Earned Wage Advance
    earnedWageAdvanceEnabled: Joi.boolean(),
    earnedWageAdvanceRate:    Joi.number().min(0.1).max(0.9), // 10–90% of earned wages
    // Emergency Fund
    emergencyFundContributionRate: Joi.number().min(0).max(0.02), // max 2% of commission
    // Tips
    tipMaxPaise:  Joi.number().integer().min(0).max(100000),
    tipOptions:   Joi.array().items(Joi.number().integer().min(1)).max(6),
    // Referral
    referralReferrerBonusPaise: Joi.number().integer().min(0).max(100000),
    referralRefereeBonusPaise:  Joi.number().integer().min(0).max(50000),
  })),
  ctrl.setPricingConfig
);

// Cancellation fee configuration — previously only accessible via direct DB.
router.get('/cancellation-config', async (req, res, next) => {
  try {
    const cancellationService = require('../order/cancellation.service');
    const cfg = await cancellationService.getConfig();
    res.json({ config: cfg });
  } catch (err) { next(err); }
});

router.put(
  '/cancellation-config',
  validate(Joi.object({
    freeCancelWindowSec:         Joi.number().integer().min(0).max(600),
    userCancelFeeAssignedPaise:  Joi.number().integer().min(0).max(20000),
    userCancelFeeOnWayPaise:     Joi.number().integer().min(0).max(50000),
    userCancelFeeArrivedPaise:   Joi.number().integer().min(0).max(100000),
    workerCancelPenaltyPaise:    Joi.number().integer().min(0).max(50000),
    workerNoShowPenaltyPaise:    Joi.number().integer().min(0).max(100000),
    lateWorkerCancelMultiplier:  Joi.number().min(1).max(5),
  }).min(1)),
  async (req, res, next) => {
    try {
      const cancellationService = require('../order/cancellation.service');
      const auditService = require('./audit.service');
      const cfg = await cancellationService.updateConfig(req.body, req.auth.sub);
      await auditService.fromRequest(req, 'admin.cancellation_config_update', { kind: 'system', id: null }, null, req.body);
      res.json({ config: cfg });
    } catch (err) { next(err); }
  }
);

router.get('/heatmap', ctrl.getHeatmap);

// Dispatch kill-switch — pause/resume the dispatch engine without restarting the process
router.patch(
  '/dispatch/toggle',
  validate(Joi.object({ dispatchEnabled: Joi.boolean().required() })),
  ctrl.toggleDispatch
);

// SOS active incidents
router.get('/sos/active', async (req, res, next) => {
  try {
    const sosService = require('../worker/sos.service');
    const data = await sosService.getActiveSOSAlerts();
    res.json(data);
  } catch (err) { next(err); }
});

// Admin acknowledges an SOS — stops the 5-min re-escalation timer (#90)
router.post(
  '/sos/:incidentKey/acknowledge',
  validate(Joi.object({})),
  async (req, res, next) => {
    try {
      const sosService = require('../worker/sos.service');
      const result = await sosService.acknowledgeSOS({
        incidentKey: req.params.incidentKey,
        adminId: req.auth.sub,
      });
      res.json(result);
    } catch (err) { next(err); }
  }
);

// Emergency Fund management
router.get('/emergency-fund', async (req, res, next) => {
  try {
    const efSvc  = require('../worker/emergency-fund.service');
    const EmergencyFundClaim = require('../worker/emergency-fund.model');
    const [fund, claims] = await Promise.all([
      efSvc.getFundBalance(),
      EmergencyFundClaim.find().sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.json({ fund, claims });
  } catch (err) { next(err); }
});

router.post('/emergency-fund/:id/approve',
  validate(Joi.object({ adminNote: Joi.string().max(300).optional() })),
  async (req, res, next) => {
    try {
      const efSvc = require('../worker/emergency-fund.service');
      const claim = await efSvc.approveClaim({ claimId: req.params.id, adminId: req.auth.sub, adminNote: req.body.adminNote });
      res.json({ claim });
    } catch (err) { next(err); }
  }
);

router.post('/emergency-fund/:id/reject',
  validate(Joi.object({ adminNote: Joi.string().min(5).max(300).required() })),
  async (req, res, next) => {
    try {
      const efSvc = require('../worker/emergency-fund.service');
      const claim = await efSvc.rejectClaim({ claimId: req.params.id, adminId: req.auth.sub, adminNote: req.body.adminNote });
      res.json({ claim });
    } catch (err) { next(err); }
  }
);

// Payment refunds (admin-initiated)
router.post(
  '/orders/:id/refund',
  validate(Joi.object({
    amountPaise: Joi.number().integer().min(1).optional(),
    reason:      Joi.string().max(200).optional(),
  })),
  ctrl.refundOrder
);

// Wallet adjustments
router.post(
  '/wallet/adjust',
  validate(Joi.object({
    kind: Joi.string().valid('user', 'worker').required(),
    id: Joi.string().hex().length(24).required(),
    type: Joi.string().valid('credit', 'debit').required(),
    amountPaise: Joi.number().integer().min(1).max(10000000).required(),
    description: Joi.string().max(200).optional(),
  })),
  ctrl.adjustWallet
);
router.post('/wallet/reconcile/:kind/:id', ctrl.reconcileWallet);

// Users
router.get('/users', ctrl.listUsers);
router.post('/users/:id/block', validate(Joi.object({ blocked: Joi.boolean().required() })), ctrl.blockUser);

// Analytics
router.get('/analytics', ctrl.getAnalytics);

// ── Cashback config + analytics ─────────────────────────────────────────────
router.get('/cashback/config', ctrl.getCashbackConfig);
router.put(
  '/cashback/config',
  validate(Joi.object({
    enabled:             Joi.boolean(),
    rate:                Joi.number().min(0).max(0.30),   // max 30% cashback
    capPaise:            Joi.number().integer().min(0).max(50000), // max ₹500 cap
    firstOrderRate:      Joi.number().min(0).max(0.50),   // max 50% for first orders
    firstOrderThreshold: Joi.number().integer().min(1).max(10),
  }).min(1)),
  ctrl.setCashbackConfig
);
router.get('/cashback/stats', ctrl.getCashbackStats);

// ── Referral analytics ───────────────────────────────────────────────────────
router.get('/referrals/stats', ctrl.getReferralStats);
router.get('/referrals/recent', ctrl.listRecentReferrals);

// ── Deferred milestone review ────────────────────────────────────────────────
router.get('/incentives/deferred', ctrl.listDeferredMilestones);
router.post('/incentives/deferred/:workerId/:milestone/release', ctrl.releaseDeferredMilestone);

// Incentives
router.get('/incentives', ctrl.getIncentiveConfig);
router.put(
  '/incentives/milestones',
  validate(Joi.object({
    milestones: Joi.array().items(
      Joi.object({ jobs: Joi.number().integer().min(1).required(), bonusPaise: Joi.number().integer().min(0).required() })
    ).min(1).required(),
  })),
  ctrl.setIncentiveMilestones
);
router.post('/incentives/rating-sweep', ctrl.runRatingBonusSweep);

// Cancellation config
router.get('/cancellation-config', ctrl.getCancellationConfig);
router.patch(
  '/cancellation-config',
  validate(Joi.object({
    freeCancelWindowSec:        Joi.number().integer().min(0).max(3600),
    userCancelFeePaise:          Joi.number().integer().min(0),
    workerCancelPenaltyPaise:    Joi.number().integer().min(0),
    workerNoShowPenaltyPaise:    Joi.number().integer().min(0),
    lateWorkerCancelMultiplier:  Joi.number().min(1).max(10),
    workerRejectLimit:           Joi.number().integer().min(1),
    workerCancelLimit:           Joi.number().integer().min(1),
    workerCancelWindowSec:       Joi.number().integer().min(3600),
    rejectRatePenaltyWeight:     Joi.number().min(0).max(20),
    cancelRatePenaltyWeight:     Joi.number().min(0).max(20),
    notes:                       Joi.string().max(500).allow('', null),
  }).min(1)),
  ctrl.updateCancellationConfig
);

// Worker penalty stats
router.get('/workers/:id/penalties', ctrl.getWorkerPenaltyStats);

// Geographic analytics + demand patterns (heatmap data)
router.get('/geo-analytics', ctrl.getGeoAnalytics);
router.get('/demand-patterns', ctrl.getDemandPatterns);

// System health
router.get('/system/health', ctrl.getSystemHealth);

// Feature flags
router.get('/feature-flags', ctrl.getFeatureFlags);
router.post(
  '/feature-flags',
  validate(Joi.object({ flag: Joi.string().required(), enabled: Joi.boolean().required() })),
  ctrl.setFeatureFlag
);

// Alerts
router.get('/alerts', ctrl.getAlerts);

// Retention cohorts
router.get('/retention', ctrl.getRetention);

// Support tickets
router.get('/support', ctrl.listSupportTickets);
router.post(
  '/support/:id/reply',
  validate(Joi.object({
    text: Joi.string().min(1).max(2000).required(),
    status: Joi.string().valid('open', 'in_progress', 'waiting_user', 'resolved', 'closed').optional(),
  })),
  ctrl.replyToSupportTicket
);

// Live operations
router.get('/liveops', ctrl.getLiveOps);

// ── Notification Management ────────────────────────────────────────────────

// FCM health check — verifies Firebase Admin SDK is initialised and credentials are valid
router.get('/notifications/health', async (req, res, next) => {
  try {
    const projectId     = process.env.FIREBASE_PROJECT_ID;
    const clientEmail   = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey    = process.env.FIREBASE_PRIVATE_KEY;
    const configured    = !!(projectId && clientEmail && privateKey);

    if (!configured) {
      return res.json({ ok: false, configured: false, message: 'Firebase Admin env vars not set. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.' });
    }
    // Try to initialise the SDK (lazy) — if it throws, credentials are wrong
    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) });
      }
      res.json({ ok: true, configured: true, projectId, message: 'Firebase Admin SDK ready.' });
    } catch (err) {
      res.json({ ok: false, configured: true, error: err.message, message: 'Firebase credentials invalid.' });
    }
  } catch (err) { next(err); }
});

// Delivery stats — sent/failed/skipped per notification type over N days
router.get('/notifications/stats', async (req, res, next) => {
  try {
    const Notification = require('../notification/notification.model');
    const days  = Math.min(Number(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 86_400_000);

    const [byType, byChannel, recentFailures] = await Promise.all([
      // Per-type breakdown
      Notification.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$type',
          total:     { $sum: 1 },
          pushSent:  { $sum: { $cond: ['$channels.push.sent', 1, 0] } },
          smsSent:   { $sum: { $cond: ['$channels.sms.sent', 1, 0] } },
          socketSent:{ $sum: { $cond: ['$channels.socket.sent', 1, 0] } },
          readCount: { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
        }},
        { $sort: { total: -1 } },
      ]),
      // Push channel summary
      Notification.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: null,
          total:      { $sum: 1 },
          pushSent:   { $sum: { $cond: ['$channels.push.sent', 1, 0] } },
          smsSent:    { $sum: { $cond: ['$channels.sms.sent', 1, 0] } },
          socketSent: { $sum: { $cond: ['$channels.socket.sent', 1, 0] } },
          read:       { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
        }},
      ]),
      // Recent push failures
      Notification.find(
        { createdAt: { $gte: since }, 'channels.push.sent': false, 'channels.push.error': { $exists: true } },
        { type: 1, title: 1, 'channels.push.error': 1, createdAt: 1, recipient: 1 }
      ).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const summary = byChannel[0] || {};
    res.json({
      windowDays: days,
      summary: {
        total:      summary.total || 0,
        pushSent:   summary.pushSent || 0,
        smsSent:    summary.smsSent || 0,
        socketSent: summary.socketSent || 0,
        read:       summary.read || 0,
        pushDeliveryRate: summary.total > 0 ? Math.round((summary.pushSent / summary.total) * 100) : 0,
      },
      byType,
      recentFailures,
    });
  } catch (err) { next(err); }
});

// Recent notifications log with filters
router.get('/notifications/log', async (req, res, next) => {
  try {
    const Notification = require('../notification/notification.model');
    const { type, kind, page = 1, limit = 50 } = req.query;
    const q = {};
    if (type) q.type = type;
    if (kind) q['recipient.kind'] = kind;
    const [docs, total] = await Promise.all([
      Notification.find(q).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean(),
      Notification.countDocuments(q),
    ]);
    res.json({ docs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

// Manual notification sender — send push/SMS to a specific user or worker
router.post(
  '/notifications/send',
  validate(Joi.object({
    recipientKind: Joi.string().valid('user', 'worker').required(),
    recipientId:   Joi.string().hex().length(24).required(),
    type:          Joi.string().required(),
    title:         Joi.string().min(1).max(100).required(),
    body:          Joi.string().max(300).allow('', null),
    deepLink:      Joi.string().max(200).allow('', null),
    channels:      Joi.array().items(Joi.string().valid('push', 'sms', 'socket')).default(['push']),
  })),
  async (req, res, next) => {
    try {
      const notifService = require('../notification/notification.service');
      const { recipientKind, recipientId, type, title, body, deepLink } = req.body;
      const result = await notifService.notify({
        recipient: { kind: recipientKind, id: recipientId },
        type, title, body: body || '', deepLink: deepLink || undefined,
        data: { sentByAdmin: String(req.auth.sub), manual: true },
      });
      await auditService.fromRequest(req, 'admin.notification_sent', { kind: recipientKind, id: recipientId }, null, { type, title });
      res.json({ ok: true, notificationId: result?._id });
    } catch (err) { next(err); }
  }
);

// Broadcast to all users or workers
router.post(
  '/notifications/broadcast',
  validate(Joi.object({
    recipientKind: Joi.string().valid('user', 'worker').required(),
    type:          Joi.string().default('promotional'),
    title:         Joi.string().min(1).max(100).required(),
    body:          Joi.string().max(300).allow('', null),
    deepLink:      Joi.string().max(200).allow('', null),
    limit:         Joi.number().integer().min(1).max(10000).default(1000),
  })),
  async (req, res, next) => {
    try {
      const UserModel   = require('../user/user.model');
      const WorkerModel = require('../worker/worker.model');
      const { notificationsQueue } = require('../../jobs');
      const { recipientKind, type, title, body, deepLink, limit } = req.body;

      const Model = recipientKind === 'worker' ? WorkerModel : UserModel;
      const recipients = await Model.find(
        { deviceTokens: { $exists: true, $ne: [] } },
        { _id: 1, deviceTokens: 1 }
      ).limit(limit).lean();

      const allTokens = recipients.flatMap((r) => r.deviceTokens || []);

      if (allTokens.length === 0) {
        return res.json({ ok: true, sent: 0, message: 'No device tokens found' });
      }

      // Enqueue as a single bulk push job
      await notificationsQueue.add('push', {
        recipientKind, title, body: body || '', deepLink, type,
        bulkTokens: allTokens,
        sentByAdmin: String(req.auth.sub),
      });

      await auditService.fromRequest(req, 'admin.broadcast', { kind: 'system', id: null }, null, { recipientKind, type, title, recipients: recipients.length });
      res.json({ ok: true, queued: true, recipientCount: recipients.length, tokenCount: allTokens.length });
    } catch (err) { next(err); }
  }
);

// ── Payment reconciliation — failed side-effects after capture (#95/#96) ─
router.get('/payments/reconciliation-queue', async (req, res, next) => {
  try {
    const PaymentIntent = require('../payment/payment-intent.model');
    const items = await PaymentIntent.find(
      { reconciliationRequired: true, reconciledAt: { $exists: false } },
      { razorpayOrderId: 1, razorpayPaymentId: 1, purpose: 1, amountPaise: 1, reconciliationReason: 1, reconciliationAt: 1 }
    ).sort({ reconciliationAt: -1 }).limit(50).lean();
    res.json({ count: items.length, items: items.map((i) => ({ ...i, amountRupees: Math.round(i.amountPaise / 100) })) });
  } catch (err) { next(err); }
});
router.post('/payments/:razorpayOrderId/reconcile', async (req, res, next) => {
  try {
    const PaymentIntent = require('../payment/payment-intent.model');
    const intent = await PaymentIntent.findOneAndUpdate(
      { razorpayOrderId: req.params.razorpayOrderId, reconciliationRequired: true },
      { $set: { reconciledAt: new Date(), reconciledBy: req.auth.sub } },
      { new: true }
    );
    if (!intent) return res.status(404).json({ error: 'Intent not found or already reconciled' });
    await auditService.fromRequest(req, 'admin.payment_reconciled', { kind: 'user', id: intent.owner.id }, null, { razorpayOrderId: req.params.razorpayOrderId });
    res.json({ ok: true, intent });
  } catch (err) { next(err); }
});

// ── Founder Audit Endpoints (scenarios 96-98) ────────────────────────────

// #96: Full financial trace for any single order — every rupee accounted for
router.get('/audit/order/:orderId', async (req, res, next) => {
  try {
    const PaymentIntent = require('../payment/payment-intent.model');
    const Transaction   = require('../payment/transaction.model');
    const [order, intent, transactions] = await Promise.all([
      Order.findById(req.params.orderId)
        .select('userId workerId service pricing earnings payment status completedAt promoCode discountPaise')
        .populate('userId', 'name phone')
        .populate('workerId', 'name phone')
        .lean(),
      PaymentIntent.findOne({ orderId: req.params.orderId }).lean(),
      Transaction.find({ refOrderId: req.params.orderId }).sort({ createdAt: 1 }).lean(),
    ]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const gmvPaise     = order.pricing?.totalPaise ?? Math.round((order.pricing?.total ?? 0) * 100);
    const workerPaise  = order.earnings?.workerPaise ?? 0;
    const platformPaise = order.earnings?.platformPaise ?? 0;
    const accountedPaise = workerPaise + platformPaise;
    const discrepancyPaise = gmvPaise - accountedPaise;

    res.json({
      orderId: req.params.orderId,
      service: order.service,
      status:  order.status,
      customer: { id: order.userId?._id, name: order.userId?.name, phone: order.userId?.phone },
      worker:   { id: order.workerId?._id, name: order.workerId?.name, phone: order.workerId?.phone },
      financials: {
        gmvRupees:          Math.round(gmvPaise / 100),
        workerPayoutRupees: Math.round(workerPaise / 100),
        platformRevRupees:  Math.round(platformPaise / 100),
        discountRupees:     Math.round((order.discountPaise || 0) / 100),
        commissionRatePct:  order.earnings?.commissionRate
          ? Math.round(order.earnings.commissionRate * 1000) / 10
          : null,
        discrepancyRupees:  Math.round(discrepancyPaise / 100),
        isBalanced:         Math.abs(discrepancyPaise) < 100, // within ₹1 rounding
      },
      paymentIntent:  intent
        ? { status: intent.status, razorpayOrderId: intent.razorpayOrderId, razorpayPaymentId: intent.razorpayPaymentId, appliedAt: intent.appliedAt, reconciliationRequired: intent.reconciliationRequired }
        : null,
      transactions: transactions.map((t) => ({
        type: t.type, owner: t.owner, amountRupees: Math.round(t.amountPaise / 100),
        reason: t.reason, status: t.status, createdAt: t.createdAt,
      })),
    });
  } catch (err) { next(err); }
});

// #97: Commission correctness audit — sample recent orders and check math
router.get('/audit/commission', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 30);
    const since = new Date(Date.now() - days * 86_400_000);
    const orders = await Order.find(
      { status: 'completed', completedAt: { $gte: since }, 'earnings.commissionRate': { $exists: true } },
      { pricing: 1, earnings: 1, service: 1 }
    ).limit(500).lean();

    let correct = 0, discrepant = [];
    for (const o of orders) {
      const gmv  = o.pricing?.totalPaise ?? Math.round((o.pricing?.total ?? 0) * 100);
      const rate = o.earnings.commissionRate;
      const expectedPlatform = Math.round(gmv * rate);
      const actualPlatform   = o.earnings.platformPaise || 0;
      const diff = Math.abs(expectedPlatform - actualPlatform);
      if (diff > 100) { // > ₹1 discrepancy
        discrepant.push({ orderId: o._id, service: o.service, gmvRupees: Math.round(gmv / 100), expectedPlatformRupees: Math.round(expectedPlatform / 100), actualPlatformRupees: Math.round(actualPlatform / 100), diffRupees: Math.round(diff / 100), commissionRatePct: Math.round(rate * 1000) / 10 });
      } else {
        correct++;
      }
    }
    res.json({
      windowDays: days, totalSampled: orders.length, correct, discrepant: discrepant.length,
      accuracy: orders.length > 0 ? Math.round((correct / orders.length) * 100) : 100,
      issues: discrepant.slice(0, 20),
    });
  } catch (err) { next(err); }
});

// #98: Worker trust audit — rating reliability and gaming signals
router.get('/audit/worker-trust', async (req, res, next) => {
  try {
    const since7d = new Date(Date.now() - 7 * 86_400_000);

    const [ratingDistribution, suspiciousVelocity, zeroRatingWorkers] = await Promise.all([
      // Overall rating distribution
      Worker.aggregate([
        { $group: {
          _id: null,
          avg: { $avg: '$rating' },
          min: { $min: '$rating' },
          max: { $max: '$rating' },
          gt4_5: { $sum: { $cond: [{ $gte: ['$rating', 4.5] }, 1, 0] } },
          lt3:   { $sum: { $cond: [{ $lt:  ['$rating', 3.0] }, 1, 0] } },
          total: { $sum: 1 },
        }},
      ]),
      // Users who submitted more than 3 ratings in one day (velocity anomaly)
      Order.aggregate([
        { $match: { status: 'completed', 'userRating': { $exists: true }, ratingSubmittedAt: { $gte: since7d } } },
        { $group: { _id: { userId: '$userId', day: { $dateToString: { format: '%Y-%m-%d', date: '$ratingSubmittedAt' } } }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 3 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      // Workers with 0 ratings (completedJobs > 0 but rating still at default 5)
      Worker.find({ completedJobs: { $gt: 5 }, rating: 5, 'kyc.status': 'approved' }, { name: 1, phone: 1, completedJobs: 1, rating: 1 }).limit(20).lean(),
    ]);

    const dist = ratingDistribution[0] || {};
    res.json({
      ratingDistribution: {
        avg:    Math.round((dist.avg || 0) * 100) / 100,
        min:    dist.min,
        max:    dist.max,
        above4_5Pct: dist.total > 0 ? Math.round((dist.gt4_5 / dist.total) * 100) : 0,
        below3Pct:   dist.total > 0 ? Math.round((dist.lt3   / dist.total) * 100) : 0,
        total:  dist.total,
      },
      suspiciousVelocity: { count: suspiciousVelocity.length, samples: suspiciousVelocity },
      unratedWorkers: { count: zeroRatingWorkers.length, note: 'Workers with 5+ jobs but still at default 5★ — may never have been rated', samples: zeroRatingWorkers },
    });
  } catch (err) { next(err); }
});

// ── Business Intelligence (scenarios 81-85) ──────────────────────────────
// #83 — Per-service P&L: revenue, worker cost, margin per service
router.get('/business/service-pnl', ctrl.getServicePnL);
// #81 — Worker churn risk: low earners, dormant, high cancel-rate workers
router.get('/business/churn-risk', ctrl.getChurnRisk);
// #84 — Dead categories: active services with 0 orders in N days
router.get('/business/dead-categories', ctrl.getDeadCategories);
// #85 — Geo readiness: worker density + approval status for a city area
router.get('/business/geo-readiness', ctrl.getGeoReadiness);
// #82 — Quote abandonment: price sensitivity proxy via early-exit rates
router.get('/business/quote-abandonment', ctrl.getQuoteAbandonmentStats);

// Subscription plan management (full CRUD)
router.get('/plans', ctrl.listAllPlans);
router.post(
  '/plans',
  validate(Joi.object({
    code:         Joi.string().alphanum().uppercase().min(3).max(40).required(),
    name:         Joi.string().min(2).max(80).required(),
    description:  Joi.string().max(300).allow('', null),
    audience:     Joi.string().valid('user', 'worker').required(),
    priceInPaise: Joi.number().integer().min(0).required(),
    durationDays: Joi.number().integer().min(1).max(365).required(),
    trialDays:    Joi.number().integer().min(0).max(30).default(0),
    sortOrder:    Joi.number().integer().min(0).default(0),
    effects:      Joi.object().default({}),
  })),
  ctrl.createPlan
);
router.patch(
  '/plans/:id',
  validate(Joi.object({
    name:         Joi.string().min(2).max(80),
    description:  Joi.string().max(300).allow('', null),
    priceInPaise: Joi.number().integer().min(0),
    durationDays: Joi.number().integer().min(1).max(365),
    trialDays:    Joi.number().integer().min(0).max(30),
    sortOrder:    Joi.number().integer().min(0),
    isActive:     Joi.boolean(),
    effects:      Joi.object(),
  }).min(1)),
  ctrl.updatePlan
);
router.delete('/plans/:id', ctrl.deletePlan);

module.exports = router;
