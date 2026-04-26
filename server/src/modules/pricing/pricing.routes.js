const express = require('express');
const Joi = require('joi');
const ctrl = require('./pricing.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/', ctrl.getConfig);

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
    commissionRate: Joi.number().min(0).max(0.5),
    serviceOverrides: Joi.array().items(Joi.object({
      service: Joi.string().required(),
      multiplier: Joi.number().required(),
      minFarePaise: Joi.number().integer().min(0).optional(),
    })),
  })),
  ctrl.adminUpdateConfig
);

module.exports.adminRouter = adminRouter;
