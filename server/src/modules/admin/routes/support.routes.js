const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/operations.controller');

const router = express.Router();

router.get('/support', ctrl.listSupportTickets);
router.post(
  '/support/:id/reply',
  validate(Joi.object({
    text: Joi.string().min(1).max(2000).required(),
    status: Joi.string().valid('open', 'in_progress', 'waiting_user', 'resolved', 'closed').optional(),
  })),
  ctrl.replyToSupportTicket,
);

module.exports = router;
