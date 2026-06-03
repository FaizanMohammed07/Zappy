# Schema Map

## Order
```
service: enum [puncture, plumbing, electrical, helper, carpenter, ac_repair, cleaning, painting,
               screen_replacement, battery_replacement, charging_issue, speaker_mic_issue, software_issue, water_damage_check,
               mason, battery_jump_start, fuel_delivery, bike_wash, car_wash, minor_roadside_repair]
subCategory: String
description: String
images: [String]  // S3 URLs
scheduledAt: Date  // null = now
priority: enum [normal, emergency]
pickupLocation: { type: 'Point', coordinates: [lng,lat], address, landmark, flatNumber, notes }
dropLocation: { type: 'Point', coordinates: [lng,lat], address }
pricing: { baseFee, distanceKm, distanceFee, etaMinutes, timeFee, platformFee, surgeMultiplier, subtotal, total, currency }
status: enum [created, searching, assigned, on_the_way, arrived, in_progress, completed, cancelled, failed]
statusHistory: [{ status, at, meta }]
dispatch: { attemptedWorkerIds, currentOfferWorkerId, offerExpiresAt, attempts }
payment: { method: enum[cash,upi,card], status, transactionId, paidAt }
earnings: { workerPaise, platformPaise, commissionRate, settledAt }
userRating, workerRating, completionPhotos, promoCode, discountPaise, otp
// NEW FIELDS (post vertical expansion):
vehicleType: enum [bike, scooter, car]  // vehicle services
deviceBrand: String  // mobile services
deviceModel: String  // mobile services
serviceMode: enum [doorstep, pickup]  // mobile services
pricingModel: enum [standard, hourly, project]  // construction
```
Indexes: pickupLocation (2dsphere), status+createdAt, userId+status, workerId+status

## Worker
```
phone, name, email, passwordHash
skills: [String]  // puncture, plumbing, electrical, helper, carpenter, ac_repair, cleaning, painting,
                  // + mobile: screen_replacement, battery_replacement, charging_issue, speaker_mic_issue, software_issue, water_damage_check
                  // + construction: mason, plumbing, electrical, carpenter, painting
                  // + vehicle: battery_jump_start, fuel_delivery, bike_wash, car_wash, minor_roadside_repair, puncture
rating, totalJobs, completedJobs
kyc: { status: enum[not_submitted, pending_review, approved, rejected], aadhaarUrl, licenseUrl, selfieUrl, submittedAt, reviewedAt, reviewedBy, rejectionReason }
isOnline, isAvailable
currentLocation: { type: 'Point', coordinates: [lng,lat], updatedAt }
currentOrderId, wallet: { balance, totalEarnings }
penalties: { totalOffers, totalRejects, totalCancels, totalNoShows, lastPenaltyAt }
deviceTokens: [String]  // FCM
isBlocked, lastSeenAt
```
Indexes: currentLocation (2dsphere), isOnline+isAvailable+skills

## User
```
phone, name, email, passwordHash
savedAddresses: [{ label, address, location: Point, landmark, flatNumber, notes, tag }]
recentLocations: [{ address, lat, lng, usedAt }]
deviceTokens: [String]
defaultPayment: enum [cash, upi, card]
rating, isBlocked
gamification: { xp, level, streak, lastOrderDate, totalOrders, badges: [{ id, label, earnedAt }] }
```

## PricingConfig (singleton-ish, versioned)
```
version, baseFeePaise, perKmFeePaise, perMinFeePaise, platformFeePaise, minFarePaise
serviceOverrides: [{ service, multiplier, minFarePaise }]
surgeEnabled, surgeMaxCap, commissionRate, isActive, createdBy, notes
```
Index: isActive (unique partial)

## VerticalConfig (NEW — per-vertical pricing config)
```
vertical: enum [mobile, construction, vehicle]
isActive: Boolean
version: Number
createdBy: ObjectId(Admin)
mobile: {
  inspectionFeePaise: Number,
  urgentSurchargePaise: Number,
  warrantyDays: Number,
  spareParts: [{ brand, service, model, costPaise, isActive }]
}
construction: {
  visitFeePaise: Number,
  perHourFeePaise: Number,
  materialMarkupPct: Number,
  urgentSurchargePct: Number,
}
vehicle: {
  baseVisitFeePaise: Number,
  perKmFeePaise: Number,
  emergencySurchargePaise: Number,
  nightSurchargePaise: Number,
  nightStartHour: Number,
  nightEndHour: Number,
}
```

## ServiceCatalog
```
code: String (unique, index)  // e.g. 'screen_replacement', 'mason', 'car_wash'
name: String
icon: String
category: enum [vehicle, home, helper, beauty, mobile, construction, other]
description, estimatedDurationMinutes
priceRangeMinPaise, priceRangeMaxPaise
checklist: [{ item, required }]
guidelines: [String]
requiredTools: [String]
requiredSkills: [String]
isActive, sortOrder
```

## Wallet
```
owner: { kind: enum[user,worker], id: ObjectId }
balancePaise: Number  // denormalized cache
lifetimeCreditedPaise, lifetimeDebitedPaise
currency, isFrozen, version
```

## Transaction
```
type: enum [credit, debit]
owner: { kind, id }
amountPaise: Number (signed: + credit, - debit)
reason: String
refOrderId, refPaymentIntentId, refSubscriptionId
description, metadata
idempotencyKey: String (unique)
status: enum [pending, succeeded, reversed]
balanceAfterPaise
```

## Notification
```
recipient: { kind: enum[user,worker], id: ObjectId }
type: String
title, body, data, deepLink
channels: { socket: {sent}, push: {sent}, sms: {sent} }
readAt: Date
```

## CancellationFeeRecord  (Worker Cancellation Shield Fund)
```
orderId: ObjectId(Order)  // unique — one record per cancelled order
userId:  ObjectId(User)
workerId: ObjectId(Worker) | null   // null if cancelled while still searching
cancelledAtStage: enum [created, searching, assigned, on_the_way, arrived]
feePaise: Number                    // fee assessed (0 for grace)
isGrace: Boolean                    // true = first-ever searching cancel → ₹0 + warning
harmScore: Number                   // 0/1/2/3/5 — weight for Monday fund payout
cancelsInPeriod: Number             // user's cancel count in last 30 days (determines fee tier)
collectionStatus: enum [grace, zero_fee, collected_wallet, pending_next_order,
                        collected_next_order, written_off]
collectedAt: Date
collectedFromOrderId: ObjectId(Order) | null   // which booking collected a deferred fee
addedToFundWeekId: ObjectId(ShieldFundWeek)
addedToFundAt: Date
warningIssuedAt: Date
```
Indexes: userId+createdAt, addedToFundWeekId+workerId

## ShieldFundWeek
```
weekStart: Date  // Monday 00:00:00 UTC (unique index)
weekEnd:   Date  // Sunday 23:59:59 UTC
totalCollectedPaise: Number   // sum of all fees added this week
platformCutPaise: Number      // splitPlatformPct% of total
workerPoolPaise: Number        // splitWorkerPct% of total
splitWorkerPct: Number         // snapshot of split at payout time (default 85)
splitPlatformPct: Number       // snapshot (default 15)
status: enum [open, paid_out, skipped]
paidOutAt: Date
payoutsCount: Number
triggeredBy: enum [cron, admin]
```

## ShieldWorkerPayout
```
weekId:   ObjectId(ShieldFundWeek)
workerId: ObjectId(Worker)
harmScore: Number              // total harm points this worker accumulated this week
cancellationsCount: Number
feeRecordIds: [ObjectId]       // which CancellationFeeRecords contributed
amountPaise: Number            // proportional share of workerPoolPaise
status: enum [pending, paid, failed]
paidAt: Date
transactionId: ObjectId(Transaction)
```
Unique index: weekId + workerId

## ShieldConfig  (editable via admin — versioned)
```
feeSchedule: {
  created:    [Number, Number, Number]   // always [0,0,0]
  searching:  [Number, Number, Number]   // [tier0, tier1, tier2+] in paise
  assigned:   [Number, Number, Number]
  on_the_way: [Number, Number, Number]
  arrived:    [Number, Number, Number]
}
harmScores: { created, searching, assigned, on_the_way, arrived }  // points per stage
splitWorkerPct: Number    // default 85
splitPlatformPct: Number  // default 15
isActive: Boolean
version: Number
updatedBy: ObjectId(Admin)
```
Cache: Redis key `config:shield:active`, TTL 60s
