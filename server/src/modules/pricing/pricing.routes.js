const express = require('express');
const Joi = require('joi');
const ctrl = require('./pricing.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/', ctrl.getConfig);
router.get('/surge-info', authenticate, ctrl.getSurgeInfo);

module.exports = router;

const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.patch(
  '/',
  validate(Joi.object({
    baseFeePaise: Joi.number().integer().min(0),
    perKmFeePaise: Joi.number().integer().min(0),
    perMinFeePaise: Joi.number().integer().min(0),
    platformFeePaise: Joi.number().integer().min(0),
    minFarePaise: Joi.number().integer().min(0),
    surgeEnabled: Joi.boolean(),
    surgeMaxCap: Joi.number().min(1).max(5),
    surgeTolerancePct: Joi.number().min(0.02).max(0.50),
    commissionRate: Joi.number().min(0).max(0.5),
    serviceOverrides: Joi.array().items(Joi.object({
      service: Joi.string().required(),
      multiplier: Joi.number().required(),
      minFarePaise: Joi.number().integer().min(0).optional(),
    })),
    // Auto-pricing
    nightSurchargeEnabled:    Joi.boolean(),
    nightSurchargeMultiplier: Joi.number().min(1.0).max(3.0),
    nightStartHour:           Joi.number().integer().min(0).max(23),
    nightEndHour:             Joi.number().integer().min(0).max(23),
    rainSurchargeEnabled:     Joi.boolean(),
    rainSurchargeMultiplier:  Joi.number().min(1.0).max(3.0),
    rainActiveUntil:          Joi.date().allow(null),
    weekendSurchargeEnabled:    Joi.boolean(),
    weekendSurchargeMultiplier: Joi.number().min(1.0).max(2.0),
    peakHourSurchargeEnabled: Joi.boolean(),
    peakHourRanges: Joi.array().items(Joi.object({
      label:      Joi.string().max(50),
      startHour:  Joi.number().integer().min(0).max(23).required(),
      endHour:    Joi.number().integer().min(0).max(23).required(),
      multiplier: Joi.number().min(1.0).max(3.0).required(),
    })).max(10),
  })),
  ctrl.adminUpdateConfig
);

module.exports.adminRouter = adminRouter;
