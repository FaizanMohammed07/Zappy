/**
 * Service Warranty Card
 * Auto-created on order completion when the service has warrantyDays > 0.
 * Customer can claim warranty if the service fails within the period.
 * Worker is re-dispatched at no extra charge to fix the issue.
 * No Indian competitor tracks post-service warranty.
 */
const mongoose = require('mongoose');

const warrantySchema = new mongoose.Schema({
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  workerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  service:     { type: String, required: true },
  warrantyDays:{ type: Number, required: true },
  issuedAt:    { type: Date, required: true, default: Date.now },
  expiresAt:   { type: Date, required: true },
  status:      { type: String, enum: ['active', 'claimed', 'expired', 'resolved'], default: 'active', index: true },

  /* Claim details */
  claimReason:   String,
  claimPhotos:   [String],
  claimAt:       Date,
  revisitOrderId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  resolvedAt:    Date,
}, { timestamps: true });

warrantySchema.index({ userId: 1, status: 1 });
warrantySchema.index({ expiresAt: 1, status: 1 });

module.exports = mongoose.model('Warranty', warrantySchema);
