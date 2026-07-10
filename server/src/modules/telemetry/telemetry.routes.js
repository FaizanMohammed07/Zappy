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

// Beacons are sent as text/plain (a CORS-simple request) so navigator.sendBeacon
// works cross-origin WITHOUT a preflight — an application/json beacon would be
// silently dropped between the Vercel frontend and the EC2 API. Parse the raw
// text body as JSON here (the global express.json() only handles application/json).
router.use(express.json({ type: () => true, limit: '16kb' }));

router.post('/pageview', ctrl.pageview);
router.post('/heartbeat', ctrl.heartbeat);
router.post('/search', ctrl.search);
router.post('/client-error', ctrl.clientError);

module.exports = router;
