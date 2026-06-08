const mongoose = require('mongoose');

const ZONE_STATUSES = ['active', 'coming_soon', 'disabled'];

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 500 },

    // GeoJSON polygon — [[[lng, lat], ...]]
    polygon: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true },
    },

    status: { type: String, enum: ZONE_STATUSES, default: 'active', index: true },

    // null = inherit global surge; otherwise a hard override for this zone
    surgeMultiplierOverride: { type: Number, min: 1, max: 5, default: null },

    // Price modifier for this zone (1.0 = no change)
    pricingMultiplier: { type: Number, min: 0.5, max: 3, default: 1.0 },

    // Empty enabledServices = all services enabled. disabledServices blocks specific ones.
    enabledServices: { type: [String], default: [] },
    disabledServices: { type: [String], default: [] },

    // Zone-specific quality floor for dispatch
    minWorkerRating: { type: Number, default: 0, min: 0, max: 5 },

    color: { type: String, default: '#3B82F6' },

    createdBy: { type: String },
  },
  { timestamps: true }
);

zoneSchema.index({ polygon: '2dsphere' });

const Zone = mongoose.model('Zone', zoneSchema);
Zone.STATUSES = ZONE_STATUSES;

module.exports = Zone;
module.exports.ZONE_STATUSES = ZONE_STATUSES;
