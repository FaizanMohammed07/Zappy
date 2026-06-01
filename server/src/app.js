const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { globalLimiter } = require("./middlewares/rateLimit");
const { errorHandler, notFound } = require("./middlewares/error");
const { sanitizeMiddleware } = require("./middlewares/sanitize");
const { requestIdMiddleware } = require("./middlewares/requestId");
const { timeoutMiddleware } = require("./middlewares/timeout");
const mountRoutes = require("./routes");
const paymentRoutes = require("./modules/payment/payment.routes");
const { requireMongo } = require("./config/mongo");

function buildApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(cookieParser()); // needed for req.cookies (httpOnly refresh token)
  // ── Helmet with explicit Content-Security-Policy (#77) ──────────────────
  // Tight CSP eliminates most XSS vectors even if an attacker injects script.
  // Each directive is the minimum required for the app to function.
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],                  // no inline scripts, no eval
        styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:         ["'self'", 'data:', 'blob:', 'https://api.mapbox.com', 'https://*.amazonaws.com'],
        connectSrc:     [
          "'self'",
          'wss:',                            // WebSocket (Socket.io)
          'https://api.mapbox.com',
          'https://*.firebaseio.com',
          'https://fcm.googleapis.com',
        ],
        workerSrc:      ["'self'", 'blob:'],         // Mapbox GL worker
        frameSrc:       ["'none'"],                  // no iframes embedding this app
        objectSrc:      ["'none'"],                  // no Flash/plugins
        frameAncestors: ["'none'"],                  // no clickjacking
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy:  { policy: 'strict-origin-when-cross-origin' },
    hsts:            { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));
  const allowedOrigin = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? false : true);
  app.use(cors({ origin: allowedOrigin, credentials: true }));

  // CRITICAL ORDERING:
  // The Razorpay webhook needs the raw request body for HMAC verification.
  // Mount it BEFORE express.json() so the body isn't parsed.
  app.use("/api/payments/webhook", paymentRoutes.webhookRouter);

  app.use(express.json({ limit: "500kb" }));
  app.use(express.urlencoded({ extended: true, limit: "500kb" }));
  app.use(sanitizeMiddleware);
  app.use(morgan("tiny"));
  app.use(globalLimiter);
  app.use(timeoutMiddleware(30_000)); // kill requests hanging >30s

  // Fail fast when MongoDB is disconnected — before routes but after health check (#91)
  // Health check is below this; payment webhook is mounted before express.json() above.

  // Deep health check — returns individual dependency status.
  // Used by load balancers, monitoring, and ops runbooks for disaster scenarios.
  app.get("/health", async (req, res) => {
    const checks = {};
    let isHealthy = true;

    // MongoDB
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.db.command({ ping: 1 });
      checks.mongodb = 'ok';
    } catch (err) {
      checks.mongodb = `error: ${err.message}`;
      isHealthy = false;
    }

    // Redis
    try {
      const { redis } = require('./config/redis');
      await redis.ping();
      checks.redis = 'ok';
    } catch (err) {
      checks.redis = `error: ${err.message}`;
      isHealthy = false;
    }

    // BullMQ (dispatch queue)
    try {
      const { dispatchQueue } = require('./jobs');
      await dispatchQueue.getJobCounts();
      checks.dispatchQueue = 'ok';
    } catch (err) {
      checks.dispatchQueue = `error: ${err.message}`;
      // Queue degradation is non-fatal for HTTP — existing orders survive.
    }

    const status = isHealthy ? 200 : 503;
    res.status(status).json({ ok: isHealthy, ts: Date.now(), checks });
  });

  // Return 503 immediately for all API routes when Mongo is down (#91)
  app.use('/api', requireMongo);

  mountRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
