/**
 * Home Health Inspection Report
 * Worker does a full-home walkthrough and generates a structured PDF report.
 * Findings: electrical, plumbing, AC, structural. Severity per issue.
 * Customer gets a professional report + recommended follow-up services.
 * Nothing like this exists as a bookable service in India.
 */
const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  category:  { type: String, enum: ['electrical', 'plumbing', 'ac', 'carpenter', 'structural', 'other'], required: true },
  location:  { type: String, required: true, maxlength: 200 }, // e.g. "Master bedroom — left wall socket"
  severity:  { type: String, enum: ['ok', 'minor', 'moderate', 'urgent'], default: 'minor' },
  finding:   { type: String, required: true, maxlength: 500 },
  recommendation: { type: String, maxlength: 300 },
  photoUrls: [String],
  serviceCode: String, // if a follow-up booking is recommended
}, { _id: true });

const inspectionReportSchema = new mongoose.Schema({
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  address:   { type: String, required: true },

  /* Structured findings */
  findings:  [findingSchema],

  /* Summary scores per category */
  scores: {
    electrical:  { type: String, enum: ['good', 'attention', 'urgent'], default: 'good' },
    plumbing:    { type: String, enum: ['good', 'attention', 'urgent'], default: 'good' },
    ac:          { type: String, enum: ['good', 'attention', 'urgent'], default: 'good' },
    structural:  { type: String, enum: ['good', 'attention', 'urgent'], default: 'good' },
    overall:     { type: String, enum: ['excellent', 'good', 'needs_attention', 'urgent'], default: 'good' },
  },

  /* Recommended services (follow-up booking opportunities) */
  recommendedServices: [{
    serviceCode:  String,
    reason:       String,
    estimatedCost: Number,
    priority:     { type: String, enum: ['immediate', 'soon', 'eventually'] },
  }],

  reportPdfUrl:  { type: String, default: null }, // S3 URL to generated PDF
  status:        { type: String, enum: ['draft', 'complete'], default: 'draft' },
  completedAt:   Date,
}, { timestamps: true });

module.exports = mongoose.model('InspectionReport', inspectionReportSchema);
