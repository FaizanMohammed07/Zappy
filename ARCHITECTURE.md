# Hyperlocal Instant Service Platform — Architecture

## 1. High-Level Flow

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  User App    │          │  Worker App  │          │ Admin Panel  │
│ (React+RTK)  │          │ (React+RTK)  │          │ (React)      │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │ HTTPS/WSS               │ HTTPS/WSS               │
       ▼                         ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    NGINX / ALB (Load Balancer)               │
│                    TLS, Rate Limit, Sticky sessions (WS)     │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  API Gateway   │  │  Socket Layer  │  │  Admin Service │
│  (Express)     │  │  (Socket.io +  │  │                │
│  Stateless     │  │   Redis Adapt.)│  │                │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                  ▼                   ▼
         ┌────────────────┐  ┌────────────────┐
         │  BullMQ Queues │  │  Redis Cluster │
         │  - dispatch    │  │  - sessions    │
         │  - notify      │  │  - geo cache   │
         │  - payments    │  │  - pub/sub     │
         └───────┬────────┘  └────────────────┘
                 │
         ┌───────▼────────────────────┐
         │  Dispatch Worker Processes │
         │  (Separate Node procs)     │
         └───────┬────────────────────┘
                 ▼
         ┌────────────────┐      ┌────────────────┐
         │   MongoDB      │      │   AWS S3       │
         │   Replica Set  │      │   (KYC docs,   │
         │   2dsphere idx │      │    images)     │
         └────────────────┘      └────────────────┘
```

## 2. Why this shape

- **Stateless API servers** behind a load balancer → horizontal scaling.
- **Socket.io with Redis adapter** → sockets can be served from any node; pub/sub fans events out.
- **BullMQ dispatch workers** are separate processes, not in the API process. Dispatch retries, backoffs, and dead-letter handling never block the API event loop.
- **MongoDB 2dsphere index** for geo queries (`$near`, `$geoWithin`). Redis GEO is used as a hot cache of online workers for sub-millisecond lookups.
- **Event-driven order lifecycle** — every transition emits a domain event (`order.created`, `worker.assigned`, `order.completed`), so analytics, notifications, and audit logging are decoupled.

## 3. Order lifecycle (state machine)

```
                    ┌─────────────┐
                    │  CREATED    │
                    └──────┬──────┘
                           │ dispatch enqueued
                    ┌──────▼──────┐
                    │  SEARCHING  │◄──────┐
                    └──────┬──────┘       │
              worker accepts │             │ no accept in 15s
                    ┌──────▼──────┐       │ (retry next worker)
                    │  ASSIGNED   │       │
                    └──────┬──────┘       │
                           │ worker starts │
                    ┌──────▼──────┐       │
                    │ ON_THE_WAY  │       │
                    └──────┬──────┘       │
                           │ geofence hit  │
                    ┌──────▼──────┐       │
                    │  ARRIVED    │       │
                    └──────┬──────┘       │
                           │ completion    │
                    ┌──────▼──────┐       │
                    │ COMPLETED   │       │
                    └─────────────┘       │
                                          │
                    ┌─────────────┐       │
                    │  CANCELLED  │◄──────┘ (timeout w/ no workers)
                    └─────────────┘
```

## 4. Dispatch algorithm (the core)

Two-tier matching:

1. **Hot path (Redis GEO)** — `GEOSEARCH workers:online FROMLONLAT <lng> <lat> BYRADIUS 5 km ASC COUNT 20`. Sub-millisecond.
2. **Cold path (MongoDB $near)** — fallback for filters Redis can't express (skill tags, rating ≥ 4.2, recent completions).

Then a **sequential offer** pattern: offer to worker #1 with a 15s accept window. If no accept, offer to #2. BullMQ's `delay` + job state holds this without polling.

This beats a naive broadcast because:
- Prevents thundering-herd accept races
- Deterministic — the nearest available worker wins
- Trivially retryable on worker disconnects

## 5. Live tracking pipe

```
Worker device ──(every 4s)──► POST /location  ─┐
                                               ├──► Redis GEO (write-through)
                                               └──► Socket room `order:<id>`
                                                    ├─► User app (marker moves)
                                                    └─► Admin live map
```

Delta-only updates — client sends a location only if it moved >15m or >4s elapsed. Server throttles per-order emits to at most 1/sec.

## 6. Scaling posture

| Concern | Answer |
|---|---|
| 10k concurrent users | Stateless API + Socket.io horizontal. Redis adapter fans sockets. |
| Dispatch throughput | BullMQ concurrency tuned per worker process; dispatch is I/O bound. |
| Geo query hotspot | Redis GEO as L1 cache, rebuilt from Mongo every 30s per shard. |
| Write amplification on tracking | Location writes bypass Mongo; only terminal state persisted. |
| Failure of a dispatch worker | BullMQ job recovery — stalled jobs reclaimed after visibility timeout. |
