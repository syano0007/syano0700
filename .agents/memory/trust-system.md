---
name: Trust System V1 architecture
description: Verification tiers, 0-100 score engine, SellerTrustBadge, API routes, audit table name, and known pitfalls.
---

## Architecture

- **Score engine:** `artifacts/api-server/src/lib/trustScore.ts` — 0-100, components: completedOrders(30) + storeRating(25) + deliverySuccess(20) + reviewCount(10) + accountAge(5) + followers(5) − cancellationPenalty − violationsPenalty
- **Verification tiers:** none | basic | verified | business (stored on `users.verification_level`)
- **isVerified:** `users.is_verified` boolean — set true when level becomes verified/business
- **Audit table:** `seller_verification_log` (NOT `verification_audit_log` — that name collides with the OTP audit table in schema.sql)
- **Badge component:** `artifacts/marketplace/src/components/SellerTrustBadge.tsx`

## API Routes (all under /api prefix)

```
GET  /sellers/:id/trust                    — public live breakdown
GET  /admin/sellers/verification           — admin: all sellers + verification status
POST /admin/sellers/:id/verification       — admin: set/clear tier (action: verify|unverify, level: basic|verified|business)
GET  /admin/trust/leaderboard              — admin: trust leaderboard
POST /admin/sellers/:id/recompute-trust    — force score recompute
```

## Frontend pages

- `marketplace/src/pages/admin/verification.tsx` — admin verification management
- `marketplace/src/pages/seller/trust.tsx` — seller self-service trust page
  - Reads: `components.completedOrders`, `components.storeRating`, `components.deliverySuccess`, `components.reviewCount`, `components.accountAge`, `components.followers`, `components.cancellationPenalty` (from liveBreakdown.components)

## DB fields on users table

- `is_verified` boolean NOT NULL DEFAULT false
- `verification_level` text DEFAULT 'none'
- `verified_at` timestamp
- `verified_by` INTEGER (additive column via run-migrations.ts — NOT in schema.sql)
- `trust_score` INTEGER DEFAULT 0
- `trust_score_updated_at` timestamp
- `verification_method` text

## Store endpoints fix (June 11, 2026)

`GET /sellers/store/:slug` and `GET /sellers/:id/store-preview` were missing `isVerified` from SELECT + response JSON. Fixed by adding `isVerified: usersTable.isVerified` to both queries and `isVerified: storeData.isVerified ?? false` to both responses.

**Why:** SellerTrustBadge on product detail and store pages requires `isVerified` to render the correct badge tier.

## Known pitfalls

- tsx watch does NOT always hot-reload route changes → restart API server after sellers.ts edits
- Vite cache must be cleared (restart marketplace workflow) after new badge imports
- Seller apply endpoint is `POST /api/seller-applications` (NOT `/api/seller/apply`) — must include `categories: string[]` (min 1)
- Admin login must use `role:"admin"` — not "customer"
- Rate limiter is in-memory; restart API to clear 429s during testing
