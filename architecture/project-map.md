# Zappy Hyperlocal Platform — Project Map

## Repository Structure
```
hyperlocal-platform/
├── server/                  # Node.js/Express API (port 4000)
│   └── src/
│       ├── config/          # env validation, redis client
│       ├── jobs/            # BullMQ queues + workers (dispatch, notifications, payments)
│       ├── middlewares/     # auth (JWT), validate (Joi), error handler
│       ├── modules/         # domain modules (see below)
│       ├── routes/index.js  # mounts all module routes
│       ├── sockets/index.js # Socket.io server + Redis pub/sub bridge
│       └── utils/           # logger, helpers
│
├── client/                  # React/Vite SPA (port 5173)
│   └── src/
│       ├── components/      # booking/, common/, layout/, tracking/
│       ├── config/          # admin.js (slug-based admin URL)
│       ├── hooks/           # useSocket, useGeolocation, useFCM, useSocket
│       ├── lib/             # animations (framer-motion)
│       ├── modules/         # auth/authSlice, booking/LocationPicker, order/orderSlice, worker/workerSlice
│       ├── pages/           # all pages + pages/admin/* 
│       ├── routes/          # n/a (routes in App.jsx)
│       ├── services/        # api.js (RTK Query), socket.js
│       ├── store/           # Redux store
│       └── styles/          # global CSS (Tailwind)
│
├── architecture/            # THIS FOLDER — compressed architectural memory
└── deploy/                  # deployment configs
```

## Server Module Map
| Module       | Files                                                           | Purpose                               |
|-------------|------------------------------------------------------------------|---------------------------------------|
| admin        | admin.controller.js, admin.model.js, admin.routes.js           | Admin CRUD, metrics, toggles          |
| ads          | ad.controller.js, ad.model.js, ad.routes.js, ad.service.js     | Ad campaigns                          |
| auth         | auth.controller.js, auth.routes.js, auth.service.js, token.service.js | JWT + OTP login            |
| chat         | call-session.model.js, calling.service.js, chat-message.model.js, chat.service.js | In-order chat |
| dispute      | dispute.{controller,model,routes,service}.js                   | Order disputes                        |
| engagement   | engagement.{controller,routes}.js, recommendations.service.js, support-ticket.model.js, user-gamification.service.js | Recommendations, support, gamification |
| notification | notification.{controller,model,routes,service}.js             | Persist + FCM + SMS + socket fan-out  |
| order        | order.{controller,model,repository,routes,service}.js, abuse.service.js, cancellation-config.model.js, cancellation.service.js, emergency.service.js, feedback.model.js | Core order lifecycle |
| payment      | payment-intent.model.js, payment.{controller,routes,service}.js, razorpay.client.js, transaction.model.js | Razorpay payments |
| payout       | payout.{controller,model,routes,service}.js                   | Worker payouts                        |
| pricing      | pricing-config.model.js, pricing.{controller,routes,service}.js | Dynamic pricing engine              |
| promo        | promo.{controller,model,routes,service}.js                    | Promo codes                           |
| referral     | referral.{controller,model,routes,service}.js                 | Referral program                      |
| service      | service-catalog.model.js, service.{controller,routes}.js, invoice.service.js | Service catalog + invoices |
| subscription | plan.model.js, plan.seed.js, subscription.{controller,model,routes,service}.js | Subscription plans |
| user         | upload.{controller,routes}.js, user.{controller,model,routes}.js | User profile + S3 upload |
| wallet       | cashback.service.js, ledger.service.js, wallet.{controller,model,routes,service}.js | Wallet + ledger |
| worker       | eta.service.js, geo.service.js, incentive.service.js, kyc.{controller,routes}.js, maps.service.js, worker-dues.service.js, worker.{controller,model,routes,service}.js | Worker lifecycle |

## App Boundaries
- **User App**: `/` `/home` `/services` `/book/:service` `/orders` `/orders/:id` `/profile` `/wallet` `/plans`
- **Worker App**: `/worker` `/worker/jobs/:id` `/worker/kyc`
- **Admin Panel**: `/{ADMIN_SLUG}/dashboard` (slug from env `ADMIN_LOGIN_SLUG`)

## Tech Stack
- **Backend**: Node.js + Express + Mongoose (MongoDB) + Redis (ioredis) + BullMQ + Socket.io
- **Frontend**: React 18 + Vite + Redux Toolkit + RTK Query + Tailwind CSS + Framer Motion + Lucide
- **Infra**: AWS S3 (uploads), Google Maps (distance/ETA), Razorpay (payments), Firebase (FCM push)
- **Queues**: dispatch, notifications, payments (BullMQ workers in jobs/)

## Entry Points
- Server: `server/src/index.js` (or server.js)
- Client: `client/src/main.jsx` → `App.jsx` → `Routes`
