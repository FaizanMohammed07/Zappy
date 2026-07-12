const express = require('express');
const { verifyToken } = require('../auth/auth.service');
const { makeLimiter } = require('../../middlewares/rateLimit');
const ctrl = require('./search.controller');

const router = express.Router();

// Search is public (guests can search). If a valid bearer token is present we
// attach req.auth so results can be personalised — but a missing/invalid token
// never blocks the request.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) { try { req.auth = verifyToken(token); } catch { /* guest */ } }
  next();
}

// Generous limiter — search runs as-you-type (debounced client-side + cached).
const searchLimiter = makeLimiter({ windowMs: 60_000, max: 150, prefix: 'search' });

router.get('/', searchLimiter, optionalAuth, ctrl.search);
router.get('/suggest', searchLimiter, ctrl.suggest);
router.get('/trending', ctrl.trending);

module.exports = router;
