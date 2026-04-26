const mongoose = require('mongoose');

/**
 * Wallet — a denormalized balance for cheap reads.
 *
 * The Transaction collection is the source of truth (sum of credit/debit rows).
 * Wallet.balance must always equal that sum. The reconciliation script in
 * scripts/reconcile-wallets.js audits this invariant.
 *
 * Concurrent updates use optimistic locking via the `version` field — every
 * balance change increments it; conflicting updates retry. This avoids a
 * transaction on every wallet write while still preventing lost updates.
 */
const walletSchema = new mongoose.Schema(
  {
    owner: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
    },

    // All amounts in paise (integer math — no float errors).
    // Worker wallets can go NEGATIVE (commission debt). User wallets cannot —
    // the debit guard in wallet.service enforces that per-kind.
    balancePaise: { type: Number, default: 0 },

    // Lifetime totals for analytics
    lifetimeCreditedPaise: { type: Number, default: 0 },
    lifetimeDebitedPaise: { type: Number, default: 0 },

    currency: { type: String, default: 'INR' },
    isFrozen: { type: Boolean, default: false }, // admin can freeze on fraud
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

walletSchema.index({ 'owner.kind': 1, 'owner.id': 1 }, { unique: true });

module.exports = mongoose.model('Wallet', walletSchema);
