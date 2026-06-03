# API Map

## Auth `/api/auth`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | /otp/request | public | Request OTP |
| POST | /user/login | public | Login with OTP |
| POST | /worker/login | public | Worker login |
| POST | /admin/login | public | Admin login |
| POST | /refresh | public | Refresh token |
| POST | /logout | bearer | Logout |

## Users `/api/users`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /me | user | Get profile |
| PATCH | /me | user | Update profile |
| GET | /addresses | user | Saved addresses |
| POST | /addresses | user | Add address |
| DELETE | /addresses/:id | user | Delete address |
| POST | /recent-location | user | Save recent loc |
| POST | /device-token | user | Register FCM token |

## Orders `/api/orders`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | / | user | Create order |
| GET | /mine | user | List my orders |
| GET | /quote | user | Get price quote |
| GET | /:id | user/worker | Get order |
| POST | /:id/cancel | user | Cancel order |
| GET | /:id/cancel-preview | user | Cancel fee preview |
| POST | /:id/rate | user | Rate worker |
| GET | /:id/chat | user/worker | Chat messages |
| POST | /:id/chat | user/worker | Send message |
| GET | /:id/invoice | user/admin | Get invoice |

## Workers `/api/workers`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /me | worker | Get worker profile |
| POST | /online | worker | Go online |
| POST | /offline | worker | Go offline |
| POST | /location | worker | Update location |
| GET | /earnings | worker | Earnings summary |
| GET | /orders | worker | Worker's orders |
| POST | /orders/:id/accept | worker | Accept job offer |
| POST | /orders/:id/reject | worker | Reject job offer |
| POST | /orders/:id/status | worker | Update order status |
| GET | /demand-zones | worker | Nearby demand heatmap |

## KYC `/api/workers/kyc`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | /submit | worker | Submit KYC docs |
| GET | /status | worker | Get KYC status |

## Catalog `/api/catalog`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /services | public | List active services |
| GET | /services/:code | public | Get service details |
| GET | /invoices/:orderId | user/admin | Get invoice |

## Pricing `/api/pricing`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /config | user | Get active pricing |

## Wallet `/api/wallet`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /balance | user/worker | Get balance |
| GET | /transactions | user/worker | List transactions |
| POST | /topup | user | Add money |

## Payments `/api/payments`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | /create-intent | user | Create Razorpay order |
| POST | /webhook | public | Razorpay webhook |

## Subscriptions `/api/subscriptions`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /plans | public | List plans |
| POST | /subscribe | user/worker | Subscribe to plan |
| GET | /my | user/worker | My subscription |

## Notifications `/api/notifications`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | / | user/worker | List notifications |
| POST | /:id/read | user/worker | Mark read |
| POST | /read-all | user/worker | Mark all read |

## Admin `/{slug}/`
| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | /metrics | admin | Platform metrics |
| GET | /revenue | admin | Revenue stats |
| GET | /orders | admin | All orders |
| GET | /workers | admin | All workers |
| GET | /users | admin | All users |
| POST | /workers/:id/block | admin | Block worker |
| GET | /kyc/pending | admin | Pending KYC |
| POST | /workers/:id/kyc/approve | admin | Approve KYC |
| POST | /workers/:id/kyc/reject | admin | Reject KYC |
| GET | /pricing-config | admin | Get pricing |
| PUT | /pricing-config | admin | Update pricing |
| GET | /heatmap | admin | Demand heatmap |
| POST | /wallet/adjust | admin | Manual wallet adj |
| GET | /analytics | admin | Analytics data |
| GET | /feature-flags | admin | Feature flags |
| POST | /feature-flags | admin | Set feature flag |
| GET | /liveops | admin | Live operations |
| GET | /alerts | admin | System alerts |
| GET | /retention | admin | Retention cohorts |
| GET/POST | /support | admin | Support tickets |
| GET/POST/PATCH/DELETE | /plans | admin | Subscription plans |
| GET/PUT | /verticals/:vertical | admin | Vertical pricing configs |
| POST | /verticals/mobile/spare-parts | admin | Add spare part pricing |
| DELETE | /verticals/mobile/spare-parts/:id | admin | Remove spare part |
| GET | /shield/summary | admin | Fund stats + current week |
| GET | /shield/weeks | admin | Weekly fund history (paginated) |
| GET | /shield/weeks/:weekId/payouts | admin | Worker payouts for a week |
| GET | /shield/fees | admin | Fee records (filterable by status/user) |
| GET | /shield/pending-summary | admin | Total uncollected pending fees |
| GET | /shield/fee-schedule | admin | Active fee schedule + harm scores + split |
| PUT | /shield/fee-schedule | admin | Update fee schedule / harm scores / split % |
| POST | /shield/trigger-payout | admin | Manually run payout for all closed weeks |
| POST | /shield/fees/:id/write-off | admin | Write off a stale pending fee |
