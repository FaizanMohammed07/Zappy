/**
 * Pricing Service
 * ----------------------------------------------------------------------------
 * price = (base + distance*perKm + time*perMin + platformFee) * surge
 *
 * Config sources (precedence):
 *   1. Redis cache `config:pricing:active` (5s in-process cache too)
 *   2. PricingConfig collection (the active one)
 *   3. Env-based defaults
 *
 * Premium effects (only applied when computing for a specific user):
 *   - waivePlatformFee → platformFee = 0
 *   - surgeCap         → cap surge multiplier at the user's tier
 *
 * All money is computed in PAISE internally (integer math). Returned both
 * in paise and rupees for the frontend's convenience.
 * ----------------------------------------------------------------------------
 */

const config = require('../../config');
const { redis } = require('../../config/redis');
const { getDistanceAndEta } = require('../worker/maps.service');
const subscriptionService = require('../subscription/subscription.service');
const PricingConfig = require('./pricing-config.model');
const logger = require('../../utils/logger');

const CACHE_KEY = 'config:pricing:active';
const CACHE_TTL_REDIS = 60;
const CACHE_TTL_LOCAL_MS = 5000;

let _localCache = { data: null, at: 0 };

async function getActiveConfig() {
  const now = Date.now();
  if (_localCache.data && now - _localCache.at < CACHE_TTL_LOCAL_MS) return _localCache.data;

  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      _localCache = { data: parsed, at: now };
      return parsed;
    } catch { /* ignore */ }
  }

  const fromDb = await PricingConfig.findOne({ isActive: true }).lean();
  const view = fromDb ? toView(fromDb) : envFallback();

  await redis.setex(CACHE_KEY, CACHE_TTL_REDIS, JSON.stringify(view));
  _localCache = { data: view, at: now };
  return view;
}

function toView(doc) {
  return {
    baseFeePaise: doc.baseFeePaise,
    perKmFeePaise: doc.perKmFeePaise,
    perMinFeePaise: doc.perMinFeePaise,
    platformFeePaise: doc.platformFeePaise,
    minFarePaise: doc.minFarePaise,
    surgeEnabled: doc.surgeEnabled,
    surgeMaxCap: doc.surgeMaxCap,
    commissionRate: doc.commissionRate,
    serviceOverrides: doc.serviceOverrides || [],
  };
}

function envFallback() {
  return {
    baseFeePaise: config.pricing.baseFee * 100,
    perKmFeePaise: config.pricing.perKmFee * 100,
    perMinFeePaise: config.pricing.perMinFee * 100,
    platformFeePaise: config.pricing.platformFee * 100,
    minFarePaise: config.pricing.minFare * 100,
    surgeEnabled: true,
    surgeMaxCap: 2.5,
    commissionRate: 0.30,
    serviceOverrides: [
      { service: 'helper', multiplier: 0.9 },
      { service: 'plumbing', multiplier: 1.2 },
      { service: 'electrical', multiplier: 1.2 },
      { service: 'carpenter', multiplier: 1.3 },
      { service: 'ac_repair', multiplier: 1.5 },
      { service: 'cleaning', multiplier: 1.0 },
      { service: 'painting', multiplier: 1.4 },
    ],
  };
}

async function bustCache() {
  await redis.del(CACHE_KEY);
  _localCache = { data: null, at: 0 };
}

// --- Surge ---

function geoBucket(lat, lng) {
  return `${lat.toFixed(2)}:${lng.toFixed(2)}`;
}

async function computeSurge(lat, lng, cfg) {
  if (!cfg.surgeEnabled) return 1.0;
  const bucket = geoBucket(lat, lng);
  const [demand, supply] = await Promise.all([
    redis.get(`demand:${bucket}`).then((v) => Number(v) || 0),
    redis.scard(`supply:${bucket}`).then((v) => Number(v) || 0),
  ]);

  let surge;
  if (supply === 0 && demand > 0) surge = 2.0;
  else if (supply === 0) surge = 1.0;
  else {
    const ratio = demand / supply;
    if (ratio < 1) surge = 1.0;
    else if (ratio < 2) surge = 1.2;
    else if (ratio < 3) surge = 1.5;
    else if (ratio < 5) surge = 1.8;
    else surge = 2.5;
  }
  return Math.min(surge, cfg.surgeMaxCap);
}

async function recordDemand(lat, lng) {
  const key = `demand:${geoBucket(lat, lng)}`;
  await redis.multi().incr(key).expire(key, 300).exec();
}

async function recordSupply(workerId, lat, lng) {
  const key = `supply:${geoBucket(lat, lng)}`;
  await redis.multi().sadd(key, String(workerId)).expire(key, 120).exec();
}

// --- Quote ---

/**
 * Compute a price quote.
 *
 * @param {object} p
 * @param {{lat:number,lng:number}} p.origin
 * @param {{lat:number,lng:number}} p.dest
 * @param {string} p.service
 * @param {ObjectId} [p.userId] — when provided, premium effects are applied
 * @returns {object} priced quote (rupees + paise) suitable for client display
 */
async function calculatePrice({ origin, dest, service, userId }) {
  const cfg = await getActiveConfig();
  const { distanceKm, etaMinutes } = await getDistanceAndEta(origin, dest);

  // Premium check
  let premiumEffects = {};
  if (userId) {
    premiumEffects = await subscriptionService.getEffects({ kind: 'user', id: userId });
  }

  // Service multiplier
  const overrideRow = cfg.serviceOverrides.find((o) => o.service === service);
  const serviceMult = overrideRow?.multiplier ?? 1.0;

  // Components in paise
  const baseFeePaise = Math.round(cfg.baseFeePaise * serviceMult);
  const distanceFeePaise = Math.round(distanceKm * cfg.perKmFeePaise);
  const timeFeePaise = Math.round(etaMinutes * cfg.perMinFeePaise);
  let platformFeePaise = cfg.platformFeePaise;

  // Premium: waive platform fee
  if (premiumEffects.waivePlatformFee) platformFeePaise = 0;

  // Surge
  let surge = await computeSurge(origin.lat, origin.lng, cfg);
  // Premium: cap surge
  if (typeof premiumEffects.surgeCap === 'number') {
    surge = Math.min(surge, premiumEffects.surgeCap);
  }

  const subtotalPaise = baseFeePaise + distanceFeePaise + timeFeePaise + platformFeePaise;
  const rawTotalPaise = Math.round(subtotalPaise * surge);
  const minFarePaise = overrideRow?.minFarePaise ?? cfg.minFarePaise;
  const totalPaise = Math.max(minFarePaise, rawTotalPaise);

  return {
    // Rupee fields for backwards-compat with existing UI
    baseFee: paiseToRupees(baseFeePaise),
    distanceKm: Number(distanceKm.toFixed(2)),
    distanceFee: paiseToRupees(distanceFeePaise),
    etaMinutes,
    timeFee: paiseToRupees(timeFeePaise),
    platformFee: paiseToRupees(platformFeePaise),
    surgeMultiplier: surge,
    subtotal: paiseToRupees(subtotalPaise),
    total: paiseToRupees(totalPaise),
    currency: 'INR',
    // Paise fields (precise)
    paise: {
      baseFee: baseFeePaise,
      distanceFee: distanceFeePaise,
      timeFee: timeFeePaise,
      platformFee: platformFeePaise,
      subtotal: subtotalPaise,
      total: totalPaise,
    },
    isUserPremium: !!userId && Object.keys(premiumEffects).length > 0,
  };
}

function paiseToRupees(p) {
  return Math.round(p / 100);
}

// Back-compat: order.service still calls quote()
const quote = calculatePrice;

// --- Earnings (commission split) ---

/**
 * Calculate the platform/worker earnings split for a completed order.
 * Honors a per-worker commission delta from the WORKER_PRO subscription.
 */
async function calculateEarnings({ totalPaise, workerId }) {
  const cfg = await getActiveConfig();
  let commissionRate = cfg.commissionRate;

  if (workerId) {
    const effects = await subscriptionService.getEffects({ kind: 'worker', id: workerId });
    if (typeof effects.commissionDelta === 'number') {
      commissionRate = Math.max(0, commissionRate + effects.commissionDelta);
    }
  }

  const platformPaise = Math.round(totalPaise * commissionRate);
  const workerPaise = totalPaise - platformPaise;
  return {
    totalPaise,
    platformPaise,
    workerPaise,
    commissionRate,
  };
}

// --- Admin: update active config ---

async function updateActiveConfig(patch, adminId) {
  const current = await PricingConfig.findOne({ isActive: true });
  const newVersion = (current?.version || 0) + 1;

  // Deactivate old
  if (current) {
    current.isActive = false;
    await current.save();
  }

  // Create new active
  const merged = {
    ...(current ? toView(current) : envFallback()),
    ...patch,
  };

  const next = await PricingConfig.create({
    ...merged,
    version: newVersion,
    isActive: true,
    createdBy: adminId,
  });

  await bustCache();
  logger.info({ version: newVersion, adminId }, 'Pricing config updated');
  return next;
}

module.exports = {
  calculatePrice,
  quote, // alias
  calculateEarnings,
  computeSurge,
  recordDemand,
  recordSupply,
  getActiveConfig,
  updateActiveConfig,
  bustCache,
};
