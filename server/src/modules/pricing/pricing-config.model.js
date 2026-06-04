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
    // Max price increase (%) between quote and submit before order is blocked.
    // 0.10 = 10%. User must re-confirm if price spiked beyond this threshold.
    surgeTolerancePct: { type: Number, default: 0.10, min: 0.02, max: 0.50 },

    // Commission (workers' platform cut)
    commissionRate: { type: Number, default: 0.30, min: 0, max: 0.5 }, // 30%
    // Reduced commission rate when customer used a coupon/promo code.
    // Platform absorbs the coupon marketing cost; worker keeps more.
    couponCommissionRate: { type: Number, default: 0.15, min: 0, max: 0.5 }, // 15%

    // ── Dispatch kill-switch ─────────────────────────────────────────────────
    // When false, the dispatch worker re-queues all jobs with a 60s delay instead
    // of processing them. Admin can re-enable to drain the queue normally.
    dispatchEnabled: { type: Boolean, default: true },

    // ── Dispatch / worker behaviour ──────────────────────────────────────────
    // Force-assign bonus credited to workers who get auto-assigned (no voluntary accept)
    forceAssignBonusPaise: { type: Number, default: 1500 },        // ₹15
    // Dispatch reject-rate threshold — above this → worker auto-offline
    workerAutoOfflineRejectRate: { type: Number, default: 0.70 },   // 70%
    // Dispatch reject-rate early-warning threshold
    workerRejectWarnRate: { type: Number, default: 0.50 },          // 50%
    // Dispatch scoring weights
    rejectRatePenaltyWeight: { type: Number, default: 3.0 },
    cancelRatePenaltyWeight: { type: Number, default: 5.0 },
    // Minimum worker rating to appear in dispatch
    minWorkerRating: { type: Number, default: 3.0 },

    // ── Stale order watchdog ─────────────────────────────────────────────────
    staleNudgeMinutes: { type: Number, default: 5 },         // nudge after X min assigned
    staleRedispatchMinutes: { type: Number, default: 10 },   // re-dispatch after X min
    staleOtwAlertMinutes: { type: Number, default: 20 },     // on_the_way alert after X min

    // ── Tip caps ─────────────────────────────────────────────────────────────
    tipMaxPaise: { type: Number, default: 50000 },           // ₹500 max tip
    tipOptions: { type: [Number], default: [20, 50, 100] },  // quick tip buttons (₹)

    // ── Offer Boost (pre-acceptance incentive) ────────────────────────────────
    // Boost is the optional pre-acceptance incentive shown during searching phase.
    // 100% of boost goes to worker earnings. Admin controls amounts, max, and
    // whether the feature is enabled at all.
    boostEnabled:         { type: Boolean, default: true },
    boostOptions:         { type: [Number], default: [10, 20, 30, 50, 100] }, // ₹ options shown in UI
    boostMaxPaise:        { type: Number, default: 20000 },   // ₹200 max boost per order
    // dispatch weight: higher boost → higher priority score in dispatch scoring
    // Value of 1.0 = no effect; 2.0 = ₹10 boost counts as 20 in scoring
    boostDispatchWeight:  { type: Number, default: 1.5, min: 1.0, max: 10.0 },

    // ── Referral rewards ─────────────────────────────────────────────────────
    referralReferrerBonusPaise: { type: Number, default: 15000 },  // ₹150 for referring
    referralRefereeBonusPaise: { type: Number, default: 5000 },    // ₹50 for new user

    // ── Earned wage advance ──────────────────────────────────────────────────
    earnedWageAdvanceEnabled: { type: Boolean, default: true },
    earnedWageAdvanceRate: { type: Number, default: 0.80 },    // worker can withdraw 80%

    // ── Emergency fund ───────────────────────────────────────────────────────
    emergencyFundContributionRate: { type: Number, default: 0.005 }, // 0.5% of commission

    // ── Late arrival penalty ─────────────────────────────────────────────────
    // Deducted from worker earnings per extra minute beyond ETA.
    // Set to 0 to disable. Default: ₹2/min (200 paise).
    lateArrivalPenaltyPaisePerMin: { type: Number, default: 200, min: 0 },
    // Grace period before penalty kicks in (minutes). Default: 2 min buffer.
    lateArrivalGraceMinutes: { type: Number, default: 2, min: 0 },

    // ── Service tiers (booking-time speed/quality premium) ────────────────────
    // Multipliers applied on top of the base quote price.
    // Priority: 4.5★+ workers only. Express: nearest worker, instant match.
    tierMultiplierPriority: { type: Number, default: 1.2, min: 1.0, max: 3.0 },
    tierMultiplierExpress:  { type: Number, default: 1.4, min: 1.0, max: 3.0 },
    // Max search window before force-assign kicks in (milliseconds).
    // Express = 60s, Priority = 2 min, Standard = 5 min (system default).
    tierExpressMaxSearchMs:  { type: Number, default: 60000 },
    tierPriorityMaxSearchMs: { type: Number, default: 120000 },

    isActive: { type: Boolean, default: false }, // exactly one active — unique index below

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
