/**
 * Subscription Maintenance Plans
 * Customer subscribes to recurring service (monthly cleaning, quarterly AC, etc.)
 * Platform auto-schedules + notifies. Worker gets guaranteed income.
 * No competitor has smart auto-recurring home service plans in India.
 */
const mongoose = require('mongoose');

const maintenancePlanSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  service:       { type: String, required: true },
  label:         { type: String, maxlength: 100 }, // e.g. "Monthly Cleaning", "Quarterly AC Service"

  /* Recurrence */
  frequencyDays: { type: Number, required: true, min: 1, max: 365 }, // 30 = monthly

  /* Preferred worker */
  preferredWorkerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },

  /* Location */
  pickupLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number],
    address: String,
  },

  /* Pricing snapshot (discounted) */
  basePriceRupees:    Number,
  discountPct:        { type: Number, default: 10 }, // 10% loyalty discount
  effectivePriceRupees: Number,

  /* Execution tracking */
  status:          { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active', index: true },
  nextScheduledAt: { type: Date, required: true, index: true },
  lastCompletedAt: Date,
  totalCompleted:  { type: Number, default: 0 },
  orderHistory:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

  /* Payment */
  paymentMethod:   { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
}, { timestamps: true });

maintenancePlanSchema.index({ pickupLocation: '2dsphere' });
maintenancePlanSchema.index({ status: 1, nextScheduledAt: 1 });

module.exports = mongoose.model('MaintenancePlan', maintenancePlanSchema);
