const express = require('express');
const ctrl = require('./service.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

const router = express.Router();

// Public catalog
router.get('/services', ctrl.listServices);
router.get('/services/:code', ctrl.getService);
router.get('/invoices/:orderId', authenticate, ctrl.getInvoice);
router.get('/heatmap/worker', authenticate, requireRole('worker'), ctrl.getWorkerHeatmap);

// Admin catalog management
router.get('/admin/services', authenticate, requireRole('admin'), ctrl.adminListServices);
router.put('/admin/services/:code', authenticate, requireRole('admin'), ctrl.adminUpdateService);
// Returns count of active orders for a given service code — used by admin UI before disabling
router.get('/admin/services/:code/active-orders', authenticate, requireRole('admin'), ctrl.adminServiceActiveOrderCount);

module.exports = router;
