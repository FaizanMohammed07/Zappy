const express = require('express');
const Joi = require('joi');
const ctrl = require('./auth.controller');
const { validate } = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimit');

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
  validate(Joi.object({ phone: phoneSchema, otp: Joi.string().length(6).required(), name: Joi.string().max(100).optional(), skills: Joi.array().items(Joi.string()).optional() })),
  ctrl.loginWorker
);

router.post(
  '/admin/login',
  authLimiter,
  validate(Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required() })),
  ctrl.loginAdmin
);

router.post('/refresh', authLimiter, validate(Joi.object({ refreshToken: Joi.string().required() })), ctrl.refresh);

router.post('/logout', validate(Joi.object({ refreshToken: Joi.string().required() })), ctrl.logout);

module.exports = router;
