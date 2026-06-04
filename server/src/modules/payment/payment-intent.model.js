const mongoose = require('mongoose');

/**
 * PaymentIntent — represents a single intended Razorpay payment lifecycle.
 *
 * We create one of these the moment we ask Razorpay to create an order. The
 * webhook later resolves it. Multiple status transitions:
 *
 *   created → authorized → captured  (success)
 *           → failed                  (terminal)
 *           → expired                 (terminal, sweeper)
 *
 * The `purpose` field tells the webhook handler what side-effects to apply
 * once the payment captures: activate a subscription, top up a wallet, or
 * settle an order. Keeping this on the intent itself (not derived from
 * Razorpay metadata only) means we can reconcile even if Razorpay's notes
 * field is missing.
 */
const paymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, sparse: true, unique: true }, // set on capture

    owner: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    },

    purpose: {
      type: String,
      enum: ['subscription', 'wallet_topup', 'order_payment', 'event_advance_payment', 'event_remaining_payment'],
      required: true,
      index: true,
    },

    // Refs depending on purpose — exactly one will be populated
    planId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    orderId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    eventBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventBooking' },

    amountPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'expired', 'refunded'],
      default: 'created',
      index: true,
    },

    // For double-processing prevention: set the first time we successfully
    // apply side-effects. Idempotency key in our domain.
    appliedAt: Date,

    // Raw metadata from Razorpay events for audit + debugging
    events: [
      {
        event: String,
        at: { type: Date, default: Date.now },
        payload: mongoose.Schema.Types.Mixed,
      },
    ],

    failureReason: String,

    // Reconciliation flag: set when side-effects fail after payment captures. (#95/#96)
    // Admin must manually verify and apply the credit/subscription/order update.
    reconciliationRequired: { type: Boolean, default: false, index: true },
    reconciliationReason:   String,
    reconciliationAt:       Date,
    reconciledAt:           Date,   // set by admin when resolved
    reconciledBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

paymentIntentSchema.index({ 'owner.id': 1, createdAt: -1 });
paymentIntentSchema.index({ status: 1, createdAt: -1 });
paymentIntentSchema.index({ reconciliationRequired: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
