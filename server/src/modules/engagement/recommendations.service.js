/**
 * Smart Recommendation Engine
 *
 * For users:
 *   1. Personal: services ranked by order frequency in last 90 days
 *   2. Trending: platform-wide most-booked services in last 7 days
 *   3. New-user fallback: top-3 most popular platform-wide
 *
 * For workers:
 *   1. Best earning zones (demand zones with highest avg order value)
 *   2. Recommended shift hours (peak booking hours)
 */

const Order = require('../order/order.model');
const { redis } = require('../../config/redis');

const ALL_SERVICES = ['electrical', 'plumbing', 'ac_repair', 'carpenter', 'helper', 'puncture', 'cleaning', 'painting'];

const TRENDING_KEY       = 'recommendations:trending';
const TRENDING_TTL       = 3600;   // 1 hour — platform-wide, changes slowly
const USER_REC_TTL       = 300;    // 5 min — personal history
const WORKER_REC_KEY     = 'recommendations:worker_global';
const WORKER_REC_TTL     = 3600;   // 1 hour — platform averages

async function getUserRecommendations(userId) {
  const cacheKey = `recommendations:user:${userId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* fall through to DB */ }

  // Personal history — top services in last 90 days
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const history = await Order.aggregate([
    { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(String(userId)), createdAt: { $gte: since }, status: { $in: ['completed', 'cancelled'] } } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const personalServices = history.map((h) => h._id);

  // Trending platform-wide (already cached at 1h)
  const trending = await getTrending();

  const ranked = [];
  const seen = new Set();
  const add = (service, reason) => {
    if (!seen.has(service)) { ranked.push({ service, reason }); seen.add(service); }
  };

  for (const s of personalServices.slice(0, 3)) add(s, 'Your favourite');
  for (const s of trending.slice(0, 4)) add(s, 'Trending nearby');
  for (const s of ALL_SERVICES) add(s, 'Popular service');

  const result = ranked.slice(0, 6);
  try { await redis.setex(cacheKey, USER_REC_TTL, JSON.stringify(result)); } catch { /* non-fatal */ }
  return result;
}

async function getTrending() {
  try {
    const cached = await redis.get(TRENDING_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* fall through */ }

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);
  const result = agg.map((a) => a._id);
  try { await redis.setex(TRENDING_KEY, TRENDING_TTL, JSON.stringify(result)); } catch { /* non-fatal */ }
  return result;
}

async function getWorkerRecommendations() {
  try {
    const cached = await redis.get(WORKER_REC_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* fall through */ }

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  // Both aggregations run in parallel — platform-wide averages, same for all workers
  const [hourAgg, serviceAgg] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: 'completed' } },
      { $group: { _id: '$service', avgTotal: { $avg: '$pricing.total' }, count: { $sum: 1 } } },
      { $sort: { avgTotal: -1 } },
      { $limit: 4 },
    ]),
  ]);

  const peakHours = hourAgg.map((h) => {
    const hr = h._id;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    return { hour: hr, label: `${hr % 12 || 12}${ampm}`, orders: h.count };
  }).sort((a, b) => a.hour - b.hour);

  const topServices = serviceAgg.map((s) => ({
    service: s._id,
    avgEarnings: Math.round((s.avgTotal || 0) * 0.7),
    orders: s.count,
  }));

  const result = { peakHours, topServices };
  try { await redis.setex(WORKER_REC_KEY, WORKER_REC_TTL, JSON.stringify(result)); } catch { /* non-fatal */ }
  return result;
}

module.exports = { getUserRecommendations, getTrending, getWorkerRecommendations };
