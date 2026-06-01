/**
 * Mid-Job Spare Parts Request
 * Worker identifies needed part during service, requests it.
 * Customer approves cost, platform arranges delivery to job site.
 * Embedded supply chain — no competitor has this flow.
 */
const mongoose = require('mongoose');

const sparePartsRequestSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  workerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },

  parts: [{
    name:        { type: String, required: true, maxlength: 150 },
    brand:       String,
    model:       String,
    quantity:    { type: Number, default: 1 },
    estimatedCostPaise: Number,
    photoUrl:    String,
  }],

  workerNote:  { type: String, maxlength: 300 },
  totalEstimatedPaise: Number,

  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'ordered', 'delivered', 'cancelled'],
    default: 'pending_approval',
    index: true,
  },

  customerApprovedAt: Date,
  deliveryAddressNote: String,
  deliveryEtaMin:     Number,
  deliveredAt:        Date,
  expiresAt:          { type: Date, required: true }, // customer has 5 min to approve
}, { timestamps: true });

module.exports = mongoose.model('SparePartsRequest', sparePartsRequestSchema);
