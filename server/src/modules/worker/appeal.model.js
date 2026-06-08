const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const appealSchema = new mongoose.Schema(
  {
    workerId:   { type: ObjectId, ref: 'Worker', required: true, index: true },
    type:       { type: String, enum: ['rating', 'penalty', 'cancellation', 'order_issue'], required: true },
    orderId:    { type: ObjectId, ref: 'Order', default: null },
    subject:    { type: String, required: true, maxlength: 200 },
    description:{ type: String, required: true, maxlength: 2000 },
    status:     { type: String, enum: ['pending', 'under_review', 'upheld', 'dismissed'], default: 'pending', index: true },
    // Resolution
    adminNote:  { type: String, maxlength: 1000 },
    resolvedBy: { type: ObjectId, ref: 'Admin', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appealSchema.index({ workerId: 1, createdAt: -1 });

module.exports = mongoose.model('WorkerAppeal', appealSchema);
