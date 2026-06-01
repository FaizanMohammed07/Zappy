const express = require('express');
const ctrl = require('./vertical-config.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.getAll);
router.get('/:vertical', ctrl.getVertical);
router.put('/:vertical', ctrl.updateVertical);

// Mobile spare parts
router.post('/mobile/spare-parts', ctrl.addSparePart);
router.patch('/mobile/spare-parts/:sparePartId', ctrl.updateSparePart);
router.delete('/mobile/spare-parts/:sparePartId', ctrl.removeSparePart);

module.exports = router;
