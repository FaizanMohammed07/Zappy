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

/* ── Shift Slots ─────────────────────────────────────────────────────────── */

async function getShifts(req, res, next) {
  try {
    const availService = require('./availability.service');
    const from = req.query.from ? new Date(req.query.from) : new Date();
    const to   = req.query.to   ? new Date(req.query.to)   : new Date(Date.now() + 7 * 86400000);
    const shifts = await availService.getShifts({ workerId: req.auth.sub, fromDate: from, toDate: to });
    const today  = await availService.getTodayShifts(req.auth.sub);
    res.json({ shifts, today });
  } catch (err) { next(err); }
}

async function previewShift(req, res, next) {
  try {
    const availService = require('./availability.service');
    const { startHour, endHour, lat, lng } = req.query;
    if (!startHour || !endHour || !lat || !lng) {
      return res.status(400).json({ error: 'startHour, endHour, lat, lng required' });
    }
    const data = await availService.previewShift({
      startHour: Number(startHour),
      endHour:   Number(endHour),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
    res.json(data);
  } catch (err) { next(err); }
}

async function commitShift(req, res, next) {
  try {
    const availService = require('./availability.service');
    const { startHour, endHour, lat, lng, date, zoneLabel } = req.body;
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) {
      return res.status(400).json({ error: 'startHour and endHour must be integers' });
    }
    const result = await availService.commitShift({
      workerId: req.auth.sub,
      date: date ? new Date(date) : new Date(),
      startHour,
      endHour,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zoneLabel,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function cancelShiftSlot(req, res, next) {
  try {
    const availService = require('./availability.service');
    const doc = await availService.cancelSlot({
      workerId: req.auth.sub,
      startHour: Number(req.body.startHour),
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });
    res.json({ ok: true, doc });
  } catch (err) { next(err); }
}

/* ── Wellness ──────────────────────────────────────────────────────────────── */

async function getWellness(req, res, next) {
  try {
    const wellnessService = require('./wellness.service');
    const data = await wellnessService.computeWellnessScore(req.auth.sub);
    if (!data) return res.status(404).json({ error: 'Worker not found' });
    res.json(data);
  } catch (err) { next(err); }
}

async function claimBreakBonus(req, res, next) {
  try {
    const wellnessService = require('./wellness.service');
    const result = await wellnessService.creditBreakBonus(req.auth.sub);
    if (!result.ok) return res.status(400).json({ error: 'No break bonus available right now' });
    res.json(result);
  } catch (err) { next(err); }
}

/* ── Neighborhood Reputation ───────────────────────────────────────────────── */

async function getNeighborhoodRep(req, res, next) {
  try {
    const Order = require('../order/order.model');
    const workerId = req.params.id || req.auth.sub;
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }

    /* 5km radius around the customer/pickup location */
    const radiusMeters = 5000;
    const since90d = new Date(Date.now() - 90 * 86400000);

    const localOrders = await Order.find({
      workerId,
      status: 'completed',
      completedAt: { $gte: since90d },
      pickupLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusMeters,
        },
      },
    }).select('userRating completedAt').lean().limit(200);

    const totalLocal = localOrders.length;
    const ratedLocal = localOrders.filter(o => o.userRating);
    const localRating = ratedLocal.length > 0
      ? Math.round((ratedLocal.reduce((s, o) => s + o.userRating, 0) / ratedLocal.length) * 10) / 10
      : null;

    /* Area label from demand-zone seeds (nearest match within 3km) */
    const ZONES = [
      { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
      { name: 'HSR Layout',  lat: 12.9116, lng: 77.6389 },
      { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
      { name: 'Whitefield',  lat: 12.9698, lng: 77.7500 },
      { name: 'Jayanagar',   lat: 12.9308, lng: 77.5839 },
      { name: 'BTM Layout',  lat: 12.9165, lng: 77.6101 },
      { name: 'Marathahalli',lat: 12.9591, lng: 77.6974 },
    ];
    const nearest = ZONES.reduce((best, z) => {
      const d = haversineKm(lat, lng, z.lat, z.lng);
      return (!best || d < best.d) ? { name: z.name, d } : best;
    }, null);
    const areaLabel = nearest?.d < 3 ? nearest.name : `${lat.toFixed(2)},${lng.toFixed(2)}`;

    const isLocalHero = totalLocal >= 10 && localRating && localRating >= 4.5;

    res.json({
      workerId: String(workerId),
      areaLabel,
      totalLocalJobs: totalLocal,
      localRating,
      isLocalHero,
      radiusKm: radiusMeters / 1000,
    });
  } catch (err) { next(err); }
}

async function getPublicProfile(req, res, next) {
  try {
    const worker = await Worker.findById(req.params.id)
      .select('name rating completedJobs skills kyc.status penalties createdAt')
      .lean();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({
      worker: {
        _id:           worker._id,
        name:          worker.name,
        rating:        worker.rating,
        completedJobs: worker.completedJobs,
        skills:        worker.skills || [],
        verified:      worker.kyc?.status === 'approved',
        memberSince:   worker.createdAt,
        acceptRate:    worker.penalties?.totalOffers > 0
          ? Math.round(((worker.penalties.totalOffers - (worker.penalties.totalRejects || 0)) / worker.penalties.totalOffers) * 100)
          : null,
      },
    });
  } catch (err) { next(err); }
}

async function getLeaderboard(req, res, next) {
  try {
    const Order = require('../order/order.model');
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const pipeline = [
      { $match: { status: 'completed', completedAt: { $gte: since }, workerId: { $ne: null } } },
      { $group: { _id: '$workerId', weekEarnings: { $sum: '$pricing.total' }, jobs: { $sum: 1 } } },
      { $sort: { weekEarnings: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'workers',
          localField: '_id',
          foreignField: '_id',
          as: 'w',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          workerId: '$_id',
          name: '$w.name',
          weekEarnings: 1,
          jobs: 1,
        },
      },
    ];

    const results = await Order.aggregate(pipeline);
    const leaders = results.map((r, i) => ({
      rank:        i + 1,
      workerId:    String(r.workerId),
      name:        r.name ? `${r.name.charAt(0)}*** ${r.name.split(' ').pop()?.charAt(0) || ''}.` : 'Worker',
      weekEarnings: Math.round(r.weekEarnings),
      jobs:        r.jobs,
    }));

    // If caller is authenticated worker, find their rank
    let myRank = null;
    if (req.auth?.role === 'worker') {
      const allResults = await Order.aggregate([
        { $match: { status: 'completed', completedAt: { $gte: since }, workerId: { $ne: null } } },
        { $group: { _id: '$workerId', weekEarnings: { $sum: '$pricing.total' } } },
        { $sort: { weekEarnings: -1 } },
      ]);
      const idx = allResults.findIndex((r) => String(r._id) === String(req.auth.sub));
      myRank = idx >= 0 ? { rank: idx + 1, total: allResults.length } : null;
    }

    res.json({ leaders, myRank });
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const workerId = req.auth.sub;
    const { name, skills, bio } = req.body;
    const update = {};
    if (name)   update.name   = name;
    if (skills) update.skills = skills;
    if (bio !== undefined) update.bio = bio;

    const worker = await require('./worker.model').findByIdAndUpdate(
      workerId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('name skills bio').lean();

    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // If skills changed, refresh the Redis skill sets so dispatch picks up new skills immediately
    if (skills) {
      const geoService = require('./geo.service');
      const full = await require('./worker.model').findById(workerId).lean();
      if (full?.isOnline) await geoService.markOnline(full).catch(() => {});
    }

    res.json({ worker });
  } catch (err) { next(err); }
}

module.exports = {
  getMe, goOnline, goOffline, updateLocation, getEarnings,
  getOrders, getNearbyWorkers, getDemandZones,
  getShifts, previewShift, commitShift, cancelShiftSlot,
  getWellness, claimBreakBonus,
  getNeighborhoodRep,
  getPublicProfile,
  getLeaderboard,
  updateProfile,
};
