const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { redis } = require('../config/redis');

function makeLimiter({ windowMs, max, prefix, skipFailedRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `rl:${prefix}:`,
    }),
    // Fail-open (#92): if Redis is down, the store throws. Express-rate-limit
    // will propagate the error to the error handler. Instead, skip the limiter
    // entirely — it's safer to allow a request than to block all traffic.
    skip: async () => {
      if (redis.status !== 'ready') return true; // Redis reconnecting — skip limiter
      return false;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests — please slow down',
        retryAfterMs: Math.ceil(req.rateLimit.resetTime - Date.now()),
      });
    },
  });
}

// ── Global: 200 req / 15s per IP ────────────────────────────────────────────
// Tighter window (15s vs 60s) means a viral spike hits the limiter faster
// without punishing normal users who spread 300 req over a full minute. (#63)
// 200/15s per IP — dashboard fires 6-8 concurrent RTK queries on mount, refetches on focus
const globalLimiter   = makeLimiter({ windowMs: 15_000,     max: 200, prefix: 'g'      });

// ── Auth: 20 req / min — OTP dev testing fires frequently ───────────────────
const authLimiter     = makeLimiter({ windowMs: 60_000,     max: 20,  prefix: 'auth'   });

// ── OTP per-phone: 5 send requests per hour (enforced in service layer via Redis INCR)
// This IP-level limiter is an extra defence layer — prevents a single IP from
// cycling through many phone numbers. 20 phones/hr per IP is reasonable.
const otpPhoneLimiter = makeLimiter({ windowMs: 3_600_000,  max: 20,  prefix: 'otpip'  });

// ── Admin auth: 3 attempts per 15 min per IP (#79) ──────────────────────────
// Much stricter than the general authLimiter. Brute-forcing admin credentials
// must be economically infeasible — each wrong password costs 5 min of lockout.
const adminAuthLimiter = makeLimiter({ windowMs: 900_000,   max: 3,   prefix: 'adm'   });

// ── Orders: 10 / min per IP (down from 30) ─────────────────────────────────
// A legitimate user places at most 1–2 orders per minute.
// This blocks carpet-bombing bots during a viral spike. (#63)
const orderLimiter    = makeLimiter({ windowMs: 60_000,     max: 10,  prefix: 'order'  });

// ── Worker go-online: 30 / min per IP ───────────────────────────────────────
// 500 workers logging in from different IPs is fine; this blocks a single
// orchestrated login storm from one source. (#65)
const workerOnlineLimiter = makeLimiter({ windowMs: 60_000, max: 30,  prefix: 'wonline' });

// ── Cancel + refund storm: 5 per 10 min (unchanged) ────────────────────────
const cancelLimiter   = makeLimiter({ windowMs: 600_000,    max: 5,   prefix: 'cancel' });

// ── Wallet top-up: 10 per hour (unchanged) ──────────────────────────────────
const topupLimiter    = makeLimiter({ windowMs: 3_600_000,  max: 10,  prefix: 'topup'  });

// ── Rating spam: 20 per hour (unchanged) ────────────────────────────────────
const ratingLimiter   = makeLimiter({ windowMs: 3_600_000,  max: 20,  prefix: 'rating' });

// ── Quote: 20 per 10 min (down from 30) ─────────────────────────────────────
// Each quote may hit Google Maps API. Tighter limit protects quota. (#63)
const quoteLimiter    = makeLimiter({ windowMs: 600_000,    max: 20,  prefix: 'quote'  });

// ── Nearby workers: 20 per min (unchanged) ──────────────────────────────────
const nearbyLimiter   = makeLimiter({ windowMs: 60_000,     max: 20,  prefix: 'nearby' });

// ── Dispute opening: 5 per hour (unchanged) ─────────────────────────────────
const disputeLimiter  = makeLimiter({ windowMs: 3_600_000,  max: 5,   prefix: 'dispute'});

module.exports = {
  globalLimiter, authLimiter, adminAuthLimiter, otpPhoneLimiter, orderLimiter, workerOnlineLimiter,
  cancelLimiter, topupLimiter, ratingLimiter,
  quoteLimiter, nearbyLimiter, disputeLimiter,
};
