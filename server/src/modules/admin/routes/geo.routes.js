const express = require('express');
const ctrl = require('../controllers/geo.controller');

const router = express.Router();

router.get('/heatmap', ctrl.getHeatmap);
router.get('/geo-analytics', ctrl.getGeoAnalytics);
router.get('/demand-patterns', ctrl.getDemandPatterns);

module.exports = router;
