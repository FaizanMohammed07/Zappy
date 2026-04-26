const Worker = require('./worker.model');
const Order = require('../order/order.model');
const geoService = require('./geo.service');
const pricingService = require('../pricing/pricing.service');
const { redis } = require('../../config/redis');

async function goOnline({ workerId, lng, lat }) {
  // Load first to check KYC status — cheap guard before we write anything.
  const existing = await Worker.findById(workerId).select('kyc.status isBlocked').lean();
  if (!existing) throw Object.assign(new Error('Worker not found'), { status: 404, code: 'WORKER_NOT_FOUND' });
  if (existing.isBlocked) {
    throw Object.assign(new Error('Account is blocked'), { status: 403, code: 'WORKER_BLOCKED' });
  }
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

  // If worker is on a trip, broadcast to the order room.
  if (orderId) {
    await redis.publish(
      'order:event',
      JSON.stringify({
        orderId: String(orderId),
        event: 'worker.location',
        payload: { lng, lat, at: Date.now() },
      })
    );
  }
  return { ok: true };
}

async function getEarnings({ workerId, range = 'today' }) {
  const now = new Date();
  let since;
  if (range === 'today') since = new Date(now.setHours(0, 0, 0, 0));
  else if (range === 'week') since = new Date(Date.now() - 7 * 86400 * 1000);
  else since = new Date(Date.now() - 30 * 86400 * 1000);

  const agg = await Order.aggregate([
    {
      $match: {
        workerId: require('mongoose').Types.ObjectId.createFromHexString(String(workerId)),
        status: 'completed',
        completedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$pricing.total' },
        jobs: { $sum: 1 },
        avgFare: { $avg: '$pricing.total' },
      },
    },
  ]);
  return agg[0] || { totalEarnings: 0, jobs: 0, avgFare: 0 };
}

module.exports = { goOnline, goOffline, updateLocation, getEarnings };
