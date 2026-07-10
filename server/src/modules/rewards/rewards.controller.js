const rewardsService = require('./rewards.service');

async function getSummary(req, res, next) {
  try {
    res.json(await rewardsService.getSummary(req.auth.sub));
  } catch (err) { next(err); }
}

async function redeem(req, res, next) {
  try {
    const result = await rewardsService.redeemPoints({ userId: req.auth.sub, points: req.body.points });
    res.json(result);
  } catch (err) { next(err); }
}

async function scratch(req, res, next) {
  try {
    const result = await rewardsService.scratchCard({ userId: req.auth.sub, cardId: req.params.cardId });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { getSummary, redeem, scratch };
