const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const rewardsService = require('../../rewards/rewards.service');
const { RewardAccount, ScratchCard, PointsLedger } = require('../../rewards/rewards.models');
const auditService = require('../audit.service');

const router = express.Router();

const tierSchema = Joi.object({
  label:  Joi.string().max(60).required(),
  type:   Joi.string().valid('points', 'cashback', 'none').required(),
  value:  Joi.number().integer().min(0).required(),
  weight: Joi.number().min(0).required(),
});

const configBody = Joi.object({
  enabled:              Joi.boolean(),
  pointsPerOrder:       Joi.number().integer().min(0),
  pointsPer100Rupees:   Joi.number().integer().min(0),
  pointsPerReferral:    Joi.number().integer().min(0),
  pointsPerRefereeJoin: Joi.number().integer().min(0),
  redeemPaisePerPoint:  Joi.number().integer().min(1).max(100),
  minRedeemPoints:      Joi.number().integer().min(1),
  scratchOnOrder:       Joi.boolean(),
  scratchExpiryDays:    Joi.number().integer().min(1).max(365),
  scratchTiers:         Joi.array().items(tierSchema).min(1).max(12),
}).min(1);

/** GET /rewards-config — current config + high-level stats. */
router.get('/rewards-config', async (req, res, next) => {
  try {
    const config = await rewardsService.getConfig();
    const [accounts, outstandingPoints, activeCards] = await Promise.all([
      RewardAccount.countDocuments(),
      RewardAccount.aggregate([{ $group: { _id: null, total: { $sum: '$points' } } }]).then((r) => r[0]?.total || 0),
      ScratchCard.countDocuments({ status: 'active' }),
    ]);
    res.json({ config, stats: { accounts, outstandingPoints, activeCards } });
  } catch (err) { next(err); }
});

/** PUT /rewards-config — update config. */
router.put('/rewards-config', validate(configBody), async (req, res, next) => {
  try {
    const before = await rewardsService.getConfig();
    const config = await rewardsService.updateConfig(req.body, String(req.auth.sub));
    await auditService.fromRequest(req, 'admin.rewards_config_update', { kind: 'rewards', id: 'active' }, before, req.body);
    res.json({ config });
  } catch (err) { next(err); }
});

/** POST /rewards-config/grant — manually grant points to a user (support/goodwill). */
router.post('/rewards-config/grant', validate(Joi.object({
  userId: Joi.string().hex().length(24).required(),
  points: Joi.number().integer().min(1).max(100000).required(),
  reason: Joi.string().max(120).default('admin_grant'),
})), async (req, res, next) => {
  try {
    await rewardsService.awardPoints({
      userId: req.body.userId, points: req.body.points, reason: 'admin_grant',
      ref: req.body.reason, idempotencyKey: `admin_grant:${req.body.userId}:${Date.now()}`,
    });
    await auditService.fromRequest(req, 'admin.rewards_grant', { kind: 'user', id: req.body.userId }, null, req.body);
    res.json({ ok: true, balance: await rewardsService.getBalance(req.body.userId) });
  } catch (err) { next(err); }
});

module.exports = router;
