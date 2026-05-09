const express = require('express');
const Joi = require('joi');
const ctrl = require('./ad.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

// Public/authenticated — fetch ads for current user/worker
router.get('/', authenticate, ctrl.getActive);
router.post('/:id/impression', authenticate, ctrl.impression);
router.post('/:id/click', authenticate, ctrl.click);

// Admin router (mounted under /api/:slug/ads)
const adminRouter = express.Router();

const adSchema = Joi.object({
  title:    Joi.string().required(),
  type:     Joi.string().valid('banner', 'popup', 'offer_card', 'sponsored_service', 'home_card', 'notification').required(),
  audience: Joi.string().valid('users', 'workers', 'both').default('users'),
  status:   Joi.string().valid('draft', 'active', 'paused', 'completed').default('draft'),
  content:  Joi.object({
    headline:        Joi.string().required(),
    body:            Joi.string().allow('').default(''),
    imageUrl:        Joi.string().allow('').default(''),
    ctaText:         Joi.string().default('Learn More'),
    ctaLink:         Joi.string().allow('').default(''),
    badgeText:       Joi.string().allow('').default(''),
    backgroundColor: Joi.string().default('#2563EB'),
    textColor:       Joi.string().default('#FFFFFF'),
  }).required(),
  targeting: Joi.object({
    serviceCategories: Joi.array().items(Joi.string()).default([]),
    userBehavior:      Joi.string().valid('all', 'new_users', 'inactive_7d', 'high_spenders').default('all'),
  }).default({}),
  schedule: Joi.object({
    startAt:          Joi.date().required(),
    endAt:            Joi.date().required(),
    impressionsLimit: Joi.number().integer().min(0).default(0),
  }).required(),
  billing: Joi.object({
    model:  Joi.string().valid('cpm', 'cpc', 'fixed').default('fixed'),
    rate:   Joi.number().min(0).default(0),
    budget: Joi.number().min(0).default(0),
  }).default({}),
}).options({ allowUnknown: false });

adminRouter.get('/', authenticate, requireRole('admin'), ctrl.adminList);
adminRouter.post('/', authenticate, requireRole('admin'), validate(adSchema), ctrl.adminCreate);
adminRouter.patch('/:id', authenticate, requireRole('admin'), ctrl.adminUpdate);
adminRouter.delete('/:id', authenticate, requireRole('admin'), ctrl.adminDelete);

module.exports = router;
module.exports.adminRouter = adminRouter;
