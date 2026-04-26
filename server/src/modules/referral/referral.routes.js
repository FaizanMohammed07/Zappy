const express = require('express');
const Joi = require('joi');
const ctrl = require('./referral.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/me', authenticate, ctrl.getMyCode);
router.post('/apply', authenticate, validate(Joi.object({ code: Joi.string().required() })), ctrl.applyCode);

module.exports = router;
