const mongoose = require('mongoose');

const savedCardSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:     { type: String, enum: ['card', 'upi', 'netbanking'], required: true },
  isDefault: { type: Boolean, default: false },
  // Card fields
  last4:    String,
  network:  { type: String, enum: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners', 'Unknown'] },
  cardName: String,
  expiryMM: Number,
  expiryYY: Number,
  // UPI fields
  upiId:      String,
  upiProvider: String,
  // Gateway-issued instrument reference (never expose raw card numbers)
  vaultId:    String,
}, { timestamps: true });

savedCardSchema.index({ userId: 1, isDefault: -1 });

module.exports = mongoose.model('SavedCard', savedCardSchema);
