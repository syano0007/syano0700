# KNOWN_ISSUES.md — SYANO (سوق سوريا)

## OPEN ISSUES

### KI-001
- **ID:** KI-001
- **Priority:** Low
- **Description:** TypeScript TS7006 implicit-any errors in callback parameters across api-server, marketplace, and mobile (e.g., `.map(s => ...)` without type annotation)
- **Current status:** Open / accepted — pre-existing, does not affect runtime
- **Affected files:** `artifacts/api-server/src/routes/orders.ts`, `products.ts`, `variants.ts`, `sellers.ts`, `reviews.ts`, `search.ts`; `artifacts/marketplace/src/pages/products/[id].tsx`, `seller/dashboard.tsx`, `seller/inventory.tsx`, `seller/messages.tsx`, `seller/orders.tsx`, `seller/products/index.tsx`, `store/[slug].tsx`; `artifacts/mobile/app/(tabs)/index.tsx`, `orders.tsx`, `checkout.tsx`, `order/[id].tsx`, `components/OrderCard.tsx`
- **Possible root cause:** Code written with implicit any in arrow function callbacks; noImplicitAny is enabled but these were accepted in the previous workspace state
- **Temporary workaround:** None needed — runtime is not affected; esbuild strips types
- **Resolved in version:** Not yet — intentionally not fixed to preserve existing behavior

### KI-003
- **ID:** KI-003
- **Priority:** Low
- **Description:** Expo package version mismatches — `expo@54.0.34` (expected ~54.0.35), `expo-font@14.0.11` (expected ~14.0.12), `expo-router@6.0.23` (expected ~6.0.24)
- **Current status:** Open / accepted — minor patch versions, no functional impact
- **Affected files:** `artifacts/mobile/package.json`
- **Possible root cause:** pnpm lockfile pinned to slightly older patch
- **Temporary workaround:** App runs correctly with current versions
- **Resolved in version:** Defer to next dependency update cycle

---

## RESOLVED ISSUES

### KI-R-BUG001
- **ID:** KI-R-BUG001
- **Priority:** High
- **Description:** `GET /api/orders` list missing 8 delivery/courier fields (`deliveryFee`, `zoneId`, `zoneNameEn`, `zoneNameAr`, `courierName`, `courierPhone`, `courierStatus`, `cancelledBy`, `cancellationReason`)
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Added batch-fetch of zones + courier assignments in orders.ts; all 8 fields now included in list response
- **Resolved in version:** QA Audit V1

### KI-R-BUG002
- **ID:** KI-R-BUG002
- **Priority:** High
- **Description:** `GET /api/admin/orders` list missing same 8 delivery/courier fields
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Added missing table imports + batch-fetch pattern to admin.ts; also fixed TS `never[]` inference with explicit `OrderItemRow` type
- **Resolved in version:** QA Audit V1

### KI-R-BUG003
- **ID:** KI-R-BUG003
- **Priority:** High
- **Description:** Customer orders "Active" tab silently hid all orders in new delivery statuses (`confirmed`, `preparing`, `ready_for_pickup`, `courier_assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `delivery_failed`)
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Expanded `STATUS_TAB_KEYS` active filter in `orders/index.tsx` to include all 8 missing statuses; also fixed `canCancel` logic to match V1 policy
- **Resolved in version:** QA Audit V1

### KI-R-BUG004
- **ID:** KI-R-BUG004
- **Priority:** Medium
- **Description:** Customer orders status badge rendered nothing (null) for all new delivery statuses
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Expanded `getStatusBadge()` switch statement in `orders/index.tsx` from 6 old cases to all 15 V1 statuses with correct badge colors
- **Resolved in version:** QA Audit V1

### KI-R-BUG005
- **ID:** KI-R-BUG005
- **Priority:** Critical (security)
- **Description:** Courier role could read any order via `GET /api/orders/:id` — no ownership check meant couriers could access customer PII (name, phone, address) for any order by guessing IDs
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Added courier assignment guard in `orders.ts` — courier must have an active `courierAssignmentsTable` row for the order or receives 403
- **Resolved in version:** QA Audit V1

### KI-R-BUG006
- **ID:** KI-R-BUG006
- **Priority:** High
- **Description:** `PATCH /api/admin/orders/:id/status` only accepted 6 stale statuses; all 9 new V1 statuses returned 400. Admin order status dropdown silently failed for all new statuses.
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Replaced 6-item `validStatuses` with all 15 V1 statuses; removed strict forward-only transitions (admins get full override); added `refunded` terminal guard; expanded notification map to cover all key status changes
- **Resolved in version:** QA Audit V1

### KI-R-BUG007
- **ID:** KI-R-BUG007
- **Priority:** Medium
- **Description:** Seller dashboard `ordersByStatus` only tracked 5 old statuses; orders in `confirmed`, `preparing`, `ready_for_pickup`, `courier_assigned`, `picked_up`, `out_for_delivery`, `delivery_failed`, `returned`, `refunded` counted as zero
- **Current status:** RESOLVED 2026-06-11
- **Resolution:** Replaced hardcoded 5-entry array with `.map()` over all 15 V1 statuses in `dashboard.ts`
- **Resolved in version:** QA Audit V1

### KI-R001
- **ID:** KI-R001
- **Priority:** Critical
- **Description:** Empty database after Replit account migration — `relation "users" does not exist`
- **Current status:** RESOLVED 2026-06-08
- **Resolution:** Ran `drizzle-kit push` to create all 22 tables from scratch
- **Resolved in version:** Recovery 2026-06-08

### KI-R002
- **ID:** KI-R002
- **Priority:** Critical
- **Description:** Missing `node_modules` after migration — all workflows failed with `ERR_MODULE_NOT_FOUND`
- **Current status:** RESOLVED 2026-06-08
- **Resolution:** Ran `pnpm install`
- **Resolved in version:** Recovery 2026-06-08

### KI-R003
- **ID:** KI-R003
- **Priority:** High
- **Description:** Lib declaration files (`dist/index.d.ts`) not built — TS6305 errors across all projects
- **Current status:** RESOLVED 2026-06-08
- **Resolution:** Ran `npx tsc --build lib/db lib/api-zod lib/api-client-react`
- **Resolved in version:** Recovery 2026-06-08

### KI-R004
- **ID:** KI-R004
- **Priority:** High
- **Description:** `AdminListUsersParams` type missing `q?: string` — TS2353 error in `artifacts/marketplace/src/pages/admin/users.tsx`
- **Current status:** RESOLVED 2026-06-08
- **Resolution:** Added `q?: string` to `AdminListUsersParams` in `lib/api-client-react/src/generated/api.schemas.ts`
- **Resolved in version:** Recovery 2026-06-08

### KI-R005
- **ID:** KI-R005
- **Priority:** High
- **Description:** Admin account missing after fresh DB — no admin user existed
- **Current status:** RESOLVED 2026-06-08
- **Resolution:** Root Owner bootstrapRootAdmin() self-healed on API startup
- **Resolved in version:** Recovery 2026-06-08

### KI-R006
- **ID:** KI-R006
- **Priority:** Critical
- **Description:** `variant_images` table missing from database — variant image save/load failed
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Created table via psql; added `CREATE TABLE IF NOT EXISTS` to run-migrations.ts
- **Resolved in version:** Recovery 2026-06-09

### KI-R007
- **ID:** KI-R007
- **Priority:** High
- **Description:** Inter font missing — `public/fonts/inter-latin.woff2` 404 in browser console
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Downloaded from Google Fonts CDN to `public/fonts/inter-latin.woff2`
- **Resolved in version:** Recovery 2026-06-09

### KI-R008
- **ID:** KI-R008
- **Priority:** High
- **Description:** `syano-logo.png` missing from public/ — Navbar, AdminLayout showing broken image
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Official logo (silver/green S) installed from user-supplied asset. Canonical copy at `src/assets/syano-logo.png`.
- **Resolved in version:** Recovery 2026-06-09

### KI-R009
- **ID:** KI-R009
- **Priority:** Medium
- **Description:** All 6 PWA/manifest PNG icons missing — 404 in browser console
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Generated all 6 PNG sizes from official logo using ImageMagick
- **Resolved in version:** Recovery 2026-06-09

### KI-R010
- **ID:** KI-R010
- **Priority:** High
- **Description:** Products page footer overlap — `useWindowVirtualizer` used `position:absolute` rows with wrong `scrollMargin`, causing footer to render under product grid
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Removed `useWindowVirtualizer` entirely; replaced with CSS `auto-fill/minmax(260px,1fr)` grid
- **Resolved in version:** Recovery 2026-06-09

### KI-R011
- **ID:** KI-R011
- **Priority:** High
- **Description:** `reset_otp_*` columns missing from users table after migration
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Added `ADD COLUMN IF NOT EXISTS` for all 4 reset_otp columns in run-migrations.ts; applied to DB
- **Resolved in version:** Recovery 2026-06-09

### KI-R012
- **ID:** KI-R012
- **Priority:** Low
- **Description:** Mobile `assets/images/icon.png` missing — app icon not displaying
- **Current status:** RESOLVED 2026-06-09
- **Resolution:** Installed official logo as `artifacts/mobile/assets/images/icon.png`
- **Resolved in version:** Recovery 2026-06-09

### KI-R013
- **ID:** KI-R013
- **Priority:** High
- **Description:** VariantBuilder Toggle (VariantBuilder.tsx) thumb escapes track in Arabic RTL
- **Current status:** RESOLVED 2026-06-09 (Session 2)
- **Root cause:** `flex + ms-[26px]/ms-[2px]` — under `direction:rtl` flex main-axis reverses; ms-[26px] ON pushes thumb off the far end of the track.
- **Resolution:** `position:relative` track + `position:absolute` thumb, `style={{ left: on ? 26 : 2 }}`. 26+16=42 < 44px always.
- **Resolved in version:** Session 2, 2026-06-09

### KI-R014
- **ID:** KI-R014
- **Priority:** High
- **Description:** `new.tsx` main "Product Variants" toggle (separate from VariantBuilder.tsx Toggle) thumb escapes track in Arabic RTL
- **Current status:** RESOLVED 2026-06-09 (Session 2b)
- **Root cause:** `inline-flex items-center + inline-block + translate-x-6/translate-x-1`. In `direction:rtl`, `inline-flex` places the inline-block child at the RIGHT edge; `translateX(24px)` pushes it further right, escaping the 44px track.
- **Resolution:** Same fix as KI-R013 — removed `inline-flex items-center`, changed to `position:relative` button + `position:absolute` span with `style={{ left: variantsEnabled ? 26 : 2 }}`.
- **Verified on:** Real page `/seller/products/new`, seller `delewatiamer8@gmail.com`, Arabic RTL + English LTR, desktop + mobile.
- **Resolved in version:** Session 2b, 2026-06-09
