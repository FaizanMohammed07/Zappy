const express = require('express');
const Joi = require('joi');
const ctrl = require('./upload.controller');
const { authenticate } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const router = express.Router();

router.post(
  '/presign',
  authenticate,
  validate(Joi.object({
    folder: Joi.string().valid('kyc', 'profile', 'order-proof').required(),
    contentType: Joi.string().required(),
  })),
  ctrl.presign
);

router.get('/download/:key(*)', authenticate, ctrl.download);

module.exports = router;
