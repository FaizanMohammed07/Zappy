/**
 * Live Material Cost Tracker
 * Worker logs every material purchased/used during service.
 * Customer sees live running bill: labor + materials. No surprise final invoice.
 * Admin and worker both see markup at configurable rate.
 */
const mongoose = require('mongoose');

const materialEntrySchema = new mongoose.Schema({
  name:         { type: String, required: true, maxlength: 150 },
  quantity:     { type: Number, required: true, min: 0.1 },
  unit:         { type: String, default: 'pcs', maxlength: 20 },
  costPaise:    { type: Number, required: true, min: 0 },   // worker's cost
  markupPct:    { type: Number, default: 15 },               // platform markup %
  chargedPaise: { type: Number, required: true },            // what customer pays
  photoUrl:     { type: String, default: null },             // photo of receipt/part
  addedAt:      { type: Date, default: Date.now },
  approved:     { type: Boolean, default: null },            // null=pending, true/false=customer decision
  approvedAt:   Date,
}, { _id: true });

const materialsBillSchema = new mongoose.Schema({
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  entries:   [materialEntrySchema],

  /* Running totals */
  laborPaise:    { type: Number, default: 0 },    // original order quote
  materialPaise: { type: Number, default: 0 },    // sum of approved chargedPaise
  totalPaise:    { type: Number, default: 0 },    // labor + material
  requiresApproval: { type: Boolean, default: false }, // true when new items added
}, { timestamps: true });

module.exports = mongoose.model('MaterialsBill', materialsBillSchema);
