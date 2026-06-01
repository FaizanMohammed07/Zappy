# Business Logic — Compressed

## Pricing Engine
Formula: `price = (base + distance×perKm + time×perMin + platformFee) × surge × serviceMultiplier`

Config priority: in-process 5s cache → Redis (60s TTL) → MongoDB PricingConfig → env defaults

**Service multipliers (serviceOverrides in PricingConfig):**
- helper: 0.9×, plumbing: 1.2×, electrical: 1.2×, carpenter: 1.3×, ac_repair: 1.5×, cleaning: 1.0×, painting: 1.4×
- (New) mobile services: see VerticalConfig.mobile
- (New) construction: see VerticalConfig.construction (visit + hourly/project + material markup)
- (New) vehicle: see VerticalConfig.vehicle (base + distance + emergency + night surcharge)

**Surge calculation:**
- demand/supply ratio by geo bucket (0.02° cell)
- ratio < 1 → 1.0×; < 2 → 1.2×; < 3 → 1.5×; < 5 → 1.8×; ≥ 5 → 2.5× (capped at surgeMaxCap)
- Premium users can have surgeCap applied

## Commission Split
- Default: 30% platform, 70% worker
- WORKER_PRO subscription: commissionDelta reduces platform cut
- Computed at order completion, immutable after

## Wallet Rules
- User wallet: cannot go below 0 (debit guard in apply())
- Worker wallet: can go to -₹500 (HARD_LIMIT_PAISE = -50000)
- Soft limit warning at -₹200 (dues service)
- isFrozen=true blocks all debits

## Dispatch Algorithm
1. Redis GEORADIUS for online+available workers with matching skill
2. Filter: rating ≥ DISPATCH_MIN_WORKER_RATING (3.0), not in attemptedWorkerIds
3. Score = rating × completedJobs / (rejectRate + 1) — abuse penalty degrades score
4. Offer to highest-scored worker, set offerExpiresAt
5. 30s timeout → reject → next candidate
6. After all candidates exhausted: expand radius by DISPATCH_RADIUS_KM
7. After DISPATCH_MIN_SEARCH_MS (5min): force-assign closest available

## Abuse Prevention
- User: max 3 bookings/hour (Redis rate limit)
- User: freeze after rapid cancels pattern
- Worker: reject limit → REJECT_LIMIT bans for REJECT_WINDOW_SEC
- Worker: cancel limit → CANCEL_LIMIT bans for CANCEL_WINDOW_SEC
- Worker penalty scores degrade dispatch priority

## Mobile Pricing (VerticalConfig.mobile)
- inspectionFeePaise: flat inspection fee (refunded if user accepts repair quote)
- sparePart cost: looked up by (brand, service, model) — admin-controlled
- urgentSurchargePaise: flat surcharge for same-day urgent bookings
- Total = inspectionFee + serviceLabor + spareParts + [urgentSurcharge]
- Warranty: warrantyDays from completion (admin-configurable per brand)

## Construction Pricing (VerticalConfig.construction)
- visitFeePaise: flat site visit fee
- pricingModel: 
  - hourly: visitFee + hours × perHourFee + materials × (1 + markupPct)
  - project: fixed project quote (admin sets after site assessment)
  - standard: visitFee + service multiplier × base
- urgentSurchargePct: % added for urgent bookings

## Vehicle Pricing (VerticalConfig.vehicle)
- baseVisitFeePaise: flat visit/dispatch fee
- perKmFeePaise: distance from worker to vehicle location
- emergencySurchargePaise: flat surcharge when priority=emergency
- nightSurchargePaise: flat surcharge during nightStartHour–nightEndHour (default 10pm–6am)
- Total = baseVisit + distance + [emergency] + [night]

## Cancellation Rules (CancellationConfig)
- freeCancelWindowSec: user can cancel free within N seconds of booking
- After window: userCancelFeePaise charged
- Worker cancel: workerCancelPenaltyPaise debited from worker wallet
- Worker no-show: workerNoShowPenaltyPaise debited + penalty score hit
- LateWorkerCancelMultiplier: penalty multiplied if cancel < threshold before scheduled

## Subscription Effects
User subscriptions (USER_PREMIUM):
- waivePlatformFee: platformFee = 0
- surgeCap: cap surge at plan's surgeCap value

Worker subscriptions (WORKER_PRO):
- commissionDelta: reduce commission rate (negative number)
- priorityDispatch: boosted in dispatch queue scoring

## Incentives (Worker)
Milestone bonuses (stored in Redis config, swept by incentive.service.js):
- 10 jobs: +₹200, 25: +₹500, 50: +₹1000, 100: +₹2500, 200: +₹5000
Rating bonus: workers with rating ≥ 4.8 get monthly bonus sweep
