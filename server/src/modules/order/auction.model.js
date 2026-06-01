/**
 * Job Auction — Skill-based competitive bidding for premium orders (>₹1500).
 * Workers submit their approach, estimated time, and proposed price.
 * Customer picks the best bid. Creates trust through choice, not blind assignment.
 */
const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  workerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  proposedPrice:  { type: Number, required: true },
  etaMinutes:     { type: Number, required: true },
  approach:       { type: String, maxlength: 500, required: true },
  workerRating:   Number,
  workerJobs:     Number,
  workerName:     String,
  submittedAt:    { type: Date, default: Date.now },
}, { _id: true });

const auctionSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  bids:       [bidSchema],
  expiresAt:  { type: Date, required: true },
  status:     { type: String, enum: ['open', 'closed', 'assigned', 'cancelled'], default: 'open' },
  winnerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },
  winnerBidId: { type: mongoose.Schema.Types.ObjectId, default: null },
  basePrice:  Number,
}, { timestamps: true });

auctionSchema.index({ orderId: 1 });
auctionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('JobAuction', auctionSchema);
