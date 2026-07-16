/**
 * Allowed browser origins — SINGLE SOURCE OF TRUTH.
 *
 * Express CORS (app.js) and socket.io (sockets/index.js) MUST allow the same
 * hosts. They used to be two hand-maintained arrays and they drifted: the
 * rakshak/events subdomains were added to Express but not to socket.io, so on
 * rakshak.zappyone.com the REST API worked while every socket connection was
 * rejected — workers silently got no job-offer popups, no live tracking, no chat.
 *
 * Anything that serves the SPA must be listed here.
 */

const PRODUCTION_ORIGINS = [
  'https://zappyone.com',           // consumer (apex)
  'https://www.zappyone.com',       // consumer (www)
  'https://rakshak.zappyone.com',   // worker app
  'https://events.zappyone.com',    // event partner portal
];

/**
 * Origins allowed in production. `CLIENT_URL` (staging/preview) is appended when
 * set. In non-production we allow everything so localhost:5173 and LAN/device
 * testing work without config.
 */
function allowedOrigins() {
  const list = [...PRODUCTION_ORIGINS];
  if (process.env.CLIENT_URL && !list.includes(process.env.CLIENT_URL)) {
    list.push(process.env.CLIENT_URL);
  }
  return list;
}

/** Value for `cors({ origin })` / socket.io `cors.origin`. */
function corsOrigin() {
  return process.env.NODE_ENV === 'production' ? allowedOrigins() : true;
}

/** socket.io rejects `true`, so it needs an explicit list (or '*' in dev). */
function socketCorsOrigin() {
  return process.env.NODE_ENV === 'production' ? allowedOrigins() : '*';
}

module.exports = { PRODUCTION_ORIGINS, allowedOrigins, corsOrigin, socketCorsOrigin };
