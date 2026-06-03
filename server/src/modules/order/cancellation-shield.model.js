const mongoose = require('mongoose');

/**
 * CancellationFeeRecord — one row per cancelled order where a fee was assessed.
 * Tracks collection status: wallet deducted immediately, or deferred to next order.
 * Also records harm score so the weekly payout can distribute proportionally.
 */
const cancellationFeeRecordSchema = new mongoose.Schema(
  {
    orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },

    cancelledAtStage: {
      type: String,
      enum: ['created', 'searching', 'assigned', 'on_the_way', 'arrived'],
      required: true,
    },

    feePaise:      { type: Number, required: true, default: 0 },
    isGrace:       { type: Boolean, default: false }, // first searching cancel → ₹0 + warning only
    harmScore:     { type: Number, required: true, default: 0 }, // 0/1/2/3/5 based on stage

    // How many user-initiated cancels in last 30 days at time of cancel (0=first, 1=second, 2+=third+)
    cancelsInPeriod: { type: Number, default: 0 },

    collectionStatus: {
      type: String,
      enum: ['grace', 'zero_fee', 'collected_wallet', 'pending_next_order', 'collected_next_order', 'written_off'],
      default: 'pending_next_order',
      index: true,
    },
    collectedAt:         { type: Date, default: null },
    collectedFromOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    // Which weekly fund pool this fee was added to
    addedToFundWeekId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShieldFundWeek', default: null, index: true },
    addedToFundAt:     { type: Date, default: null },

    warningIssuedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cancellationFeeRecordSchema.index({ userId: 1, createdAt: -1 });
cancellationFeeRecordSchema.index({ addedToFundWeekId: 1, workerId: 1 });

module.exports = mongoose.model('CancellationFeeRecord', cancellationFeeRecordSchema);
