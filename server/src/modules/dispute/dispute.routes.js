const express = require('express');
const Joi = require('joi');
const ctrl = require('./dispute.controller');
const Dispute = require('./dispute.model');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { disputeLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

router.post(
  '/',
  authenticate,
  disputeLimiter,
  validate(Joi.object({
    orderId: Joi.string().hex().length(24).optional(),
    category: Joi.string().valid(...Dispute.CATEGORIES).required(),
    description: Joi.string().min(10).max(2000).required(),
    evidenceUrls: Joi.array().items(Joi.string()).max(5).default([]),
  })),
  ctrl.openDispute
);

router.get('/mine', authenticate, ctrl.listMine);
router.get('/:id', authenticate, ctrl.getOne);
router.post('/:id/messages', authenticate, validate(Joi.object({ text: Joi.string().min(1).max(2000).required() })), ctrl.addMessage);

const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/', ctrl.adminList);
adminRouter.post(
  '/:id/resolve',
  validate(Joi.object({
    type: Joi.string().valid(...Dispute.RESOLUTION_TYPES).required(),
    refundAmountPaise: Joi.number().integer().min(0).optional(),
    penaltyAmountPaise: Joi.number().integer().min(0).optional(),
    adminNotes: Joi.string().max(2000).optional(),
  })),
  ctrl.adminResolve
);

module.exports = router;
module.exports.adminRouter = adminRouter;
