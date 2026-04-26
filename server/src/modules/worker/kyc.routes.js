const express = require('express');
const Joi = require('joi');
const ctrl = require('./kyc.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

const kycSubmitSchema = Joi.object({
  aadhaarUrl: Joi.string().required(),
  licenseUrl: Joi.string().optional(),
  selfieUrl: Joi.string().required(),
});

router.post('/submit', authenticate, requireRole('worker'), validate(kycSubmitSchema), ctrl.submitKyc);
router.get('/status', authenticate, requireRole('worker'), ctrl.getKycStatus);

module.exports = router;
