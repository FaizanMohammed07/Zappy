const express = require('express');
const Joi = require('joi');
const ctrl = require('./subscription.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/plans', validate(Joi.object({ audience: Joi.string().valid('user', 'worker').optional() }), 'query'), ctrl.listPlans);
router.get('/me', authenticate, ctrl.getMySubscription);
router.post('/subscribe', authenticate, validate(Joi.object({ planCode: Joi.string().required() })), ctrl.subscribe);
router.post('/:id/cancel', authenticate, ctrl.cancelSubscription);

module.exports = router;
