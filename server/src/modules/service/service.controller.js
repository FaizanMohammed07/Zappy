const ServiceCatalog = require('./service-catalog.model');
const Order = require('../order/order.model');
const { redis } = require('../../config/redis');
const invoiceService = require('./invoice.service');

async function listServices(req, res, next) {
  try {
    const services = await ServiceCatalog.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ services });
  } catch (err) { next(err); }
}

async function getService(req, res, next) {
  try {
    const service = await ServiceCatalog.findOne({ code: req.params.code.toLowerCase(), isActive: true }).lean();
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json({ service });
  } catch (err) { next(err); }
}

async function getInvoice(req, res, next) {
  try {
    const order = await Order.findById(req.params.orderId).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isOwner = String(order.userId) === String(req.auth.sub);
    if (!isOwner && req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = await invoiceService.getInvoiceData(req.params.orderId);
    if (req.query.format === 'json') return res.json({ invoice: data });
    res.set('Content-Type', 'text/html');
    res.send(invoiceService.renderHtml(data));
  } catch (err) { next(err); }
}

async function getWorkerHeatmap(req, res, next) {
  try {
    const { lat, lng, radiusKm = 10 } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng query params required' });
    const cells = await scanDemandCells(Number(lat), Number(lng), Number(radiusKm));
    res.json({ cells, generatedAt: new Date() });
  } catch (err) { next(err); }
}

async function scanDemandCells(lat, lng, radiusKm) {
  const stream = redis.scanStream({ match: 'demand:*', count: 200 });
  const cells = [];
  for await (const batch of stream) {
    for (const key of batch) {
      const [bLat, bLng] = key.replace('demand:', '').split(':').map(Number);
      const dist = haversineKm({ lat, lng }, { lat: bLat, lng: bLng });
      if (dist > radiusKm) continue;
      const demand = Number(await redis.get(key)) || 0;
      const supply = Number(await redis.scard(`supply:${bLat.toFixed(2)}:${bLng.toFixed(2)}`)) || 0;
      cells.push({
        lat: bLat, lng: bLng, demand, supply,
        attractivenessScore: supply === 0 ? demand * 2 : demand / Math.max(1, supply),
      });
    }
  }
  cells.sort((a, b) => b.attractivenessScore - a.attractivenessScore);
  return cells;
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ── Admin: list all services (incl. inactive) ── */
async function adminListServices(req, res, next) {
  try {
    const services = await ServiceCatalog.find({}).sort({ category: 1, sortOrder: 1, name: 1 }).lean();
    res.json({ services });
  } catch (err) { next(err); }
}

/* ── Admin: update a service's pricing + meta ── */
async function adminUpdateService(req, res, next) {
  try {
    const { code } = req.params;
    const {
      name, description,
      priceRangeMinRs, priceRangeMaxRs,
      estimatedDurationMinutes,
      isActive,
    } = req.body;

    const update = {};
    if (name                    != null) update.name = name;
    if (description             != null) update.description = description;
    if (priceRangeMinRs         != null) update.priceRangeMinPaise = Math.round(Number(priceRangeMinRs) * 100);
    if (priceRangeMaxRs         != null) update.priceRangeMaxPaise = Math.round(Number(priceRangeMaxRs) * 100);
    if (estimatedDurationMinutes != null) update.estimatedDurationMinutes = Number(estimatedDurationMinutes);
    if (isActive                != null) update.isActive = Boolean(isActive);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const svc = await ServiceCatalog.findOneAndUpdate(
      { code: code.toLowerCase() },
      { $set: update },
      { new: true }
    ).lean();
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    res.json({ service: svc });
  } catch (err) { next(err); }
}

async function adminServiceActiveOrderCount(req, res, next) {
  try {
    const Order = require('../order/order.model');
    const count = await Order.countDocuments({
      service: req.params.code.toLowerCase(),
      status: { $in: ['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] },
    });
    res.json({ code: req.params.code, activeOrderCount: count });
  } catch (err) { next(err); }
}

module.exports = { listServices, getService, getInvoice, getWorkerHeatmap, adminListServices, adminUpdateService, adminServiceActiveOrderCount };
