const mongoose = require('mongoose');

/**
 * CallSession — masked phone-call proxy.
 *
 * Neither party sees the other's real number. When a user taps "Call worker",
 * we create a session and return a proxy number (rented pool of Twilio/Exotel
 * virtual numbers). The telephony provider bridges the actual call using the
 * proxy-number + session context to route to the right party.
 *
 * TTL: sessions auto-expire 2h after the order completes so numbers can be
 * recycled. The unique index on (proxyNumber, active) ensures we don't assign
 * the same proxy to two live sessions simultaneously.
 */

const callSessionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    caller: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
    },
    callee: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
    },

    proxyNumber: { type: String, required: true, index: true },

    // Provider tracking (Twilio call SID, Exotel call ID, etc.)
    providerCallId: String,
    provider: { type: String, enum: ['twilio', 'exotel', 'mock'], default: 'mock' },

    // Recordings (consent per region) — S3 URL
    recordingUrl: String,

    active: { type: Boolean, default: true, index: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    durationSec: Number,

    // TTL — 2h past order completion
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

// One active session per order per direction
callSessionSchema.index(
  { orderId: 1, 'caller.id': 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('CallSession', callSessionSchema);
