const mongoose = require('mongoose');

/**
 * Notification — persisted records for the in-app notification feed.
 *
 * Sockets push for live UI; this collection is the source of truth users see
 * when they reopen the app. We also track delivery state per channel (push,
 * SMS) for ops debugging.
 *
 * TYPES — controlled vocabulary, mapping to specific UI templates on the
 * frontend (icons, copy, deep links).
 */

const TYPES = [
  // Order lifecycle
  'order_placed',
  'worker_assigned',
  'worker_on_the_way',
  'worker_arriving_soon',
  'worker_arrived',
  'order_completed',
  'order_cancelled',
  'order_failed',
  'rating_request',
  // Worker safety + special events
  'worker_wellness',
  'worker_sos',
  // Trust / reporting
  'report_received',
  // Subscriptions + wallet
  'subscription_activated',
  'subscription_expiring',
  'wallet_credited',
  'cashback_received',
  'referral_reward',
  // KYC
  'kyc_approved',
  'kyc_rejected',
  'kyc_suspended',
  // Disputes + support
  'dispute_response',
  'chat_message',
  // Platform-wide
  'promotional',
  'system_alert',
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
    },

    type: { type: String, enum: TYPES, required: true },
    title: { type: String, required: true },
    body: String,

    // Deep link the app opens when the notification is tapped
    deepLink: String, // e.g. '/orders/abc123'

    // Free-form payload for the frontend (e.g. { orderId, workerName })
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    readAt: Date,

    // Per-channel delivery tracking
    channels: {
      socket: { sent: { type: Boolean, default: false }, at: Date },
      push:   { sent: { type: Boolean, default: false }, at: Date, error: String },
      sms:    { sent: { type: Boolean, default: false }, at: Date, error: String },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ 'recipient.kind': 1, 'recipient.id': 1, createdAt: -1 });
// TTL: prune notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const Notification = mongoose.model('Notification', notificationSchema);
Notification.TYPES = TYPES;

module.exports = Notification;
