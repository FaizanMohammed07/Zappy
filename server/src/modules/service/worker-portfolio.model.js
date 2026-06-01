/**
 * Worker Portfolio Gallery
 * Workers upload before/after photos tagged by service type.
 * Customers can browse "Rajesh's 14 AC repair jobs" before booking.
 * Creates massive trust — customer CHOOSES their worker based on evidence.
 */
const mongoose = require('mongoose');

const portfolioItemSchema = new mongoose.Schema({
  workerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  service:     { type: String, required: true, index: true },
  beforeUrl:   String,
  afterUrl:    { type: String, required: true },
  caption:     { type: String, maxlength: 200 },
  isPublic:    { type: Boolean, default: true },
  likes:       { type: Number, default: 0 },
  addedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

portfolioItemSchema.index({ workerId: 1, service: 1 });

module.exports = mongoose.model('PortfolioItem', portfolioItemSchema);
