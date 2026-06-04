const express = require('express');
const Joi = require('joi');
const ctrl = require('./worker.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { nearbyLimiter, workerOnlineLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  orderId: Joi.string().hex().length(24).optional().allow(null, ''),
});

const shiftSchema = Joi.object({
  startHour:  Joi.number().integer().min(0).max(23).required(),
  endHour:    Joi.number().integer().min(1).max(24).required(),
  lat:        Joi.number().required(),
  lng:        Joi.number().required(),
  date:       Joi.date().iso().optional(),
  zoneLabel:  Joi.string().max(100).optional(),
});

/* ── Core worker routes ── */
router.get('/me', authenticate, requireRole('worker'), ctrl.getMe);
router.post('/online', authenticate, requireRole('worker'), workerOnlineLimiter,
  validate(Joi.object({ lat: Joi.number().required(), lng: Joi.number().required() })), ctrl.goOnline);
router.post('/offline', authenticate, requireRole('worker'), ctrl.goOffline);
router.post('/location', authenticate, requireRole('worker'), validate(locationSchema), ctrl.updateLocation);
router.get('/earnings', authenticate, requireRole('worker'), ctrl.getEarnings);
router.get('/orders', authenticate, requireRole('worker'), ctrl.getOrders);

// Update skills / profile
router.patch('/profile', authenticate, requireRole('worker'),
  validate(Joi.object({
    name:   Joi.string().min(2).max(100).optional(),
    skills: Joi.array().items(Joi.string()).min(1).max(10).optional(),
    bio:    Joi.string().max(300).allow('', null).optional(),
    emergencyContact: Joi.object({
      name:  Joi.string().max(100).optional(),
      phone: Joi.string().max(15).optional(),
    }).optional(),
  }).min(1)),
  ctrl.updateProfile
);

// Complete onboarding — called once after worker sets name + skills
router.post('/onboarding/complete', authenticate, requireRole('worker'),
  validate(Joi.object({
    name:  Joi.string().min(2).max(100).required(),
    phone: Joi.string().max(15).optional(),
    skills: Joi.array().items(Joi.string()).min(1).max(20).required(),
    emergencyContact: Joi.object({
      name:  Joi.string().max(100).optional(),
      phone: Joi.string().max(15).optional(),
    }).optional(),
  })),
  ctrl.completeOnboarding,
);

// Stream profile avatar (selfie from approved KYC) — no URL expiry
router.get('/me/avatar', authenticate, requireRole('worker'), ctrl.streamAvatar);
router.get('/nearby', authenticate, nearbyLimiter, ctrl.getNearbyWorkers);
router.get('/demand-zones', authenticate, requireRole('worker'), ctrl.getDemandZones);

/* ── Shift Slots — predictive availability ── */
router.get('/shifts', authenticate, requireRole('worker'), ctrl.getShifts);
router.get('/shifts/preview', authenticate, requireRole('worker'), ctrl.previewShift);
router.post('/shifts', authenticate, requireRole('worker'), validate(shiftSchema), ctrl.commitShift);
router.delete('/shifts/cancel',
  authenticate, requireRole('worker'),
  validate(Joi.object({
    startHour: Joi.number().integer().min(0).max(23).required(),
    date:      Joi.date().iso().optional(),
  })),
  ctrl.cancelShiftSlot);

/* ── Wellness system ── */
router.get('/wellness', authenticate, requireRole('worker'), ctrl.getWellness);
router.post('/wellness/break-bonus', authenticate, requireRole('worker'), ctrl.claimBreakBonus);

/* ── Neighborhood reputation ── */
router.get('/rep', authenticate, ctrl.getNeighborhoodRep);
router.get('/:id/rep', authenticate, ctrl.getNeighborhoodRep);

/* ── Leaderboard — week's top earners ── */
router.get('/leaderboard', authenticate, ctrl.getLeaderboard);

/* ── Public profile — customer-facing ── */
router.get('/:id/public', authenticate, ctrl.getPublicProfile);

/* ── Device token (FCM push notifications) ── */
router.post(
  '/device-token',
  authenticate,
  requireRole('worker'),
  validate(Joi.object({ token: Joi.string().max(1000).required() })),
  async (req, res, next) => {
    try {
      const Worker = require('./worker.model');
      await Worker.updateOne(
        { _id: req.auth.sub },
        { $addToSet: { deviceTokens: req.body.token } }
      );
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
