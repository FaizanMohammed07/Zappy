const pricingService = require('./pricing.service');

async function getConfig(req, res, next) {
  try {
    const cfg = await pricingService.getActiveConfig();
    res.json({ pricing: cfg });
  } catch (err) { next(err); }
}

async function adminUpdateConfig(req, res, next) {
  try {
    const updated = await pricingService.updateActiveConfig(req.body, req.auth.sub);
    res.json({ pricing: updated });
  } catch (err) { next(err); }
}

module.exports = { getConfig, adminUpdateConfig };
