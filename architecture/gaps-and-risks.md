# Gaps, Risks & New Vertical Requirements

## Pre-Existing Gaps (Fixed in this session)
- Order.service enum only had 8 services — no mobile/construction/vehicle sub-services
- No per-vertical pricing config (spare parts, hourly rates, night surcharges)
- No vehicle type field on Order (bike/scooter/car)
- No device brand/model field for mobile services
- No serviceMode (doorstep/pickup) for mobile services
- ServiceCatalog category only had: vehicle, home, helper, beauty, other — no mobile/construction
- Admin panel had no vertical service management section
- HomePage/ServicesPage had no mobile or construction categories

## Scalability Notes
- Geo bucket resolution (0.02°) = ~2.2km cells — adequate for city-level surge
- BullMQ dispatch: single job per order, expandable to parallel multi-city
- Redis GEO is O(N+log M) — scales to millions of workers with geo prefix sharding
- Socket.io Redis adapter handles multi-node correctly; scale horizontally

## Security Notes
- Admin login URL is slug-based (security by obscurity layer) — combine with rate limiting
- OTP is Redis-stored with 5min TTL — good
- S3 URLs should be pre-signed on server, not public — check upload controller
- Razorpay webhook verifies signature — good
- Worker wallet hard limit prevents runaway debt

## Production Readiness Checklist
- [ ] GOOGLE_MAPS_KEY must be a real server-side key (not client browser key)
- [ ] FCM credentials must be real Firebase service account
- [ ] ADMIN_LOGIN_SLUG must be randomized per deployment
- [ ] Redis persistence (AOF) should be enabled for wallet + order state
- [ ] MongoDB replica set needed for change streams (if added later)
- [ ] Add rate limiting middleware on /api/auth/otp/request

## New Vertical-Specific Risks
### Mobile Services
- Spare part pricing must be kept fresh — stale prices cause customer disputes
- Warranty tracking needs expiry job (add to BullMQ if tracking needed)
- Water damage assessment is opinion-based — add disclaimer flow

### Construction Services  
- Hourly billing requires timer start/stop in worker app — add to WorkerJobPage
- Material cost estimation is fuzzy — use admin-approved estimates + worker photo upload
- Multi-day jobs need order extension mechanism (future work)

### Vehicle Services
- Night surcharge requires server-side time check (not client) — implemented in VerticalConfig
- Fuel delivery needs vehicle registration info for legal compliance
- Battery jump-start may need equipment confirmation from worker
