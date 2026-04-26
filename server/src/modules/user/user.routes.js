const express = require('express');
const Joi = require('joi');
const ctrl = require('./user.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/me', authenticate, requireRole('user'), ctrl.getMe);

router.patch(
  '/me',
  authenticate,
  requireRole('user'),
  validate(Joi.object({ name: Joi.string().max(100), email: Joi.string().email(), defaultPayment: Joi.string().valid('cash', 'upi', 'card') })),
  ctrl.updateMe
);

router.post(
  '/addresses',
  authenticate,
  requireRole('user'),
  validate(Joi.object({
    label: Joi.string().max(50).required(),
    address: Joi.string().max(500).required(),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    landmark: Joi.string().max(200).allow('', null),
    flatNumber: Joi.string().max(100).allow('', null),
    notes: Joi.string().max(500).allow('', null),
    tag: Joi.string().valid('home', 'work', 'other').default('other'),
  })),
  ctrl.addAddress
);

router.delete('/addresses/:addrId', authenticate, requireRole('user'), ctrl.deleteAddress);

module.exports = router;
