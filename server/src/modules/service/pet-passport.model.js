/**
 * Pet Passport — Zappy's unique defensible data asset.
 * Every pet serviced through the platform builds a permanent history.
 * Creates lock-in and trust that no competitor can replicate.
 */
const mongoose = require('mongoose');

const vaccinationSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  givenAt:     { type: Date },
  nextDueAt:   { type: Date },
  vetName:     String,
  proofUrl:    String,
}, { _id: false });

const serviceEventSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  service:    { type: String, required: true },
  workerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker' },
  workerName: String,
  notes:      String,
  photoUrls:  [String],
  at:         { type: Date, default: Date.now },
}, { _id: true });

const petPassportSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // Pet identity
  name:     { type: String, required: true, trim: true },
  species:  { type: String, enum: ['dog', 'cat', 'bird', 'rabbit', 'fish', 'other'], required: true },
  breed:    String,
  gender:   { type: String, enum: ['male', 'female', 'unknown'] },
  dob:      Date,
  colour:   String,
  weight:   Number, // kg
  photoUrl: String,

  // Medical
  vaccinations: [vaccinationSchema],
  allergies:    [String],
  medicalNotes: String,
  vetName:      String,
  vetPhone:     String,

  // Preferences (used by workers to give personalised service)
  preferences: {
    groomingStyle:  String,
    temperament:    { type: String, enum: ['calm', 'energetic', 'aggressive', 'anxious', 'friendly'] },
    foodBrand:      String,
    walkDuration:   Number, // minutes
    specialNotes:   String,
  },

  // Service history — builds the passport timeline
  serviceHistory: [serviceEventSchema],

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

petPassportSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('PetPassport', petPassportSchema);
