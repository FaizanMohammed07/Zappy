const express = require('express');
const ctrl = require('../controllers/audit.controller');

const router = express.Router();

router.get('/audit-logs', ctrl.getAuditLogs);

module.exports = router;
