const { redis } = require('../../config/redis');
const Worker = require('./worker.model');
const config = require('../../config');
const logger = require('../../utils/logger');

const ONLINE_GEO_KEY    = 'workers:online';    // Redis GEO set
const AVAIL_HASH_KEY    = 'workers:available'; // hash: workerId -> 1|0
const SKILLS_SET_PREFIX = 'workers:skill:';    // set: skill -> workerIds
const ALIVE_ZSET_KEY    = 'workers:alive';     // sorted set: workerId -> last_seen_timestamp

const STALE_THRESHOLD_MS = 8 * 60 * 1000; // 8 min without ping = stale

/**
 * Called whenever a worker goes online or updates location.
 * Keeps Redis hot cache in sync with Mongo.
 */
async function markOnline(worker) {
  const { _id, currentLocation, skills, isAvailable } = worker;
  const [lng, lat] = currentLocation.coordinates;
  const now = Date.now();

  const pipe = redis.multi();
  pipe.geoadd(ONLINE_GEO_KEY, lng, lat, String(_id));
  pipe.hset(AVAIL_HASH_KEY, String(_id), isAvailable ? '1' : '0');
  pipe.zadd(ALIVE_ZSET_KEY, now, String(_id)); // heartbeat
  for (const skill of skills) pipe.sadd(`${SKILLS_SET_PREFIX}${skill}`, String(_id));
  // 10-minute TTL: workers:alive heartbeat re-registers every ~30s via location update,
  // so any worker silent for >10 min is genuinely offline. 1-hour TTL caused stale
  // phantom workers to appear in dispatch searches after ungraceful disconnects.
  pipe.expire(ONLINE_GEO_KEY, 600);
  pipe.expire(ALIVE_ZSET_KEY, 600);
  await pipe.exec();
}

async function markOffline(workerId) {
  // Fetch skills before wiping so we can remove from per-skill sets.
  // Small extra read is fine — markOffline is infrequent.
  let skills = [];
  try {
    const w = await Worker.findById(workerId).select('skills').lean();
    skills = w?.skills || [];
  } catch { /* best-effort */ }

  const pipe = redis.multi();
  pipe.zrem(ONLINE_GEO_KEY, String(workerId));
  pipe.hdel(AVAIL_HASH_KEY, String(workerId));
  pipe.zrem(ALIVE_ZSET_KEY, String(workerId));
  for (const skill of skills) pipe.srem(`${SKILLS_SET_PREFIX}${skill}`, String(workerId));
  await pipe.exec();
}

async function updateLocation(workerId, lng, lat) {
  const pipe = redis.pipeline();
  pipe.geoadd(ONLINE_GEO_KEY, lng, lat, String(workerId));
  pipe.zadd(ALIVE_ZSET_KEY, Date.now(), String(workerId)); // heartbeat
  await pipe.exec();
}

async function setAvailability(workerId, isAvailable) {
  await redis.hset(AVAIL_HASH_KEY, String(workerId), isAvailable ? '1' : '0');
}

/**
 * Find candidate workers for an order.
 * Tier 1: Redis GEO — sub-ms, returns candidates sorted by distance.
 * Tier 2: Mongo $near — fallback if Redis has no results (after cold start).
 *
 * Returns workerIds in order of preference (nearest + rating-boosted).
 */
async function findCandidates({ lng, lat, skill, excludeIds = [], radiusKm: radiusKmOverride, skipSkillFilter = false } = {}) {
  const excludeSet = new Set(excludeIds.map(String));
  const radiusKm = radiusKmOverride ?? config.dispatch.radiusKm;
  const maxCandidates = config.dispatch.maxCandidates;
  const freshnessThreshold = Date.now() - STALE_THRESHOLD_MS; // workers alive within 8 min

  // Tier 1: Redis GEO (GEOSEARCH added in Redis 6.2, fall back to GEORADIUS for older)
  let geoResult;
  try {
    geoResult = await redis.geosearch(
      ONLINE_GEO_KEY,
      'FROMLONLAT', lng, lat,
      'BYRADIUS', radiusKm, 'km',
      'ASC',
      'COUNT', maxCandidates * 3,
      'WITHCOORD', 'WITHDIST',
    );
  } catch {
    geoResult = await redis.georadius(
      ONLINE_GEO_KEY,
      lng, lat, radiusKm, 'km',
      'ASC',
      'COUNT', String(maxCandidates * 3),
      'WITHCOORD', 'WITHDIST',
    );
  }

  logger.info({ radiusKm, skill, geoHits: geoResult.length }, '[GEO] Raw geo results');

  const nearbyIds = geoResult.map((r) => r[0]).filter((id) => !excludeSet.has(id));

  if (nearbyIds.length === 0) {
    return mongoFallback({ lng, lat, skill, excludeIds, radiusKm, skipSkillFilter });
  }

  // Filter by availability + skill + freshness in one pipelined batch
  const availPipe  = redis.pipeline();
  const skillPipe  = redis.pipeline();
  const alivePipe  = redis.pipeline();
  nearbyIds.forEach((id) => {
    availPipe.hget(AVAIL_HASH_KEY, id);
    skillPipe.sismember(`${SKILLS_SET_PREFIX}${skill}`, id);
    alivePipe.zscore(ALIVE_ZSET_KEY, id);
  });

  const [availResults, skillResults, aliveResults] = await Promise.all([
    availPipe.exec(),
    skillPipe.exec(),
    alivePipe.exec(),
  ]);

  const filtered = [];
  for (let i = 0; i < nearbyIds.length; i++) {
    const isAvail    = availResults[i][1] === '1';
    const hasSkill   = skipSkillFilter || skillResults[i][1] === 1;
    const lastSeen   = Number(aliveResults[i][1] ?? 0);
    const isFresh    = lastSeen === 0 || lastSeen >= freshnessThreshold; // 0 = legacy, allow through

    if (isAvail && hasSkill && isFresh) {
      const dist = parseFloat(geoResult[i][1]);
      filtered.push({ workerId: nearbyIds[i], distanceKm: dist });
    }
    if (filtered.length >= maxCandidates) break;
  }

  logger.info({ radiusKm, skill, filtered: filtered.length }, '[GEO] After availability+skill+freshness filter');

  if (filtered.length === 0) {
    return mongoFallback({ lng, lat, skill, excludeIds, radiusKm, skipSkillFilter });
  }

  // Rating + penalty + KYC — fetch from Mongo in one query.
  const ids = filtered.map((f) => f.workerId);
  const minRating = config.dispatch.minWorkerRating ?? 3.0;

  const [ratings, cancellationCfg] = await Promise.all([
    Worker.find(
      {
        _id: { $in: ids },
        isBlocked: false,
        'kyc.status': 'approved',       // never dispatch to unverified workers
        rating: { $gte: minRating },    // skip workers below quality threshold
      },
      { _id: 1, rating: 1, completedJobs: 1, penalties: 1 }
    ).lean(),
    require('../order/cancellation.service').getConfig(),
  ]);

  // WORKER_PRO subscription effects — Pro workers get a score boost so they
  // surface higher on equal-distance ties.
  // One MGET fetches all cached boost values in a single Redis round-trip.
  // Only the cache-miss IDs issue a DB lookup (batched via Promise.all).
  const subscriptionService = require('../subscription/subscription.service');
  const cacheKeys = ids.map((id) => `geo:sub:boost:${id}`);
  let cachedBoosts;
  try { cachedBoosts = await redis.mget(...cacheKeys); } catch { cachedBoosts = ids.map(() => null); }

  const missIds = ids.filter((_, i) => cachedBoosts[i] === null);
  const missBoosts = await Promise.all(
    missIds.map(async (id) => {
      try {
        const fx = await subscriptionService.getEffects({ kind: 'worker', id });
        const boost = Number(fx.proBoost) || 0;
        await redis.set(`geo:sub:boost:${id}`, String(boost), 'EX', 60);
        return [id, boost];
      } catch { return [id, 0]; }
    })
  );
  const missMap = new Map(missBoosts);
  const boostMap = new Map(
    ids.map((id, i) => [id, cachedBoosts[i] !== null ? Number(cachedBoosts[i]) : (missMap.get(id) || 0)])
  );

  const ratingMap = new Map(ratings.map((r) => [String(r._id), r]));
  const scored = filtered
    .filter((f) => ratingMap.has(f.workerId))
    .map((f) => {
      const w = ratingMap.get(f.workerId);
      const proBoost = boostMap.get(f.workerId) || 0;

      // Penalty degradation — higher reject/cancel rates push the score up
      // (worse rank). Guards against re-dispatching chronic cancellers.
      const rejectRate = (w.penalties?.totalOffers || 0) > 0
        ? (w.penalties.totalRejects || 0) / w.penalties.totalOffers
        : 0;
      const cancelRate = (w.completedJobs || 0) > 0
        ? (w.penalties?.totalCancels || 0) / w.completedJobs
        : 0;
      const penaltyScore = rejectRate * (cancellationCfg.rejectRatePenaltyWeight || 3.0)
        + cancelRate * (cancellationCfg.cancelRatePenaltyWeight || 5.0);

      // Score: lower is better. Distance dominates, rating tie-breaks, Pro boost
      // subtracts, penalty history adds (degrades rank).
      //
      // Fairness jitter: when workers are at the same location (distanceKm < 0.05,
      // e.g. 500 workers in a warehouse or same pin), pure distance gives no
      // differentiation and the same top-N are always notified first.
      // We inject a small random perturbation (±0.05, max ~5% of a 1-star rating
      // difference) so the broadcast rotates across the equal-distance pool.
      // High-penalty workers are still reliably pushed to the back.
      const SAME_LOCATION_THRESHOLD_KM = 0.05;
      const fairnessJitter = f.distanceKm < SAME_LOCATION_THRESHOLD_KM
        ? (Math.random() - 0.5) * 0.1
        : 0;

      const score = f.distanceKm * 10
        - (w.rating || 0) * 0.5
        - Math.log1p(w.completedJobs) * 0.1
        - proBoost
        + penaltyScore
        + fairnessJitter;
      return { ...f, score };
    })
    .sort((a, b) => a.score - b.score);

  // Exclude workers whose dues exceed the hard limit. This is the primary
  // dispatch-time gate — workers with -₹500+ debt never see new offers.
  const duesService = require('./worker-dues.service');
  const workingIds = await duesService.filterWorkingWorkers(scored.map((s) => s.workerId));

  return scored.map((s) => s.workerId).filter((id) => workingIds.has(String(id)));
}

async function mongoFallback({ lng, lat, skill, excludeIds, radiusKm, skipSkillFilter = false }) {
  const effectiveRadius = radiusKm ?? config.dispatch.radiusKm;
  const minRating = config.dispatch.minWorkerRating ?? 3.0;
  logger.info({ lng, lat, skill, radiusKm: effectiveRadius, skipSkillFilter }, 'Falling back to Mongo $near query');

  const query = {
    isOnline: true,
    isAvailable: true,
    isBlocked: false,
    'kyc.status': 'approved',
    rating: { $gte: minRating },
    _id: { $nin: excludeIds },
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: effectiveRadius * 1000,
      },
    },
  };
  if (!skipSkillFilter) query.skills = skill;

  const docs = await Worker.find(query)
    .limit(config.dispatch.maxCandidates)
    .select('_id rating')
    .lean();

  return docs.map((d) => String(d._id));
}

/**
 * Returns anonymised positions of all online workers within radiusKm.
 * No worker IDs are exposed — used only for ambient map display.
 */
async function findNearbyWorkers({ lat, lng, radiusKm = 5, limit = 25 }) {
  try {
    let geoResult;
    try {
      geoResult = await redis.geosearch(
        ONLINE_GEO_KEY,
        'FROMLONLAT', lng, lat,
        'BYRADIUS', radiusKm, 'km',
        'ASC',
        'COUNT', limit,
        'WITHCOORD', 'WITHDIST',
      );
    } catch {
      geoResult = await redis.georadius(
        ONLINE_GEO_KEY,
        lng, lat, radiusKm, 'km',
        'ASC',
        'COUNT', String(limit),
        'WITHCOORD', 'WITHDIST',
      );
    }
    return geoResult.map((r) => ({
      distanceKm: parseFloat(r[1]),
      lng: parseFloat(r[2][0]),
      lat: parseFloat(r[2][1]),
    }));
  } catch {
    return [];
  }
}

module.exports = {
  markOnline,
  markOffline,
  updateLocation,
  setAvailability,
  findCandidates,
  findNearbyWorkers,
};
