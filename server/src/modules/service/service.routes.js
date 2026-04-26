const express = require('express');
const ctrl = require('./service.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

const router = express.Router();

router.get('/services', ctrl.listServices);
router.get('/services/:code', ctrl.getService);
router.get('/invoices/:orderId', authenticate, ctrl.getInvoice);
router.get('/heatmap/worker', authenticate, requireRole('worker'), ctrl.getWorkerHeatmap);

module.exports = router;
