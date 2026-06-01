/**
 * Voice Tip Service
 * ---------------------------------------------------------------------------
 * Customer records a 10-second voice note + chooses a tip amount.
 * Worker gets: wallet credit + push notification with the voice note attached.
 * No competitor anywhere has this. It's human, emotional, and viral.
 * ---------------------------------------------------------------------------
 */

const Tip     = require('./tip.model');
const Order   = require('./order.model');
const { redis } = require('../../config/redis');
const logger  = require('../../utils/logger');

const TIP_PRESETS_PAISE = [2000, 5000, 10000, 20000]; // ₹20, ₹50, ₹100, ₹200

/**
 * Live boost during searching phase — updates offer price and re-broadcasts
 * to all workers who received the offer so they see the higher amount.
 */
async function liveBoost({ order, orderId, userId, amountPaise }) {
  const rupees = Math.round(amountPaise / 100);

  // Persist boost on order so dispatch reads it when broadcasting
  await Order.findByIdAndUpdate(orderId, {
    $set: { 'pricing.tipPaise': amountPaise, 'pricing.boostedTotal': (order.pricing?.total || 0) + rupees },
  });

  // Re-broadcast updated price to all workers who saw this offer
  await redis.publish('order:event', JSON.stringify({
    orderId: String(orderId),
    event:   'order.boost',
    payload: { amountPaise, rupees, newTotal: (order.pricing?.total || 0) + rupees },
  }));

  // Also publish to worker:offer channel so dispatch loop picks up the higher price
  // Workers currently holding the offer will receive an update via socket
  await redis.publish('order:boost', JSON.stringify({
    orderId:    String(orderId),
    amountPaise,
    rupees,
    newTotal:   (order.pricing?.total || 0) + rupees,
  }));

  logger.info({ orderId, amountPaise, rupees }, '[Tip] Live boost applied during search');
  return { boosted: true, rupees, newTotal: (order.pricing?.total || 0) + rupees };
}

async function sendTip({ orderId, userId, amountPaise, voiceNoteUrl, message }) {
  const order = await Order.findById(orderId).select('userId workerId status pricing').lean();
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (String(order.userId) !== String(userId)) {
    throw Object.assign(new Error('Not your order'), { status: 403 });
  }

  // Live boost during searching — update offer price & re-broadcast
  if (['created', 'searching'].includes(order.status)) {
    return liveBoost({ order, orderId, userId, amountPaise });
  }

  if (order.status !== 'completed') {
    throw Object.assign(new Error('Can only tip after service is completed'), { status: 409 });
  }
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw Object.assign(new Error('Minimum tip is ₹1'), { status: 400 });
  }

  /* Attempt to create tip (unique per order) */
  let tip;
  try {
    tip = await Tip.create({
      orderId, userId,
      workerId:    order.workerId,
      amountPaise,
      voiceNoteUrl: voiceNoteUrl || null,
      message:      message      || null,
      status:       'pending',
    });
  } catch (err) {
    if (err.code === 11000) {
      throw Object.assign(new Error('You already sent a tip for this order'), { status: 409 });
    }
    throw err;
  }

  /* Credit worker wallet */
  const walletService = require('../wallet/wallet.service');
  const Transaction   = require('../payment/transaction.model');
  try {
    await walletService.apply({
      kind:   'worker',
      id:     order.workerId,
      type:   'credit',
      amountPaise,
      reason: Transaction.REASONS.WORKER_EARNING,
      idempotencyKey: `tip:${tip._id}`,
      refs:   { orderId },
      description: `Customer tip${voiceNoteUrl ? ' + voice note' : ''}`,
    });
    await Tip.findByIdAndUpdate(tip._id, { $set: { status: 'credited' } });
  } catch (err) {
    await Tip.findByIdAndUpdate(tip._id, { $set: { status: 'failed' } });
    throw err;
  }

  /* Push notification to worker with voice note CTA */
  const notifService = require('../notification/notification.service');
  const rupees = Math.round(amountPaise / 100);
  await notifService.notify({
    recipient: { kind: 'worker', id: order.workerId },
    type:  'wallet_credited',
    title: `💝 ₹${rupees} tip received!`,
    body:  voiceNoteUrl
      ? `A customer sent you ₹${rupees} + a voice thank-you. Tap to listen.`
      : `A customer tipped you ₹${rupees}! ${message || ''}`,
    deepLink: `/orders/${orderId}`,
    data: { orderId: String(orderId), tipId: String(tip._id), hasVoice: !!voiceNoteUrl },
  }).catch(() => {});

  /* Socket event so worker app can react immediately */
  await redis.publish('order:event', JSON.stringify({
    orderId: String(orderId),
    event:   'tip.received',
    payload: {
      amountPaise,
      rupees,
      hasVoice:     !!voiceNoteUrl,
      voiceNoteUrl: voiceNoteUrl || null,
      message:      message || null,
    },
  }));

  logger.info({ orderId, workerId: order.workerId, amountPaise }, '[Tip] Tip credited');
  return { tip, rupees };
}

async function getTip(orderId) {
  return Tip.findOne({ orderId }).lean();
}

module.exports = { sendTip, getTip, TIP_PRESETS_PAISE };
