const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  // Indexed below as a unique index (one tip per order) — no field-level
  // `index: true` here, which would create a duplicate {orderId:1} index.
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
  workerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
  amountPaise: { type: Number, required: true, min: 100 },  // ₹1 minimum
  voiceNoteUrl: { type: String, default: null },            // S3 URL to .webm/.mp3
  message:     { type: String, maxlength: 200, default: null }, // optional text
  paidAt:      { type: Date,   default: Date.now },
  status:      { type: String, enum: ['pending', 'credited', 'failed'], default: 'pending' },
}, { timestamps: true });

tipSchema.index({ orderId: 1 }, { unique: true }); // one tip per order

module.exports = mongoose.model('Tip', tipSchema);
