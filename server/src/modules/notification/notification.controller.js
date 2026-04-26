const notificationService = require('./notification.service');

async function list(req, res, next) {
  try {
    if (!['user', 'worker'].includes(req.auth.role)) {
      return res.status(403).json({ error: 'Notifications only for users/workers' });
    }
    const result = await notificationService.listFor({
      kind: req.auth.role,
      id: req.auth.sub,
      page: Number(req.query.page),
      limit: Number(req.query.limit),
      unreadOnly: req.query.unreadOnly === 'true' || req.query.unreadOnly === true,
    });
    res.json(result);
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await notificationService.markRead({ kind: req.auth.role, id: req.auth.sub, notificationId: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllRead({ kind: req.auth.role, id: req.auth.sub });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, markRead, markAllRead };
