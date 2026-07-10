'use strict';

const { Router } = require('express');
const { authenticate } = require('../../middlewares/auth');
const ctrl = require('./maps.controller');

const router = Router();

// All maps endpoints require a valid user or worker JWT.
// This keeps the Google Maps API key off the client bundle for server-side
// calls, and rate-limits requests to authenticated sessions only.
router.use(authenticate);

router.get('/reverse-geocode', ctrl.reverseGeocode);
router.get('/geocode',         ctrl.geocode);
router.get('/route',           ctrl.getRoute);
router.get('/eta',             ctrl.getEta);
router.get('/autocomplete',    ctrl.autocomplete);
router.get('/place',           ctrl.placeDetail);
router.get('/static',          ctrl.staticMap);

module.exports = router;
