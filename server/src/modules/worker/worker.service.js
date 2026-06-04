const Worker = require('./worker.model');
const Order = require('../order/order.model');
const geoService = require('./geo.service');
const pricingService = require('../pricing/pricing.service');
const { redis } = require('../../config/redis');
const config = require('../../config');

async function goOnline({ workerId, lng, lat }) {
  // Load first to check KYC status — cheap guard before we write anything.
  const existing = await Worker.findById(workerId).select('kyc.status isBlocked').lean();
  if (!existing) throw Object.assign(new Error('Worker not found'), { status: 404, code: 'WORKER_NOT_FOUND' });
  if (existing.isBlocked) {
    throw Object.assign(new Error('Account is blocked'), { status: 403, code: 'WORKER_BLOCKED' });
  }
  // KYC approval is mandatory in all environments — no dev bypass.
  if (existing.kyc?.status !== 'approved') {
    throw Object.assign(new Error('KYC approval required before going online'), {
      status: 403, code: 'KYC_NOT_APPROVED', kycStatus: existing.kyc?.status || 'not_submitted',
    });
  }

  // Block workers whose wallet dues exceed the hard limit
  const duesService = require('./worker-dues.service');
  await duesService.assertCanWork(workerId);

  const worker = await Worker.findByIdAndUpdate(
    workerId,
    {
      $set: {
        isOnline: true,
        isAvailable: true,
        'currentLocation.coordinates': [lng, lat],
        'currentLocation.updatedAt': new Date(),
        lastSeenAt: new Date(),
      },
    },
    { new: true }
  );
  await geoService.markOnline(worker);
  await pricingService.recordSupply(worker._id, lat, lng);
  return worker;
}

async function goOffline({ workerId }) {
  // Refuse if worker is mid-order — prevents orphaned orders.
  const active = await Order.findOne({
    workerId,
    status: { $in: ['assigned', 'on_the_way', 'arrived', 'in_progress'] },
  }).lean();
  if (active) {
    throw Object.assign(new Error('Finish your active order before going offline'), {
      status: 409,
      activeOrderId: active._id,
    });
  }

  const worker = await Worker.findByIdAndUpdate(
    workerId,
    { $set: { isOnline: false, isAvailable: false, lastSeenAt: new Date() } },
    { new: true }
  );
  await geoService.markOffline(workerId);
  return worker;
}

/**
 * Hot-path location update. Writes to Redis GEO only.
 * Mongo gets a throttled write every 30s via lastSeenAt.
 */
async function updateLocation({ workerId, lng, lat, orderId }) {
  await geoService.updateLocation(workerId, lng, lat);

  // Throttle Mongo writes — only if >30s since last.
  const throttleKey = `loc:mongo:${workerId}`;
  const shouldWriteDb = await redis.set(throttleKey, '1', 'EX', 30, 'NX');
  if (shouldWriteDb === 'OK') {
    await Worker.updateOne(
      { _id: workerId },
      {
        $set: {
          'currentLocation.coordinates': [lng, lat],
          'currentLocation.updatedAt': new Date(),
          lastSeenAt: new Date(),
        },
      }
    );
  }

  // If worker is on a trip, broadcast location + ETA to the order room.
  if (orderId) {
    await redis.publish(
      'order:event',
      JSON.stringify({
        orderId: String(orderId),
        event: 'worker.location',
        payload: { lng, lat, at: Date.now() },
      })
    );

    // ETA + arriving-soon trigger (non-blocking; needs order's userId)
    const etaService = require('./eta.service');
    Order.findById(orderId).select('userId status').lean().then((o) => {
      if (!o || o.status !== 'on_the_way') return;
      return etaService.computeAndBroadcast({
        orderId: String(orderId),
        workerId: String(workerId),
        workerLat: lat,
        workerLng: lng,
        orderUserId: o.userId,
      });
    }).catch(() => {});
  }
  return { ok: true };
}

async function getEarnings({ workerId, range = 'today' }) {
  const now = new Date();
  let since;
  if (range === 'today') since = new Date(now.setHours(0, 0, 0, 0));
  else if (range === 'week') since = new Date(Date.now() - 7 * 86400 * 1000);
  else since = new Date(Date.now() - 30 * 86400 * 1000);

  const mongoose = require('mongoose');
  const wid = mongoose.Types.ObjectId.createFromHexString(String(workerId));

  const [agg, daily] = await Promise.all([
    Order.aggregate([
      { $match: { workerId: wid, status: 'completed', completedAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          jobs: { $sum: 1 },
          // earnings.workerPaise is set on completion (post-commission).
          // Fall back to pricing.total*100*(1-commissionRate) for legacy rows.
          earningsPaise: { $sum: { $ifNull: ['$earnings.workerPaise', { $multiply: ['$pricing.total', 80] }] } },
          commissionPaise: { $sum: { $ifNull: ['$earnings.platformPaise', { $multiply: ['$pricing.total', 20] }] } },
          avgFarePaise: { $avg: { $ifNull: ['$earnings.workerPaise', { $multiply: ['$pricing.total', 80] }] } },
          cashJobs: { $sum: { $cond: [{ $eq: ['$payment.method', 'cash'] }, 1, 0] } },
          onlineJobs: { $sum: { $cond: [{ $ne: ['$payment.method', 'cash'] }, 1, 0] } },
        },
      },
    ]),

    // Daily breakdown for chart (always last 30 days regardless of range)
    Order.aggregate([
      { $match: { workerId: wid, status: 'completed', completedAt: { $gte: new Date(Date.now() - 30 * 86400 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          jobs: { $sum: 1 },
          earningsPaise: { $sum: { $ifNull: ['$earnings.workerPaise', { $multiply: ['$pricing.total', 80] }] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const summary = agg[0] || { jobs: 0, earningsPaise: 0, commissionPaise: 0, avgFarePaise: 0, cashJobs: 0, onlineJobs: 0 };
  return {
    range,
    since,
    jobs: summary.jobs,
    earningsPaise: Math.round(summary.earningsPaise),
    earningsRupees: Math.round(summary.earningsPaise / 100),
    commissionPaidPaise: Math.round(summary.commissionPaise),
    avgEarningPerJobRupees: summary.jobs > 0 ? Math.round(summary.avgFarePaise / 100) : 0,
    cashJobs: summary.cashJobs,
    onlineJobs: summary.onlineJobs,
    dailyBreakdown: daily.map((d) => ({ date: d._id, jobs: d.jobs, earningsPaise: Math.round(d.earningsPaise) })),
  };
}

module.exports = { goOnline, goOffline, updateLocation, getEarnings };
