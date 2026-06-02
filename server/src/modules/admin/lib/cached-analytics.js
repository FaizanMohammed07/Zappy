const { redis } = require('../../../config/redis');

// Analytics responses are cached in Redis to protect against expensive
// aggregation queries being fired on every dashboard refresh.
// Metrics: 30s TTL (near-real-time for ops). Revenue: 60s TTL.
async function cachedAnalytics(key, ttlSec, computeFn) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  } catch (_) {
    /* Redis miss — fall through to compute */
  }
  const result = await computeFn();
  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttlSec);
  } catch (_) {}
  return result;
}

module.exports = cachedAnalytics;
