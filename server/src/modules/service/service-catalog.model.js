const mongoose = require('mongoose');

/**
 * Service catalog entries — one per service offering (puncture, plumbing, etc.).
 *
 * Why DB-backed and not a constant?
 *   - Admin can edit checklists/guidelines without code deployment
 *   - Internationalization (each entry can have locale variants — future)
 *   - Pricing ranges shown to user as "₹100-₹300" before booking
 */

const serviceCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    icon: String,
    category: { type: String, enum: ['vehicle', 'home', 'helper', 'beauty', 'mobile', 'construction', 'other'], required: true },

    description: String,
    estimatedDurationMinutes: { type: Number, required: true, default: 30 },

    // Price hints displayed BEFORE the user enters location (post-location they
    // see the actual quote). Keeps expectations in line.
    priceRangeMinPaise: { type: Number, required: true },
    priceRangeMaxPaise: { type: Number, required: true },

    // Checklist the worker must mentally tick (or in future, actually tick in app)
    checklist: [
      {
        item: { type: String, required: true },
        required: { type: Boolean, default: true },
      },
    ],

    // Quality guidelines shown to worker before accepting
    guidelines: [String],

    // Tools/items the worker should bring
    requiredTools: [String],

    // Skills required — must match worker.skills
    requiredSkills: { type: [String], required: true },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceCatalog', serviceCatalogSchema);
