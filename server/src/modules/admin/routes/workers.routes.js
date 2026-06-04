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
router.get('/kyc/change-requests', ctrl.listChangeRequests);
router.post(
  '/workers/:id/kyc/change-request/respond',
  validate(Joi.object({
    decision:     Joi.string().valid('approved', 'denied').required(),
    denialReason: Joi.string().max(300).optional().allow(''),
  })),
  ctrl.respondChangeRequest,
);
router.get('/workers/:id/kyc/docs', ctrl.kycDocUrls);
// Streaming proxy — serves KYC images directly from S3 with no URL expiry
router.get('/workers/:id/kyc/stream/:docType', ctrl.kycStreamDoc);
router.post(
  '/workers/:id/kyc/clarify',
  validate(Joi.object({ message: Joi.string().min(5).max(500).required() })),
  ctrl.kycRequestClarification,
);
router.get('/workers/:id/penalties', ctrl.getWorkerPenaltyStats);
router.delete(
  '/workers/:id',
  validate(Joi.object({ reason: Joi.string().min(3).max(500).required() })),
  ctrl.deleteWorker,
);

module.exports = router;
