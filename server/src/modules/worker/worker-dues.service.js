/**
 * Worker Dues Service
 * ----------------------------------------------------------------------------
 * Encapsulates the soft/hard limit logic for worker wallets. Kept separate
 * from wallet.service so the financial primitive stays generic and the
 * marketplace policy lives here.
 *
 * Limits (paise):
 *   SOFT_LIMIT = -20000  (-₹200)   → warning banner, still works
 *   HARD_LIMIT = -50000  (-₹500)   → blocked from new jobs until dues cleared
 *
 * The hard-limit check runs in three places:
 *   1. geo.service.findCandidates — filter at matching time (most important)
 *   2. worker.service.goOnline    — refuse to flip online
 *   3. dispatch.worker            — second-line defense if someone slipped through
 * ----------------------------------------------------------------------------
 */

const Wallet = require('../wallet/wallet.model');

const SOFT_LIMIT_PAISE = -20000; // -₹200
const HARD_LIMIT_PAISE = -50000; // -₹500

async function getDuesStatus(workerId) {
  const wallet = await Wallet.findOne({
    'owner.kind': 'worker',
    'owner.id': workerId,
  }).lean();
  const balancePaise = wallet?.balancePaise ?? 0;

  const status = balancePaise <= HARD_LIMIT_PAISE
    ? 'blocked'
    : balancePaise <= SOFT_LIMIT_PAISE
      ? 'warning'
      : balancePaise < 0
        ? 'in_debt'
        : 'clear';

  return {
    balancePaise,
    status,
    isBlocked: status === 'blocked',
    needsTopup: status === 'warning' || status === 'blocked',
    duesPaise: balancePaise < 0 ? Math.abs(balancePaise) : 0,
    softLimitPaise: SOFT_LIMIT_PAISE,
    hardLimitPaise: HARD_LIMIT_PAISE,
  };
}

/**
 * Throws if the worker is blocked. Use this wherever a worker is about to
 * receive new work (goOnline, dispatch offer).
 */
async function assertCanWork(workerId) {
  const dues = await getDuesStatus(workerId);
  if (dues.isBlocked) {
    throw Object.assign(
      new Error(`Wallet is at ₹${dues.balancePaise / 100}. Add ₹${dues.duesPaise / 100} to continue working.`),
      { status: 402, code: 'WALLET_BLOCKED', dues }
    );
  }
  return dues;
}

/**
 * Bulk-filter a list of worker IDs down to those below the hard limit.
 * Used by the matcher to exclude blocked workers from candidate pools.
 * Returns Set of STRING ids that are OK (above the hard limit).
 */
async function filterWorkingWorkers(workerIds) {
  if (!workerIds?.length) return new Set();
  const wallets = await Wallet.find(
    { 'owner.kind': 'worker', 'owner.id': { $in: workerIds } },
    { 'owner.id': 1, balancePaise: 1 }
  ).lean();
  // Workers with NO wallet row default to balance 0 → clear
  const blockedIds = new Set(
    wallets
      .filter((w) => w.balancePaise <= HARD_LIMIT_PAISE)
      .map((w) => String(w.owner.id))
  );
  return new Set(workerIds.map(String).filter((id) => !blockedIds.has(id)));
}

module.exports = {
  getDuesStatus,
  assertCanWork,
  filterWorkingWorkers,
  SOFT_LIMIT_PAISE,
  HARD_LIMIT_PAISE,
};
