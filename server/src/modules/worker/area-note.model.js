/**
 * Neighborhood Safety Notes — Community Trust Map
 * Workers anonymously flag areas: safe, caution, access issues.
 * Aggregated data shown on LocationPicker and WorkerDashboard demand zones.
 * No Indian platform has anonymous crowd-sourced hyperlocal safety for gig workers.
 */
const mongoose = require('mongoose');

const areaNoteSchema = new mongoose.Schema({
  /* Geo bucket for aggregation (rounded to 0.01° ≈ 1.1km) */
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  geohash: { type: String, required: true, index: true },  // e.g. "12.97:77.64"

  /* Aggregated counts — we NEVER store individual worker IDs */
  safeCount:         { type: Number, default: 0 },
  cautionCount:      { type: Number, default: 0 },
  accessIssueCount:  { type: Number, default: 0 },
  totalNotes:        { type: Number, default: 0 },

  /* Most recent note text (anonymized, last 3 kept) */
  recentNotes:  [{ text: String, at: Date }],

  lastUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

areaNoteSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('AreaNote', areaNoteSchema);
