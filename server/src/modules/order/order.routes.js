const express = require('express');
const Joi = require('joi');
const ctrl = require('./order.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { orderLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

const pickupLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).required(),
  landmark: Joi.string().max(200).allow('', null),
  flatNumber: Joi.string().max(100).allow('', null),
  notes: Joi.string().max(500).allow('', null),
});

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).required(),
});

const createOrderSchema = Joi.object({
  service: Joi.string().valid('puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair').required(),
  description: Joi.string().max(500).allow(''),
  pickupLocation: pickupLocationSchema.required(),
  dropLocation: locationSchema.optional(),
  paymentMethod: Joi.string().valid('cash', 'upi', 'card').default('upi'),
  priority: Joi.string().valid('normal', 'emergency').default('normal'),
});

const quoteSchema = Joi.object({
  service: Joi.string().valid('puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair').required(),
  pickupLat: Joi.number().required(),
  pickupLng: Joi.number().required(),
  dropLat: Joi.number().optional(),
  dropLng: Joi.number().optional(),
});

const rateSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  review: Joi.string().max(500).allow(''),
});

router.get('/quote', authenticate, requireRole('user'), validate(quoteSchema, 'query'), ctrl.getQuote);
router.post('/', authenticate, requireRole('user'), orderLimiter, validate(createOrderSchema), ctrl.createOrder);
router.get('/mine', authenticate, requireRole('user'), ctrl.listMine);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/:id/cancel', authenticate, requireRole('user'), ctrl.cancelOrder);
router.post('/:id/rate', authenticate, requireRole('user'), validate(rateSchema), ctrl.rateOrder);
router.post('/:id/rate-user', authenticate, requireRole('worker'), validate(rateSchema), ctrl.workerRateUser);
router.get('/:id/timeline', authenticate, ctrl.getTimeline);
router.post('/:id/accept', authenticate, requireRole('worker'), ctrl.acceptOffer);
router.post('/:id/reject', authenticate, requireRole('worker'), ctrl.rejectOffer);
router.post('/:id/start-trip', authenticate, requireRole('worker'), ctrl.startTrip);
router.post('/:id/arrived', authenticate, requireRole('worker'), ctrl.arrive);
router.post('/:id/start-service', authenticate, requireRole('worker'), validate(Joi.object({ otp: Joi.string().length(4).required() })), ctrl.startService);
router.post('/:id/complete', authenticate, requireRole('worker'), ctrl.completeOrder);

module.exports = router;
