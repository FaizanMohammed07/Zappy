const Joi = require('joi');
const verticalService = require('./vertical-config.service');

const VERTICALS = ['mobile', 'laptop', 'smart_device', 'vehicle', 'family_assist', 'event_crew', 'pet', 'construction'];

async function getAll(req, res, next) {
  try {
    const configs = await verticalService.getAll();
    res.json({ configs });
  } catch (err) { next(err); }
}

async function getVertical(req, res, next) {
  try {
    const { vertical } = req.params;
    if (!VERTICALS.includes(vertical)) return res.status(400).json({ error: 'Invalid vertical' });
    const config = await verticalService.getConfig(vertical);
    res.json({ vertical, config });
  } catch (err) { next(err); }
}

async function updateVertical(req, res, next) {
  try {
    const { vertical } = req.params;
    if (!VERTICALS.includes(vertical)) return res.status(400).json({ error: 'Invalid vertical' });

    const schemas = {
      mobile: Joi.object({
        inspectionFeePaise:   Joi.number().integer().min(0),
        urgentSurchargePaise: Joi.number().integer().min(0),
        warrantyDays:         Joi.number().integer().min(0).max(365),
      }).min(1),
      laptop: Joi.object({
        visitFeePaise:      Joi.number().integer().min(0),
        diagnosticFeePaise: Joi.number().integer().min(0),
        urgentSurchargePct: Joi.number().min(0).max(100),
        warrantyDays:       Joi.number().integer().min(0).max(365),
      }).min(1),
      smart_device: Joi.object({
        visitFeePaise:      Joi.number().integer().min(0),
        urgentSurchargePct: Joi.number().min(0).max(100),
      }).min(1),
      construction: Joi.object({
        visitFeePaise:      Joi.number().integer().min(0),
        perHourFeePaise:    Joi.number().integer().min(0),
        materialMarkupPct:  Joi.number().min(0).max(100),
        urgentSurchargePct: Joi.number().min(0).max(100),
      }).min(1),
      vehicle: Joi.object({
        baseVisitFeePaise:       Joi.number().integer().min(0),
        perKmFeePaise:           Joi.number().integer().min(0),
        emergencySurchargePaise: Joi.number().integer().min(0),
        nightSurchargePaise:     Joi.number().integer().min(0),
        nightStartHour:          Joi.number().integer().min(0).max(23),
        nightEndHour:            Joi.number().integer().min(0).max(23),
      }).min(1),
      family_assist: Joi.object({
        baseFeePaise:       Joi.number().integer().min(0),
        emergencyFeePaise:  Joi.number().integer().min(0),
        companionHourPaise: Joi.number().integer().min(0),
      }).min(1),
      event_crew: Joi.object({
        perHourFeePaise:    Joi.number().integer().min(0),
        urgentSurchargePct: Joi.number().min(0).max(100),
        minHours:           Joi.number().min(1).max(24),
      }).min(1),
      pet: Joi.object({
        visitFeePaise:     Joi.number().integer().min(0),
        emergencyFeePaise: Joi.number().integer().min(0),
      }).min(1),
    };

    const { error, value } = schemas[vertical].validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updated = await verticalService.updateConfig(vertical, value, req.auth.sub);
    res.json({ vertical, config: updated[vertical] });
  } catch (err) { next(err); }
}

async function addSparePart(req, res, next) {
  try {
    const schema = Joi.object({
      brand:     Joi.string().valid('Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Others').required(),
      service:   Joi.string().valid('screen_replacement', 'battery_replacement', 'charging_issue', 'speaker_mic_issue', 'software_issue', 'water_damage_check').required(),
      model:     Joi.string().default('all'),
      costPaise: Joi.number().integer().min(0).required(),
      isActive:  Joi.boolean().default(true),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const doc = await verticalService.addSparePart(value, req.auth.sub);
    res.json({ config: doc.mobile });
  } catch (err) { next(err); }
}

async function removeSparePart(req, res, next) {
  try {
    const doc = await verticalService.removeSparePart(req.params.sparePartId, req.auth.sub);
    res.json({ config: doc.mobile });
  } catch (err) { next(err); }
}

async function updateSparePart(req, res, next) {
  try {
    const schema = Joi.object({
      costPaise: Joi.number().integer().min(0),
      isActive:  Joi.boolean(),
      model:     Joi.string(),
    }).min(1);
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const doc = await verticalService.updateSparePart(req.params.sparePartId, value, req.auth.sub);
    res.json({ config: doc.mobile });
  } catch (err) { next(err); }
}

module.exports = { getAll, getVertical, updateVertical, addSparePart, removeSparePart, updateSparePart };
