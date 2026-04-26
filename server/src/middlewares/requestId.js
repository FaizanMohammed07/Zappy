const crypto = require('crypto');

/**
 * Assigns a unique request ID to each inbound request and propagates it
 * via res.setHeader + req.id. Used by the logger for correlation across
 * nested service calls and async workers.
 */
function requestIdMiddleware(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[a-zA-Z0-9-]{1,64}$/.test(incoming)
    ? incoming
    : crypto.randomBytes(8).toString('hex');
  res.setHeader('x-request-id', req.id);
  next();
}

module.exports = { requestIdMiddleware };
