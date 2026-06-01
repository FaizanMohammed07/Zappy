# Deployment Map

## Services
| Service | Purpose | Config |
|---------|---------|--------|
| MongoDB Atlas | Primary DB | `MONGO_URI` |
| Redis Cloud (ap-south-1) | Cache, queues, geo, pub/sub | `REDIS_URL` |
| AWS S3 | Image/document uploads | `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Google Maps | Distance matrix, ETA | `GOOGLE_MAPS_KEY` |
| Razorpay | Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Firebase | FCM push notifications | Firebase service account (embedded in notifications.worker.js) |

## Environment Variables (server/.env)
```
NODE_ENV=development|production
PORT=4000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET=<min 32 chars>
JWT_EXPIRES_IN=7d
GOOGLE_MAPS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=hyperlocal-uploads-workers
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
DISPATCH_RADIUS_KM=5
DISPATCH_MAX_CANDIDATES=20
DISPATCH_OFFER_TIMEOUT_MS=15000
DISPATCH_STEP_WINDOW_MS=30000
DISPATCH_MIN_SEARCH_MS=300000
DISPATCH_MIN_WORKER_RATING=3.0
DISPATCH_FORCE_ASSIGN_RADIUS_KM=20
BASE_FEE=40
PER_KM_FEE=12
PER_MIN_FEE=2
PLATFORM_FEE=10
MIN_FARE=60
ADMIN_LOGIN_SLUG=<secret slug>
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

## BullMQ Workers (in jobs/)
| Worker | Queue | Concurrency | Purpose |
|--------|-------|-------------|---------|
| dispatch.worker.js | dispatch | 5 | Find workers, send offers, handle timeout |
| notifications.worker.js | notifications | 10 | FCM push + SMS |
| (implicit in payment.service) | payments | 3 | Razorpay settlement |

## Deploy Folder
- deploy/ — deployment scripts/configs (Dockerfile, nginx, PM2 ecosystem, etc.)
