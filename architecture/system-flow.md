# System Flows — Compressed

## User Booking Flow
1. User selects service on HomePage/ServicesPage → navigate `/book/:service`
2. BookingPage: pick sub-category → upload images → pick location (LocationPicker) → get quote (RTK Query `getQuote`)
3. SmartPricingPanel shows: baseFee + distanceFee + timeFee + platformFee × surge
4. User submits → `POST /api/orders` → order.service.createOrder()
   - Abuse check (Redis rate limit)
   - Pricing snapshot locked
   - Emergency surcharge applied if priority=emergency
   - Demand recorded for surge
   - Promo discount applied
   - OTP generated
   - BullMQ dispatch job enqueued
5. User redirected to `/orders/:id` (OrderTrackingPage)

## Worker Dispatch Flow
1. dispatch.worker.js processes job from BullMQ queue
2. Geo query: Redis GEORADIUS for available workers with matching skills
3. Score workers: rating × completedJobs / (rejectionRate + 1)
4. Offer sent to best candidate via Redis pub/sub → socket `new_job_request`
5. Worker sees offer popup (WorkerDashboard) with 30s timer
6. Accept: `POST /api/workers/orders/:id/accept` → worker assigned, socket `job.assigned`
7. Reject/timeout: next candidate offered; after exhausting candidates, expand radius
8. Force-assign after DISPATCH_MIN_SEARCH_MS if needed

## Worker Job Flow
1. Worker goes online: `POST /api/workers/online` → Redis GEO marked, supply recorded
2. Receives offer via socket → accepts → navigates `/worker/jobs/:id`
3. Status updates: on_the_way → arrived → in_progress → completed
4. Worker uploads completion photos
5. User verifies OTP at site
6. Order completed: earnings calculated, wallet credited, payout ledger updated
7. Worker rates user, user rates worker

## Admin Flow
- Dashboard: single SPA at `/{slug}/dashboard` with tab navigation
- All admin APIs gated by `authenticate + requireRole('admin')`
- Audit log records every admin action

## Payment Flow
1. `POST /api/payments/create-intent` → Razorpay order created
2. Client completes Razorpay checkout
3. Webhook `POST /api/payments/webhook` (signature verified) → marks payment paid
4. paymentsQueue processes settlement: worker wallet credited, platform share recorded

## Wallet Flow
- All money in PAISE (integer, no float errors)
- wallet.service.apply() is idempotent (idempotencyKey unique constraint)
- Debit guard: user wallet cannot go below 0; worker wallet floor at -₹500
- Every apply() creates Transaction doc (ledger) + updates Wallet.balancePaise

## Notifications Flow
1. Caller invokes notify({ recipient, type, title, body, data })
2. Notification doc persisted
3. Redis pub/sub publishes to `notification:{kind}:{id}`
4. Socket.io bridge receives → emits `notification` event to client room
5. notificationsQueue.add('push') → FCM push (for backgrounded app)
6. notificationsQueue.add('sms') → SMS (only SMS_TYPES: worker_assigned, arriving_soon, etc.)

## Auth Flow
1. OTP: `POST /api/auth/otp/request` → Redis stores OTP 5min TTL
2. Login: `POST /api/auth/user/login` or `/worker/login` with phone+OTP
3. Returns: accessToken (15min) + refreshToken (30d, stored in Redis family)
4. Refresh: `POST /api/auth/refresh` with refreshToken → new pair (rotation)
5. Logout: revokes refresh token family

## Order Status Machine
```
created → searching → assigned → on_the_way → arrived → in_progress → completed
                    ↘ (timeout/fail) → failed
       → cancelled (from created/searching/assigned)
```
