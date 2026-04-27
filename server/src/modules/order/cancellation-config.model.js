const mongoose = require('mongoose');

/**
 * CancellationConfig — singleton DB-backed config for all penalty rules.
 *
 * Exactly one active row at a time (partial unique index on isActive:true).
 * Admin updates create a versioned new row, preserving audit history.
 */
const cancellationConfigSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },

    // User-side
    freeCancelWindowSec: { type: Number, default: 60 },      // grace period
    userCancelFeePaise:  { type: Number, default: 1000 },    // ₹10 flat fee

    // Worker-side penalties (debited from wallet)
    workerCancelPenaltyPaise:   { type: Number, default: 2000 },  // ₹20 base
    workerNoShowPenaltyPaise:   { type: Number, default: 5000 },  // ₹50 no-show
    lateWorkerCancelMultiplier: { type: Number, default: 2 },     // on_the_way/arrived → ×2

    // Behaviour thresholds
    workerRejectLimit:      { type: Number, default: 5 },   // consecutive rejects → auto-unavailable
    workerCancelLimit:      { type: Number, default: 3 },   // cancels in window → auto-block
    workerCancelWindowSec:  { type: Number, default: 86400 }, // 24h window for cancel counting

    // Score degradation weights (added to dispatch score — higher = worse rank)
    rejectRatePenaltyWeight: { type: Number, default: 3.0 },
    cancelRatePenaltyWeight: { type: Number, default: 5.0 },

    isActive: { type: Boolean, default: false, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    notes: String,
  },
  { timestamps: true }
);

cancellationConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('CancellationConfig', cancellationConfigSchema);
