const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/system.controller');
const opCtrl = require('../controllers/operations.controller');
const auditService = require('../audit.service');

const router = express.Router();

router.get('/system/health', ctrl.getSystemHealth);

router.get('/feature-flags', ctrl.getFeatureFlags);
router.post(
  '/feature-flags',
  validate(Joi.object({ flag: Joi.string().required(), enabled: Joi.boolean().required() })),
  ctrl.setFeatureFlag,
);

router.get('/alerts', ctrl.getAlerts);

router.get('/retention', opCtrl.getRetention);

// FCM health check
router.get('/notifications/health', async (req, res, next) => {
  try {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
    const configured  = !!(projectId && clientEmail && privateKey);

    if (!configured) {
      return res.json({ ok: false, configured: false, message: 'Firebase Admin env vars not set. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.' });
    }
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

// Notification delivery stats
router.get('/notifications/stats', async (req, res, next) => {
  try {
    const Notification = require('../../notification/notification.model');
    const days  = Math.min(Number(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 86_400_000);

    const [byType, byChannel, recentFailures] = await Promise.all([
      Notification.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: '$type',
          total:      { $sum: 1 },
          pushSent:   { $sum: { $cond: ['$channels.push.sent', 1, 0] } },
          smsSent:    { $sum: { $cond: ['$channels.sms.sent', 1, 0] } },
          socketSent: { $sum: { $cond: ['$channels.socket.sent', 1, 0] } },
          readCount:  { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
        }},
        { $sort: { total: -1 } },
      ]),
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
      Notification.find(
        { createdAt: { $gte: since }, 'channels.push.sent': false, 'channels.push.error': { $exists: true } },
        { type: 1, title: 1, 'channels.push.error': 1, createdAt: 1, recipient: 1 },
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

// Notification log
router.get('/notifications/log', async (req, res, next) => {
  try {
    const Notification = require('../../notification/notification.model');
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

// Manual notification sender
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
      const notifService = require('../../notification/notification.service');
      const { recipientKind, recipientId, type, title, body, deepLink } = req.body;
      const result = await notifService.notify({
        recipient: { kind: recipientKind, id: recipientId },
        type, title, body: body || '', deepLink: deepLink || undefined,
        data: { sentByAdmin: String(req.auth.sub), manual: true },
      });
      await auditService.fromRequest(req, 'admin.notification_sent', { kind: recipientKind, id: recipientId }, null, { type, title });
      res.json({ ok: true, notificationId: result?._id });
    } catch (err) { next(err); }
  },
);

// Broadcast notifications
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
      const UserModel   = require('../../user/user.model');
      const WorkerModel = require('../../worker/worker.model');
      const { notificationsQueue } = require('../../../jobs');
      const { recipientKind, type, title, body, deepLink, limit } = req.body;

      const Model = recipientKind === 'worker' ? WorkerModel : UserModel;
      const recipients = await Model.find(
        { deviceTokens: { $exists: true, $ne: [] } },
        { _id: 1, deviceTokens: 1 },
      ).limit(limit).lean();

      const allTokens = recipients.flatMap((r) => r.deviceTokens || []);

      if (allTokens.length === 0) {
        return res.json({ ok: true, sent: 0, message: 'No device tokens found' });
      }

      await notificationsQueue.add('push', {
        title,
        body:       body || '',
        bulkTokens: allTokens,
        // data is what FCM puts in the notification payload (deepLink, type, etc.)
        data: { deepLink: deepLink || '/', type: type || 'promotional', sentByAdmin: String(req.auth.sub) },
        sentByAdmin: String(req.auth.sub),
      });

      await auditService.fromRequest(req, 'admin.broadcast', { kind: 'system', id: null }, null, { recipientKind, type, title, recipients: recipients.length });
      res.json({ ok: true, queued: true, recipientCount: recipients.length, tokenCount: allTokens.length });
    } catch (err) { next(err); }
  },
);

router.get('/liveops', opCtrl.getLiveOps);

// SOS active incidents
router.get('/sos/active', async (req, res, next) => {
  try {
    const sosService = require('../../worker/sos.service');
    const data = await sosService.getActiveSOSAlerts();
    res.json(data);
  } catch (err) { next(err); }
});

// Admin acknowledges an SOS
router.post(
  '/sos/:incidentKey/acknowledge',
  validate(Joi.object({})),
  async (req, res, next) => {
    try {
      const sosService = require('../../worker/sos.service');
      const result = await sosService.acknowledgeSOS({
        incidentKey: req.params.incidentKey,
        adminId: req.auth.sub,
      });
      res.json(result);
    } catch (err) { next(err); }
  },
);

// Emergency Fund management
router.get('/emergency-fund', async (req, res, next) => {
  try {
    const efSvc  = require('../../worker/emergency-fund.service');
    const EmergencyFundClaim = require('../../worker/emergency-fund.model');
    const [fund, claims] = await Promise.all([
      efSvc.getFundBalance(),
      EmergencyFundClaim.find().sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.json({ fund, claims });
  } catch (err) { next(err); }
});

router.post(
  '/emergency-fund/:id/approve',
  validate(Joi.object({ adminNote: Joi.string().max(300).optional() })),
  async (req, res, next) => {
    try {
      const efSvc = require('../../worker/emergency-fund.service');
      const claim = await efSvc.approveClaim({ claimId: req.params.id, adminId: req.auth.sub, adminNote: req.body.adminNote });
      res.json({ claim });
    } catch (err) { next(err); }
  },
);

router.post(
  '/emergency-fund/:id/reject',
  validate(Joi.object({ adminNote: Joi.string().min(5).max(300).required() })),
  async (req, res, next) => {
    try {
      const efSvc = require('../../worker/emergency-fund.service');
      const claim = await efSvc.rejectClaim({ claimId: req.params.id, adminId: req.auth.sub, adminNote: req.body.adminNote });
      res.json({ claim });
    } catch (err) { next(err); }
  },
);

module.exports = router;
