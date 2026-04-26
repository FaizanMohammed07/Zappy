const express = require('express');
const Joi = require('joi');
const ctrl = require('./payment.controller');
const paymentService = require('./payment.service');
const razorpay = require('./razorpay.client');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimit');
const logger = require('../../utils/logger');

const router = express.Router();

router.post(
  '/create-order',
  authenticate,
  authLimiter,
  validate(Joi.object({
    purpose: Joi.string().valid('subscription', 'wallet_topup', 'order_payment').required(),
    planCode: Joi.string().when('purpose', { is: 'subscription', then: Joi.required() }),
    amountPaise: Joi.number().integer().min(100).when('purpose', { is: 'wallet_topup', then: Joi.required() }),
    orderId: Joi.string().hex().length(24).when('purpose', { is: 'order_payment', then: Joi.required() }),
  })),
  ctrl.createOrder
);

router.post(
  '/verify',
  authenticate,
  validate(Joi.object({
    razorpayOrderId: Joi.string().required(),
    razorpayPaymentId: Joi.string().required(),
    razorpaySignature: Joi.string().required(),
  })),
  ctrl.verify
);

const webhookRouter = express.Router();

webhookRouter.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const signature = req.get('x-razorpay-signature');
    const rawBody = req.body;

    if (!signature) {
      logger.warn({ ip: req.ip }, 'Webhook missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const ok = razorpay.verifyWebhookSignature(rawBody, signature);
    if (!ok) {
      logger.warn({ ip: req.ip }, 'Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed JSON' });
    }

    try {
      const result = await paymentService.handleWebhook(payload);
      logger.info({ event: payload.event, result }, 'Webhook processed');
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error({ err: err.message, event: payload.event }, 'Webhook processing failed');
      res.status(500).json({ error: 'Processing failed' });
    }
  }
);

module.exports = router;
module.exports.webhookRouter = webhookRouter;
