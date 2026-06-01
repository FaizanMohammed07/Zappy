/**
 * Construction Site Visit Assessment
 * Before any major construction work, worker visits site, takes photos,
 * marks scope and estimated cost. Customer reviews and confirms before work starts.
 *
 * Urban Company charges ₹99 for site visits but doesn't generate structured assessments.
 * We generate a professional digital scope-of-work document.
 */
const mongoose = require('mongoose');

const scopeItemSchema = new mongoose.Schema({
  area:           { type: String, required: true, maxlength: 200 },  // "Kitchen wall, east side"
  workType:       { type: String, required: true, maxlength: 200 },  // "Replaster + waterproofing"
  estimatedHours: Number,
  estimatedMaterialCost: Number,  // rupees
  photos:         [String],
  severity:       { type: String, enum: ['minor', 'moderate', 'major'], default: 'minor' },
  notes:          String,
}, { _id: true });

const siteVisitSchema = new mongoose.Schema({
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  workerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
  address:   String,

  visitDate: { type: Date, default: Date.now },

  /* Scope items identified during visit */
  scopeItems: [scopeItemSchema],

  /* Overall estimate */
  totalEstimatedHours:   Number,
  totalMaterialCost:     Number,  // rupees
  totalLaborCost:        Number,  // rupees (estimated)
  grandTotal:            Number,  // rupees

  /* Site conditions */
  siteAccessible:   { type: Boolean, default: true },
  accessNotes:      String,
  materialsNeeded:  [String],   // list of materials to procure
  equipmentNeeded:  [String],   // scaffolding, drill, etc.

  /* Worker assessment */
  startDateSuggested: Date,
  durationDays:      Number,
  workersNeeded:     { type: Number, default: 1 },

  /* Status */
  status: {
    type: String,
    enum: ['draft', 'submitted', 'customer_approved', 'customer_rejected', 'work_started'],
    default: 'draft',
  },

  customerResponseAt: Date,
  customerNote:       String,

  /* Main work order created after approval */
  mainOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });

siteVisitSchema.index({ workerId: 1, status: 1 });
siteVisitSchema.index({ status: 1, createdAt: -1 });
siteVisitSchema.index({ mainOrderId: 1 }, { sparse: true });

module.exports = mongoose.model('SiteVisit', siteVisitSchema);
