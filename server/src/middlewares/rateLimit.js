const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { redis } = require('../config/redis');

function makeLimiter({ windowMs, max, prefix }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `rl:${prefix}:`,
    }),
    message: { error: 'Too many requests, please try again later' },
  });
}

const globalLimiter = makeLimiter({ windowMs: 60_000, max: 300, prefix: 'g' });
const authLimiter = makeLimiter({ windowMs: 60_000, max: 10, prefix: 'auth' });
const orderLimiter = makeLimiter({ windowMs: 60_000, max: 30, prefix: 'order' });

module.exports = { globalLimiter, authLimiter, orderLimiter };
