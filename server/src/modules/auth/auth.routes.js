const express = require('express');
const Joi = require('joi');
const ctrl = require('./auth.controller');
const { validate } = require('../../middlewares/validate');
const { authLimiter, adminAuthLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

const phoneSchema = Joi.string().pattern(/^[0-9]{10,15}$/).required();

router.post('/otp/request', authLimiter, validate(Joi.object({ phone: phoneSchema })), ctrl.requestOtp);

router.post(
  '/user/login',
  authLimiter,
  validate(Joi.object({ phone: phoneSchema, otp: Joi.string().length(6).required(), name: Joi.string().max(100).optional() })),
  ctrl.loginUser
);

router.post(
  '/worker/login',
  authLimiter,
  validate(Joi.object({
    phone:    phoneSchema,
    otp:      Joi.string().length(6).required(),
    name:     Joi.string().max(100).optional(),
    skills:   Joi.array().items(Joi.string()).optional(),
    deviceId: Joi.string().max(200).optional(), // hardware fingerprint for multi-account detection
  })),
  ctrl.loginWorker
);

router.post(
  '/partner/login',
  authLimiter,
  validate(Joi.object({
    phone:        phoneSchema,
    otp:          Joi.string().length(6).required(),
    businessName: Joi.string().max(150).optional(),
    ownerName:    Joi.string().max(100).optional(),
    cities:       Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
  })),
  ctrl.loginPartner
);

router.post(
  '/admin/login',
  adminAuthLimiter,  // 3 attempts / 15 min — much stricter than user authLimiter (#79)
  validate(Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required() })),
  ctrl.loginAdmin
);

// No body validation — refresh token comes from httpOnly cookie (primary) or
// body (legacy). Nothing meaningful to validate at the route level.
router.post('/refresh', authLimiter, ctrl.refresh);
router.post('/logout', ctrl.logout);

module.exports = router;
