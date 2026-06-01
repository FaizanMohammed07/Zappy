/**
 * Vehicle Profile — Save your vehicles once, use everywhere
 * Customer saves vehicle registration, make, model, year, fuel type.
 * Every booking auto-fills. No repeated entry. Service history per vehicle.
 *
 * All competitors (GoMechanic, Doorstep washers) require re-entering vehicle
 * details every booking. We save them permanently with full history.
 */
const mongoose = require('mongoose');

const vehicleProfileSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  /* Identity */
  nickname:     { type: String, maxlength: 50 },  // e.g. "My White Activa"
  registrationNo: { type: String, maxlength: 20 }, // e.g. "KA01AB1234"
  vehicleType:  { type: String, enum: ['bike', 'scooter', 'car', 'suv', 'ev'], required: true },

  /* Make & Model */
  make:         { type: String, maxlength: 50 },   // e.g. "Honda"
  model:        { type: String, maxlength: 80 },   // e.g. "Activa 6G"
  year:         { type: Number, min: 1990, max: 2030 },
  color:        { type: String, maxlength: 30 },

  /* Fuel / powertrain */
  fuelType:     { type: String, enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid'], default: 'petrol' },
  engineCC:     Number,

  /* Insurance */
  insuranceCompany:  String,
  insurancePolicyNo: String,
  insuranceExpiresAt: Date,

  /* Service history linkage */
  totalServices: { type: Number, default: 0 },
  lastServiceAt:  Date,
  orderHistory:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

  isDefault:    { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

vehicleProfileSchema.index({ userId: 1, isActive: 1 });
/* Prevent duplicate registration plate per user. Sparse so vehicles without a plate can coexist. */
vehicleProfileSchema.index({ userId: 1, registrationNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('VehicleProfile', vehicleProfileSchema);
