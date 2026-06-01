/**
 * Worker Emergency Mutual Aid Fund
 * 0.5% of every platform commission goes into a pooled emergency fund.
 * Any worker can claim up to ₹5000 once per 6 months for genuine emergencies.
 * Admin approves. Creates massive loyalty — platform that CARES.
 */
const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  workerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  workerName:  String,
  workerPhone: String,
  reason:      { type: String, required: true, maxlength: 500 },
  category:    { type: String, enum: ['medical', 'family', 'equipment', 'accident', 'other'], required: true },
  requestedPaise: { type: Number, required: true, max: 500000 }, // ₹5000 max
  status:      { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending', index: true },
  adminNote:   String,
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt:  Date,
  paidAt:      Date,
}, { timestamps: true });

claimSchema.index({ workerId: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyFundClaim', claimSchema);
