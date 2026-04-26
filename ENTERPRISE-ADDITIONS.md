# Enterprise Hardening — What's New

This document covers the additions layered on top of the base platform to make it
enterprise-ready. See `ARCHITECTURE.md` for the core design.

## 1. Authentication — Refresh Token Rotation

Two-token model:

- **Access token**: short-lived (15 min), sent as `Authorization: Bearer`
- **Refresh token**: long-lived (30 d), stored server-side in Redis with a
  family/generation counter for **rotation + reuse detection**

```
Login  → issue AT(15m) + RT(30d, family F, gen 0)
Use    → client calls /auth/refresh with RT → rotates to gen 1, invalidates gen 0
Reuse  → if gen 0 presented after gen 1 issued → entire family F is revoked
         (classic token-theft detection — Auth0 & co. do this)
```

Why server-side refresh storage? Because stateless refresh tokens can't be
revoked. A logout or "sign out everywhere" has to invalidate something real.

Storage keys:
```
rt:<userId>:<family>  →  { currentGen, expiresAt }
rt:used:<tokenId>     →  1 (for reuse detection, TTL = RT lifetime)
```

## 2. Role System

Three principals, with hard role-gates at the middleware:

| Role | Login | Source of truth |
|---|---|---|
| `user` | phone + OTP | `users` collection |
| `worker` | phone + OTP (+KYC approval gate to receive orders) | `workers` collection |
| `admin` | email + password (2FA-ready) | `admins` collection (new) |

Admins are provisioned via the `bootstrap-admin.js` script — they never self-sign-up.

## 3. Transactions & Payouts

New `transactions` collection:
- One row per order on completion (customer charge side)
- One row per worker earning on completion (worker payout side)
- One row per refund on cancellation
- Double-entry style: `type: "charge" | "earning" | "refund" | "payout"`

Enables:
- Admin revenue analytics
- Worker earnings statement (with filters)
- Payout batching cron (weekly)

## 4. MongoDB Multi-doc Transactions

Used in one critical place: **order-worker lock**.

```
session = startSession()
session.startTransaction()
  - Order.findOneAndUpdate(_id, status=searching → assigned, workerId=W)
  - Worker.findOneAndUpdate(_id=W, isAvailable=true → false, currentOrderId=order)
session.commitTransaction()
```

Without a transaction, an API crash between the two updates can leave an orphan
(worker marked busy on no order, or order assigned to a worker still marked free).
This is the single highest-value place to spend the transaction budget.

Other places use single-document atomic ops where one doc is enough.

## 5. Runtime Pricing Config

Admin `PUT /api/admin/pricing-config` writes to Redis key `config:pricing`.
The pricing service reads-through Redis on every quote, falling back to env-based
defaults. A config change is live in < 1 second across all API nodes, no restart.

## 6. Abuse Prevention

Three checks, all Redis-backed (cheap and cluster-wide):

1. **Booking rate cap** — a user can create at most N orders in 10 minutes
2. **Rapid-cancel strike system** — 3 user-side cancellations after assignment
   in 24h → account flagged for review (cannot book for 1h)
3. **Worker reject-rate monitoring** — if a worker rejects > 70% of the last 20
   offers, they're auto-unavailable until they tap "I'm back" (reduces stale
   online workers polluting match results)

## 7. Input Sanitization

Mongo injection prevention via a middleware that strips keys starting with `$`
and containing `.` from all inputs — cheaper and more predictable than
`express-mongo-sanitize` which has maintenance concerns.

## 8. Observability Additions

Structured error codes (not just messages) for client-side switch-on handling.
Request IDs propagate through logs. An audit log collection records privileged
admin actions.

## 9. Testing

Jest + Supertest structure with:
- Pure-function unit tests (pricing, geo-scoring)
- Integration tests against mongodb-memory-server + ioredis-mock
- Sample harness for one full order lifecycle
