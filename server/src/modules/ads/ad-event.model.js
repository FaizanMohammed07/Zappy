const mongoose = require('mongoose');

// Time-series analytics events for every ad interaction.
// Used for detailed reporting, fraud analysis, and billing.
const adEventSchema = new mongoose.Schema({
  adId:      { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type:      { type: String, enum: ['impression', 'click', 'lead', 'conversion'], required: true },
  placement: { type: String },

  // Who
  userId:      { type: mongoose.Schema.Types.ObjectId },
  ip:          String,
  fingerprint: String, // SHA-256(ip+ua).slice(0,16) for dedup

  // Context (search query, category, order id)
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Cost charged at event time (paise)
  costPaise: { type: Number, default: 0 },

  // Fraud flag
  isFraud: { type: Boolean, default: false },

  at: { type: Date, default: Date.now },
}, { timestamps: false });

adEventSchema.index({ adId: 1, type: 1, at: -1 });
adEventSchema.index({ fingerprint: 1, adId: 1, type: 1, at: -1 }); // fraud dedup
adEventSchema.index({ 'at': 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL 90 days

module.exports = mongoose.model('AdEvent', adEventSchema);
