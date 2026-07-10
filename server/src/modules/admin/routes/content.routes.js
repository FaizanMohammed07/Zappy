const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const Content = require('../../content/content.model');
const contentService = require('../../content/content.service');
const auditService = require('../audit.service');

const router = express.Router();

const baseBody = Joi.object({
  type:     Joi.string().valid('faq', 'policy').required(),
  // FAQ
  question: Joi.string().max(300).when('type', { is: 'faq', then: Joi.required() }),
  answer:   Joi.string().max(4000).when('type', { is: 'faq', then: Joi.required() }),
  category: Joi.string().max(60).allow('', null),
  // Policy
  slug:  Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).max(80).when('type', { is: 'policy', then: Joi.required() }),
  title: Joi.string().max(160).when('type', { is: 'policy', then: Joi.required() }),
  body:  Joi.string().max(20000).when('type', { is: 'policy', then: Joi.required() }),
  // Shared
  audience: Joi.string().valid('user', 'worker', 'all').default('all'),
  order:    Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

/** GET /content — list everything (optionally filter by ?type=). */
router.get('/content', async (req, res, next) => {
  try {
    await contentService.ensureSeeded();
    const filter = {};
    if (['faq', 'policy'].includes(req.query.type)) filter.type = req.query.type;
    const items = await Content.find(filter).sort({ type: 1, category: 1, order: 1, createdAt: 1 }).lean();
    res.json({ items });
  } catch (err) { next(err); }
});

/** POST /content — create an FAQ or policy page. */
router.post('/content', validate(baseBody), async (req, res, next) => {
  try {
    const item = await Content.create({ ...req.body, updatedBy: String(req.auth.sub) });
    await auditService.fromRequest(req, 'admin.content_create', { kind: 'content', id: item._id }, null, req.body);
    res.status(201).json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: `A policy with slug "${req.body.slug}" already exists` });
    next(err);
  }
});

/** PUT /content/:id — update. */
router.put('/content/:id', validate(baseBody.fork(
  ['type', 'question', 'answer', 'slug', 'title', 'body'], (f) => f.optional()
)), async (req, res, next) => {
  try {
    const before = await Content.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ error: 'Content not found' });
    const item = await Content.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, updatedBy: String(req.auth.sub) } },
      { new: true, runValidators: true }
    );
    await auditService.fromRequest(req, 'admin.content_update', { kind: 'content', id: item._id }, before, req.body);
    res.json({ item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: `A policy with slug "${req.body.slug}" already exists` });
    next(err);
  }
});

/** PATCH /content/:id/active — toggle visibility. */
router.patch('/content/:id/active', validate(Joi.object({ isActive: Joi.boolean().required() })), async (req, res, next) => {
  try {
    const item = await Content.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { new: true });
    if (!item) return res.status(404).json({ error: 'Content not found' });
    res.json({ item });
  } catch (err) { next(err); }
});

/** DELETE /content/:id */
router.delete('/content/:id', async (req, res, next) => {
  try {
    const item = await Content.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Content not found' });
    await auditService.fromRequest(req, 'admin.content_delete', { kind: 'content', id: item._id }, item.toObject(), null);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
