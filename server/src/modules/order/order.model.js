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
      enum: [
        // Electronics — Mobile Phones
        'screen_replacement', 'battery_replacement', 'charging_issue',
        'speaker_mic_issue', 'microphone_issue', 'software_issue',
        'water_damage', 'camera_issue', 'data_recovery', 'device_not_turning_on',
        // Electronics — Laptops
        'laptop_slow', 'laptop_ssd_upgrade', 'laptop_ram_upgrade',
        'laptop_keyboard_issue', 'laptop_motherboard_issue', 'laptop_charging_issue',
        'laptop_screen_issue', 'laptop_virus_removal', 'laptop_data_recovery',
        // Electronics — Smart Devices
        'smart_tv_install', 'smart_tv_repair', 'router_setup', 'router_troubleshoot',
        'cctv_install', 'cctv_repair', 'smart_lock_install', 'home_automation_setup',
        // Vehicle Care — Bike
        'puncture', 'bike_chain_issue', 'bike_brake_issue', 'bike_battery_issue',
        'bike_wash', 'bike_breakdown', 'bike_service',
        // Vehicle Care — Car
        'car_wash', 'car_detailing', 'battery_jump_start', 'car_puncture',
        'car_breakdown', 'fuel_delivery', 'car_service',
        // Vehicle Care — Commercial
        'commercial_emergency', 'commercial_scheduled_maintenance', 'fleet_support',
        'auto_repair', 'van_repair',
        // Family Assist
        'medicine_pickup', 'hospital_companion', 'grocery_assistance',
        'bill_payment_assist', 'document_submission', 'home_visit_check',
        // Elder Assist
        'elder_doctor_visit', 'elder_companion', 'elder_home_visit', 'elder_transport',
        // Event Crew
        'event_decorator', 'event_setup_crew', 'event_cleaning_crew',
        'event_helper', 'event_sound_crew', 'event_lighting_crew',
        'event_security_crew', 'event_birthday_setup', 'event_wedding_setup',
        'event_photography_assist', 'event_catering_assist',
        // Pet Assistance
        'pet_grooming', 'pet_walking', 'pet_transport',
        'pet_sitting', 'pet_vet_assist', 'pet_training_assist',
      ],
    },
    subCategory: { type: String, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    images: [{ type: String }], // S3 URLs, max 5
    scheduledAt: { type: Date, default: null, index: true }, // null = book now

    // Mobile phone service extras
    deviceBrand: { type: String, enum: ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Others'] },
    deviceModel: { type: String, maxlength: 100 },
    serviceMode: { type: String, enum: ['doorstep', 'pickup'], default: 'doorstep' },

    // Vehicle service extras
    vehicleType: { type: String, enum: ['bike', 'scooter', 'car'] },

    // Construction extras
    pricingModel: { type: String, enum: ['standard', 'hourly', 'project'], default: 'standard' },
    estimatedHours: { type: Number, min: 0.5, max: 48 }, // for hourly jobs

    // Priority — emergency mode surfaces the order first + applies a surcharge
    priority: {
      type: String,
      enum: ['normal', 'emergency'],
      default: 'normal',
      index: true,
    },

    // Booking tier — determines dispatch speed and price multiplier
    tier: {
      type: String,
      enum: ['standard', 'priority', 'express'],
      default: 'standard',
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
      tierMultiplier:  { type: Number, default: 1 },  // tier price factor applied at booking
      subtotal: Number,
      total: Number,
      totalPaise: Number,           // precise paise value for revenue aggregation
      tipPaise: Number,             // tip/boost amount in paise (100% to worker)
      boostedTotal: Number,         // total + tip in rupees (what worker sees)
      subtotalBeforeDiscount: Number, // pre-coupon total (for platform cost analytics)
      discountPaise: Number,          // coupon discount in paise (platform absorbs this)
      currency: { type: String, default: 'INR' },
      snapshotCommissionRate: Number, // commission rate locked at creation — used at settlement
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
      attemptedWorkerIds:    { type: [mongoose.Schema.Types.ObjectId], default: [] },
      currentOfferWorkerId:  { type: mongoose.Schema.Types.ObjectId, default: null },
      // Full batch of workers currently holding the offer (broadcast model).
      // Needed so all notified workers can pass socket auth and call accept/reject.
      currentOfferWorkerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      offerExpiresAt:        { type: Date, default: null },
      attempts:              { type: Number, default: 0 },
    },

    // Payment
    payment: {
      method: { type: String, enum: ['cash', 'upi', 'card'], default: 'upi' },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
      transactionId: String,
      paidAt: Date,
      reconciliationRequired: { type: Boolean, default: false, index: true }, // needs manual ops review
    },

    // Earnings snapshot — set on completion, immutable after
    earnings: {
      workerPaise:    Number,
      platformPaise:  Number,
      commissionRate: Number,
      settledAt:      Date,
    },

    // Ratings (post-completion) — immutable once ratingSubmittedAt is set (#87/#88)
    userRating:         { type: Number, min: 1, max: 5 },
    workerRating:       { type: Number, min: 1, max: 5 },
    ratingSubmittedAt:  Date,   // set when user rates; prevents re-rating via direct DB access

    // Proof-of-work photos uploaded by worker at job completion
    completionPhotos: [{ type: String }],

    // Promo/coupon applied at checkout
    promoCode:     { type: String, default: null },
    discountPaise: { type: Number, default: 0 },

    // OTP for verifying worker at site (prevents impersonation)
    otp: { type: String, select: false },

    // Team / multi-worker bookings (event crew, fleet jobs)
    teamSize:          { type: Number, min: 1, max: 20, default: 1 },
    workerIds:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }],

    // Trip timing — set when worker starts journey (on_the_way transition)
    tripStartedAt:   { type: Date, default: null },
    tripEtaMinutes:  { type: Number, default: null }, // computed ETA in minutes
    tripDeadlineAt:  { type: Date, default: null },   // tripStartedAt + tripEtaMinutes
    tripArrivedAt:   { type: Date, default: null },   // when arrived was marked
    tripLateMinutes: { type: Number, default: null }, // minutes overdue (null = on time)

    // Penalty — deducted from worker earnings if late
    lateArrivalPenaltyPaise: { type: Number, default: 0 },

    // Diagnosis answers collected at booking time
    diagnosisAnswers: { type: mongoose.Schema.Types.Mixed, default: null },
    diagnosisUrgency: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    requiredTools:    [{ type: String }],

    // Digital checklist completion (Feature 3)
    checklistCompletedIds: [{ type: String }],
    checklistValid:        { type: Boolean, default: false },

    // Multi-room/unit metadata (Feature 6)
    roomCount:     { type: Number, default: 1 },
    unitDetails:   { type: String, maxlength: 200 },

    // Live service photos streamed to customer in real-time during service
    servicePhotos: [{
      url:     { type: String, required: true },
      phase:   { type: String, enum: ['before', 'during', 'after', 'issue', 'material'], default: 'during' },
      caption: { type: String, maxlength: 200 },
      takenAt: { type: Date, default: Date.now },
    }],

    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,

    // Deferred cancellation fee from a previous order — shown as line item at checkout
    pendingCancellationFeePaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ workerId: 1, status: 1 });
orderSchema.index({ 'dispatch.currentOfferWorkerId': 1 }, { sparse: true });

// ── Scaling indexes added for 1K–10K concurrent order handling ────────────
// Admin analytics: service breakdown queries (scenario #62)
orderSchema.index({ service: 1, status: 1 });
// Revenue aggregation on completedAt (used in getMetrics / getRevenue)
orderSchema.index({ status: 1, completedAt: -1 });
// Scheduled order dispatch (background job scans for due orders)
orderSchema.index({ scheduledAt: 1, status: 1 }, { sparse: true });
// Stale-order watchdog: status + updatedAt scan
orderSchema.index({ status: 1, updatedAt: 1 });

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = ORDER_STATUSES;
