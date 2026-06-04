const mongoose = require('mongoose');

// All supported placement slots — admin can enable/disable each
const PLACEMENTS = [
  'home_banner',        // #1 Homepage carousel
  'category_listing',   // #2 Event/service category sponsored
  'search_ads',         // #3 Search results top
  'detail_cross_sell',  // #4 Service detail page cross-sell
  'booking_success',    // #5 Post-booking upsell (highest value)
  'order_tracking',     // #6 Live tracking page
  'profile_page',       // #7 User profile sponsored
  'wallet_page',        // #8 Cashback/rewards ads
];

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['banner', 'popup', 'offer_card', 'sponsored_service', 'home_card', 'notification',
             'sponsored_listing', 'video', 'featured_theme', 'cross_sell', 'lead_gen'],
      required: true,
    },
    audience:   { type: String, enum: ['users', 'workers', 'both'], default: 'users' },
    // Which placements this ad runs in (empty = home_banner default)
    placements: { type: [String], enum: PLACEMENTS, default: ['home_banner'] },

    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'paused', 'completed', 'rejected', 'exhausted'],
      default: 'draft',
      index: true,
    },

    // Self-serve: who created this (admin or event_partner)
    advertiser: {
      id:   { type: mongoose.Schema.Types.ObjectId },
      kind: { type: String, enum: ['admin', 'event_partner', 'external'], default: 'admin' },
      name: String,
    },

    content: {
      headline:        { type: String, required: true },
      body:            { type: String, default: '' },
      imageUrl:        { type: String, default: '' },
      videoUrl:        { type: String, default: '' },
      ctaText:         { type: String, default: 'Learn More' },
      ctaLink:         { type: String, default: '' },
      badgeText:       { type: String, default: '' },
      backgroundColor: { type: String, default: '#2563EB' },
      textColor:       { type: String, default: '#FFFFFF' },
    },

    targeting: {
      serviceCategories: { type: [String], default: [] }, // service slugs; empty = all
      eventCategories:   { type: [String], default: [] }, // event category IDs; empty = all
      cities:            { type: [String], default: [] }, // lowercase city names; empty = all
      keywords:          { type: [String], default: [] }, // for search_ads placement
      userBehavior:      { type: String, enum: ['all', 'new_users', 'inactive_7d', 'high_spenders'], default: 'all' },
      radiusKm:          { type: Number, default: 0 },    // 0 = city-wide
    },

    schedule: {
      startAt:          { type: Date, required: true },
      endAt:            { type: Date, required: true },
      impressionsLimit: { type: Number, default: 0 }, // 0 = unlimited
    },

    billing: {
      model:          { type: String, enum: ['cpm', 'cpc', 'cpl', 'fixed', 'flat_monthly'], default: 'fixed' },
      rate:           { type: Number, default: 0 }, // paise per event (click/1K impressions/lead)
      budget:         { type: Number, default: 0 }, // lifetime budget paise; 0 = unlimited
      dailyCapPaise:  { type: Number, default: 0 }, // daily spend cap; 0 = none
      spentTodayPaise:{ type: Number, default: 0 }, // resets daily
      lastDayReset:   { type: String, default: '' }, // YYYY-MM-DD
    },

    stats: {
      impressions: { type: Number, default: 0 },
      clicks:      { type: Number, default: 0 },
      leads:       { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      spend:       { type: Number, default: 0 }, // total paise spent
    },

    adminNote:  String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: Date,
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

adSchema.index({ status: 1, placements: 1, 'schedule.startAt': 1, 'schedule.endAt': 1 });
adSchema.index({ 'advertiser.id': 1, status: 1 });
adSchema.index({ audience: 1, status: 1 });

module.exports = mongoose.model('Ad', adSchema);
module.exports.PLACEMENTS = PLACEMENTS;
