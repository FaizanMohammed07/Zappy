const mongoose = require('mongoose');

// Persists user saved themes to MongoDB so Redis flush doesn't wipe saves.
// Redis is still used as the fast path; this is the durable source of truth.
const eventSavedSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  themeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTheme', required: true },
}, { timestamps: true });

eventSavedSchema.index({ userId: 1, themeId: 1 }, { unique: true });
eventSavedSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('EventSaved', eventSavedSchema);
