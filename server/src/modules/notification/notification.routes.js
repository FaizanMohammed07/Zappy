const express = require('express');
const Joi = require('joi');
const ctrl = require('./notification.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get(
  '/',
  authenticate,
  validate(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    unreadOnly: Joi.boolean().default(false),
  }), 'query'),
  ctrl.list
);

router.post('/:id/read', authenticate, ctrl.markRead);
router.post('/read-all', authenticate, ctrl.markAllRead);

module.exports = router;
