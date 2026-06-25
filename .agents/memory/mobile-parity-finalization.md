---
name: Mobile parity finalization
description: 14 new screens added in Mx phase; i18n import path conventions and design decisions.
---

# Mobile Parity Finalization (Phase Mx)

## 14 New Screens

| Screen | Path | Notes |
|---|---|---|
| verify | app/verify.tsx | Redirects to "/" (verification disabled in prod — matches web) |
| categories | app/categories.tsx | Fetches /api/search/filter-options, color palette by slug hash |
| customer-dashboard | app/customer-dashboard.tsx | Stats + recent orders, uses useGetCustomerDashboard() hook |
| about | app/about.tsx | Hero, 4 stat cells, 5 value cards |
| contact | app/contact.tsx | 3 channels + validation form (no real submission — local success state) |
| help | app/help.tsx | 5 categories (orders/payments/shipping/returns/account), 5 Q&As each, search |
| admin/courier-applications | app/admin/courier-applications.tsx | 4 tabs, approve/reject/suspend/reactivate via PATCH /admin/couriers/:id |
| admin/verification | app/admin/verification.tsx | Verify/unverify sellers via POST /admin/sellers/:id/verification |
| admin/support | app/admin/support.tsx | Ticket tabs, resolve/close via PATCH /admin/support/tickets/:id |
| seller/trust | app/seller/trust.tsx | Trust score breakdown from /api/sellers/:id/trust |
| privacy-policy | app/privacy-policy.tsx | 8 sections bilingual (EN/AR hardcoded, no i18n keys for content) |
| terms | app/terms.tsx | 9 sections bilingual |
| returns | app/returns.tsx | 8 sections bilingual |
| cookies | app/cookies.tsx | 7 sections bilingual |

## Critical: i18n import paths

- Screens in `app/` directory: `import { t } from "../src/i18n"` (ONE level up)
- Screens in `app/admin/` or `app/seller/`: `import { t } from "../../src/i18n"` (TWO levels up)
- `getLocale()` in static pages: `require("../src/i18n").getLocale()` (same prefix rule)

**Why:** `artifacts/mobile/tsconfig.json` baseUrl is `"."` (artifacts/mobile/). Relative paths from `app/` go: `..` = `artifacts/mobile/`, then `src/i18n`. From `app/admin/` go: `../..` = `artifacts/mobile/`, then `src/i18n`.

## i18n Namespaces Added

14 new namespaces in both EN and AR sections of `artifacts/mobile/src/i18n/index.ts`:
`customer_dashboard`, `categories`, `verify`, `about`, `contact`, `help`, `privacy`, `terms`, `returns`, `cookies`, `courier_applications`, `seller_verification`, `admin_support`, `seller_trust`

## profile.tsx updates

- Common menu: added "customer-dashboard" (customers) and "categories" (all)
- Seller menu: added "seller/trust"
- Admin menu: added "admin/courier-applications", "admin/verification", "admin/support"
- New "About & Legal" section at bottom: about, contact, help, privacy-policy, terms, returns, cookies

## Static page design decision

Bilingual content (EN/AR) is hardcoded directly in the components (SECTIONS_EN / SECTIONS_AR arrays) rather than in i18n keys. This avoids adding 100+ short text keys to the i18n file. Uses `getLocale()` to pick the right section.
