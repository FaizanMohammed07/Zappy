const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, sparse: true },
    passwordHash: { type: String, select: false },
    savedAddresses: [
      {
        label: String,
        address: String,
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], required: true }, // [lng, lat]
        },
        landmark: String,
        flatNumber: String,
        notes: String,
        tag: { type: String, enum: ['home', 'work', 'other'], default: 'other' },
      },
    ],
    recentLocations: [
      {
        address: { type: String },
        lat: { type: Number },
        lng: { type: Number },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    deviceTokens: [{ type: String }], // FCM / Web Push tokens for push notifications
    defaultPayment: { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    isBlocked: { type: Boolean, default: false },

    // Gamification — XP, levels, streaks, badges (mirrors worker incentive system)
    gamification: {
      xp:            { type: Number, default: 0 },
      level:         { type: Number, default: 1 },
      streak:        { type: Number, default: 0 },
      lastOrderDate: { type: Date },
      totalOrders:   { type: Number, default: 0 },
      badges:        [{ id: String, label: String, earnedAt: Date }],
    },
  },
  { timestamps: true }
);

userSchema.index({ 'savedAddresses.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema);
