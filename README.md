# Zappy — Hyperlocal Instant Service Platform

**Instant Help. Anytime. Anywhere.**

A production-grade real-time platform for on-demand services (puncture, plumbing,
electrical, helper, carpenter, AC repair). Users request, workers are matched by
geo + skill, and the entire flow is live-tracked on a map.

Built for scale: stateless API, horizontal Socket.io with Redis adapter, queue-based
dispatch, two-tier (Redis GEO + Mongo `$near`) matching, dynamic surge pricing,
refresh-token rotation with reuse detection, multi-doc transactional order locking.

**Brand colors**: `#2563EB` Primary Blue · `#22C55E` Success Green · `#F59E0B` Accent Orange · `#0F172A` Deep Navy · `#F9FAFB` Light Bg.
**Typography**: Poppins (400/500/600/700).
**Spacing**: 8px grid.

> **See also:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) for core design,
> [`ENTERPRISE-ADDITIONS.md`](./ENTERPRISE-ADDITIONS.md) for the security &
> hardening layer.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Local development](#local-development)
5. [The dispatch algorithm](#the-dispatch-algorithm)
6. [Real-time flow](#real-time-flow)
7. [Production deployment](#production-deployment)
8. [Scaling](#scaling)
9. [Observability](#observability)
10. [Security](#security)

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design, component diagram,
state machine, and rationale. High-level shape:

- **Edge Nginx** terminates TLS, load-balances API nodes, pins WebSocket sessions
  via `ip_hash`.
- **Stateless API** (Express) handles REST. Horizontally scalable.
- **Socket.io** with **Redis adapter** — any API node can emit to any client.
- **BullMQ dispatch workers** run in separate processes, consuming the dispatch queue.
- **Redis** is the source of truth for hot data: worker GEO set, availability map,
  sessions, surge counters. Mongo is the system of record.
- **MongoDB** with `2dsphere` on workers + orders, compound indexes on the
  query paths that matter.
- **AWS S3** for KYC and profile images via presigned URLs — no binary through Node.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Redux Toolkit + RTK Query, React Router, Tailwind, Vite, Google Maps JS API |
| Backend | Node 20, Express, Mongoose, Socket.io, BullMQ |
| Data | MongoDB 7, Redis 7 |
| Infra | Docker Compose, Nginx, Let's Encrypt, AWS S3 |
| Auth | JWT (HS256), OTP-based login |

## Project structure

```
hyperlocal-platform/
├── ARCHITECTURE.md
├── docker-compose.yml
├── deploy/
│   └── nginx.conf                # edge reverse proxy
├── server/
│   ├── Dockerfile
│   ├── package.json
│   ├── scripts/
│   │   ├── create-indexes.js
│   │   └── seed.js
│   └── src/
│       ├── index.js              # API entry + graceful shutdown
│       ├── app.js                # express wiring
│       ├── config/               # env, mongo, redis
│       ├── models/               # User, Worker, Order
│       ├── middlewares/          # auth, validate, rate limit, error
│       ├── services/             # maps, geo matching, s3
│       ├── modules/
│       │   ├── auth/             # OTP + JWT
│       │   ├── user/             # profile, addresses, uploads
│       │   ├── worker/           # online/offline, location, earnings
│       │   ├── order/            # lifecycle, repository, service, routes
│       │   ├── pricing/          # dynamic surge engine
│       │   └── admin/            # metrics, management
│       ├── queues/
│       │   ├── index.js          # BullMQ queues
│       │   ├── dispatch.worker.js       # THE matcher (separate process)
│       │   └── notifications.worker.js  # FCM pushes
│       ├── sockets/              # Socket.io + Redis adapter
│       └── utils/logger.js
└── client/
    ├── Dockerfile
    ├── nginx-client.conf
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── store/
        ├── services/             # api.js (RTK Query), socket.js, maps.js
        ├── features/             # auth, order, worker slices
        ├── hooks/                # useSocket, useGeolocation
        ├── components/           # LocationPicker, LiveTrackingMap, RequireAuth
        └── pages/                # Login, Home, Booking, OrderTracking,
                                  # WorkerDashboard, WorkerJobPage, AdminDashboard
```

## Local development

### Prerequisites

- Node 20+
- Docker + Docker Compose (recommended)
- A Google Maps API key (with Maps JS, Places, Distance Matrix, Geocoding enabled)
- Optional: AWS S3 bucket for file uploads

### 1. Copy env files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit both and paste your Google Maps + JWT secret.
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Start the stack

```bash
docker compose up -d mongo redis
cd server && npm install && npm run dev
# in another shell:
cd server && node src/queues/dispatch.worker.js
cd server && node src/queues/notifications.worker.js
# in another shell:
cd client && npm install && npm run dev
```

Or full docker:
```bash
docker compose up --build
```

### 3. Bootstrap indexes, admin, plans, seed data

```bash
cd server
npm run bootstrap:indexes
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=ChangeMeNow1234 npm run bootstrap:admin
npm run bootstrap:monetization   # creates USER_PREMIUM, WORKER_PRO plans + pricing v1
npm run bootstrap:catalog        # seeds 6 services with checklists + price ranges
npm run seed
```

The seed creates 8 KYC-approved workers scattered around HITEC City (Hyderabad)
and prints JWT access tokens for quick manual testing. Bootstrap-monetization
creates the two default plans (USER_PREMIUM ₹99/mo, WORKER_PRO ₹199/mo) and an
initial pricing config v1.

### 4. Configure Razorpay (for payments to work)

1. Sign up at https://razorpay.com (test mode is fine)
2. Get your **Key ID** and **Key Secret** from Settings → API Keys
3. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `server/.env`
4. Add a webhook in the Razorpay dashboard pointing to:
   `https://your-domain.com/api/payments/webhook`
   Subscribe to: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`
5. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`

For local testing without exposing your machine, use:
```bash
ngrok http 4000
# Then use the ngrok URL as the webhook URL in Razorpay dashboard
```

### 5. Run tests

```bash
cd server && npm test
```

Tests use `mongodb-memory-server` and `ioredis-mock` — no external services
required. Covers pricing engine, abuse detection, refresh-token rotation with
reuse detection, and an end-to-end order flow via Supertest.

### 6. Background sweepers

Subscriptions auto-expire when `endAt` passes. Run the sweeper as a cron or
long-lived process:
```bash
npm run sweep:subs        # one-shot
npm run sweep:subs:loop   # forever, every 5 minutes
```

### 4. Try it

- Customer: http://localhost:5173 — login with any phone + OTP (dev mode returns
  OTP in the response).
- Worker: http://localhost:5173/worker/login
- Admin: http://localhost:5173/admin/login (create an admin via a small mongo
  insert or by changing a user's JWT role claim)

## The dispatch algorithm

Implemented in `server/src/queues/dispatch.worker.js`. It's a **sequential-offer**
pattern, not a broadcast:

1. Load order + find ranked candidates via `geo.service.findCandidates`:
   - **Tier 1**: `GEOSEARCH workers:online FROMLONLAT … BYRADIUS … ASC COUNT N`
     (Redis GEO — sub-millisecond)
   - Filter by availability (Redis hash) and skill (Redis set) in pipelined calls
   - Score: `distance − rating_boost − completions_boost`
   - **Tier 2 fallback**: Mongo `$near` if Redis has no results
2. Offer to candidate #1 for `DISPATCH_OFFER_TIMEOUT_MS` (default 15s)
3. Publish `worker:offer` on Redis → socket server fans to `worker:<id>` room
4. Wait on `dispatch:accepted:<orderId>` pub/sub channel (from `order.service.acceptOffer`)
5. On accept: atomic `findOneAndUpdate` locks the order (prevents double-assignment race)
6. On timeout/reject: add worker to `attemptedWorkerIds`, recurse with next candidate
7. Capped at 8 attempts; final failure emits `order.failed` to the order room

This pattern:

- **Deterministic** — the nearest suitable worker gets first crack.
- **No accept races** — only one worker is ever offered at a time.
- **Cleanly retryable** — attempted workers are remembered on the order.
- **Crash-safe** — BullMQ reclaims stalled jobs after `lockDuration`.

## Real-time flow

Events flow end-to-end through three hops:

```
[Backend source]               [Redis pub/sub]          [Socket.io rooms]          [Client]
─────────────────              ────────────────        ──────────────────        ──────────
order.service transitions  →  order:event channel  →  order:<id> room    →  user + worker app
dispatch.worker offers     →  worker:offer channel →  worker:<id> room   →  worker app (modal)
worker WS location         →  direct socket emit   →  order:<id> room    →  user tracking map
```

**Location throttling is layered:**

- Client throttles via the `useGeolocation` watch with `maximumAge: 4000`.
- Client also throttles emits to at most 1 every 4s.
- Socket server re-throttles per-worker via `SET NX EX 1`.
- Mongo writes are further throttled to once per 30s per worker
  (hot path is Redis GEO; Mongo is cold storage of last-known position).

## Production deployment

### On a single VM (quick start)

```bash
# 1. SSH in, install docker + docker-compose
# 2. Clone repo, copy env files, fill them with production values
# 3. Get a TLS cert (Let's Encrypt)
docker run -it --rm -v "$PWD/deploy/certs:/etc/letsencrypt" \
  -v "$PWD/deploy/certbot-www:/var/www/certbot" -p 80:80 \
  certbot/certbot certonly --standalone -d your-domain.com

# 4. Launch
docker compose up -d --build

# 5. Run one-time bootstrap
docker compose exec api node scripts/create-indexes.js
```

### Recommended production topology

| Component | Where to run |
|---|---|
| API + dispatch + notifications workers | ECS/Kubernetes (autoscaled by CPU + queue depth) |
| MongoDB | MongoDB Atlas replica set (M30+) with `2dsphere` + compound indexes |
| Redis | ElastiCache / Upstash — separate instance for cache vs pub/sub vs queues (or single cluster) |
| S3 | Standard S3 bucket + CloudFront for KYC retrieval |
| Nginx / ALB | Terminate TLS at ALB; Socket.io needs sticky sessions enabled (target group stickiness) |

## Scaling

- **API**: stateless, scale horizontally behind the LB. Target: 500–1000 RPS per node.
- **Socket.io**: add API nodes — the Redis adapter fans out events. Use sticky sessions
  at the LB (`ip_hash` in Nginx, source-IP affinity on ALB) to avoid reconnect churn.
- **Dispatch workers**: scale by queue depth (`dispatchQueue.getJobCounts()`).
  Each worker handles ~50 concurrent orders. 4 workers = 200 concurrent dispatches.
- **Mongo**: shard on `userId` for orders at very large scale. The `2dsphere` index
  handles hundreds of thousands of workers fine without sharding.
- **Redis GEO**: one instance holds ~100k workers easily. At larger scale, shard
  by geohash prefix.
- **Rate limiting**: already Redis-backed; automatically cluster-wide.

## Observability

- **Structured logs** via Pino (JSON in prod, pretty in dev). Ship to Loki/Datadog.
- **Health check**: `GET /health` returns `{ ok: true, ts }`. Used by Docker health,
  LB target health.
- **BullMQ UI**: add `@bull-board/express` on a protected route to see queues.
- **Suggested metrics** (easy to add): orders/min, average dispatch time, accept rate,
  candidate count per dispatch, 5xx rate, socket connection count.

## Security

- **JWT** with HS256, secret ≥ 32 chars enforced at startup.
- **Rate limiting** — Redis-backed, tiered (global / auth / order).
- **Helmet** with HSTS, frame options, nosniff.
- **Input validation** — every route body/query passes through Joi.
- **Order access control** — owner + assigned worker + admin only.
- **OTP on-site verification** — workers must enter a user-shared 4-digit OTP before
  starting service. Prevents impersonation at the doorstep.
- **Role-based middleware** — `requireRole('user' | 'worker' | 'admin')`.
- **S3** — presigned PUT URLs only, no proxying binary through the API.
- **Password hashes** with bcrypt (cost 10) for optional password login.

---

## API reference (quick)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/otp/request` | — | Send OTP |
| POST | `/api/auth/user/login` | — | User login (returns access + refresh) |
| POST | `/api/auth/worker/login` | — | Worker login (returns access + refresh) |
| POST | `/api/auth/admin/login` | — | Admin email+password login |
| POST | `/api/auth/refresh` | — | Rotate token pair (reuse-detected) |
| POST | `/api/auth/logout` | — | Revoke refresh-token family |
| GET | `/api/users/me` | user | Profile |
| POST | `/api/users/addresses` | user | Save address |
| GET | `/api/orders/quote` | user | Live price quote |
| POST | `/api/orders` | user | Create order → dispatch starts (rate-capped) |
| GET | `/api/orders/:id` | user/worker | Order details |
| POST | `/api/orders/:id/cancel` | user | Cancel (pre-service); strikes after assignment |
| POST | `/api/orders/:id/rate` | user | Rate completed order |
| POST | `/api/orders/:id/accept` | worker | Accept offer |
| POST | `/api/orders/:id/reject` | worker | Reject offer |
| POST | `/api/orders/:id/start-trip` | worker | → on_the_way |
| POST | `/api/orders/:id/arrived` | worker | → arrived |
| POST | `/api/orders/:id/start-service` | worker | OTP-verify → in_progress |
| POST | `/api/orders/:id/complete` | worker | → completed (writes ledger) |
| POST | `/api/workers/online` | worker | Go online (KYC-gated) |
| POST | `/api/workers/offline` | worker | Go offline |
| POST | `/api/workers/location` | worker | Ping location (throttled) |
| GET | `/api/workers/earnings` | worker | Earnings (today/week/month) |
| GET | `/api/workers/kyc/status` | worker | View own KYC state |
| POST | `/api/workers/kyc/submit` | worker | Submit KYC docs for review |
| POST | `/api/uploads/presign` | any | S3 presigned PUT URL |
| GET | `/api/admin/metrics` | admin | Dashboard metrics |
| GET | `/api/admin/orders` | admin | All orders |
| GET | `/api/admin/workers` | admin | All workers |
| POST | `/api/admin/workers/:id/block` | admin | Block / unblock (audited) |
| GET | `/api/admin/kyc/pending` | admin | KYC review queue |
| POST | `/api/admin/workers/:id/kyc/approve` | admin | Approve KYC (audited) |
| POST | `/api/admin/workers/:id/kyc/reject` | admin | Reject KYC with reason (audited) |
| GET | `/api/admin/audit-logs` | admin | Browse privileged action trail |
| PUT | `/api/admin/pricing-config` | admin | Hot-reload pricing (audited) |
| GET | `/api/pricing` | — | Get current active pricing config |
| PATCH | `/api/admin/pricing` | admin | Update active pricing config (versioned) |
| PATCH | `/api/admin/toggles` | admin | Toggle surge / cap / commission rate |
| GET | `/api/admin/revenue?days=N` | admin | Revenue breakdown from ledger |
| GET | `/api/subscriptions/plans` | — | List active plans (filter by audience) |
| GET | `/api/subscriptions/me` | any | My active subscription |
| POST | `/api/subscriptions/subscribe` | user/worker | Start Razorpay order for plan |
| POST | `/api/subscriptions/:id/cancel` | any | Cancel subscription |
| GET | `/api/wallet` | user/worker | Wallet balance |
| GET | `/api/wallet/transactions` | user/worker | Transaction history |
| POST | `/api/wallet/topup` | user/worker | Start Razorpay order for wallet top-up |
| POST | `/api/payments/create-order` | any | Generic Razorpay order creation |
| POST | `/api/payments/verify` | any | In-page checkout verification (idempotent) |
| POST | `/api/payments/webhook` | Razorpay | Signed webhook (raw body, HMAC-verified) |
| POST | `/api/orders/:id/rate-user` | worker | Worker rates user (symmetric) |
| GET | `/api/orders/:id/timeline` | any party | Full lifecycle with timestamps |
| GET | `/api/catalog/services` | — | Service catalog with checklists & price ranges |
| GET | `/api/catalog/services/:code` | — | Single service detail |
| GET | `/api/catalog/invoices/:orderId` | owner | HTML invoice (`?format=json` for data) |
| GET | `/api/catalog/heatmap/worker?lat&lng` | worker | Demand heatmap cells |
| POST | `/api/disputes` | user/worker | Raise a dispute on an order |
| GET | `/api/disputes/mine` | user/worker | My disputes |
| GET | `/api/disputes/:id` | parties/admin | Dispute detail |
| POST | `/api/disputes/:id/messages` | parties/admin | Add message to dispute thread |
| GET | `/api/admin/disputes` | admin | Admin queue (sorted by SLA) |
| POST | `/api/admin/disputes/:id/resolve` | admin | Resolve with refund/penalty/warning |
| GET | `/api/referrals/me` | user/worker | My referral code + stats |
| POST | `/api/referrals/apply` | user/worker | Apply a referral code to my account |
| GET | `/api/notifications` | user/worker | In-app notification feed |
| POST | `/api/notifications/:id/read` | user/worker | Mark one as read |
| POST | `/api/notifications/read-all` | user/worker | Mark all as read |

## Socket events

| Direction | Event | Payload |
|---|---|---|
| S → user | `order.status` | `{ status, at }` |
| S → user | `order.assigned` | `{ workerId, orderId }` |
| S → user | `worker.location` | `{ lat, lng, at }` |
| S → user | `order.cancelled` | `{ reason }` |
| S → user | `order.failed` | `{ reason }` |
| S → worker | `offer.new` | `{ _id, service, pickupAddress, pickupCoords, price, expiresAt }` |
| C → S (worker) | `worker:location` | `{ lat, lng, orderId? }` |
| C → S (any) | `order:subscribe` | `{ orderId }` |
| C → S (any) | `order:unsubscribe` | `{ orderId }` |

---

## Changelog

### v7.0 — Zappy brand system (current)

**Rebrand from QuickFix to Zappy**
- Product name updated across client, server, invoice template, referral share URLs, Razorpay display name
- Page title, favicon (inline SVG), theme-color, OG tags all updated

**Brand system implementation**
- `tailwind.config.js`: full Zappy palette as named color ramps (`zappy` 50–900, `success`, `accent`, `navy`), Poppins as default sans, type scale matching the H1/H2/H3/Body/Small spec, `rounded-card`/`rounded-btn` radius tokens, `shadow-soft`/`shadow-soft-lg`/`shadow-card`, `bg-zappy-gradient` utility
- `src/index.css`: CSS custom properties for brand tokens, Poppins `@import`, and the full utility-class system (`btn-primary` blue, `btn-success` green, `btn-outline`, `btn-icon`, `card`, `card-hero`, `chip-blue/success/accent/neutral`, `input`, `bottom-nav`, `bubble-in`/`bubble-out`, typography helpers, `text-zappy-gradient`)
- `components/ZappyLogo.jsx`: three exports — `ZappyLogo` (symbol mark), `ZappyWordmark` (logo + "ZAPPY" + tri-color tagline), `ZappyAppIcon` (light/dark/blue variants)
- `index.html`: Poppins Google Fonts preconnect+load, data-URI SVG favicon + apple-touch-icon

**Screen redesigns to match the Zappy reference**
- `HomePage`: greeting + notification bell, search pill, "Need Help Now?" gradient hero card with decorative Z glyph, 5-col popular services grid with colored icon tiles, 20% OFF offer banner, Premium + Wallet shortcut cards, bottom tab nav
- `LoginPage`: top half gradient splash with logo + tri-color tagline, bottom half white rounded-top sheet with OTP form
- `OrderTrackingPage`: worker strip with avatar + verified badge + rating + call/chat buttons, ETA pill, Zappy-green OTP card
- `ChatPage` (new): full-screen order-scoped chat with incoming/outgoing bubbles, delivery receipts, canned-reply chips, pinned composer, live socket updates via extended `useOrderSocket`
- `ServicesPage` (new): browse-all catalog with search + category chips (all/vehicle/home/helper/beauty), price ranges, duration
- `WorkerDashboard`: gradient header, success-green online toggle, accent-orange KYC banner
- `BookingPage`: confirm button switched from blue to success-green (matching the reference "Confirm Booking" CTA)
- `components/BottomNav.jsx` (new): fixed 5-tab navigation (Home / Bookings / Track / Wallet / Profile) with outline-style inline SVG icons, Zappy-blue active state

**Extended `useOrderSocket`**
- Now accepts a callbacks object with `onChatMessage` — relays `chat.message` events from the order room to the page subscriber
- Backward-compatible: existing callers (tracking page) work unchanged

**Routes added**
- `/home` — same as `/` (HomePage)
- `/services` — catalog browser
- `/orders/:id/chat` — chat with assigned worker

### v6.0 — Engagement, communication, emergency

**Masked phone calls**
- `CallSession` model with pool-based proxy-number assignment and 2h post-completion TTL
- `calling.service` assigns an available proxy from `CALL_POOL_NUMBERS`, tracks session state, accepts provider webhooks (ended, connected, recording URL)
- Provider-agnostic: `CALL_PROVIDER=twilio|exotel|mock`; contract identical regardless of vendor
- Active-session uniqueness via partial index on `(proxyNumber, active)` prevents number collisions across concurrent calls
- `POST /api/orders/:id/call` returns `{ proxyNumber, sessionId }` — client dials the proxy directly, telephony layer bridges

**In-app chat**
- `ChatMessage` model with 30-day TTL, per-order scoping, canned-code support
- `chat.service` enforces `canChat` predicate: only parties, only active statuses + 7d post-completion
- Real-time delivery via existing `order:event` pub/sub channel with new `chat.message` event type
- Auto-mark-read when the OTHER party loads the thread
- Fallback notification to catch the recipient when they're not on the screen

**Emergency mode**
- Optional `priority: 'emergency'` on order creation applies a 1.5× surcharge (`emergency.service`)
- BullMQ priority `1` (vs normal `10`) so emergency orders jump to the front of the dispatch queue
- Single field on Order model (`priority`) indexed for analytics

**Open-ended feedback**
- `Feedback` model separate from the 1–5 star rating — sentiment, tag taxonomy (10 tags), optional comment
- One feedback per order per party (unique index on `orderId`)
- Enables "top complaints this week" analytics by tag

**Support tickets**
- `SupportTicket` model — distinct from `Dispute` (which is order-specific with financial resolution). Support handles "my KYC is stuck", "payout not received", general help.
- SLA by priority (urgent 1h / high 2h / normal 4h / low 24h)
- Message thread, admin assignment, status machine (open → in_progress → waiting_user → resolved → closed)

**Saved address improvements**
- `User.savedAddresses` extended with `landmark`, `flatNumber`, `notes`, `tag` (home/work/other)
- Arrival notes persist on each order's `pickupLocation` so the worker sees them regardless of address book state

**Book-again suggestions**
- `GET /api/orders/suggestions` groups the user's last 20 completed orders by service, returns 3 freshest unique-service entries with the last address + price + preferred worker ID
- Frontend can render a "Book X again at ₹Y" card

**Public worker profile**
- `GET /api/workers/:id/public-profile` returns the customer-safe view: name, rating, completed jobs, skills, KYC verification badge, selfie URL, member-since
- Shown on the tracking screen before arrival — "Your verified helper: Ramesh K (⭐ 4.8, 234 jobs)"

**New endpoints**
- `POST /api/orders/:id/chat`, `GET /api/orders/:id/chat` — send & list messages
- `POST /api/orders/:id/call` — start masked call session
- `POST /api/calls/provider-webhook` — telephony provider callback
- `GET /api/workers/:id/public-profile` — customer-facing worker profile
- `POST /api/orders/:id/feedback` — post-order rich feedback
- `POST /api/support`, `GET /api/support/mine`, `POST /api/support/:id/messages` — support tickets
- `GET /api/admin/support`, `PATCH /api/admin/support/:id/status` — admin ops
- `GET /api/orders/suggestions` — book-again candidates
- `POST /api/users/addresses` now accepts `landmark`, `flatNumber`, `notes`, `tag`
- `POST /api/orders` now accepts `priority: 'emergency'` + pickup `landmark`/`flatNumber`/`notes`

### v5.0 — Cash payments, negative wallets, payouts

**Cash flow branching in `workerComplete`**
- `payment.method === 'cash'`: worker keeps full cash from customer; we DEBIT the worker wallet by the commission amount. May push worker's balance negative.
- `payment.method !== 'cash'`: existing online flow — CREDIT worker with earnings.
- Platform commission row written identically for both paths — revenue tracking is method-agnostic.

**Negative balance support**
- `Wallet.balancePaise` no longer has `min: 0` — workers can go negative.
- `wallet.service.apply` debit guard is now kind-aware: users still require positive balance; workers can debit down to hard limit.
- Natural debt clearing — when earnings credit a worker already in debt, integer math repays dues first (balance -300 + earning 700 = +400). No special code.

**Soft/hard limits (`workerDues.service`)**
- SOFT_LIMIT = -₹200 → warning banner, still works
- HARD_LIMIT = -₹500 → blocked from new jobs
- Three-layer enforcement:
  1. `geo.service.findCandidates` filters out blocked workers from match pool
  2. `worker.service.goOnline` refuses to flip a blocked worker online
  3. `wallet.service` debit guard prevents breaching the hard limit
- `GET /api/wallet/dues` returns `{ balancePaise, status: 'clear'|'in_debt'|'warning'|'blocked', duesPaise, softLimitPaise, hardLimitPaise }`

**Payout system (full lifecycle)**
- `Payout` model with state machine: requested → approved → processing → paid | failed
- **Reservation semantics**: on approve, wallet is debited immediately (idempotency key `payout:debit:<id>`). Prevents concurrent duplicate payouts.
- **Reversal on failure**: Razorpay Payouts error → wallet credited back (idempotency key `payout:reversal:<id>`), payout marked `failed`.
- One in-flight payout per worker — blocks duplicate requests.
- UPI / bank / manual destinations supported.
- Min ₹50, max ₹25,000 per payout.

**Razorpay Payouts (RX) integration**
- `razorpay.client.createPayout` wraps the RazorpayX Payouts API.
- Falls back to a manual/mock path if RX isn't configured, so the lifecycle is testable end-to-end without RX activation.

**New endpoints**
- `POST /api/payouts/request` — worker requests withdrawal
- `GET /api/payouts/mine` — worker's payout history
- `GET /api/admin/payouts` — admin queue (filter by status)
- `POST /api/admin/payouts/:id/approve` — approve (debits wallet, processes)
- `POST /api/admin/payouts/:id/reject` — reject with reason
- `POST /api/admin/payouts/:id/process` — retry a failed payout
- `GET /api/wallet/dues` — worker dues status

### v4.0 — Marketplace parity

**Trust & reputation**
- Symmetric rating — workers can now rate users (`POST /orders/:id/rate-user`); affects `user.rating` via rolling average
- User rating can be factored into future matching decisions

**Service standardization**
- `ServiceCatalog` collection — fixed price ranges, required skills, tools, checklists, quality guidelines per service
- `GET /api/catalog/services` public endpoint; bootstrap script seeds 6 services

**Disputes & refunds**
- Full `Dispute` model with category taxonomy (service_not_done, poor_quality, overcharged, …)
- Dispute messaging thread — both parties can add context
- 24h SLA tracking; admin queue sorted by SLA deadline
- Resolutions: `refund_full` / `refund_partial` / `no_action` / `worker_penalty` / `worker_warning` / `split_decision`
- Auto-wires into wallet: refunds credit user, penalties debit worker (with insufficient-funds handling)
- `POST /api/disputes` (raise) / `POST /api/admin/disputes/:id/resolve` (resolve)

**User retention**
- `Referral` system — 6-char codes, auto-generated per user, anti-abuse via IP+device detection
- Referee gets ₹50 signup bonus instantly; referrer gets ₹100 on referee's first completed order
- `Cashback` on every order — 5% default, 10% for first 3 orders, +2% for premium users, capped at ₹50
- Both trigger on order completion with deterministic idempotency keys

**Cancellation policy**
- 60-second grace window for free cancellation
- Cancellation fee: 30% of order, min ₹20, max ₹100 — debited from user wallet
- 50% of fee compensates the worker if they were already on the way

**Notifications**
- New `Notification` persistence collection — in-app feed with unread tracking, 90-day TTL
- Multi-channel: socket push (instant) + FCM (backgrounded apps) + SMS for high-stakes events
- Lifecycle events wired: `order_placed`, `worker_assigned`, `worker_on_the_way`, `worker_arrived`, `order_completed`, `cashback_received`, `referral_reward`, `dispute_response`, `kyc_approved`
- Pattern-subscribed socket channel `notification:<kind>:<id>` for real-time delivery

**Worker heatmap**
- `GET /api/catalog/heatmap/worker?lat&lng&radiusKm` — reads from the same demand/supply Redis buckets the surge engine uses
- Returns cells ranked by demand/supply ratio ("attractiveness score")
- Workers see: "Go to this area for more jobs"

**Invoicing**
- Clean HTML invoice template (`invoice.service.js`) — renderable directly in browser or by a Puppeteer worker for PDF
- Invoice number format `INV-YYYYMM-<id-suffix>` for human readability
- GST 18% applied to platform fee portion only
- `GET /api/catalog/invoices/:orderId` — HTML by default, `?format=json` for data

**Order timeline**
- `GET /api/orders/:id/timeline` — full lifecycle timeline with timestamps for every stage
- Powered by existing `statusHistory[]` on the order

### v3.0 — Monetization & Payments

**Razorpay end-to-end**
- Direct REST integration (no SDK) — `razorpay.client.js` with constant-time HMAC for both webhook and checkout signatures
- `PaymentIntent` model links Razorpay orders to our purposes (subscription / wallet_topup / order_payment)
- Webhook handler uses `express.raw()` mounted **before** `express.json()` — required for HMAC verification
- Three-layer idempotency: `razorpayPaymentId` unique, `appliedAt` claim guard via `findOneAndUpdate`, Transaction `idempotencyKey`
- Amount tampering detection — webhook refuses to apply effects if Razorpay reports a different amount than the intent

**Subscriptions & feature flags**
- `Plan` model with arbitrary `effects` bag (no schema changes for new perks)
- `Subscription` with partial unique index enforcing one-active-per-owner
- Effects snapshot at activation — plan edits don't retroactively change existing subscriber perks
- Redis-cached active-subscription lookup (60s TTL) for hot-path reads
- Feature flag readers: `isUserPremium`, `isWorkerPro`, `getEffects` — used by pricing + matching
- Expiry sweeper script (`sweep:subs:loop`) for cron-style auto-expiration

**Premium effects in real-time**
- `USER_PREMIUM` (₹99/mo): no surge (`surgeCap: 1.0`), waived platform fee, priority assignment
- `WORKER_PRO` (₹199/mo): -5% commission delta, +2 score boost in matching
- Pricing engine reads user's subscription effects on every quote
- Earnings calculation reads worker's commission delta at completion time

**Wallet & ledger**
- New `Wallet` model with denormalized balance + version field (optimistic locking)
- `wallet.service.apply()` enforces idempotency via Transaction unique key — same operation runs once even on retry
- Reconciliation function audits `Wallet.balancePaise` vs `SUM(Transaction.amountPaise)` invariant
- Transfer between principals with paired idempotency keys
- All money in **paise** (integer math, no float errors)
- Controlled `REASONS` vocabulary: WORKER_EARNING, CASHBACK, REFERRAL_REWARD, REFUND, WALLET_TOPUP, PLATFORM_COMMISSION, …

**Pricing engine v2**
- Now reads from `PricingConfig` collection (versioned, audit trail) → Redis cache → env fallback
- Service-level overrides (multiplier + optional service-specific min fare)
- Configurable commission rate (PATCH `/admin/toggles`)
- Surge enable/cap admin controls
- Premium effects integrated (surge cap, fee waiver)

**Frontend**
- `PlansPage` — works for both users and workers; Razorpay Checkout flow with verify
- `WalletPage` — balance card + quick top-up amounts + transaction list
- Razorpay SDK lazy-loaded; `openCheckout()` returns a Promise
- Premium / Pro shortcut cards on HomePage and WorkerDashboard

**Admin**
- `GET /admin/revenue?days=N` — accurate breakdown from ledger by reason + by day
- `PATCH /admin/toggles` — surge enable, max cap, commission rate

### v2.0 — Enterprise hardening

**Security**
- Refresh-token rotation with family/generation tracking and **token reuse detection** (Auth0-style — replayed RT triggers full family revocation)
- Admin role separated into its own collection with email/password login, exponential-backoff lockout
- OTP flood protection (3 per phone per 10 min)
- NoSQL operator injection sanitizer (strips `$` and `.` keys from all inputs)
- Request ID propagation through logs and error responses
- Structured error codes on every throw (`OTP_INVALID`, `KYC_NOT_APPROVED`, `BOOKING_RATE_CAP`, `RT_REUSE`, …)

**Reliability**
- Order-worker locking now uses a **MongoDB multi-doc transaction** — order status flip and worker availability flip commit atomically or roll back together
- Idempotent ledger writes (charge + earning split) on completion; refund rows on cancellation
- Immutable audit log of every privileged admin action with 2-year TTL

**Business logic**
- Worker KYC state machine (`not_submitted` / `pending_review` / `approved` / `rejected`) with admin approve/reject endpoints
- KYC approval enforced at `goOnline` — unapproved workers can't receive offers
- Booking rate cap (5 per 10 min per user)
- Rapid-cancel strikes (3 cancels-after-assignment in 24h → 1h booking freeze)
- Worker reject-rate monitoring (sliding window of 20 offers; >70% rejects → auto-unavailable)
- Runtime pricing config — admin writes to Redis, pricing engine reads-through with 5s in-process cache; live in <1s, no restart

**Frontend**
- RTK Query `baseQueryWithReauth` with mutex-serialized refresh — concurrent 401s won't trigger false reuse-detection revocations
- Worker KYC onboarding page with presigned S3 uploads
- Admin KYC review queue with approve/reject + rejection-reason modal
- KYC banner on Worker dashboard that gates the online toggle

**Testing**
- Jest harness with `mongodb-memory-server` and `ioredis-mock` — tests run with no external services
- Unit tests: pricing engine, abuse detection, refresh-token rotation
- Integration tests: full order flow via Supertest (auth, validation, NoSQL injection, KYC gate, happy path, active-order conflict)

### v1.0 — Initial system

Core platform: dispatch worker (sequential offer with retry), Redis GEO matching,
dynamic surge pricing, Socket.io with Redis adapter, live tracking maps, full
React+RTK client, Docker stack.

---

## License

Proprietary — all rights reserved.
