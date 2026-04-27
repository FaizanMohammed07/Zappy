/**
 * Cancellation Service
 * --------------------------------------------------------------------------
 * All penalty amounts and time windows come from CancellationConfig (DB),
 * cached in Redis for 60 s so every request gets fresh values after an admin
 * update without hammering Mongo.
 *
 * Fee/penalty calculators are pure functions — they return amounts only;
 * callers own the wallet debits and state transitions.
 * --------------------------------------------------------------------------
 */

const CancellationConfig = require('./cancellation-config.model');
const { redis } = require('../../config/redis');

const CACHE_KEY = 'config:cancellation:active';
const CACHE_TTL = 60;

const DEFAULTS = {
  freeCancelWindowSec: 60,
  userCancelFeePaise: 1000,
  workerCancelPenaltyPaise: 2000,
  workerNoShowPenaltyPaise: 5000,
  lateWorkerCancelMultiplier: 2,
  workerRejectLimit: 5,
  workerCancelLimit: 3,
  workerCancelWindowSec: 86400,
  rejectRatePenaltyWeight: 3.0,
  cancelRatePenaltyWeight: 5.0,
};

async function getConfig() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fallthrough */ }
  }
  const doc = await CancellationConfig.findOne({ isActive: true }).lean();
  const cfg = doc ? { ...DEFAULTS, ...doc } : DEFAULTS;
  await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(cfg));
  return cfg;
}

async function bustCache() {
  await redis.del(CACHE_KEY);
}

/**
 * Create a new active config, versioning the old one out.
 * @param {object} patch
 * @param {string} adminId
 */
async function updateConfig(patch, adminId) {
  const current = await CancellationConfig.findOne({ isActive: true });
  if (current) {
    current.isActive = false;
    await current.save();
  }
  const next = await CancellationConfig.create({
    ...DEFAULTS,
    ...(current ? current.toObject() : {}),
    ...patch,
    version: (current?.version || 0) + 1,
    isActive: true,
    updatedBy: adminId,
  });
  await bustCache();
  return next;
}

// ─── User cancellation fee ────────────────────────────────────────────────

/**
 * Returns { feePaise, reason }.
 * All fee logic driven by config; no hardcoded values here.
 */
async function calculateUserCancelFee(order) {
  const cfg = await getConfig();
  const ageSec = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
  const workerActive = ['assigned', 'on_the_way', 'arrived'].includes(order.status);

  // Free: within grace window AND no worker yet active
  if (!workerActive && ageSec <= cfg.freeCancelWindowSec) {
    return { feePaise: 0, reason: 'within_grace_period' };
  }
  // Free: still searching, within window
  if (order.status === 'searching' && ageSec <= cfg.freeCancelWindowSec) {
    return { feePaise: 0, reason: 'within_grace_period' };
  }

  return {
    feePaise: cfg.userCancelFeePaise,
    reason: workerActive ? 'worker_already_assigned' : 'past_grace_period',
  };
}

// ─── Worker cancellation penalty ─────────────────────────────────────────

/**
 * Worker penalty depends on how far through the order they were when they bailed.
 *   assigned          → base penalty
 *   on_the_way/arrived → base × lateWorkerCancelMultiplier (default ×2)
 */
async function calculateWorkerCancelPenalty(order) {
  const cfg = await getConfig();
  const isLate = ['on_the_way', 'arrived'].includes(order.status);
  const penaltyPaise = isLate
    ? Math.round(cfg.workerCancelPenaltyPaise * cfg.lateWorkerCancelMultiplier)
    : cfg.workerCancelPenaltyPaise;
  return {
    penaltyPaise,
    reason: isLate ? 'worker_cancelled_late' : 'worker_cancelled_assigned',
    isLate,
  };
}

/**
 * No-show penalty (applied via dispute resolution).
 */
async function calculateNoShowPenalty() {
  const cfg = await getConfig();
  return cfg.workerNoShowPenaltyPaise;
}

module.exports = {
  getConfig,
  updateConfig,
  bustCache,
  calculateUserCancelFee,
  calculateWorkerCancelPenalty,
  calculateNoShowPenalty,
  DEFAULTS,
};
