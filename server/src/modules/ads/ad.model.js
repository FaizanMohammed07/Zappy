const mongoose = require('mongoose');

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['banner', 'popup', 'offer_card', 'sponsored_service', 'home_card', 'notification'],
      required: true,
    },
    audience: { type: String, enum: ['users', 'workers', 'both'], default: 'users' },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed'],
      default: 'draft',
      index: true,
    },

    content: {
      headline:        { type: String, required: true },
      body:            { type: String, default: '' },
      imageUrl:        { type: String, default: '' },
      ctaText:         { type: String, default: 'Learn More' },
      ctaLink:         { type: String, default: '' },
      badgeText:       { type: String, default: '' },
      backgroundColor: { type: String, default: '#2563EB' },
      textColor:       { type: String, default: '#FFFFFF' },
    },

    targeting: {
      serviceCategories: { type: [String], default: [] }, // empty = all
      userBehavior:      { type: String, enum: ['all', 'new_users', 'inactive_7d', 'high_spenders'], default: 'all' },
    },

    schedule: {
      startAt:          { type: Date, required: true },
      endAt:            { type: Date, required: true },
      impressionsLimit: { type: Number, default: 0 }, // 0 = unlimited
    },

    billing: {
      model:  { type: String, enum: ['cpm', 'cpc', 'fixed'], default: 'fixed' },
      rate:   { type: Number, default: 0 }, // paise: per 1000 (CPM), per click (CPC), or total (fixed)
      budget: { type: Number, default: 0 }, // 0 = unlimited
    },

    stats: {
      impressions: { type: Number, default: 0 },
      clicks:      { type: Number, default: 0 },
      spend:       { type: Number, default: 0 }, // paise
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

adSchema.index({ status: 1, 'schedule.startAt': 1, 'schedule.endAt': 1 });
adSchema.index({ audience: 1, status: 1 });

module.exports = mongoose.model('Ad', adSchema);
