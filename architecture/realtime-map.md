# Realtime Architecture

## Socket.io Setup
- Redis adapter: pub/sub bridge across API nodes
- Auth: JWT in handshake.auth.token (verified on connection)
- Transports: websocket + polling

## Rooms
| Room | Who joins | Purpose |
|------|-----------|---------|
| `user:{userId}` | User socket | User notifications |
| `worker:{workerId}` | Worker socket | Job offers, broadcasts |
| `order:{orderId}` | User + Worker on subscribe | Live tracking |

## Client → Server Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `order:subscribe` | `{ orderId }` | Join order room for tracking |
| `order:unsubscribe` | `{ orderId }` | Leave order room |
| `worker:location` | `{ lat, lng, orderId }` | Worker broadcasts location (throttled 1/sec) |

## Server → Client Events
| Event | Room | Payload | Purpose |
|-------|------|---------|---------|
| `notification` | `user:{id}` / `worker:{id}` | `{ _id, type, title, body, data, deepLink }` | All notifications |
| `new_job_request` | `worker:{id}` | order object | Dispatch offer to worker |
| `offer.cancelled` | `worker:{id}` | `{ orderId }` | Offer taken, dismiss popup |
| `job.assigned` | `worker:{id}` | `{ workerId, orderId, service, pickupAddress, price }` | Force-assigned |
| `worker.location` | `order:{id}` | `{ lat, lng, at }` | Worker position update |
| `order:subscribed` | socket | `{ orderId }` | Confirm room join |
| (any order event) | `order:{id}` | `{ orderId, event, payload }` | Status changes etc. |

## Redis Pub/Sub Channels
| Channel | Publisher | Consumer | Payload |
|---------|-----------|----------|---------|
| `order:event` | order.service, dispatch | socket bridge | `{ orderId, event, payload }` |
| `worker:offer` | dispatch.worker | socket bridge | `{ workerId, order }` |
| `worker:offer_cancel` | dispatch.worker | socket bridge | `{ workerId, orderId }` |
| `worker:assigned` | dispatch.worker | socket bridge | `{ workerId, orderId, ... }` |
| `notification:{kind}:{id}` | notification.service | socket bridge | notification payload |

## Redis Keys (operational)
| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `demand:{lat}:{lng}` | String (counter) | 300s | Demand per geo bucket |
| `supply:{lat}:{lng}` | Set (workerIds) | 120s | Supply per geo bucket |
| `loc:ws:{workerId}` | String | 1s | Socket location throttle |
| `loc:mongo:{workerId}` | String | 30s | MongoDB write throttle |
| `config:pricing:active` | JSON | 60s | Pricing config cache |
| `workers:geo` | GEO set | N/A | Worker positions |
| `workers:alive` | Set | N/A | Online workers |
