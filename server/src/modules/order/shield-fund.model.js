const mongoose = require('mongoose');

/**
 * ShieldFundWeek — one document per Mon–Sun week.
 * Accumulates all cancellation fees collected that week, then distributes on Monday.
 */
const shieldFundWeekSchema = new mongoose.Schema(
  {
    weekStart: { type: Date, required: true, unique: true, index: true }, // Monday 00:00:00 UTC
    weekEnd:   { type: Date, required: true },                            // Sunday 23:59:59 UTC

    totalCollectedPaise: { type: Number, default: 0 }, // sum of all fees added this week
    platformCutPaise:    { type: Number, default: 0 }, // platform's share (splitPlatformPct %)
    workerPoolPaise:     { type: Number, default: 0 }, // workers' share (splitWorkerPct %)

    splitWorkerPct:   { type: Number, default: 85 }, // stored for audit; may change over time
    splitPlatformPct: { type: Number, default: 15 },

    status: {
      type: String,
      enum: ['open', 'paid_out', 'skipped'],
      default: 'open',
      index: true,
    },

    paidOutAt:        { type: Date, default: null },
    payoutsCount:     { type: Number, default: 0 }, // how many workers received a payout
    totalWorkersPaid: { type: Number, default: 0 }, // same (alias for clarity)

    triggeredBy:   { type: String, enum: ['cron', 'admin'], default: 'cron' },
    triggeredById: { type: mongoose.Schema.Types.ObjectId, default: null }, // admin id if manual
  },
  { timestamps: true }
);

/**
 * ShieldWorkerPayout — one row per (week × worker) who had cancellations.
 * Created during the weekly payout run.
 */
const shieldWorkerPayoutSchema = new mongoose.Schema(
  {
    weekId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ShieldFundWeek', required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },

    harmScore:          { type: Number, required: true },
    cancellationsCount: { type: Number, required: true },
    feeRecordIds:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'CancellationFeeRecord' }],

    amountPaise: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    paidAt:        { type: Date, default: null },
    failureReason: { type: String, default: null },

    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    notifiedAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

shieldWorkerPayoutSchema.index({ weekId: 1, workerId: 1 }, { unique: true });

const ShieldFundWeek    = mongoose.model('ShieldFundWeek',    shieldFundWeekSchema);
const ShieldWorkerPayout = mongoose.model('ShieldWorkerPayout', shieldWorkerPayoutSchema);

module.exports = { ShieldFundWeek, ShieldWorkerPayout };
