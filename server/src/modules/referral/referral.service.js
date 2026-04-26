/**
 * Referral Service
 * ----------------------------------------------------------------------------
 * Two-sided rewards:
 *   - Referee: small bonus credited to wallet on signup (e.g. ₹50)
 *   - Referrer: larger bonus credited when referee completes their first order
 *               (e.g. ₹100) — this prevents farming via fake signups
 *
 * Code generation: 6-char alphanumeric, retried on collision (extremely rare).
 * Idempotency: ReferralUse uniqueness on referee_id ensures one referee can't
 * have multiple referrers; wallet credits use deterministic idempotency keys.
 */

const crypto = require('crypto');
const { ReferralCode, ReferralUse } = require('./referral.model');
const walletService = require('../wallet/wallet.service');
const Transaction = require('../payment/transaction.model');
const notificationService = require('../notification/notification.service');
const logger = require('../../utils/logger');

const REFEREE_BONUS_PAISE = 5000;    // ₹50 — instant on signup
const REFERRER_REWARD_PAISE = 10000; // ₹100 — on referee's first completed order

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 (look-alikes)

function generateCode(prefix = 'QFX', length = 6) {
  const chars = Array.from({ length }, () =>
    ALPHABET[crypto.randomInt(0, ALPHABET.length)]
  ).join('');
  return `${prefix}${chars}`;
}

/**
 * Get or create a referral code for an owner. Idempotent.
 */
async function getOrCreateCode({ kind, id }) {
  let existing = await ReferralCode.findOne({ 'owner.kind': kind, 'owner.id': id });
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      return await ReferralCode.create({ code, owner: { kind, id } });
    } catch (err) {
      if (err.code === 11000) continue; // collision, retry
      throw err;
    }
  }
  throw new Error('Could not generate unique referral code after 5 attempts');
}

/**
 * Apply a referral code at signup. Credits the referee instantly.
 *
 * @param {object} p
 * @param {string} p.code            The code the referee entered
 * @param {object} p.referee         { kind, id }
 * @param {string} [p.refereeIp]     For anti-abuse
 * @param {string} [p.refereeDeviceId]
 */
async function applyAtSignup({ code, referee, refereeIp, refereeDeviceId }) {
  const codeDoc = await ReferralCode.findOne({ code: code.toUpperCase(), isActive: true });
  if (!codeDoc) {
    throw Object.assign(new Error('Invalid referral code'), { status: 400, code: 'REFERRAL_INVALID' });
  }
  // No self-referrals
  if (
    String(codeDoc.owner.id) === String(referee.id) &&
    codeDoc.owner.kind === referee.kind
  ) {
    throw Object.assign(new Error('Cannot refer yourself'), { status: 400, code: 'REFERRAL_SELF' });
  }

  // Anti-abuse: same IP/device referring multiple accounts
  if (refereeIp || refereeDeviceId) {
    const recent = await ReferralUse.findOne({
      $or: [
        ...(refereeIp ? [{ refereeIp }] : []),
        ...(refereeDeviceId ? [{ refereeDeviceId }] : []),
      ],
      createdAt: { $gte: new Date(Date.now() - 30 * 86400 * 1000) },
    });
    if (recent) {
      logger.warn({ refereeIp, refereeDeviceId }, 'Referral abuse suspected — denying');
      throw Object.assign(new Error('Referral cannot be applied'), { status: 400, code: 'REFERRAL_DUPLICATE' });
    }
  }

  let use;
  try {
    use = await ReferralUse.create({
      code: codeDoc.code,
      referrer: codeDoc.owner,
      referee,
      status: 'signup',
      refereeSignupBonusPaise: REFEREE_BONUS_PAISE,
      refereeIp,
      refereeDeviceId,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw Object.assign(new Error('Referral already applied to this account'), {
        status: 409, code: 'REFERRAL_ALREADY_USED',
      });
    }
    throw err;
  }

  // Credit referee instantly
  await walletService.apply({
    kind: referee.kind,
    id: referee.id,
    type: 'credit',
    amountPaise: REFEREE_BONUS_PAISE,
    reason: Transaction.REASONS.REFERRAL_REWARD,
    idempotencyKey: `referral:referee:${use._id}`,
    description: `Welcome bonus — referred by ${codeDoc.code}`,
  });

  use.refereeBonusGivenAt = new Date();
  await use.save();

  await ReferralCode.updateOne({ _id: codeDoc._id }, { $inc: { totalUses: 1 } });

  await notificationService.notify({
    recipient: referee,
    type: 'referral_reward',
    title: '🎁 Welcome bonus credited!',
    body: `₹${REFEREE_BONUS_PAISE / 100} has been added to your wallet`,
    deepLink: '/wallet',
  });

  return use;
}

/**
 * Called after a referee's FIRST completed order. Awards the referrer.
 * Idempotent — if already rewarded, returns silently.
 */
async function onRefereeFirstOrder({ refereeKind, refereeId, orderId }) {
  const use = await ReferralUse.findOne({
    'referee.kind': refereeKind,
    'referee.id': refereeId,
    status: 'signup',
  });
  if (!use) return null; // Not referred, or already rewarded

  use.status = 'rewarded';
  use.referrerRewardPaise = REFERRER_REWARD_PAISE;
  use.referrerRewardGivenAt = new Date();
  use.qualifyingOrderId = orderId;
  await use.save();

  await walletService.apply({
    kind: use.referrer.kind,
    id: use.referrer.id,
    type: 'credit',
    amountPaise: REFERRER_REWARD_PAISE,
    reason: Transaction.REASONS.REFERRAL_REWARD,
    idempotencyKey: `referral:referrer:${use._id}`,
    description: 'Referral reward — your friend just completed their first order!',
    refs: { orderId },
  });

  await ReferralCode.updateOne(
    { code: use.code },
    { $inc: { totalRewardsPaise: REFERRER_REWARD_PAISE } }
  );

  await notificationService.notify({
    recipient: use.referrer,
    type: 'referral_reward',
    title: `🎉 You earned ₹${REFERRER_REWARD_PAISE / 100}!`,
    body: 'A friend you invited just completed their first order',
    deepLink: '/wallet',
  });

  return use;
}

module.exports = {
  getOrCreateCode,
  applyAtSignup,
  onRefereeFirstOrder,
  REFEREE_BONUS_PAISE,
  REFERRER_REWARD_PAISE,
};
