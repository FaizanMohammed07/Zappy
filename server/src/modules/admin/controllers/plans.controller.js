const Plan = require('../../subscription/plan.model');

async function listAllPlans(req, res, next) {
  try {
    const plans = await Plan.find()
      .sort({ audience: 1, sortOrder: 1, priceInPaise: 1 })
      .lean();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ plan });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Plan code already exists' });
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true },
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
}

async function deletePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true },
    );
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAllPlans, createPlan, updatePlan, deletePlan };
