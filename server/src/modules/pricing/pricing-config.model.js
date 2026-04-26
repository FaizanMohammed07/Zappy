const mongoose = require('mongoose');

/**
 * PricingConfig — singleton-ish (one active row at a time, history kept).
 *
 * Why DB-backed when we already have Redis hot config?
 *   - Audit trail (versioning) — every change keeps a row
 *   - Source-of-truth that survives Redis flushes
 *   - Service-level overrides for ac_repair vs puncture etc.
 *
 * The pricing service hot-reads from Redis cache → falls back to DB → falls
 * back to env defaults. Admin updates write to BOTH DB and Redis.
 */
const serviceOverrideSchema = new mongoose.Schema(
  {
    service: { type: String, required: true },
    multiplier: { type: Number, default: 1.0 },
    minFarePaise: Number, // optional service-specific floor
  },
  { _id: false }
);

const pricingConfigSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, unique: true, index: true },

    baseFeePaise: { type: Number, required: true, default: 4000 },     // ₹40
    perKmFeePaise: { type: Number, required: true, default: 1200 },    // ₹12 per km
    perMinFeePaise: { type: Number, required: true, default: 200 },    // ₹2 per min
    platformFeePaise: { type: Number, required: true, default: 1000 }, // ₹10
    minFarePaise: { type: Number, required: true, default: 6000 },     // ₹60

    serviceOverrides: { type: [serviceOverrideSchema], default: [] },

    // Surge controls
    surgeEnabled: { type: Boolean, default: true },
    surgeMaxCap: { type: Number, default: 2.5, min: 1.0, max: 5.0 },

    // Commission (workers' platform cut)
    commissionRate: { type: Number, default: 0.20, min: 0, max: 0.5 }, // 20%

    isActive: { type: Boolean, default: false, index: true }, // exactly one active

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    notes: String,
  },
  { timestamps: true }
);

// Only one active config at a time
pricingConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
