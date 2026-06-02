const AuditLog = require('../audit-log.model');

async function getAuditLogs(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 50;
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actorId) filter['actor.id'] = req.query.actorId;
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ logs, total });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs };
