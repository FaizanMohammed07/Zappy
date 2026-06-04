const mongoose = require('mongoose');

const eventPartnerSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  ownerName:    { type: String, required: true },
  phone:        { type: String, required: true, unique: true },
  email:        String,

  // Service areas
  cities:          { type: [String], default: [] },
  serviceRadiusKm: { type: Number, default: 30 },

  // KYC — reusing same status pattern as worker KYC
  kyc: {
    status:     { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
    gstNumber:  String,
    panNumber:  String,
    documents:  { type: [String], default: [] }, // S3 URLs
    reviewedAt: Date,
    reviewNote: String,
  },

  // Profile
  profilePhotoKey:   String, // S3 key for business profile photo
  bio:               String,
  portfolioImages:   { type: [String], default: [] },
  yearsExperience:   Number,
  completedEvents:   { type: Number, default: 0 },
  rating:            { type: Number, default: 0, min: 0, max: 5 },
  reviewCount:       { type: Number, default: 0 },

  // Financials
  totalEarningsPaise: { type: Number, default: 0 },

  isActive:  { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },

  // Blocked date slots (partner marks unavailable dates)
  blockedDates: { type: [Date], default: [] },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('EventPartner', eventPartnerSchema);
