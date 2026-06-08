const Appeal = require('./appeal.model');

async function listMyAppeals(req, res, next) {
  try {
    const appeals = await Appeal.find({ workerId: req.auth.sub })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ appeals });
  } catch (err) { next(err); }
}

async function createAppeal(req, res, next) {
  try {
    const { type, orderId, subject, description } = req.body;

    if (description.length < 30) {
      return res.status(400).json({ error: 'Description must be at least 30 characters' });
    }

    // Prevent duplicate open appeals for the same order
    if (orderId) {
      const existing = await Appeal.findOne({
        workerId: req.auth.sub,
        orderId,
        status: { $in: ['pending', 'under_review'] },
      });
      if (existing) {
        return res.status(409).json({ error: 'You already have an open appeal for this order' });
      }
    }

    // Max 10 open appeals at a time (spam guard)
    const openCount = await Appeal.countDocuments({
      workerId: req.auth.sub,
      status: { $in: ['pending', 'under_review'] },
    });
    if (openCount >= 10) {
      return res.status(429).json({ error: 'Too many open appeals. Wait for existing ones to be resolved.' });
    }

    const appeal = await Appeal.create({
      workerId: req.auth.sub,
      type,
      orderId: orderId || null,
      subject: subject.trim(),
      description: description.trim(),
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
    const filter = status && status !== 'all' ? { status } : {};
    const limit = 30;
    const [appeals, total] = await Promise.all([
      Appeal.find(filter)
        .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('workerId', 'name phone').lean(),
      Appeal.countDocuments(filter),
    ]);
    res.json({ appeals, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

async function adminResolveAppeal(req, res, next) {
  try {
    const { status, adminNote } = req.body;
    if (!['upheld', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be upheld or dismissed' });
    }
    const appeal = await Appeal.findByIdAndUpdate(
      req.params.id,
      { $set: { status, adminNote: adminNote?.trim(), resolvedBy: req.auth.sub, resolvedAt: new Date() } },
      { new: true }
    );
    if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
    res.json({ appeal });
  } catch (err) { next(err); }
}

module.exports = { listMyAppeals, createAppeal, getAppeal, adminListAppeals, adminResolveAppeal };
