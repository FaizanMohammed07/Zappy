const express = require('express');
const Joi = require('joi');
const { validate } = require('../../../middlewares/validate');
const ctrl = require('../controllers/workers.controller');

const router = express.Router();

router.get('/workers', ctrl.listWorkers);
router.post(
  '/workers/:id/block',
  validate(Joi.object({ blocked: Joi.boolean().required() })),
  ctrl.blockWorker,
);
router.post('/workers/:id/kyc/approve', ctrl.approveKyc);
router.post(
  '/workers/:id/kyc/reject',
  validate(Joi.object({ reason: Joi.string().min(3).max(500).required() })),
  ctrl.rejectKyc,
);
router.get('/kyc/pending', ctrl.listKycPending);
router.get('/workers/:id/penalties', ctrl.getWorkerPenaltyStats);

module.exports = router;
