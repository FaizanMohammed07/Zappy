const Appeal = require('./appeal.model');

async function listMyAppeals(req, res, next) {
  try {
    const appeals = await Appeal.find({ workerId: req.auth.sub })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ appeals });
  } catch (err) { next(err); }
}

async function createAppeal(req, res, next) {
  try {
    const { type, orderId, subject, description } = req.body;
    const appeal = await Appeal.create({
      workerId: req.auth.sub,
      type,
      orderId: orderId || null,
      subject,
      description,
    });
    res.status(201).json({ appeal });
  } catch (err) { next(err); }
}

async function getAppeal(req, res, next) {
  try {
    const appeal = await Appeal.findOne({ _id: req.params.id, workerId: req.auth.sub }).lean();
    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ appeal });
  } catch (err) { next(err); }
}

// Admin
async function adminListAppeals(req, res, next) {
  try {
    const { status, page = 1 } = req.query;
    const filter = status ? { status } : {};
    const limit = 30;
    const [appeals, total] = await Promise.all([
      Appeal.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('workerId', 'name phone').populate('orderId', 'service').lean(),
      Appeal.countDocuments(filter),
    ]);
    res.json({ appeals, total, page: Number(page) });
  } catch (err) { next(err); }
}

async function adminResolveAppeal(req, res, next) {
  try {
    const { status, adminNote } = req.body;
    const appeal = await Appeal.findByIdAndUpdate(
      req.params.id,
      { $set: { status, adminNote, resolvedBy: req.auth.sub, resolvedAt: new Date() } },
      { new: true }
    );
    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ appeal });
  } catch (err) { next(err); }
}

module.exports = { listMyAppeals, createAppeal, getAppeal, adminListAppeals, adminResolveAppeal };
