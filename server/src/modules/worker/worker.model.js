const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, sparse: true },
    passwordHash: { type: String, select: false },

    // Work attributes
    skills: {
      type: [String],
      required: true,
      index: true, // ['puncture', 'plumbing', 'electrical', 'helper', 'carpenter']
    },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    totalJobs: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },

    // KYC — multi-state approval workflow
    kyc: {
      status: {
        type: String,
        enum: ['not_submitted', 'pending_review', 'approved', 'rejected', 'suspended'],
        default: 'not_submitted',
        index: true,
      },
      aadhaarUrl: String, // S3 key
      licenseUrl: String,
      selfieUrl: String,
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      rejectionReason: String,
      // Resubmission controls (#86)
      rejectionCount: { type: Number, default: 0 },      // lifetime rejections
      lastRejectedAt: Date,                              // last rejection timestamp
      submissionHistory: [{                              // immutable audit trail
        aadhaarUrl: String,
        licenseUrl: String,
        selfieUrl: String,
        submittedAt: Date,
        outcome: String,  // 'pending' | 'approved' | 'rejected'
        rejectionReason: String,
      }],
    },

    // Trust signals — accumulated misconduct flags (#89)
    trust: {
      harassmentComplaints: { type: Number, default: 0 },   // safety complaints by users
      harassmentFlaggedAt: Date,                            // when auto-flagged for review
      blockedFromUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // per-user blocks
    },

    // Availability + location — SOURCE OF TRUTH; Redis is a cache.
    isOnline: { type: Boolean, default: false, index: true },
    isAvailable: { type: Boolean, default: false, index: true },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      updatedAt: { type: Date, default: Date.now },
    },
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    // Financials
    wallet: {
      balance: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
    },

    // Persistent penalty stats — source of truth for dispatch score degradation.
    // Redis sliding window in abuse.service is the short-term signal;
    // this is the lifetime ledger used for scoring and admin reports.
    penalties: {
      totalOffers:    { type: Number, default: 0 },  // offers received
      totalRejects:   { type: Number, default: 0 },  // rejected/timed-out offers
      totalCancels:   { type: Number, default: 0 },  // worker-initiated cancellations
      totalNoShows:   { type: Number, default: 0 },  // no-show on completed disputes
      lastPenaltyAt:  { type: Date },
    },

    // Emergency contact for SOS feature
    emergencyContact: {
      name:  { type: String, maxlength: 100 },
      phone: { type: String, maxlength: 15 },
    },

    // Ops
    deviceTokens: [String], // FCM push tokens
    deviceIds:    [String], // hardware fingerprints (for multi-account detection)
    isBlocked: { type: Boolean, default: false },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

// CRITICAL: Compound geo index used by the matcher.
workerSchema.index({ currentLocation: '2dsphere' });
workerSchema.index({ isOnline: 1, isAvailable: 1, skills: 1 });

module.exports = mongoose.model('Worker', workerSchema);
