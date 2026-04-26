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

module.exports = { listServices, getService, getInvoice, getWorkerHeatmap };
