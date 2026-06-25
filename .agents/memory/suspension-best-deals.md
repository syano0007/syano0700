---
name: Suspension system + best deals
description: Architecture decisions for account suspension enforcement and best deals threshold feature
---

## Suspension System

**Rule:** All seller routes and customer routes (orders, follow, review, cart write ops) must have `requireActiveAccount` middleware immediately after `requireAuth`+`requireRole`.

**Why:** Suspended users must be blocked server-side even if they still hold a valid JWT.

**SSE enforcement:** The SSE handler in notifications.ts checks `accountStatus` on connect (returns 403 for suspended). `kickSseUser()` sends `event: suspended\ndata: {"reason":"account_suspended"}` and closes the connection immediately. NotificationProvider handles this with `es.addEventListener("suspended", ...)` → `logout()` + `window.location.replace("/account-suspended")`.

**DB columns applied via executeSql (not drizzle-kit):** account_status (TEXT NOT NULL DEFAULT 'active'), suspended_reason (TEXT), suspended_by (INTEGER), suspended_at (TIMESTAMPTZ). Index: idx_users_account_status.

## Best Deals

**Rule:** All product response mappers must include `isBestDeal` — NOT just `buildProductResponse`. The list products route and best-sellers route each have their own inline mapper.

**Why:** The list route uses a GROUP BY aggregate query (can't call buildProductResponse per-row); best-sellers uses a different join pattern. Each must call `isBestDeal(discountPercent)` directly.

**Threshold:** `BEST_DEALS_THRESHOLD` = env `BEST_DEALS_THRESHOLD` || 15. Centralized in `artifacts/api-server/src/lib/bestDeals.ts`.

## Ambiguous Column Bug (best-sellers)

Adding `sales_count` column to the products table (via migration) made `coalesce("sales_count", '0')` in the best-sellers Drizzle SQL template ambiguous — both `products.sales_count` and `sales_sub.sales_count` were in scope. Fix: use raw string `coalesce("sales_sub"."sales_count", '0')` instead of `${salesSub.salesCount}` in SQL templates where the subquery alias shadows a real column name.

**How to apply:** Any time a Drizzle sql`` template references a subquery column that might conflict with a real table column name, use the explicit `"alias"."column"` form rather than `${subquery.field}`.
