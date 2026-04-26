/**
 * Cancellation policy.
 *
 * Rules:
 *   - User can cancel free of charge within FREE_CANCEL_WINDOW_SEC of order creation
 *   - After that, OR if a worker is already on the way:
 *       fee = 30% of order subtotal, minimum ₹20, capped at ₹100
 *   - Fee is debited from user wallet if they have balance, else added as
 *     a "pending charge" they must clear before booking again
 *   - Worker marked the order completed but the user disputes "no show":
 *       worker pays a no-show penalty (30% of order value) on dispute resolution
 */

const FREE_CANCEL_WINDOW_SEC = 60;
const FEE_PERCENT = 0.30;
const MIN_FEE_PAISE = 2000;   // ₹20
const MAX_FEE_PAISE = 10000;  // ₹100

/**
 * Returns { feePaise, reason } or { feePaise: 0 } if cancellation is free.
 * Does NOT mutate anything — purely a calculator.
 */
function calculateCancellationFee(order) {
  const ageSec = (Date.now() - new Date(order.createdAt).getTime()) / 1000;

  // Always free during the grace window if no worker has been assigned
  const workerActive = ['assigned', 'on_the_way'].includes(order.status);
  if (!workerActive && ageSec < FREE_CANCEL_WINDOW_SEC) {
    return { feePaise: 0, reason: 'within_grace_period' };
  }

  // Free if still searching but user changed mind very quickly
  if (order.status === 'searching' && ageSec < FREE_CANCEL_WINDOW_SEC) {
    return { feePaise: 0, reason: 'within_grace_period' };
  }

  // Otherwise fee applies
  const totalPaise = order.pricing.total * 100;
  let fee = Math.round(totalPaise * FEE_PERCENT);
  fee = Math.min(MAX_FEE_PAISE, Math.max(MIN_FEE_PAISE, fee));
  return {
    feePaise: fee,
    reason: workerActive ? 'worker_already_assigned' : 'past_grace_period',
  };
}

/**
 * Worker no-show penalty — applied via dispute resolution.
 */
function calculateNoShowPenalty(order) {
  const totalPaise = order.pricing.total * 100;
  return Math.round(totalPaise * 0.30);
}

module.exports = {
  calculateCancellationFee,
  calculateNoShowPenalty,
  FREE_CANCEL_WINDOW_SEC,
};
