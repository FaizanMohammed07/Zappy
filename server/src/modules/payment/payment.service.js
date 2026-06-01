/**
 * Payment Service
 * ----------------------------------------------------------------------------
 * The orchestrator between Razorpay and our domain.
 *
 *   1. createOrder() — called from API to start a payment for a known purpose
 *   2. handleWebhook() — called from Razorpay; routes to the right side-effect
 *      handler based on PaymentIntent.purpose
 *   3. handleCheckoutVerification() — for the in-page Razorpay Checkout flow
 *      where the frontend POSTs back the signed result; we double-confirm
 *      via the webhook regardless
 *
 * Idempotency is enforced at three layers:
 *   - PaymentIntent.razorpayPaymentId is unique
 *   - PaymentIntent.appliedAt is set in a single findOneAndUpdate guard
 *   - Wallet.apply uses idempotencyKey at the Transaction level
 *
 * Even if Razorpay sends the same webhook 5 times, we apply effects once.
 * ----------------------------------------------------------------------------
 */

const PaymentIntent = require('./payment-intent.model');
const Order = require('../order/order.model');
const Transaction = require('./transaction.model');
const razorpay = require('./razorpay.client');
const walletService = require('../wallet/wallet.service');
const subscriptionService = require('../subscription/subscription.service');
const logger = require('../../utils/logger');

/**
 * Create a Razorpay order for one of three purposes.
 * Returns { paymentIntent, razorpayOrder } — the frontend uses razorpayOrder.id
 * to launch the Razorpay Checkout widget.
 */
async function createOrderForPurpose({ owner, purpose, planCode, amountPaise, orderId }) {
  let resolvedAmount = amountPaise;
  let planId = null;
  let subscriptionId = null;
  let receiptPrefix = '';

  if (purpose === 'subscription') {
    if (!planCode) throw Object.assign(new Error('planCode required'), { status: 400, code: 'PLAN_CODE_REQUIRED' });
    const { subscription, plan } = await subscriptionService.startPurchase({
      owner, planCode,
    });
    resolvedAmount = plan.priceInPaise;
    planId = plan._id;
    subscriptionId = subscription._id;
    receiptPrefix = 'sub';
  } else if (purpose === 'wallet_topup') {
    if (!Number.isInteger(amountPaise) || amountPaise < 1000) {
      throw Object.assign(new Error('Wallet top-up minimum is ₹10'), {
        status: 400, code: 'TOPUP_MIN',
      });
    }
    receiptPrefix = 'wlt';
  } else if (purpose === 'order_payment') {
    if (!orderId) throw Object.assign(new Error('orderId required'), { status: 400, code: 'ORDER_ID_REQUIRED' });
    const order = await Order.findById(orderId).lean();
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (String(order.userId) !== String(owner.id)) {
      throw Object.assign(new Error('Not your order'), { status: 403 });
    }
    if (order.payment?.status === 'paid') {
      throw Object.assign(new Error('Order already paid'), { status: 409, code: 'ORDER_ALREADY_PAID' });
    }
    resolvedAmount = order.pricing.total * 100; // pricing.total is in rupees
    receiptPrefix = 'ord';
  } else {
    throw Object.assign(new Error('Unknown purpose'), { status: 400, code: 'BAD_PURPOSE' });
  }

  // Receipt is what shows in Razorpay dashboard — must be ≤40 chars
  const receipt = `${receiptPrefix}_${Date.now()}_${String(owner.id).slice(-6)}`.slice(0, 40);

  const rzpOrder = await razorpay.createOrder({
    amountPaise: resolvedAmount,
    currency: 'INR',
    receipt,
    notes: {
      purpose,
      ownerKind: owner.kind,
      ownerId: String(owner.id),
      ...(planCode ? { planCode } : {}),
      ...(orderId ? { orderId: String(orderId) } : {}),
    },
  });

  const intent = await PaymentIntent.create({
    razorpayOrderId: rzpOrder.id,
    owner,
    purpose,
    planId,
    subscriptionId,
    orderId,
    amountPaise: resolvedAmount,
    currency: 'INR',
    status: 'created',
  });

  return { paymentIntent: intent, razorpayOrder: rzpOrder };
}

/**
 * Handle a Razorpay webhook. The caller must have already verified the
 * signature against the raw body.
 *
 * Key events:
 *   - payment.captured  → apply side effects
 *   - payment.failed    → mark intent failed
 *   - order.paid        → also apply (sometimes arrives before payment.captured)
 *   - refund.processed  → mark intent refunded
 */
async function handleWebhook(payload) {
  const event = payload?.event;
  if (!event) return { ok: false, reason: 'missing_event' };

  switch (event) {
    case 'payment.captured':
    case 'order.paid': {
      const payment = payload.payload?.payment?.entity;
      if (!payment) return { ok: false, reason: 'no_payment_entity' };
      return capturePayment({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        eventName: event,
        rawPayload: payload,
      });
    }
    case 'payment.failed': {
      const payment = payload.payload?.payment?.entity;
      if (payment?.order_id) {
        await PaymentIntent.updateOne(
          { razorpayOrderId: payment.order_id, status: { $in: ['created', 'authorized'] } },
          {
            $set: { status: 'failed', failureReason: payment.error_description || 'failed' },
            $push: { events: { event, payload } },
          }
        );
      }
      return { ok: true, action: 'marked_failed' };
    }
    case 'refund.processed':
    case 'refund.created': {
      const refund = payload.payload?.refund?.entity;
      if (refund?.payment_id) {
        await PaymentIntent.updateOne(
          { razorpayPaymentId: refund.payment_id },
          { $set: { status: 'refunded' }, $push: { events: { event, payload } } }
        );
      }
      return { ok: true, action: 'marked_refunded' };
    }
    default:
      logger.info({ event }, 'Webhook event ignored');
      return { ok: true, action: 'ignored' };
  }
}

/**
 * Apply side-effects of a successful payment exactly once.
 *
 * The atomicity trick: we use findOneAndUpdate with `appliedAt: { $exists: false }`
 * as the guard. Only ONE of N concurrent webhook deliveries will match; the
 * rest see no document and bail out cleanly.
 */
async function capturePayment({ razorpayOrderId, razorpayPaymentId, amountPaise, eventName, rawPayload }) {
  // Atomic claim — first writer wins
  const intent = await PaymentIntent.findOneAndUpdate(
    {
      razorpayOrderId,
      appliedAt: { $exists: false },
    },
    {
      $set: {
        razorpayPaymentId,
        status: 'captured',
        appliedAt: new Date(),
      },
      $push: { events: { event: eventName, payload: rawPayload } },
    },
    { new: true }
  );

  if (!intent) {
    // Either unknown order, or already applied. Both are safe no-ops.
    logger.info({ razorpayOrderId, razorpayPaymentId }, 'Payment intent not claimable — likely already processed');
    return { ok: true, action: 'already_applied_or_unknown' };
  }

  // Sanity check: amount tampering
  if (intent.amountPaise !== amountPaise) {
    logger.error(
      { expected: intent.amountPaise, got: amountPaise, razorpayPaymentId },
      'Amount mismatch — payment captured for different amount'
    );
    return { ok: false, action: 'amount_mismatch' };
  }

  try {
    if (intent.purpose === 'subscription') {
      await subscriptionService.activateFromPayment({
        subscriptionId: intent.subscriptionId,
        paymentIntentId: intent._id,
        razorpayPaymentId,
      });
      // Platform revenue ledger row
      await Transaction.create({
        type: 'credit',
        owner: { kind: 'platform', id: null },
        amountPaise: intent.amountPaise,
        reason: Transaction.REASONS.SUBSCRIPTION_REVENUE,
        refSubscriptionId: intent.subscriptionId,
        refPaymentIntentId: intent._id,
        idempotencyKey: `platform:sub:${razorpayPaymentId}`,
        description: 'Subscription payment received',
      }).catch((e) => { if (e.code !== 11000) throw e; });
    } else if (intent.purpose === 'wallet_topup') {
      await walletService.apply({
        kind: intent.owner.kind,
        id: intent.owner.id,
        type: 'credit',
        amountPaise: intent.amountPaise,
        reason: Transaction.REASONS.WALLET_TOPUP,
        idempotencyKey: `topup:${razorpayPaymentId}`,
        refs: { paymentIntentId: intent._id },
        description: 'Wallet top-up',
      });
    } else if (intent.purpose === 'order_payment') {
      const order = await Order.findById(intent.orderId);
      if (order) {
        order.payment.status = 'paid';
        order.payment.transactionId = razorpayPaymentId;
        order.payment.paidAt = new Date();
        await order.save();
      }
    }
    return { ok: true, action: 'applied', purpose: intent.purpose };
  } catch (err) {
    // Side-effect failed after payment was captured. Money exists in Razorpay
    // but our side-effects (wallet credit, subscription activation) didn't apply.
    // Mark the PaymentIntent for admin reconciliation and alert ops. (#95/#96)
    logger.error({ err: err.message, razorpayPaymentId, purpose: intent.purpose }, '[PAYMENT] Side-effect failed — marking for reconciliation');
    await PaymentIntent.updateOne(
      { razorpayOrderId: intent.razorpayOrderId },
      {
        $set: {
          reconciliationRequired: true,
          reconciliationReason: err.message,
          reconciliationAt: new Date(),
        },
      }
    ).catch(() => {});
    // Alert admin ops room
    const { redis: r } = require('../../config/redis');
    r.publish('notification:admin:ops', JSON.stringify({
      type: 'payment_reconciliation_required',
      title: '⚠️ Payment needs reconciliation',
      body: `${purpose} · ₹${(intent.amountPaise / 100).toFixed(0)} · ${razorpayPaymentId}`,
      data: { razorpayPaymentId, razorpayOrderId: intent.razorpayOrderId, purpose: intent.purpose, err: err.message },
      urgent: true,
    })).catch(() => {});
    throw err;
  }
}

/**
 * Optional: in-page checkout verification. Razorpay returns a signature
 * the moment the user pays. We verify it and OPTIMISTICALLY apply side
 * effects — but the webhook is still the source of truth and idempotency
 * guards ensure no double-application.
 */
async function handleCheckoutVerification({ razorpayOrderId, razorpayPaymentId, signature }) {
  const ok = razorpay.verifyCheckoutSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature,
  });
  if (!ok) {
    throw Object.assign(new Error('Invalid checkout signature'), {
      status: 400, code: 'CHECKOUT_SIG_INVALID',
    });
  }
  // Fetch the payment to learn its amount, then apply.
  const payment = await razorpay.fetchPayment(razorpayPaymentId);
  if (payment.status !== 'captured' && payment.status !== 'authorized') {
    return { ok: false, status: payment.status };
  }
  return capturePayment({
    razorpayOrderId,
    razorpayPaymentId,
    amountPaise: payment.amount,
    eventName: 'manual.verify',
    rawPayload: { source: 'checkout-verify', payment },
  });
}

module.exports = {
  createOrderForPurpose,
  handleWebhook,
  handleCheckoutVerification,
};
