const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options:  { type: [String], required: true },
  correct:  { type: Number, required: true }, // 0-indexed
}, { _id: false });

const trainingModuleSchema = new mongoose.Schema(
  {
    title:        { type: String, required: true, trim: true },
    description:  { type: String, required: true },
    category:     { type: String, required: true }, // service category
    difficulty:   { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    durationMin:  { type: Number, default: 15 },
    videoUrl:     { type: String, default: null },
    thumbnail:    { type: String, default: null },
    quiz:         [quizQuestionSchema],
    passingScore: { type: Number, default: 70 }, // percent
    unlockService:{ type: String, default: null }, // service slug unlocked on completion
    xpReward:     { type: Number, default: 50 },
    bonusRupees:  { type: Number, default: 0 },   // one-time cash bonus
    isActive:     { type: Boolean, default: true, index: true },
    order:        { type: Number, default: 0 },   // display ordering
  },
  { timestamps: true }
);

module.exports = mongoose.model('TrainingModule', trainingModuleSchema);
