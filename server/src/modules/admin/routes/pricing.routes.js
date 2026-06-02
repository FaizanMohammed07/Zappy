const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/pricing.controller');

const router = express.Router();

router.get('/pricing-config', ctrl.getPricingConfig);
router.put(
  '/pricing-config',
  validate(Joi.object({
    baseFee: Joi.number().min(0),
    perKmFee: Joi.number().min(0),
    perMinFee: Joi.number().min(0),
    platformFee: Joi.number().min(0).max(100),
    minFare: Joi.number().min(0).max(1000),
    surgeMaxMultiplier: Joi.number().min(1).max(3),
    commissionRate: Joi.number().min(0).max(0.45),
    earnedWageAdvanceEnabled: Joi.boolean(),
    earnedWageAdvanceRate:    Joi.number().min(0.1).max(0.9),
    emergencyFundContributionRate: Joi.number().min(0).max(0.02),
    tipMaxPaise:  Joi.number().integer().min(0).max(100000),
    tipOptions:   Joi.array().items(Joi.number().integer().min(1)).max(6),
    referralReferrerBonusPaise: Joi.number().integer().min(0).max(100000),
    referralRefereeBonusPaise:  Joi.number().integer().min(0).max(50000),
  })),
  ctrl.setPricingConfig,
);

router.patch(
  '/toggles',
  validate(Joi.object({
    surgeEnabled: Joi.boolean(),
    surgeMaxCap: Joi.number().min(1).max(3),
    commissionRate: Joi.number().min(0).max(0.45),
    dispatchEnabled: Joi.boolean(),
  })),
  ctrl.updateToggles,
);

router.patch(
  '/dispatch/toggle',
  validate(Joi.object({ dispatchEnabled: Joi.boolean().required() })),
  ctrl.toggleDispatch,
);

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
  ctrl.updateCancellationConfig,
);

module.exports = router;
