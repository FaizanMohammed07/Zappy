const express = require('express');
const Joi = require('joi');
const ctrl = require('./worker.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  orderId: Joi.string().hex().length(24).optional(),
});

router.get('/me', authenticate, requireRole('worker'), ctrl.getMe);
router.post('/online', authenticate, requireRole('worker'), validate(Joi.object({ lat: Joi.number().required(), lng: Joi.number().required() })), ctrl.goOnline);
router.post('/offline', authenticate, requireRole('worker'), ctrl.goOffline);
router.post('/location', authenticate, requireRole('worker'), validate(locationSchema), ctrl.updateLocation);
router.get('/earnings', authenticate, requireRole('worker'), ctrl.getEarnings);
router.get('/orders', authenticate, requireRole('worker'), ctrl.getOrders);
router.get('/nearby', authenticate, ctrl.getNearbyWorkers);

module.exports = router;
