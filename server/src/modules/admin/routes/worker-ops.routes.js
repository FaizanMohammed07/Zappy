const express = require('express');
const { redis } = require('../../../config/redis');
const Worker = require('../../worker/worker.model');
const cancellationService = require('../../order/cancellation.service');

const router = express.Router();

/**
 * Worker Operations summary — one place for the ops team to see worker-side
 * policy + live signals: single-device, cancellation policy + escalation
 * threshold, and how many workers are cancelling / have been auto-offlined today.
 */
router.get('/worker-ops', async (req, res, next) => {
  try {
    const cfg = await cancellationService.getConfig();
    const limit = cfg.maxDailyWorkerCancels ?? cfg.workerCancelLimit ?? 3;

    // Live cancel-window counters (Redis: worker:cancelwin:<id>, 24h TTL).
    const keys = [];
    const stream = redis.scanStream({ match: 'worker:cancelwin:*', count: 200 });
    for await (const batch of stream) keys.push(...batch);

    let cancelsToday = 0;
    let workersCancellingToday = 0;
    let workersAtLimit = 0;
    if (keys.length) {
      const pipe = redis.pipeline();
      keys.forEach((k) => pipe.get(k));
      const vals = await pipe.exec();
      for (const [, v] of vals) {
        const n = Number(v) || 0;
        if (n > 0) { workersCancellingToday += 1; cancelsToday += n; }
        if (n >= limit) workersAtLimit += 1;
      }
    }

    const [totalWorkers, onlineWorkers, availableWorkers] = await Promise.all([
      Worker.countDocuments({ isBlocked: { $ne: true } }),
      Worker.countDocuments({ isOnline: true }),
      Worker.countDocuments({ isOnline: true, isAvailable: true }),
    ]);

    res.json({
      singleDevice: { enforced: true, hardBlockNewDevice: process.env.WORKER_NEW_DEVICE_BLOCK === 'true' },
      policy: {
        maxDailyWorkerCancels: limit,
        workerCancelWindowHours: Math.round((cfg.workerCancelWindowSec ?? 86400) / 3600),
        workerCancelPenaltyRupees: Math.round((cfg.workerCancelPenaltyPaise ?? 2000) / 100),
        lateWorkerCancelMultiplier: cfg.lateWorkerCancelMultiplier ?? 2,
        workerNoShowPenaltyRupees: Math.round((cfg.workerNoShowPenaltyPaise ?? 5000) / 100),
        workerRejectLimit: cfg.workerRejectLimit ?? 5,
      },
      stats: {
        totalWorkers,
        onlineWorkers,
        availableWorkers,
        cancelsToday,
        workersCancellingToday,
        workersAtLimit, // auto-offlined for repeated cancels today
      },
      penaltyFreeReasons: cancellationService.WORKER_CANCEL_REASONS.filter((r) => r.genuine).map((r) => r.label),
      penalisedReasons: cancellationService.WORKER_CANCEL_REASONS.filter((r) => !r.genuine).map((r) => r.label),
    });
  } catch (err) { next(err); }
});

module.exports = router;
