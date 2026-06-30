const express = require('express');
const Joi = require('joi');
const ctrl = require('./voice.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { voiceLimiter } = require('../../middlewares/rateLimit');

const router = express.Router();

const chatSchema = Joi.object({
  messages: Joi.array()
    .items(Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().allow('').max(2000).required(),
    }))
    .min(1).max(40).required(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().max(500).allow('', null),
  lensScanId: Joi.string().max(64).allow('', null),
});

// One conversational turn — runs the AI tool-calling loop and returns reply + cards.
router.post('/chat', authenticate, requireRole('user'), voiceLimiter, validate(chatSchema), ctrl.chat);

module.exports = router;
