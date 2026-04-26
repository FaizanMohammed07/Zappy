const payoutService = require('./payout.service');
const Payout = require('./payout.model');

async function requestPayout(req, res, next) {
  try {
    const { amountPaise, ...dest } = req.body;
    const payout = await payoutService.requestPayout({ workerId: req.auth.sub, amountPaise, destination: dest });
    res.status(201).json({ payout });
  } catch (err) { next(err); }
}

async function listMine(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const result = await payoutService.listForWorker(req.auth.sub, { page });
    res.json(result);
  } catch (err) { next(err); }
}

async function adminList(req, res, next) {
  try {
    const { status, page = 1 } = req.query;
    const filter = status ? { status } : {};
    const limit = 50;
    const [items, total] = await Promise.all([
      Payout.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('workerId', 'name phone').lean(),
      Payout.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page) });
  } catch (err) { next(err); }
}

async function adminApprove(req, res, next) {
  try {
    const autoProcess = req.body?.autoProcess !== false;
    const payout = await payoutService.approvePayout({ payoutId: req.params.id, adminId: req.auth.sub, autoProcess });
    res.json({ payout });
  } catch (err) { next(err); }
}

async function adminReject(req, res, next) {
  try {
    const payout = await payoutService.rejectPayout({ payoutId: req.params.id, adminId: req.auth.sub, reason: req.body.reason });
    res.json({ payout });
  } catch (err) { next(err); }
}

async function adminProcess(req, res, next) {
  try {
    const payout = await payoutService.processPayout({ payoutId: req.params.id });
    res.json({ payout });
  } catch (err) { next(err); }
}

module.exports = { requestPayout, listMine, adminList, adminApprove, adminReject, adminProcess };
