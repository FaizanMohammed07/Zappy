const Worker = require('../../worker/worker.model');
const Order = require('../../order/order.model');
const { redis } = require('../../../config/redis');
const auditService = require('../audit.service');

async function getSystemHealth(req, res, next) {
  try {
    const { redis: redisClient } = require('../../../config/redis');
    const {
      dispatchQueue,
      notificationsQueue,
      paymentsQueue,
    } = require('../../../jobs/index');
    const mongoose = require('mongoose');

    const [redisPing, dispatchCounts, notifCounts, paymentCounts] =
      await Promise.all([
        redisClient
          .ping()
          .then((r) => r === 'PONG')
          .catch(() => false),
        dispatchQueue
          .getJobCounts('waiting', 'active', 'failed', 'delayed')
          .catch(() => ({})),
        notificationsQueue
          .getJobCounts('waiting', 'active', 'failed', 'delayed')
          .catch(() => ({})),
        paymentsQueue
          .getJobCounts('waiting', 'active', 'failed', 'delayed')
          .catch(() => ({})),
      ]);

    const mongoState = mongoose.connection.readyState;
    const mem = process.memoryUsage();

    res.json({
      uptime: Math.round(process.uptime()),
      redis: { ok: redisPing },
      mongo: { ok: mongoState === 1 },
      queues: {
        dispatch: dispatchCounts,
        notifications: notifCounts,
        payments: paymentCounts,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

const FLAG_KEY = 'admin:feature-flags';
const DEFAULT_FLAGS = {
  surge_pricing: true,
  promo_codes: true,
  gamification: true,
  ads: true,
  chat: true,
  live_tracking: true,
  worker_ratings: true,
  cashback: true,
  referrals: true,
  notifications: true,
};

async function getFeatureFlags(req, res, next) {
  try {
    const raw = await redis.get(FLAG_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    res.json({ flags: { ...DEFAULT_FLAGS, ...saved } });
  } catch (err) {
    next(err);
  }
}

async function setFeatureFlag(req, res, next) {
  try {
    const { flag, enabled } = req.body;
    if (!(flag in DEFAULT_FLAGS))
      return res.status(400).json({ error: 'Unknown flag' });
    const raw = await redis.get(FLAG_KEY);
    const flags = { ...DEFAULT_FLAGS, ...(raw ? JSON.parse(raw) : {}) };
    flags[flag] = Boolean(enabled);
    await redis.set(FLAG_KEY, JSON.stringify(flags), 'EX', 86400);
    await auditService.fromRequest(
      req,
      'admin.feature_flag_update',
      { kind: 'system', id: null },
      null,
      { flag, enabled },
    );
    res.json({ flags });
  } catch (err) {
    next(err);
  }
}

async function getAlerts(req, res, next) {
  try {
    const now = new Date();
    const last1h = new Date(now - 3_600_000);

    const [
      onlineWorkers,
      activeOrders,
      recentCancels,
      recentCompleted,
      failedOrders,
      longSearching,
    ] = await Promise.all([
      Worker.countDocuments({ isOnline: true }),
      Order.countDocuments({
        status: {
          $in: [
            'searching',
            'assigned',
            'on_the_way',
            'arrived',
            'in_progress',
          ],
        },
      }),
      Order.countDocuments({
        status: 'cancelled',
        updatedAt: { $gte: last1h },
      }),
      Order.countDocuments({
        status: 'completed',
        completedAt: { $gte: last1h },
      }),
      Order.countDocuments({ status: 'failed', updatedAt: { $gte: last1h } }),
      Order.countDocuments({
        status: 'searching',
        updatedAt: { $lt: new Date(now - 600_000) },
      }),
    ]);

    const alerts = [];

    if (onlineWorkers === 0 && activeOrders > 0) {
      alerts.push({
        id: 'no_workers',
        severity: 'critical',
        title: 'No Online Workers',
        message: `${activeOrders} active order(s) with no workers online`,
      });
    } else if (onlineWorkers < 3) {
      alerts.push({
        id: 'low_workers',
        severity: 'warning',
        title: 'Low Worker Supply',
        message: `Only ${onlineWorkers} worker(s) currently online`,
      });
    }

    const cancelTotal = recentCancels + recentCompleted;
    if (cancelTotal >= 5 && recentCancels / cancelTotal > 0.3) {
      alerts.push({
        id: 'high_cancel',
        severity: 'warning',
        title: 'High Cancellation Rate',
        message: `${Math.round((recentCancels / cancelTotal) * 100)}% cancel rate in last hour (${recentCancels}/${cancelTotal})`,
      });
    }

    if (failedOrders >= 3) {
      alerts.push({
        id: 'failed_orders',
        severity: 'critical',
        title: 'Dispatch Failures Spike',
        message: `${failedOrders} order(s) failed dispatch in the last hour`,
      });
    }

    if (longSearching > 0) {
      alerts.push({
        id: 'long_search',
        severity: 'warning',
        title: 'Orders Stuck Searching',
        message: `${longSearching} order(s) have been searching for worker >10 minutes`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: 'all_clear',
        severity: 'ok',
        title: 'All Systems Normal',
        message: 'No active alerts — platform is operating normally',
      });
    }

    res.json({
      alerts,
      snapshot: {
        onlineWorkers,
        activeOrders,
        recentCancels,
        recentCompleted,
        failedOrders,
        longSearching,
      },
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSystemHealth, getFeatureFlags, setFeatureFlag, getAlerts };
