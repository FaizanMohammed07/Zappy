const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, sparse: true },
    passwordHash: { type: String, select: false },
    savedAddresses: [
      {
        label: String,                       // "Home", "Office", "Mom's place"
        address: String,
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], required: true }, // [lng, lat]
        },
        landmark: String,                    // "Near Reliance Fresh"
        flatNumber: String,                  // "Flat 302, 3rd floor"
        notes: String,                       // "Gate code 1234, red door"
        tag: { type: String, enum: ['home', 'work', 'other'], default: 'other' },
      },
    ],
    defaultPayment: { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ 'savedAddresses.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema);
