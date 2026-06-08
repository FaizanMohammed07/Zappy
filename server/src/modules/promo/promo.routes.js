const express = require('express');
const Joi = require('joi');
const ctrl = require('./promo.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

// User: browse all currently active promos
router.get('/available', authenticate, ctrl.listAvailable);

// User: validate promo at checkout
router.post('/validate', authenticate, validate(Joi.object({
  code:            Joi.string().required(),
  service:         Joi.string().optional(),
  orderTotalPaise: Joi.number().integer().min(0).optional(),
})), ctrl.validate);

// Admin router
const adminRouter = express.Router();

const promoSchema = Joi.object({
  code:        Joi.string().alphanum().min(3).max(20).required(),
  name:        Joi.string().required(),
  description: Joi.string().allow('').default(''),
  type:        Joi.string().valid('flat', 'percent', 'first_order', 'loyalty').default('flat'),
  discount: Joi.object({
    value:            Joi.number().required(),
    maxDiscountPaise: Joi.number().integer().min(0).default(0),
    minOrderPaise:    Joi.number().integer().min(0).default(0),
  }).required(),
  services: Joi.array().items(Joi.string()).default([]),
  limits: Joi.object({
    totalUses:  Joi.number().integer().min(0).default(0),
    perUserUses: Joi.number().integer().min(0).default(1),
  }).default({}),
  validity: Joi.object({
    startAt: Joi.date().required(),
    endAt:   Joi.date().required(),
  }).required(),
  isActive: Joi.boolean().default(true),
}).options({ allowUnknown: false });

adminRouter.get('/', authenticate, requireRole('admin'), ctrl.adminList);
adminRouter.post('/', authenticate, requireRole('admin'), validate(promoSchema), ctrl.adminCreate);
adminRouter.patch('/:id', authenticate, requireRole('admin'), ctrl.adminUpdate);
adminRouter.delete('/:id', authenticate, requireRole('admin'), ctrl.adminDelete);

module.exports = router;
module.exports.adminRouter = adminRouter;
