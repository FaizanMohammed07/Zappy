const mongoose = require('mongoose');

const priceRevisionSchema = new mongoose.Schema({
  orderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  workerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  originalTotal:   { type: Number, required: true },
  requestedTotal:  { type: Number, required: true },
  reason:          { type: String, maxlength: 500, required: true },
  evidenceUrls:    [{ type: String }],     // S3 URLs to photos of discovered issue
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
    index: true,
  },
  expiresAt:   { type: Date, required: true },   // customer has 5 min to respond
  resolvedAt:  Date,
  resolvedBy:  { type: String, enum: ['customer', 'auto_approved', 'admin'] },
}, { timestamps: true });

priceRevisionSchema.index({ orderId: 1, status: 1 });

module.exports = mongoose.model('PriceRevision', priceRevisionSchema);
