const mongoose = require('mongoose');

const ORDER_STATUSES = [
  'created',
  'searching',
  'assigned',
  'on_the_way',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
];

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null, index: true },

    service: {
      type: String,
      required: true,
      enum: ['puncture', 'plumbing', 'electrical', 'helper', 'carpenter', 'ac_repair', 'cleaning', 'painting'],
    },
    subCategory: { type: String, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    images: [{ type: String }], // S3 URLs, max 5
    scheduledAt: { type: Date, default: null, index: true }, // null = book now

    // Priority — emergency mode surfaces the order first + applies a surcharge
    priority: {
      type: String,
      enum: ['normal', 'emergency'],
      default: 'normal',
      index: true,
    },

    // Locations
    pickupLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      address: { type: String, required: true },
      landmark: String,
      flatNumber: String,
      notes: String,           // instructions for the worker on arrival
    },
    dropLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
      address: String,
    },

    // Pricing snapshot — computed at creation, locked for the order.
    pricing: {
      baseFee: Number,
      distanceKm: Number,
      distanceFee: Number,
      etaMinutes: Number,
      timeFee: Number,
      platformFee: Number,
      surgeMultiplier: { type: Number, default: 1 },
      subtotal: Number,
      total: Number,
      currency: { type: String, default: 'INR' },
    },

    // Lifecycle
    status: { type: String, enum: ORDER_STATUSES, default: 'created', index: true },
    statusHistory: [
      {
        status: { type: String, enum: ORDER_STATUSES },
        at: { type: Date, default: Date.now },
        meta: mongoose.Schema.Types.Mixed,
      },
    ],

    // Dispatch metadata
    dispatch: {
      attemptedWorkerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      currentOfferWorkerId: { type: mongoose.Schema.Types.ObjectId, default: null },
      offerExpiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },

    // Payment
    payment: {
      method: { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      transactionId: String,
      paidAt: Date,
    },

    // Earnings snapshot — set on completion, immutable after
    earnings: {
      workerPaise:    Number,
      platformPaise:  Number,
      commissionRate: Number,
      settledAt:      Date,
    },

    // Ratings (post-completion)
    userRating: { type: Number, min: 1, max: 5 },
    workerRating: { type: Number, min: 1, max: 5 },

    // Proof-of-work photos uploaded by worker at job completion
    completionPhotos: [{ type: String }],

    // Promo/coupon applied at checkout
    promoCode:     { type: String, default: null },
    discountPaise: { type: Number, default: 0 },

    // OTP for verifying worker at site (prevents impersonation)
    otp: { type: String, select: false },

    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
  },
  { timestamps: true }
);

orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ workerId: 1, status: 1 });
orderSchema.index({ 'dispatch.currentOfferWorkerId': 1 }, { sparse: true });

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = ORDER_STATUSES;
