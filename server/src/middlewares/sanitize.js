/**
 * Sanitize request inputs against NoSQL operator injection.
 *
 * Without this, a JSON body like { "phone": { "$gt": "" } } can turn
 * User.findOne({ phone }) into a "find any user" query.
 *
 * We strip keys starting with '$' and keys containing '.' (dotted path traversal)
 * from body, query, and params. This is safer than replacing the characters —
 * legitimate client code never sends these keys.
 */

const FORBIDDEN_KEY = /^\$|\./;

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEY.test(k)) continue;
    out[k] = v && typeof v === 'object' ? sanitize(v) : v;
  }
  return out;
}

function sanitizeMiddleware(req, res, next) {
  if (req.body) req.body = sanitize(req.body);
  // Note: req.query is a getter in Express 5 — mutate in place
  if (req.query) {
    for (const k of Object.keys(req.query)) {
      if (FORBIDDEN_KEY.test(k)) delete req.query[k];
    }
  }
  if (req.params) {
    for (const k of Object.keys(req.params)) {
      if (FORBIDDEN_KEY.test(k)) delete req.params[k];
    }
  }
  next();
}

module.exports = { sanitize, sanitizeMiddleware };
