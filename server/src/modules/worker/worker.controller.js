const Worker = require('./worker.model');
const workerService = require('./worker.service');
const orderService = require('../order/order.service');

async function getMe(req, res, next) {
  try {
    const worker = await Worker.findById(req.auth.sub).lean();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ worker });
  } catch (err) { next(err); }
}

async function goOnline(req, res, next) {
  try {
    const worker = await workerService.goOnline({ workerId: req.auth.sub, lat: req.body.lat, lng: req.body.lng });
    res.json({ worker });
  } catch (err) { next(err); }
}

async function goOffline(req, res, next) {
  try {
    const worker = await workerService.goOffline({ workerId: req.auth.sub });
    res.json({ worker });
  } catch (err) { next(err); }
}

async function updateLocation(req, res, next) {
  try {
    await workerService.updateLocation({ workerId: req.auth.sub, lat: req.body.lat, lng: req.body.lng, orderId: req.body.orderId });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getEarnings(req, res, next) {
  try {
    const data = await workerService.getEarnings({ workerId: req.auth.sub, range: req.query.range });
    res.json(data);
  } catch (err) { next(err); }
}

async function getOrders(req, res, next) {
  try {
    const orders = await orderService.listByWorker(req.auth.sub, { page: Number(req.query.page) || 1 });
    res.json({ orders });
  } catch (err) { next(err); }
}

module.exports = { getMe, goOnline, goOffline, updateLocation, getEarnings, getOrders };
