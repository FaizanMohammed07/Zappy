/**
 * Payout Service
 * ----------------------------------------------------------------------------
 * Worker withdrawal lifecycle with proper money-reservation semantics.
 *
 * State machine:
 *   requested → (admin approve)  → approved → processing → paid   [success]
 *                                                       → failed  [retry possible]
 *             → (admin reject)   → rejected
 *
 * Wallet interaction:
 *   1. On APPROVE we DEBIT the wallet immediately (reserves the money).
 *      Idempotency key: `payout:debit:<payoutId>`.
 *   2. If Razorpay Payouts API succeeds, status → paid. Wallet stays debited.
 *   3. If Razorpay fails, we CREDIT the wallet back (reversal row) and mark
 *      the payout failed. Idempotency key: `payout:reversal:<payoutId>`.
 *
 * Why debit on approve (not on request)? Two reasons:
 *   - A worker shouldn't be able to request 3 payouts of their full balance
 *     and have all 3 processed.
 *   - Reservation semantics match how banks and wallets work in the real world.
 *
 * Minimum payout: ₹50 (to keep Razorpay fees sane)
 * Maximum single payout: ₹25,000 (anti-fraud; larger amounts need multiple requests)
 * ----------------------------------------------------------------------------
 */

const Payout = require('./payout.model');
const Transaction = require('../payment/transaction.model');
const walletService = require('../wallet/wallet.service');
const notificationService = require('../notification/notification.service');
const razorpay = require('../payment/razorpay.client');
const logger = require('../../utils/logger');
const config = require('../../config');

const MIN_PAYOUT_PAISE = 5000;     // ₹50
const MAX_PAYOUT_PAISE = 2500000;  // ₹25,000

/**
 * Worker requests a withdrawal.
 *
 * @param {object} p
 * @param {ObjectId} p.workerId
 * @param {number}   p.amountPaise
 * @param {object}   p.destination  { method, upiId?, bankAccount?, bankIfsc?, accountName? }
 */
async function requestPayout({ workerId, amountPaise, destination }) {
  if (!Number.isInteger(amountPaise) || amountPaise < MIN_PAYOUT_PAISE) {
    throw Object.assign(new Error(`Minimum payout is ₹${MIN_PAYOUT_PAISE / 100}`), {
      status: 400, code: 'PAYOUT_TOO_SMALL',
    });
  }
  if (amountPaise > MAX_PAYOUT_PAISE) {
    throw Object.assign(new Error(`Maximum payout is ₹${MAX_PAYOUT_PAISE / 100}`), {
      status: 400, code: 'PAYOUT_TOO_LARGE',
    });
  }
  if (!destination?.method || !['upi', 'bank', 'manual'].includes(destination.method)) {
    throw Object.assign(new Error('Valid destination method required'), {
      status: 400, code: 'PAYOUT_BAD_DESTINATION',
    });
  }
  if (destination.method === 'upi' && !destination.upiId) {
    throw Object.assign(new Error('UPI ID required'), { status: 400, code: 'PAYOUT_NO_UPI' });
  }
  if (destination.method === 'bank' && (!destination.bankAccount || !destination.bankIfsc)) {
    throw Object.assign(new Error('Bank account + IFSC required'), { status: 400, code: 'PAYOUT_NO_BANK' });
  }

  // Check balance — must have at least this much available (positive balance only).
  // We don't reserve here; reservation happens on approve.
  const balance = await walletService.getBalance({ kind: 'worker', id: workerId });
  if (balance.isFrozen) {
    throw Object.assign(new Error('Wallet is frozen'), { status: 403, code: 'WALLET_FROZEN' });
  }
  if (balance.balancePaise < amountPaise) {
    throw Object.assign(
      new Error(`Insufficient balance. Available: ₹${balance.balancePaise / 100}`),
      { status: 400, code: 'PAYOUT_INSUFFICIENT', balancePaise: balance.balancePaise }
    );
  }

  // Block duplicate in-flight requests
  const existing = await Payout.findOne({
    workerId,
    status: { $in: ['requested', 'approved', 'processing'] },
  });
  if (existing) {
    throw Object.assign(
      new Error('A payout request is already in progress'),
      { status: 409, code: 'PAYOUT_IN_FLIGHT', payoutId: existing._id }
    );
  }

  const payout = await Payout.create({
    workerId,
    amountPaise,
    method: destination.method,
    destination,
    status: 'requested',
    events: [{ event: 'requested', at: new Date() }],
  });

  await notificationService.notify({
    recipient: { kind: 'worker', id: workerId },
    type: 'wallet_credited', // reuse nearest type
    title: '💸 Payout request submitted',
    body: `₹${amountPaise / 100} withdrawal is awaiting approval`,
    deepLink: '/wallet',
  }).catch(() => {});

  return payout;
}

/**
 * Admin approves the payout. DEBITS the wallet (reserves) and kicks off
 * Razorpay Payouts. On success → paid. On failure → reverses the debit.
 */
async function approvePayout({ payoutId, adminId, autoProcess = true }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw Object.assign(new Error('Payout not found'), { status: 404 });
  if (payout.status !== 'requested') {
    throw Object.assign(new Error(`Cannot approve from ${payout.status}`), { status: 409 });
  }

  // Reservation debit — idempotent
  await walletService.apply({
    kind: 'worker',
    id: payout.workerId,
    type: 'debit',
    amountPaise: payout.amountPaise,
    reason: Transaction.REASONS.WITHDRAWAL,
    idempotencyKey: `payout:debit:${payout._id}`,
    description: `Payout reservation — ${payout.method}`,
    metadata: { payoutId: String(payout._id) },
  });

  payout.status = 'approved';
  payout.approvedBy = adminId;
  payout.approvedAt = new Date();
  payout.events.push({ event: 'approved', at: new Date(), meta: { adminId } });
  await payout.save();

  if (autoProcess) {
    await processPayout({ payoutId: payout._id });
    return Payout.findById(payoutId);
  }
  return payout;
}

/**
 * Razorpay Payouts execution. Called by approve() when autoProcess=true,
 * or by the admin manually.
 *
 * If config.razorpay.keyId isn't set (dev), we mock the success path so the
 * rest of the system can be tested. In production this calls the real API.
 */
async function processPayout({ payoutId }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw Object.assign(new Error('Payout not found'), { status: 404 });
  if (payout.status !== 'approved') {
    throw Object.assign(new Error(`Cannot process from ${payout.status}`), { status: 409 });
  }

  payout.status = 'processing';
  payout.events.push({ event: 'processing_started', at: new Date() });
  await payout.save();

  try {
    let rzpPayoutId;
    if (config.razorpay.keyId && payout.method !== 'manual' && razorpay.createPayout) {
      const resp = await razorpay.createPayout({
        amountPaise: payout.amountPaise,
        destination: payout.destination,
        referenceId: `payout_${payout._id}`,
      });
      rzpPayoutId = resp.id;
    } else {
      // Manual / dev mock
      rzpPayoutId = `manual_${Date.now()}`;
    }

    payout.razorpayPayoutId = rzpPayoutId;
    payout.status = 'paid';
    payout.processedAt = new Date();
    payout.events.push({ event: 'paid', at: new Date(), meta: { rzpPayoutId } });
    await payout.save();

    await notificationService.notify({
      recipient: { kind: 'worker', id: payout.workerId },
      type: 'wallet_credited',
      title: '✅ Payout sent',
      body: `₹${payout.amountPaise / 100} has been transferred to your ${payout.method.toUpperCase()}`,
      deepLink: '/wallet',
    }).catch(() => {});

    return payout;
  } catch (err) {
    logger.error({ err: err.message, payoutId: String(payout._id) }, 'Payout processing failed');
    await reversePayout({ payout, reason: err.message || 'processing_failed' });
    throw err;
  }
}

/**
 * Reverse a failed payout — credit the wallet back, mark payout `failed`.
 * Idempotent on `payout:reversal:<payoutId>`.
 */
async function reversePayout({ payout, reason }) {
  await walletService.apply({
    kind: 'worker',
    id: payout.workerId,
    type: 'credit',
    amountPaise: payout.amountPaise,
    reason: Transaction.REASONS.ADMIN_ADJUSTMENT_CREDIT,
    idempotencyKey: `payout:reversal:${payout._id}`,
    description: `Payout reversed — ${reason}`,
    metadata: { payoutId: String(payout._id) },
  });

  payout.status = 'failed';
  payout.failureReason = reason;
  payout.events.push({ event: 'failed', at: new Date(), meta: { reason } });
  await payout.save();

  await notificationService.notify({
    recipient: { kind: 'worker', id: payout.workerId },
    type: 'wallet_credited',
    title: '⚠️ Payout failed',
    body: `Your ₹${payout.amountPaise / 100} has been returned to your wallet. Reason: ${reason}`,
    deepLink: '/wallet',
  }).catch(() => {});

  return payout;
}

async function rejectPayout({ payoutId, adminId, reason }) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw Object.assign(new Error('Payout not found'), { status: 404 });
  if (payout.status !== 'requested') {
    throw Object.assign(new Error(`Cannot reject from ${payout.status}`), { status: 409 });
  }
  payout.status = 'rejected';
  payout.rejectedBy = adminId;
  payout.rejectedAt = new Date();
  payout.rejectionReason = reason;
  payout.events.push({ event: 'rejected', at: new Date(), meta: { adminId, reason } });
  await payout.save();

  await notificationService.notify({
    recipient: { kind: 'worker', id: payout.workerId },
    type: 'wallet_credited',
    title: '❌ Payout rejected',
    body: reason || 'Your payout request was declined. Contact support for details.',
    deepLink: '/wallet',
  }).catch(() => {});

  return payout;
}

async function listForWorker(workerId, { page = 1, limit = 20 } = {}) {
  const [items, total] = await Promise.all([
    Payout.find({ workerId }).sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    Payout.countDocuments({ workerId }),
  ]);
  return { items, total, page };
}

module.exports = {
  requestPayout,
  approvePayout,
  processPayout,
  rejectPayout,
  reversePayout,
  listForWorker,
  MIN_PAYOUT_PAISE,
  MAX_PAYOUT_PAISE,
};
