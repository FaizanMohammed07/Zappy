const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema(
  {
    code:        { type: String, required: true, unique: true, uppercase: true, trim: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type:        { type: String, enum: ['flat', 'percent', 'first_order', 'loyalty'], default: 'flat' },

    discount: {
      value:            { type: Number, required: true }, // paise for flat/first_order; 1-100 for percent
      maxDiscountPaise: { type: Number, default: 0 },    // cap for percent (0 = no cap)
      minOrderPaise:    { type: Number, default: 0 },    // minimum order total
    },

    services: { type: [String], default: [] }, // empty = all services

    limits: {
      totalUses:  { type: Number, default: 0 }, // 0 = unlimited
      perUserUses: { type: Number, default: 1 },
      usedCount:  { type: Number, default: 0 },
    },

    validity: {
      startAt: { type: Date, required: true },
      endAt:   { type: Date, required: true },
    },

    isActive:  { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Promo', promoSchema);

// Per-user usage tracking
const promoUsageSchema = new mongoose.Schema(
  {
    code:          { type: String, required: true, index: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    discountPaise: { type: Number, required: true },
  },
  { timestamps: true }
);
promoUsageSchema.index({ code: 1, userId: 1 });

module.exports.PromoUsage = mongoose.model('PromoUsage', promoUsageSchema);
