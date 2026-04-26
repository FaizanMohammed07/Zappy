const mongoose = require('mongoose');

/**
 * Feedback — structured post-order feedback beyond the 1-5 star rating.
 *
 * Star rating is a scalar; feedback captures free-form problems and
 * tags for analytics. Kept separate so:
 *   - Rating is required for closure (one tap)
 *   - Feedback is optional and richer
 *   - Admin can dashboard "top complaints" by tag
 */

const FEEDBACK_TAGS = [
  'arrived_late',
  'rude_behavior',
  'poor_quality',
  'great_service',
  'on_time',
  'fair_pricing',
  'would_recommend',
  'tools_missing',
  'overcharged',
  'communication',
];

const feedbackSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    from: {
      kind: { type: String, enum: ['user', 'worker'], required: true },
      id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    },
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], required: true, index: true },
    tags: { type: [String], enum: FEEDBACK_TAGS, default: [] },
    comment: { type: String, maxlength: 1000 },

    // For ops — has this feedback been reviewed by someone?
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

feedbackSchema.index({ sentiment: 1, tags: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
Feedback.TAGS = FEEDBACK_TAGS;

module.exports = Feedback;
