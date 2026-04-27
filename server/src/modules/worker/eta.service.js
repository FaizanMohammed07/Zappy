/**
 * ETA Service
 * ----------------------------------------------------------------------------
 * Real-time ETA computation for the "worker is on the way" phase.
 *
 * Strategy:
 *   - Cache the order's pickup coordinates in Redis when the worker starts
 *     the trip (workerStartTrip). Key: `order:pickup:<orderId>` (TTL 24h).
 *   - On every worker location update, do a cheap Redis GET + Haversine to
 *     compute remaining distance and estimated time. No Google Maps call here —
 *     we save that for the initial quote. The ±15% error on Haversine is fine
 *     for a "you're 3 min away" ticker.
 *   - Emit `order.eta` event to the order room via Redis pub/sub.
 *   - If worker crosses the 500m threshold, fire a one-time `worker_arriving_soon`
 *     push notification. Dedup with a Redis key so it fires exactly once.
 *
 * Speed assumption: 25 km/h urban average. Better than nothing; swappable for
 * Google Routes Preferred ETA if the budget grows.
 * ----------------------------------------------------------------------------
 */

const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const PICKUP_KEY = (orderId) => `order:pickup:${orderId}`;
const ARRIVING_SOON_KEY = (orderId) => `order:arriving_soon_sent:${orderId}`;
const URBAN_SPEED_KMH = 25;
const ARRIVING_SOON_THRESHOLD_KM = 0.5; // 500 m

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Cache pickup coords when the order enters `on_the_way` state.
 * Called from order.service.workerStartTrip.
 */
async function cacheOrderPickup(orderId, lat, lng) {
  await redis.set(PICKUP_KEY(orderId), JSON.stringify({ lat, lng }), 'EX', 86400);
}

/**
 * Compute ETA and broadcast to the order room. Fire the "arriving soon"
 * notification once when within threshold.
 *
 * @param {object} p
 * @param {string} p.orderId
 * @param {string} p.workerId
 * @param {number} p.workerLat
 * @param {number} p.workerLng
 * @param {object} p.orderUserId  — needed to address the arriving_soon push
 */
async function computeAndBroadcast({ orderId, workerId, workerLat, workerLng, orderUserId }) {
  const raw = await redis.get(PICKUP_KEY(orderId));
  if (!raw) return; // order not in on_the_way state yet

  let pickup;
  try { pickup = JSON.parse(raw); } catch { return; }

  const distKm = haversineKm(workerLat, workerLng, pickup.lat, pickup.lng);
  const etaMinutes = Math.max(1, Math.ceil(distKm / (URBAN_SPEED_KMH / 60)));
  const isArrivingSoon = distKm <= ARRIVING_SOON_THRESHOLD_KM;

  // Broadcast ETA to order room
  await redis.publish('order:event', JSON.stringify({
    orderId: String(orderId),
    event: 'order.eta',
    payload: { distKm: Number(distKm.toFixed(3)), etaMinutes, isArrivingSoon, at: Date.now() },
  }));

  // One-time "arriving soon" push + socket event
  if (isArrivingSoon && orderUserId) {
    const key = ARRIVING_SOON_KEY(orderId);
    const already = await redis.set(key, '1', 'EX', 3600, 'NX');
    if (already === 'OK') {
      const notificationService = require('../notification/notification.service');
      notificationService.notify({
        recipient: { kind: 'user', id: orderUserId },
        type: 'worker_arriving_soon',
        title: '📍 Worker is almost there',
        body: `Your worker is less than 500m away — get ready!`,
        deepLink: `/orders/${orderId}`,
        data: { orderId: String(orderId), distKm, etaMinutes },
        sms: false,
      }).catch(() => {});
    }
  }
}

module.exports = { cacheOrderPickup, computeAndBroadcast };
