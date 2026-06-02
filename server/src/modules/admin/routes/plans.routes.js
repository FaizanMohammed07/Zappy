const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/plans.controller');

const router = express.Router();

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
  ctrl.createPlan,
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
  ctrl.updatePlan,
);
router.delete('/plans/:id', ctrl.deletePlan);

module.exports = router;
