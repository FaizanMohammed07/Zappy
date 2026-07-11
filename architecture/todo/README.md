# Zappy — Pending Work (TODO)

Tracked, not-yet-built features and deferred config. Each item links to its spec.

## Features
- [Live Selfie on Job Accept — KYC face match](./live-selfie-kyc-match.md) — worker must
  pass a live-selfie face match against their KYC before Start Trip. **Needs a face-match
  provider** (AWS Rekognition recommended).

## Deferred config / ops (code done — needs credentials or a one-time run)
- **OpenRouter credits** — fund the key so ZappyLens + Zappy Voice can call the model
  (currently 402 no-credits). Optional dedicated key: `VOICE_OPENROUTER_API_KEY`.
- **Call provider** — set `CALL_PROVIDER` (Twilio/Exotel) + keys so masked calling actually
  dials (mock returns a placeholder number).
- **KYC verification API** — set `KYC_PROVIDER` + keys to auto-verify PAN/bank; otherwise
  KYC stays manual admin approval.
- **Face-match provider** — set `FACE_MATCH_PROVIDER` + keys for the live-selfie feature above.
- **Prod catalog seed** — run `npm run bootstrap:catalog` so production has the newer
  services (towing, tank cleaning).
- **Tow / tank-cleaning worker skills** — onboard workers with `car_towing` / `bike_towing`
  / `tank_cleaning` skills so dispatch can match those jobs.

## Polish backlog (primitives built; roll out to remaining pages)
- Apply `QueryState` error+retry / `EmptyState` and pull-to-refresh to the remaining
  secondary pages (Spending, Referral, Promos, Support, Payment Methods, Scheduled).
