'use strict';

/**
 * Worker location time-series — trip replay, dispute evidence, spoof forensics,
 * and training data for the future ETA/placement AI.
 *
 * MongoDB native time-series collection: auto-bucketed (cheap storage), with a
 * 14-day TTL. This is the ONLY sanctioned worker-location write — it is async,
 * fire-and-forget, and never on the request hot path. Live tracking stays in
 * Redis; this is the durable, sampled trail (only while on an active trip).
 */

const mongoose = require('mongoose');

const locationPingSchema = new mongoose.Schema(
  {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    loc:      { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number] } }, // [lng, lat]
    hdg:      Number,
    spd:      Number,   // m/s (server-computed)
    acc:      Number,   // metres
    mock:     Boolean,
    at:       { type: Date, default: Date.now },
  },
  {
    timeseries: { timeField: 'at', metaField: 'workerId', granularity: 'seconds' },
    expireAfterSeconds: 14 * 24 * 60 * 60, // 14-day retention
    autoCreate: true,
    versionKey: false,
  },
);

module.exports = mongoose.models.LocationPing || mongoose.model('LocationPing', locationPingSchema);
