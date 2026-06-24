const express = require('express');
const ctrl = require('../controllers/intelligence.controller');

// Intelligence & Expansion dashboard — live traffic, demand, unmet demand,
// city expansion score, CEO pulse. All read-only, admin-auth via parent router.
const router = express.Router();

router.get('/intelligence/live-traffic', ctrl.liveTraffic);
router.get('/intelligence/demand',       ctrl.demandIntel);
router.get('/intelligence/unmet-demand', ctrl.unmetDemand);
router.get('/intelligence/expansion',    ctrl.expansionEngine);
router.get('/intelligence/ceo',          ctrl.ceoPulse);

module.exports = router;
