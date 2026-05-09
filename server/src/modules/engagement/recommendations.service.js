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
const TRENDING_KEY = 'recommendations:trending';
const TRENDING_TTL = 3600; // 1 hour

async function getUserRecommendations(userId) {
  // Personal history — top services in last 90 days
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const history = await Order.aggregate([
    { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(String(userId)), createdAt: { $gte: since }, status: { $in: ['completed', 'cancelled'] } } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const personalServices = history.map((h) => h._id);

  // Trending platform-wide
  const trending = await getTrending();

  // Build ranked list: personal first, then trending, then fill from all
  const ranked = [];
  const seen = new Set();
  const add = (service, reason) => {
    if (!seen.has(service)) { ranked.push({ service, reason }); seen.add(service); }
  };

  for (const s of personalServices.slice(0, 3)) add(s, 'Your favourite');
  for (const s of trending.slice(0, 4)) add(s, 'Trending nearby');
  for (const s of ALL_SERVICES) add(s, 'Popular service');

  return ranked.slice(0, 6);
}

async function getTrending() {
  const cached = await redis.get(TRENDING_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const agg = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
  ]);
  const result = agg.map((a) => a._id);
  await redis.setex(TRENDING_KEY, TRENDING_TTL, JSON.stringify(result));
  return result;
}

async function getWorkerRecommendations(workerId) {
  // Peak booking hours in the last 7 days
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const hourAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
  ]);
  const peakHours = hourAgg.map((h) => {
    const hr = h._id;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const display = `${hr % 12 || 12}${ampm}`;
    return { hour: hr, label: display, orders: h.count };
  }).sort((a, b) => a.hour - b.hour);

  // Top earning services for worker (based on platform avg)
  const serviceAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, status: 'completed' } },
    { $group: { _id: '$service', avgTotal: { $avg: '$pricing.total' }, count: { $sum: 1 } } },
    { $sort: { avgTotal: -1 } },
    { $limit: 4 },
  ]);
  const topServices = serviceAgg.map((s) => ({
    service: s._id,
    avgEarnings: Math.round((s.avgTotal || 0) * 0.7),
    orders: s.count,
  }));

  return { peakHours, topServices };
}

module.exports = { getUserRecommendations, getTrending, getWorkerRecommendations };
