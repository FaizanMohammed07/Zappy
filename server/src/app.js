const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { globalLimiter } = require("./middlewares/rateLimit");
const { errorHandler, notFound } = require("./middlewares/error");
const { sanitizeMiddleware } = require("./middlewares/sanitize");
const { requestIdMiddleware } = require("./middlewares/requestId");
const mountRoutes = require("./routes");
const paymentRoutes = require("./modules/payment/payment.routes");

function buildApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
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

  app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

  mountRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
