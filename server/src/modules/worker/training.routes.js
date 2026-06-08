const express = require('express');
const ctrl = require('./training.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');

const router = express.Router();

router.get('/', authenticate, requireRole('worker'), ctrl.listModules);
router.get('/:id', authenticate, requireRole('worker'), ctrl.getModule);
router.post('/:id/submit', authenticate, requireRole('worker'), ctrl.submitQuiz);

const adminRouter = express.Router();
adminRouter.use(authenticate, requireRole('admin'));
adminRouter.get('/', ctrl.adminListModules);
adminRouter.post('/', ctrl.adminCreateModule);
adminRouter.patch('/:id', ctrl.adminUpdateModule);

module.exports = router;
module.exports.adminRouter = adminRouter;
