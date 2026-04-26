const { redis } = require('../../config/redis');
const Worker = require('./worker.model');
const config = require('../../config');
const logger = require('../../utils/logger');

const ONLINE_GEO_KEY = 'workers:online'; // Redis GEO set
const AVAIL_HASH_KEY = 'workers:available'; // hash: workerId -> 1|0
const SKILLS_SET_PREFIX = 'workers:skill:'; // set: skill -> workerIds

/**
 * Called whenever a worker goes online or updates location.
 * Keeps Redis hot cache in sync with Mongo.
 */
async function markOnline(worker) {
  const { _id, currentLocation, skills, isAvailable } = worker;
  const [lng, lat] = currentLocation.coordinates;

  const pipe = redis.multi();
  pipe.geoadd(ONLINE_GEO_KEY, lng, lat, String(_id));
  pipe.hset(AVAIL_HASH_KEY, String(_id), isAvailable ? '1' : '0');
  for (const skill of skills) pipe.sadd(`${SKILLS_SET_PREFIX}${skill}`, String(_id));
  pipe.expire(ONLINE_GEO_KEY, 3600); // self-healing — expires if a node dies silently
  await pipe.exec();
}

async function markOffline(workerId) {
  const pipe = redis.multi();
  pipe.zrem(ONLINE_GEO_KEY, String(workerId));
  pipe.hdel(AVAIL_HASH_KEY, String(workerId));
  // skill sets self-expire through TTL on online hash; clean on next reconcile
  await pipe.exec();
}

async function updateLocation(workerId, lng, lat) {
  await redis.geoadd(ONLINE_GEO_KEY, lng, lat, String(workerId));
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
async function findCandidates({ lng, lat, skill, excludeIds = [] }) {
  const excludeSet = new Set(excludeIds.map(String));
  const radiusKm = config.dispatch.radiusKm;
  const maxCandidates = config.dispatch.maxCandidates;

  // Tier 1: Redis GEO
  const geoResult = await redis.geosearch(
    ONLINE_GEO_KEY,
    'FROMLONLAT', lng, lat,
    'BYRADIUS', radiusKm, 'km',
    'ASC',
    'COUNT', maxCandidates * 3,
    'WITHCOORD', 'WITHDIST'
  );

  const nearbyIds = geoResult.map((r) => r[0]).filter((id) => !excludeSet.has(id));

  if (nearbyIds.length === 0) {
    return mongoFallback({ lng, lat, skill, excludeIds });
  }

  // Filter by availability + skill in one pipelined batch
  const availPipe = redis.pipeline();
  nearbyIds.forEach((id) => availPipe.hget(AVAIL_HASH_KEY, id));
  const skillPipe = redis.pipeline();
  nearbyIds.forEach((id) => skillPipe.sismember(`${SKILLS_SET_PREFIX}${skill}`, id));

  const [availResults, skillResults] = await Promise.all([availPipe.exec(), skillPipe.exec()]);

  const filtered = [];
  for (let i = 0; i < nearbyIds.length; i++) {
    const isAvail = availResults[i][1] === '1';
    const hasSkill = skillResults[i][1] === 1;
    if (isAvail && hasSkill) {
      const dist = parseFloat(geoResult[i][1]);
      filtered.push({ workerId: nearbyIds[i], distanceKm: dist });
    }
    if (filtered.length >= maxCandidates) break;
  }

  if (filtered.length === 0) {
    return mongoFallback({ lng, lat, skill, excludeIds });
  }

  // Rating boost — fetch ratings from Mongo (cached per request could be added).
  const ids = filtered.map((f) => f.workerId);
  const ratings = await Worker.find(
    { _id: { $in: ids }, isBlocked: false },
    { _id: 1, rating: 1, completedJobs: 1 }
  ).lean();

  // WORKER_PRO subscription effects — Pro workers get a score boost so they
  // surface higher on equal-distance ties. Reads cached subscription data,
  // so this batched lookup is cheap.
  const subscriptionService = require('../subscription/subscription.service');
  const proBoosts = await Promise.all(
    ids.map(async (id) => {
      const effects = await subscriptionService.getEffects({ kind: 'worker', id });
      return [id, Number(effects.proBoost) || 0];
    })
  );
  const boostMap = new Map(proBoosts);

  const ratingMap = new Map(ratings.map((r) => [String(r._id), r]));
  const scored = filtered
    .filter((f) => ratingMap.has(f.workerId))
    .map((f) => {
      const w = ratingMap.get(f.workerId);
      const proBoost = boostMap.get(f.workerId) || 0;
      // Score: lower is better. Distance dominates, rating tie-breaks, Pro boost
      // subtracts from score to surface the worker earlier.
      const score = f.distanceKm * 10
        - (w.rating || 0) * 0.5
        - Math.log1p(w.completedJobs) * 0.1
        - proBoost;
      return { ...f, score };
    })
    .sort((a, b) => a.score - b.score);

  // Exclude workers whose dues exceed the hard limit. This is the primary
  // dispatch-time gate — workers with -₹500+ debt never see new offers.
  const duesService = require('./worker-dues.service');
  const workingIds = await duesService.filterWorkingWorkers(scored.map((s) => s.workerId));

  return scored.map((s) => s.workerId).filter((id) => workingIds.has(String(id)));
}

async function mongoFallback({ lng, lat, skill, excludeIds }) {
  logger.info({ lng, lat, skill }, 'Falling back to Mongo $near query');
  const docs = await Worker.find({
    isOnline: true,
    isAvailable: true,
    isBlocked: false,
    skills: skill,
    _id: { $nin: excludeIds },
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: config.dispatch.radiusKm * 1000,
      },
    },
  })
    .limit(config.dispatch.maxCandidates)
    .select('_id rating')
    .lean();

  return docs.map((d) => String(d._id));
}

module.exports = {
  markOnline,
  markOffline,
  updateLocation,
  setAvailability,
  findCandidates,
};
