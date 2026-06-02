const express = require('express');
const ctrl = require('../controllers/business.controller');

const router = express.Router();

// #83 — Per-service P&L: revenue, worker cost, margin per service
router.get('/business/service-pnl', ctrl.getServicePnL);
// #81 — Worker churn risk: low earners, dormant, high cancel-rate workers
router.get('/business/churn-risk', ctrl.getChurnRisk);
// #84 — Dead categories: active services with 0 orders in N days
router.get('/business/dead-categories', ctrl.getDeadCategories);
// #85 — Geo readiness: worker density + approval status for a city area
router.get('/business/geo-readiness', ctrl.getGeoReadiness);
// #82 — Quote abandonment: price sensitivity proxy via early-exit rates
router.get('/business/quote-abandonment', ctrl.getQuoteAbandonmentStats);

module.exports = router;
