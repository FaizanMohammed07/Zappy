/**
 * Socket.io server
 * ----------------------------------------------------------------------------
 * Responsibilities:
 *   - Authenticate socket connections via JWT (handshake auth token).
 *   - Join rooms:
 *       user:<userId>     → per-user notifications
 *       worker:<workerId> → offers, broadcasts
 *       order:<orderId>   → live tracking participants (user + worker + admin)
 *   - Bridge Redis pub/sub → socket rooms so the dispatch worker and other
 *     stateless nodes can reach the right clients regardless of which API
 *     node holds their socket.
 *   - Throttle location broadcasts to at most 1/second per order.
 * ----------------------------------------------------------------------------
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createPubSubPair, redis } = require('../config/redis');
const { verifyToken } = require('../modules/auth/auth.service');
const etaService = require('../modules/worker/eta.service');
const Order = require('../modules/order/order.model');
const logger = require('../utils/logger');

let io = null;

function initSockets(httpServer) {
  const { pubClient, subClient } = createPubSubPair();

  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });
  io.adapter(createAdapter(pubClient, subClient));

  // --- JWT handshake auth ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Missing token'));
    try {
      const payload = verifyToken(token);
      socket.user = payload; // { sub, role, phone }
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { sub: id, role } = socket.user;
    logger.info({ id, role, sid: socket.id }, 'Socket connected');

    // Join role-based personal room
    socket.join(`${role}:${id}`);

    // --- Client-driven room joins ---
    socket.on('order:subscribe', ({ orderId }) => {
      if (!orderId) return;
      socket.join(`order:${orderId}`);
      socket.emit('order:subscribed', { orderId });
    });

    socket.on('order:unsubscribe', ({ orderId }) => {
      if (!orderId) return;
      socket.leave(`order:${orderId}`);
    });

    // --- Worker live location (WS-driven, bypasses HTTP for lower latency) ---
    // The client should throttle client-side; we throttle server-side too.
    socket.on('worker:location', async ({ lat, lng, orderId }) => {
      if (role !== 'worker') return;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      // Server-side throttle: at most 1 broadcast/sec per worker.
      const throttleKey = `loc:ws:${id}`;
      const canEmit = await redis.set(throttleKey, '1', 'EX', 1, 'NX');
      if (canEmit !== 'OK') return;

      await redis.geoadd('workers:online', lng, lat, String(id));

      if (orderId) {
        io.to(`order:${orderId}`).emit('worker.location', { lat, lng, at: Date.now() });

        // ETA + arriving-soon notification — non-blocking, only during on_the_way
        Order.findById(orderId).select('userId status').lean().then((o) => {
          if (!o || o.status !== 'on_the_way') return;
          return etaService.computeAndBroadcast({
            orderId: String(orderId),
            workerId: String(id),
            workerLat: lat,
            workerLng: lng,
            orderUserId: o.userId,
          });
        }).catch(() => {});
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ id, role, sid: socket.id, reason }, 'Socket disconnected');
    });
  });

  // --- Redis pub/sub → socket room bridge ---
  // Dispatch worker publishes events; we relay them to the right rooms.
  const subscriber = subClient.duplicate();

  subscriber.subscribe('order:event', 'worker:offer', (err) => {
    if (err) logger.error({ err }, 'Pub/sub subscribe failed');
  });
  // Notifications are per-recipient — `notification:<kind>:<id>`. Use pattern sub.
  subscriber.psubscribe('notification:*', (err) => {
    if (err) logger.error({ err }, 'Pub/sub psubscribe failed');
  });

  subscriber.on('pmessage', (pattern, channel, message) => {
    if (!channel.startsWith('notification:')) return;
    try {
      const [, kind, id] = channel.split(':');
      const data = JSON.parse(message);
      io.to(`${kind}:${id}`).emit('notification', data);
    } catch (err) {
      logger.warn({ err: err.message, channel }, 'Bad notification pub/sub message');
    }
  });

  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);

      if (channel === 'order:event') {
        // { orderId, event, payload }
        io.to(`order:${data.orderId}`).emit(data.event, data.payload);
        return;
      }

      if (channel === 'worker:offer') {
        // { workerId, order }
        io.to(`worker:${data.workerId}`).emit('offer.new', data.order);
        return;
      }
    } catch (err) {
      logger.warn({ err: err.message, channel }, 'Bad pub/sub message');
    }
  });

  logger.info('Socket.io initialized with Redis adapter');
  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { initSockets, getIo };
