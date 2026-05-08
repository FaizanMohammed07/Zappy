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

async function getNearbyWorkers(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const geoService = require('./geo.service');
    const workers = await geoService.findNearbyWorkers({ lat, lng, radiusKm: 5, limit: 25 });
    res.json({ workers, count: workers.length });
  } catch (err) { next(err); }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Known zones — used as demand-hotspot seeds.
   In production, replace with a database of service areas. */
const DEMAND_ZONE_SEEDS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'HSR Layout',  lat: 12.9116, lng: 77.6389 },
  { name: 'BTM Layout',  lat: 12.9165, lng: 77.6101 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Whitefield',  lat: 12.9698, lng: 77.7500 },
  { name: 'Jayanagar',   lat: 12.9308, lng: 77.5839 },
  { name: 'Marathahalli',lat: 12.9591, lng: 77.6974 },
  { name: 'Electronic City', lat: 12.8458, lng: 77.6630 },
];

async function getDemandZones(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    const { redis } = require('../../config/redis');

    const zones = await Promise.all(
      DEMAND_ZONE_SEEDS.map(async (zone) => {
        const bucket = `${zone.lat.toFixed(2)}:${zone.lng.toFixed(2)}`;
        const [demand, supply] = await Promise.all([
          redis.get(`demand:${bucket}`).then((v) => Number(v) || 0),
          redis.scard(`supply:${bucket}`).then((v) => Number(v) || 0),
        ]);

        const distKm = haversineKm(lat, lng, zone.lat, zone.lng);

        // Demand level based on demand/supply ratio
        let level;
        if (supply === 0 && demand > 0) level = 'very_high';
        else if (demand === 0 && supply === 0) level = 'low';
        else {
          const ratio = demand / Math.max(supply, 1);
          if (ratio >= 3)    level = 'very_high';
          else if (ratio >= 1.5) level = 'high';
          else if (ratio >= 0.5) level = 'medium';
          else                   level = 'low';
        }

        // Estimated wait: fewer workers + more demand → shorter wait
        const waitMin = supply === 0
          ? (demand > 0 ? '<2' : '10+')
          : Math.max(1, Math.round(distKm / 20 * 60)); // rough travel time

        return { name: zone.name, distKm: parseFloat(distKm.toFixed(1)), level, demand, supply, waitMin };
      })
    );

    // Sort by distance, filter within 15 km, skip "low" that are far away
    const nearby = zones
      .filter((z) => z.distKm <= 15)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 6);

    res.json({ zones: nearby });
  } catch (err) { next(err); }
}

module.exports = { getMe, goOnline, goOffline, updateLocation, getEarnings, getOrders, getNearbyWorkers, getDemandZones };
