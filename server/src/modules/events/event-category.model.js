const mongoose = require('mongoose');

const eventCategorySchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:        { type: String, required: true },
  description: String,
  coverImage:  String,
  emoji:       { type: String, default: '🎉' },
  sortOrder:   { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
  themeCount:  { type: Number, default: 0 }, // denormalized for fast listing
}, { timestamps: true });

module.exports = mongoose.model('EventCategory', eventCategorySchema);
