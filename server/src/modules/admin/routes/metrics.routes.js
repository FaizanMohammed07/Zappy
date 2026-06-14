const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/metrics.controller');

const router = express.Router();

router.get('/revenue', ctrl.getRevenue);
router.get('/metrics', ctrl.getMetrics);
router.get('/analytics', ctrl.getAnalytics);
router.get('/otp-analytics', ctrl.getOtpAnalytics);

module.exports = router;
