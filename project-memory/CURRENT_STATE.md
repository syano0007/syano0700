# CURRENT_STATE.md — SYANO (سوق سوريا)

## LATEST VERIFIED CHECKPOINT
**Date:** 2026-06-11
**Recovery Version:** Post-Migration Stable Build (v5) — Phase 1+2 Stability Audit: Notification Enum Expansion + Delivery Status TS Fixes + Mobile i18n

This document is the single authoritative source of truth for the workspace state.
Future recovery agents must restore THIS EXACT checkpoint.

---

## Status Summary

| Component | Status |
|---|---|
| API Server | ✅ HEALTHY — port 8080 |
| Marketplace (Vite) | ✅ HEALTHY — port dynamic |
| Mobile (Expo) | ✅ HEALTHY — port dynamic |
| PostgreSQL | ✅ CONNECTED |
| Database | ✅ 26 TABLES (delivery system) |
| Official Logo | ✅ VERIFIED |
| Browser Console | ✅ ZERO ERRORS |
| TypeScript | ✅ 0 STRUCTURAL ERRORS |
| Known Structural Issues | ✅ NONE |
| Known Runtime Issues | ✅ NONE |
| Recently Viewed Products | ✅ IMPLEMENTED 2026-06-11 |
| Product Wizard Inventory UX | ✅ IMPROVED 2026-06-11 |
| Delivery System | ✅ FULLY INTEGRATED 2026-06-11 |
| Notification Enum (DB) | ✅ 31 TYPES — all delivery statuses added 2026-06-11 |
| Mobile i18n Delivery Statuses | ✅ ALL 15 STATUS KEYS PRESENT (EN+AR) |
| Pending Features | ✅ NONE |

---

## Official Branding

**Official SYANO logo:** Silver/metallic "S" letterform with green neon glow, 500×500 RGBA PNG
- Canonical source: `artifacts/marketplace/src/assets/syano-logo.png`
- Public URL: `artifacts/marketplace/public/syano-logo.png`
- Mobile icon: `artifacts/mobile/assets/images/icon.png`
- Used in: Navbar (×3), AdminLayout (×1), index.html JSON-LD
- All PWA icons (6 sizes) generated from this official logo

---

## Database State

**Total tables: 26** (verified 2026-06-11)

| Table | Status |
|---|---|
| admin_audit_log | ✅ |
| cart_items | ✅ |
| conversations | ✅ |
| messages | ✅ |
| notifications | ✅ |
| order_items | ✅ |
| order_status_history | ✅ |
| orders | ✅ |
| platform_settings | ✅ |
| product_variant_groups | ✅ |
| product_variant_options | ✅ |
| product_variant_values | ✅ |
| product_variants | ✅ |
| products | ✅ |
| push_subscriptions | ✅ |
| reviews | ✅ |
| seller_applications | ✅ |
| seller_reviews | ✅ |
| store_follows | ✅ |
| users | ✅ |
| variant_images | ✅ (added in recovery 2026-06-09) |
| verification_audit_log | ✅ |
| couriers | ✅ (delivery system) |
| delivery_zones | ✅ (delivery system) |
| courier_assignments | ✅ (delivery system) |
| courier_applications | ✅ (delivery system) |

**All migrations idempotent in `run-migrations.ts`:**
- ✅ orders.shipping_company, orders.tracking_number
- ✅ cart_items.variant_id
- ✅ order_items.variant_id, order_items.variant_details
- ✅ product_variants (price, compare_at_price, barcode, weight_grams, dimensions)
- ✅ products.sales_count
- ✅ users.account_status, suspended_reason, suspended_by, suspended_at
- ✅ users.reset_otp_hash, reset_otp_expires_at, reset_otp_attempts, reset_otp_locked_until
- ✅ variant_images table (CREATE TABLE IF NOT EXISTS)

---

## Asset State

| Asset | Location | Status |
|---|---|---|
| Official logo (canonical) | `artifacts/marketplace/src/assets/syano-logo.png` | ✅ 112KB |
| Official logo (public) | `artifacts/marketplace/public/syano-logo.png` | ✅ 112KB |
| favicon.svg | `artifacts/marketplace/public/favicon.svg` | ✅ 163B |
| favicon-16x16.png | `artifacts/marketplace/public/` | ✅ |
| favicon-32x32.png | `artifacts/marketplace/public/` | ✅ |
| favicon-48x48.png | `artifacts/marketplace/public/` | ✅ |
| apple-touch-icon.png | `artifacts/marketplace/public/` | ✅ |
| android-chrome-192x192.png | `artifacts/marketplace/public/` | ✅ |
| android-chrome-512x512.png | `artifacts/marketplace/public/` | ✅ |
| Inter font | `artifacts/marketplace/public/fonts/inter-latin.woff2` | ✅ 73KB |
| OpenGraph image | `artifacts/marketplace/public/opengraph.jpg` | ✅ 114KB |
| manifest.json | `artifacts/marketplace/public/manifest.json` | ✅ |
| sw.js | `artifacts/marketplace/public/sw.js` | ✅ |
| robots.txt | `artifacts/marketplace/public/robots.txt` | ✅ |
| Sitemaps (5 files) | `artifacts/marketplace/public/` | ✅ |
| Mobile icon | `artifacts/mobile/assets/images/icon.png` | ✅ 112KB |

---

## Root Owner

| Field | Value |
|---|---|
| Email | `delewatiamer7@gmail.com` |
| Password | `00Amer00` |
| Role | `admin` |
| Status | `active` |
| Is Verified | `true` |
| Self-healing | Yes — `bootstrapRootAdmin()` on every API startup |

---

## Users in Database (2026-06-09)

| ID | Email | Role | Notes |
|---|---|---|---|
| 1 | delewatiamer7@gmail.com | admin | Root Owner — permanent |
| 2 | test@test.com | customer | Recovery test account |
| 3 | admin@syano.online | admin | Original platform admin (from backup) |
| 4 | delewatiamer8@gmail.com | customer | Real user (from backup) |

---

## Platform Settings (2026-06-09)

| Key | Value |
|---|---|
| flash_sale_end | 2026-06-15T23:56:26.463Z |
| commission_rate | 5 |
| announcement | (empty) |

---

## Verified Systems

| System | Verified | Notes |
|---|---|---|
| Authentication | ✅ 2026-06-09 | JWT, bcrypt, OTP (disabled via flag) |
| Guest Cart | ✅ | All entry points |
| Seller Dashboard | ✅ | Full flow |
| Admin Dashboard | ✅ | Full flow |
| Notifications | ✅ | SSE + polling, DO NOT MODIFY |
| Messaging | ✅ | SSE + polling |
| Product Variants | ✅ | VariantBuilder RTL/mobile QA complete (see VARIANT_SYSTEM_STATE.md) |
| Variant Images | ✅ | Table exists, API routes work |
| Push Notifications | ✅ | VAPID service worker |
| Account Suspension | ✅ | requireActiveAccount middleware |
| Seller Applications | ✅ | Draft → submit → approve/reject |
| Store Follow | ✅ | |
| Reviews (products) | ✅ | |
| Reviews (sellers) | ✅ | |
| Flash Sale | ✅ | |
| i18n AR + EN | ✅ | 1,837 lines each |
| RTL Layout | ✅ | |
| Search | ✅ | pg_trgm |
| Sitemap | ✅ | |
| CSV Export | ✅ | |
| Performance | ✅ | See PERFORMANCE_STATE.md |
| Products page | ✅ | CSS grid, no virtualizer |
| Mobile (Expo 54) | ✅ | 17 screens |
| Google Translate | ✅ | translate="no" on prices |
| Delivery System | ✅ | couriers, delivery_zones, courier_assignments, 15 order statuses |
| notification_type enum | ✅ | 31 types (all delivery statuses) in DB |
| Order status TS enums | ✅ | All 4 enums in api.schemas.ts updated |
| Mobile i18n delivery | ✅ | All 15 status keys EN+AR in index.ts |

---

## Pending Features

None. Workspace is in stable verified state.

---

## Next Recovery Agent Instructions

See SYANO_MASTER_RECOVERY.md
