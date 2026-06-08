const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/incentives.controller');
const opCtrl = require('../controllers/operations.controller');

const router = express.Router();

router.get('/incentives', ctrl.getIncentiveConfig);
router.put(
  '/incentives/milestones',
  validate(Joi.object({
    milestones: Joi.array().items(
      Joi.object({ jobs: Joi.number().integer().min(1).required(), bonusPaise: Joi.number().integer().min(0).required(), label: Joi.string().trim().min(1).required() }),
    ).min(1).required(),
  })),
  ctrl.setIncentiveMilestones,
);
router.post('/incentives/rating-sweep', ctrl.runRatingBonusSweep);
router.get('/incentives/deferred', ctrl.listDeferredMilestones);
router.post('/incentives/deferred/:workerId/:milestone/release', ctrl.releaseDeferredMilestone);

router.get('/referrals/stats', opCtrl.getReferralStats);
router.get('/referrals/recent', opCtrl.listRecentReferrals);

router.get('/cashback/config', opCtrl.getCashbackConfig);
router.put(
  '/cashback/config',
  validate(Joi.object({
    enabled:             Joi.boolean(),
    rate:                Joi.number().min(0).max(0.30),
    capPaise:            Joi.number().integer().min(0).max(50000),
    firstOrderRate:      Joi.number().min(0).max(0.50),
    firstOrderThreshold: Joi.number().integer().min(1).max(10),
  }).min(1)),
  opCtrl.setCashbackConfig,
);
router.get('/cashback/stats', opCtrl.getCashbackStats);

module.exports = router;
