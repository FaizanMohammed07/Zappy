/**
 * Worker Shift Availability
 * Workers commit to time windows ahead of time.
 * Benefits:
 *   - Dispatch system prioritises committed workers (faster match for customers)
 *   - Worker earns a "commitment bonus" on top of normal earnings
 *   - Workers see projected income before the day begins
 */

const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  startHour:       { type: Number, min: 0, max: 23, required: true },
  endHour:         { type: Number, min: 1, max: 24, required: true },
  bonusPaise:      { type: Number, default: 0 },   // pre-agreed bonus for showing up
  ordersDelivered: { type: Number, default: 0 },
  earningsPaise:   { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['committed', 'active', 'fulfilled', 'missed', 'cancelled'],
    default: 'committed',
  },
  fulfilledAt: Date,
}, { _id: false });

const availabilitySchema = new mongoose.Schema({
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },

  /* Calendar date (UTC midnight). One doc per worker per day. */
  date: { type: Date, required: true },

  slots: [slotSchema],

  /* Broad zone the worker committed to — used for faster geo-matching */
  zone: {
    lat: Number,
    lng: Number,
    label: String,           // e.g. "Koramangala"
  },

  /* Daily summary (updated as orders complete) */
  totalBonusPaise:     { type: Number, default: 0 },
  totalEarningsPaise:  { type: Number, default: 0 },
  totalOrders:         { type: Number, default: 0 },
}, {
  timestamps: true,
});

/* One commitment doc per worker per day */
availabilitySchema.index({ workerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WorkerAvailability', availabilitySchema);
