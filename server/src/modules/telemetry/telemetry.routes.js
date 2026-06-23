const express = require('express');
const ctrl = require('./telemetry.controller');
const { telemetryLimiter } = require('../../middlewares/rateLimit');

/**
 * Public, unauthenticated analytics ingest. Designed for navigator.sendBeacon /
 * fetch keepalive. Every handler responds immediately (204/202) and does its
 * work fire-and-forget, so it never adds latency to the user's page.
 */
const router = express.Router();

router.use(telemetryLimiter);

router.post('/pageview', ctrl.pageview);
router.post('/heartbeat', ctrl.heartbeat);
router.post('/search', ctrl.search);

module.exports = router;
