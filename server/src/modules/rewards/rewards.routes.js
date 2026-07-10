const express = require('express');
const Joi = require('joi');
const ctrl = require('./rewards.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, requireRole('user'), ctrl.getSummary);
router.post('/redeem', authenticate, requireRole('user'),
  validate(Joi.object({ points: Joi.number().integer().min(1).required() })), ctrl.redeem);
router.post('/scratch/:cardId', authenticate, requireRole('user'), ctrl.scratch);

module.exports = router;
