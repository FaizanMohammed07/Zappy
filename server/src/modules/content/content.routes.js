const express = require('express');
const ctrl = require('./content.controller');

// Public, read-only help content. No auth — FAQ/policies are public.
const router = express.Router();

router.get('/faqs', ctrl.getFaqs);            // ?audience=user|worker
router.get('/policies', ctrl.listPolicies);   // list slugs+titles
router.get('/policy/:slug', ctrl.getPolicy);  // single policy page

module.exports = router;
