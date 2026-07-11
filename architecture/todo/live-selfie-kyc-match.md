# TODO — Live Selfie Verification on Job Accept (KYC face match)

**Status:** planned (not built)
**Priority:** high (anti account-sharing / impersonation)
**Depends on:** a face-match provider (AWS Rekognition `CompareFaces` recommended; Face++/KYC provider also possible)

---

## Goal
After a worker **accepts** a job, and before they can **Start Trip**, they must take a
**live selfie** that is matched against their **KYC selfie** (`worker.kyc.selfieUrl`).
This guarantees the person physically doing the job is the same verified person on the
KYC record.

## Flow

```
Worker taps ACCEPT
      │
      ▼
Order requires selfie → WorkerJobPage shows LiveSelfieCapture
   (reuse existing KYC liveness component: client/src/components/kyc/LiveSelfieCapture.jsx)
      │  worker takes a LIVE selfie
      ▼
Upload selfie → S3  →  POST /orders/:id/verify-selfie  { selfieKey }
      │
      ▼
Server compares LIVE selfie vs worker.kyc.selfieUrl via face-match provider
      │
   match ≥ threshold → status = PASSED → Start Trip unlocked
   match < threshold → status = FAILED, attempts++ → retry (max 3) → block + alert admin
```

The only change to the existing order lifecycle: **`workerStartTrip` is gated** on
`selfieVerification.status === 'passed'` (or `skipped` when no provider is configured).

## Implementation checklist

### Server
- [ ] `order.model`: add
  `selfieVerification: { status: 'not_required'|'pending'|'passed'|'failed'|'skipped', selfieUrl, matchScore, attempts, verifiedAt }`
- [ ] `POST /orders/:id/verify-selfie` (worker, auth, rate-limited): loads `worker.kyc.selfieUrl`,
  presigns both images, calls the face-match provider, stores result.
- [ ] `worker/face-match.service.js`: provider-configurable adapter (Rekognition `CompareFaces`).
  Returns `{ matched, score }`. If no provider → returns `{ skipped: true }`.
- [ ] Gate in `order.service.workerStartTrip`: require `selfieVerification.status in ['passed','skipped']`.
- [ ] Config: `FACE_MATCH_PROVIDER`, `FACE_MATCH_THRESHOLD` (default ~0.85), provider keys.
- [ ] Admin: surface selfie + match score on the worker/order review; manual approve for `skipped`/`failed`.

### Client
- [ ] After accept, if `selfieVerification.status !== 'passed'`, show `LiveSelfieCapture`.
- [ ] Upload → `POST /orders/:id/verify-selfie`; on pass → proceed, on fail → retry with guidance.
- [ ] Disable "Start Trip" until passed/skipped.

## Edge cases
- **No KYC selfie on file** → cannot match → block + prompt to complete KYC.
- **Provider not configured / down** → store selfie, mark `skipped` (manual admin review),
  **fail-open** so jobs aren't blocked (launch-safe); flag for review.
- **No face / bad light / multiple faces** → reject with retry guidance.
- **Spoofing (photo of a photo)** → liveness (LiveSelfieCapture already records liveness
  metadata; use provider liveness/anti-spoof if available).
- **3 failed attempts** → block Start Trip + notify admin (possible impersonation).
- **Worker cancels after accept** → clear the selfie requirement.
- **Network drop mid-upload** → idempotent retry.

## Decision needed
Which face-match provider? Default plan is **AWS Rekognition `CompareFaces`** (cheap,
India-region available, we already use AWS S3). Until keys are added, the flow runs in
**capture + store for manual admin review** mode.
