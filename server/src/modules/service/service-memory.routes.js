/**
 * Service Memory Routes — Appliance Passport / Home History (Feature 7 + 8)
 */
const express = require('express');
const Joi     = require('joi');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, requireRole('user'), async (req, res, next) => {
  try {
    const svc      = require('./service-memory.service');
    const memories = await svc.getUserMemories(req.auth.sub);
    const reminders = await svc.getDueReminders(req.auth.sub);
    res.json({ memories, reminders });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, requireRole('user'), async (req, res, next) => {
  try {
    const svc    = require('./service-memory.service');
    const memory = await svc.getMemory(req.params.id, req.auth.sub);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    res.json({ memory });
  } catch (err) { next(err); }
});

router.patch('/:id',
  authenticate, requireRole('user'),
  validate(Joi.object({
    label:             Joi.string().max(100).optional(),
    preferredWorkerId: Joi.string().hex().length(24).optional().allow(null),
  })),
  async (req, res, next) => {
    try {
      const svc    = require('./service-memory.service');
      const memory = await svc.labelMemory({ memoryId: req.params.id, userId: req.auth.sub, ...req.body });
      if (!memory) return res.status(404).json({ error: 'Memory not found' });
      res.json({ memory });
    } catch (err) { next(err); }
  }
);

module.exports = router;
