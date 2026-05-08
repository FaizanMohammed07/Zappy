const orderService = require('./order.service');
const pricingService = require('../pricing/pricing.service');

async function getQuote(req, res, next) {
  try {
    const { service } = req.query;
    const pickupLat = parseFloat(req.query.pickupLat);
    const pickupLng = parseFloat(req.query.pickupLng);
    const dropLat   = req.query.dropLat  != null ? parseFloat(req.query.dropLat)  : null;
    const dropLng   = req.query.dropLng  != null ? parseFloat(req.query.dropLng)  : null;
    if (isNaN(pickupLat) || isNaN(pickupLng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
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
    const page  = Number(req.query.page) || 1;
    const limit = 20;
    const [orders, total] = await orderService.listByUser(req.auth.sub, { page, limit });
    res.json({ orders, total, totalPages: Math.ceil(total / limit), page });
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
    // Show OTP to the assigned worker (enters it) AND the order owner (reads it out).
    // Admins and unrelated parties never see it.
    if (!isOwner && !isAssignedWorker) delete order.otp;
    // Attach display names + worker stats used by chat header and tracking UI.
    const User   = require('../user/user.model');
    const Worker = require('../worker/worker.model');
    const [user, worker] = await Promise.all([
      User.findById(order.userId).select('name').lean(),
      order.workerId ? Worker.findById(order.workerId).select('name rating completedJobs').lean() : null,
    ]);
    if (user)   order.userName   = user.name   || null;
    if (worker) {
      order.workerName = worker.name || null;
      order.workerJobs = worker.completedJobs || 0;
      // order.workerRating on the Order schema is the rating the worker gave the user.
      // Null during active orders, so populate from the worker's own profile rating.
      if (order.workerRating == null) order.workerRating = worker.rating || null;
    }
    res.json({ order });
  } catch (err) { next(err); }
}

async function getCancelPreview(req, res, next) {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.userId) !== String(req.auth.sub)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cancellationService = require('./cancellation.service');
    const preview = await cancellationService.previewCancelFee(order);
    res.json(preview);
  } catch (err) { next(err); }
}

async function cancelOrder(req, res, next) {
  try {
    const result = await orderService.cancelByUser({
      orderId: req.params.id,
      userId: req.auth.sub,
      reason: req.body?.reason,
    });
    res.json(result);
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
    const order = await orderService.workerComplete({
      orderId: req.params.id,
      workerId: req.auth.sub,
      completionPhotos: req.body?.completionPhotos || [],
    });
    res.json({ order });
  } catch (err) { next(err); }
}

async function workerCancelOrder(req, res, next) {
  try {
    const result = await orderService.workerCancel({ orderId: req.params.id, workerId: req.auth.sub, reason: req.body.reason });
    res.json(result);
  } catch (err) { next(err); }
}

async function getInvoice(req, res, next) {
  try {
    const order = await orderService.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.userId) !== String(req.auth.sub)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const invoiceService = require('../service/invoice.service');
    const data = await invoiceService.getInvoiceData(req.params.id);
    const html = invoiceService.renderHtml(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${data.invoiceNumber}.html"`);
    res.send(html);
  } catch (err) { next(err); }
}

module.exports = { getQuote, createOrder, listMine, getOne, getCancelPreview, cancelOrder, rateOrder, workerRateUser, getTimeline, acceptOffer, rejectOffer, startTrip, arrive, startService, completeOrder, workerCancelOrder, getInvoice };
