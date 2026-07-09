const mongoose = require('mongoose');

/**
 * Admin-managed content: FAQs and policy/guideline pages.
 * Single source of truth for user-facing help content so the client never
 * hardcodes it — admins edit everything from the panel.
 *
 *  - type 'faq'    → { question, answer, category } grouped in the FAQ screen
 *  - type 'policy' → { slug, title, body } rendered as a standalone page
 *                    (refund-policy, privacy-policy, warranty-guidelines, terms…)
 */
const contentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['faq', 'policy'], required: true, index: true },

    // FAQ fields
    question: { type: String, trim: true, maxlength: 300 },
    answer:   { type: String, maxlength: 4000 },
    category: { type: String, trim: true, maxlength: 60, default: 'General' },

    // Policy / guideline fields (unique index defined below, partial to policies)
    slug:  { type: String, trim: true, lowercase: true, maxlength: 80 },
    title: { type: String, trim: true, maxlength: 160 },
    body:  { type: String, maxlength: 20000 }, // markdown / plain text

    // Shared
    audience: { type: String, enum: ['user', 'worker', 'all'], default: 'all', index: true },
    order:    { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: String, default: null }, // admin id
  },
  { timestamps: true }
);

// A policy slug is unique among policies (FAQs have no slug).
contentSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' }, type: 'policy' } }
);
contentSchema.index({ type: 1, isActive: 1, order: 1 });

module.exports = mongoose.model('Content', contentSchema);
