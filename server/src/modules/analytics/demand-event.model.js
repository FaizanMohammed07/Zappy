const mongoose = require('mongoose');

/**
 * DemandEvent — one row per booking request recorded for heatmap analytics.
 *
 * Why Mongo instead of only Redis?
 *   Redis demand buckets have a 5-min TTL and are lost on restart/flush.
 *   This collection provides durable, queryable demand history for:
 *     - Admin heatmap (historical, not just current-window)
 *     - Decision analytics: which areas / services are underserved
 *     - Post-hoc debugging of surge pricing anomalies
 *
 * TTL index: events auto-expire after 90 days to keep collection bounded.
 */
const demandEventSchema = new mongoose.Schema(
  {
    lat:     { type: Number, required: true },
    lng:     { type: Number, required: true },
    bucket:  { type: String, required: true, index: true }, // geoBucket key "lat:lng"
    service: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

// Compound index for heatmap aggregation queries
demandEventSchema.index({ bucket: 1, createdAt: -1 });
demandEventSchema.index({ service: 1, createdAt: -1 });

// Auto-expire after 90 days
demandEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('DemandEvent', demandEventSchema);
