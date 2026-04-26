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
    surgeMaxCap: Joi.number().min(1).max(5),
    commissionRate: Joi.number().min(0).max(0.5),
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
    baseFee: Joi.number(),
    perKmFee: Joi.number(),
    perMinFee: Joi.number(),
    platformFee: Joi.number(),
    minFare: Joi.number(),
    surgeMaxMultiplier: Joi.number().min(1).max(5),
  })),
  ctrl.setPricingConfig
);

router.get('/heatmap', ctrl.getHeatmap);

// Users
router.get('/users', ctrl.listUsers);
router.post('/users/:id/block', validate(Joi.object({ blocked: Joi.boolean().required() })), ctrl.blockUser);

// Analytics
router.get('/analytics', ctrl.getAnalytics);

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

module.exports = router;
