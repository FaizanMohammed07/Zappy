const orderService = require('./order.service');
const pricingService = require('../pricing/pricing.service');

async function getQuote(req, res, next) {
  try {
    const { service, pickupLat, pickupLng, dropLat, dropLng } = req.query;
    const quote = await pricingService.quote({
      origin: { lat: pickupLat, lng: pickupLng },
      dest: { lat: dropLat ?? pickupLat + 0.01, lng: dropLng ?? pickupLng },
      service,
    });
    res.json({ quote });
  } catch (err) { next(err); }
}

async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder({ userId: req.auth.sub, ...req.body });
    res.status(201).json({ order: { _id: order._id, status: order.status, service: order.service, pickupLocation: order.pickupLocation, pricing: order.pricing } });
  } catch (err) { next(err); }
}

async function listMine(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const orders = await orderService.listByUser(req.auth.sub, { page, limit: 20 });
    res.json({ orders });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isOwner = String(order.userId) === String(req.auth.sub);
    const isAssignedWorker = String(order.workerId || '') === String(req.auth.sub);
    if (!isOwner && !isAssignedWorker && req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.auth.role !== 'worker') delete order.otp;
    res.json({ order });
  } catch (err) { next(err); }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await orderService.cancelByUser({ orderId: req.params.id, userId: req.auth.sub, reason: req.body.reason });
    res.json({ order });
  } catch (err) { next(err); }
}

async function rateOrder(req, res, next) {
  try {
    const order = await orderService.rateOrder({ orderId: req.params.id, userId: req.auth.sub, ...req.body });
    res.json({ order });
  } catch (err) { next(err); }
}

async function workerRateUser(req, res, next) {
  try {
    const order = await orderService.workerRateUser({ orderId: req.params.id, workerId: req.auth.sub, ...req.body });
    res.json({ order });
  } catch (err) { next(err); }
}

async function getTimeline(req, res, next) {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isOwner = String(order.userId) === String(req.auth.sub);
    const isAssignedWorker = String(order.workerId || '') === String(req.auth.sub);
    if (!isOwner && !isAssignedWorker && req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const firstAtByStatus = {};
    for (const h of order.statusHistory || []) {
      if (!firstAtByStatus[h.status]) firstAtByStatus[h.status] = h.at;
    }
    const stages = ['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'failed'].filter((s) => firstAtByStatus[s]);
    res.json({ orderId: order._id, currentStatus: order.status, timeline: stages.map((s) => ({ status: s, at: firstAtByStatus[s] })), createdAt: order.createdAt, completedAt: order.completedAt, cancelledAt: order.cancelledAt });
  } catch (err) { next(err); }
}

async function acceptOffer(req, res, next) {
  try {
    const r = await orderService.acceptOffer({ orderId: req.params.id, workerId: req.auth.sub });
    res.json(r);
  } catch (err) { next(err); }
}

async function rejectOffer(req, res, next) {
  try {
    const r = await orderService.rejectOffer({ orderId: req.params.id, workerId: req.auth.sub });
    res.json(r);
  } catch (err) { next(err); }
}

async function startTrip(req, res, next) {
  try {
    const order = await orderService.workerStartTrip({ orderId: req.params.id, workerId: req.auth.sub });
    res.json({ order });
  } catch (err) { next(err); }
}

async function arrive(req, res, next) {
  try {
    const order = await orderService.workerArrive({ orderId: req.params.id, workerId: req.auth.sub });
    res.json({ order });
  } catch (err) { next(err); }
}

async function startService(req, res, next) {
  try {
    const order = await orderService.workerStartService({ orderId: req.params.id, workerId: req.auth.sub, otp: req.body.otp });
    res.json({ order });
  } catch (err) { next(err); }
}

async function completeOrder(req, res, next) {
  try {
    const order = await orderService.workerComplete({ orderId: req.params.id, workerId: req.auth.sub });
    res.json({ order });
  } catch (err) { next(err); }
}

module.exports = { getQuote, createOrder, listMine, getOne, cancelOrder, rateOrder, workerRateUser, getTimeline, acceptOffer, rejectOffer, startTrip, arrive, startService, completeOrder };
