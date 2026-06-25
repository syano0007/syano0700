---
name: Store Settings V2 architecture
description: 8-tab seller store settings page — DB columns, API, frontend, recovery check wiring
---

# Store Settings V2

## New DB columns (seller_applications table)
Added via executeSql (ADD COLUMN IF NOT EXISTS):
- `shipping_policy`, `return_policy`, `warranty_policy`, `privacy_policy`
- `meta_title`, `meta_description`, `seo_image_url`
- `whatsapp`, `telegram`, `facebook`, `instagram`

All are text, nullable. Also added to schema: `lib/db/src/schema/seller_applications.ts`.

## API
- `PATCH /sellers/store/branding` — handles all 11 new fields (+ existing branding fields)
- `GET /admin/store-settings-health/:sellerId` — returns {score, settingsLoaded, brandingConfigured, contactConfigured, policiesConfigured, seoConfigured, missing[]}
- `GET /seller-applications/my` — returns all new columns (must be in SELECT, currently using SELECT *)

## Frontend (artifacts/marketplace/src/pages/seller/store-settings.tsx)
- 8 tabs: General | Branding | Contact | Policies | Trust | SEO | Health | Advanced
- Sticky tab nav with unsaved-changes badge and alert dialog
- Save status indicator (saving/saved/failed) in header
- Live brand preview (color swatch + logo + banner composite)
- ScoreRing SVG for health tab
- Trust data from `GET /sellers/:id/trust` — breakdown bars + link to trust page
- SEO tab with live Google/OG card previews
- Health tab with per-item fix-in-tab buttons
- Advanced tab: slug with live URL preview + slug sanitization (lowercase, hyphens only)

## Recovery Check
- `internalPatch` helper added at line ~71 (alongside internalGet)
- `checkStoreSettings(sellerToken, sellerId, adminToken)` is Section 15
- Added to WEIGHTS: `storeSettings: 5`
- Wired into Promise.all, checkResults, sections, roadmapState
- Validated: 100/100 with 16/16 modules passing, 0 failures, 0 warnings

## i18n
- ~70 keys under `store_settings.*` in both en.json and ar.json
- Policy type pattern: `${type}_policy_label` / `${type}_policy_placeholder` for shipping/return/warranty/privacy

**Why:** Seller store settings was the last major seller-facing page without structured fields for policies, SEO, and social — essential for trust-building and discoverability.

**How to apply:** Any future Store Settings additions: add DB column via executeSql, add to schema.ts, add to PATCH handler body, add to frontend StoreData interface + form load + save body.
