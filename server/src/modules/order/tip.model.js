const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  orderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
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
