const mongoose = require('mongoose');

/**
 * Dispute — raised by either party against an order.
 *
 * Lifecycle:
 *   open → under_review → (resolved_refund | resolved_partial | resolved_no_action | resolved_worker_penalty)
 *
 * Resolution actions can:
 *   - Issue refund (full or partial) → wallet credit
 *   - Apply worker penalty → wallet debit
 *   - Block parties (handled at admin layer)
 *
 * Why an explicit resolution enum (not free text)? Lets analytics segment
 * outcomes cleanly: "what % of disputes ended in refund this month?"
 */

const DISPUTE_CATEGORIES = [
  'service_not_done',
  'poor_quality',
  'overcharged',
  'no_show',
  'wrong_address',
  'damage',
  'rude_behavior',
  'safety_concern',
  'other',
];

const RESOLUTION_TYPES = [
  'refund_full',
  'refund_partial',
  'no_action',
  'worker_penalty',
  'worker_warning',
  'split_decision',
];

const disputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },

    raisedBy: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    },
    against: {
      kind: { type: String, enum: ['user', 'worker'] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },

    category: { type: String, enum: DISPUTE_CATEGORIES, required: true, index: true },
    description: { type: String, required: true, maxlength: 2000 },
    evidenceUrls: [String], // S3 keys for photos

    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },

    // Resolution
    resolution: {
      type: { type: String, enum: RESOLUTION_TYPES },
      refundAmountPaise: Number,
      penaltyAmountPaise: Number,
      adminNotes: String,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      resolvedAt: Date,
    },

    // Communication thread (lightweight — for richer chat use a separate Messages collection)
    messages: [
      {
        from: { type: String, enum: ['user', 'worker', 'admin'] },
        fromId: mongoose.Schema.Types.ObjectId,
        text: String,
        at: { type: Date, default: Date.now },
      },
    ],

    // SLA — how long admin has to respond
    slaDeadline: Date,
  },
  { timestamps: true }
);

disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ slaDeadline: 1, status: 1 }); // For SLA breach alerts

const Dispute = mongoose.model('Dispute', disputeSchema);
Dispute.CATEGORIES = DISPUTE_CATEGORIES;
Dispute.RESOLUTION_TYPES = RESOLUTION_TYPES;

module.exports = Dispute;
