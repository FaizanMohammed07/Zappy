const Dispute = require('./dispute.model');
const disputeService = require('./dispute.service');

async function openDispute(req, res, next) {
  try {
    if (!['user', 'worker'].includes(req.auth.role)) {
      return res.status(403).json({ error: 'Only users and workers can raise disputes' });
    }
    const dispute = await disputeService.open({
      orderId: req.body.orderId,
      raisedBy: { kind: req.auth.role, id: req.auth.sub },
      category: req.body.category,
      description: req.body.description,
      evidenceUrls: req.body.evidenceUrls,
    });
    res.status(201).json({ dispute });
  } catch (err) { next(err); }
}

async function listMine(req, res, next) {
  try {
    const disputes = await Dispute.find({ 'raisedBy.kind': req.auth.role, 'raisedBy.id': req.auth.sub }).sort({ createdAt: -1 }).lean();
    res.json({ disputes });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const dispute = await Dispute.findById(req.params.id).lean();
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    const isRaiser = String(dispute.raisedBy.id) === String(req.auth.sub);
    const isAgainst = String(dispute.against?.id) === String(req.auth.sub);
    if (!isRaiser && !isAgainst && req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ dispute });
  } catch (err) { next(err); }
}

async function addMessage(req, res, next) {
  try {
    const dispute = await disputeService.addMessage({ disputeId: req.params.id, from: req.auth.role, fromId: req.auth.sub, text: req.body.text });
    res.json({ dispute });
  } catch (err) { next(err); }
}

async function adminList(req, res, next) {
  try {
    const status = req.query.status || 'open';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;
    const filter = status === 'all' ? {} : { status };
    const [items, total] = await Promise.all([
      Dispute.find(filter).sort({ slaDeadline: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Dispute.countDocuments(filter),
    ]);
    res.json({ items, total, page });
  } catch (err) { next(err); }
}

async function adminResolve(req, res, next) {
  try {
    const dispute = await disputeService.resolve({ disputeId: req.params.id, resolution: req.body, req });
    res.json({ dispute });
  } catch (err) { next(err); }
}

module.exports = { openDispute, listMine, getOne, addMessage, adminList, adminResolve };
