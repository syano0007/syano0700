---
name: Verification System
description: Complete OTP verification system for Syano — architecture, API contract, and dev/prod modes
---

## Architecture

**DB schema additions (users table):**
`is_verified`, `verified_at`, `verification_method`, `otp_hash` (bcrypt), `otp_expires_at`, `otp_attempts`, `otp_locked_until`, `otp_request_count`, `otp_request_window_start`
New table: `verification_audit_log` (userId, event, method, ipAddress, metadata, createdAt)

**API routes (artifacts/api-server/src/routes/auth.ts):**
- `POST /auth/register` → 201 `{pendingVerification: true, identifier, method, message}` (NOT `{user, token}`)
- `POST /auth/login` → 403 `{verified: false, identifier, method}` for unverified users (also auto-sends fresh OTP)
- `POST /auth/send-otp` → sends OTP, anti-enumeration safe
- `POST /auth/resend-otp` → alias for send-otp with "otp_resent" audit event
- `POST /auth/verify-otp` → 200 `{user, token}` on success
- `POST /admin/users/:id/verify` → admin manual override

**Services:**
- `artifacts/api-server/src/services/verification.ts` — OTP gen (crypto.randomInt), bcrypt hash, email/SMS dispatch
- `artifacts/api-server/src/lib/rateLimiter.ts` — in-memory per-IP limiter (5/hr)

**Dev mode:** if RESEND_API_KEY missing → prints OTP banner to server console. No code changes needed to activate real email/SMS — just add env vars.
**Prod activation:** set RESEND_API_KEY + FROM_EMAIL for email; TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_VERIFY_SERVICE_SID (or TWILIO_FROM_PHONE) for SMS.

**Rate limits:**
- Per-IP: 5 OTP sends/hr (in-memory Map, cleared every 30min)
- Per-user: 5 OTP sends/hr (DB fields otpRequestCount + otpRequestWindowStart)
- Max attempts: 5 wrong codes → 30 min lockout
- OTP expiry: 10 minutes

**Frontend:**
- `artifacts/marketplace/src/pages/verify.tsx` — 6-box OTP input, countdown, resend, RTL-safe
- Login: on 403 `verified: false` → redirect to `/verify?identifier=xxx&method=email`
- Register: on 201 `pendingVerification: true` → redirect to `/verify?identifier=xxx&method=email`
- App.tsx: `/verify` route added as lazy import

**Why:** Existing users grandfathered with `is_verified = true` on 2026-06-02. All new registrations must verify before access.

**How to apply:** When modifying auth routes, remember register/login no longer return {user,token} directly for new users. The verify-otp endpoint is the only path to getting a session token for new accounts.
