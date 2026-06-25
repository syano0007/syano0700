# DATABASE_STATE.md — SYANO (سوق سوريا)

## Connection
- **Driver:** pg (node-postgres)
- **ORM:** Drizzle ORM
- **Config:** `lib/db/drizzle.config.ts`
- **Schema source:** `lib/db/src/schema/index.ts`
- **Dialect:** PostgreSQL
- **DATABASE_URL:** Set via environment variable (Replit Secrets)

## Schema Version
- **Last push:** 2026-06-08 (fresh push after migration)
- **Last verified:** 2026-06-09 — 22 tables confirmed, all migrations applied
- **Schema files:** `lib/db/src/schema/*.ts`

## Total Tables: 22

| Table | Purpose | Schema File |
|---|---|---|
| `users` | All user accounts (customers, sellers, admins) | users.ts |
| `products` | Product catalog | products.ts |
| `product_variants` | Variant SKUs | variants.ts |
| `product_variant_groups` | Variant group definitions (e.g. "Color") | variants.ts |
| `product_variant_options` | Option values within groups (e.g. "Red") | variants.ts |
| `product_variant_values` | Junction: variant ↔ option | variants.ts |
| `variant_images` | Images specific to a variant | variants.ts |
| `orders` | Customer orders | orders.ts |
| `order_items` | Line items within orders | orders.ts |
| `order_status_history` | Audit trail of order status transitions | (migration) |
| `cart_items` | Persistent cart for authenticated users | cart.ts |
| `conversations` | Messaging threads | conversations.ts |
| `messages` | Individual messages | conversations.ts |
| `notifications` | In-app notifications | notifications.ts |
| `reviews` | Product reviews | reviews.ts |
| `seller_reviews` | Reviews of sellers | seller_reviews.ts |
| `seller_applications` | Seller onboarding applications | seller_applications.ts |
| `push_subscriptions` | Web push notification subscriptions | push_subscriptions.ts |
| `store_follows` | Customer follows a seller store | store_follows.ts |
| `platform_settings` | Global platform config (exchange rate, flash sale) | platform_settings.ts |
| `admin_audit_log` | Admin action audit trail | audit_log.ts |
| `verification_audit_log` | OTP verification audit trail | verification_audit_log.ts |

## Critical Users Table Columns
All must exist — verified 2026-06-08:
- `id` (integer, PK)
- `email` (text, unique)
- `phone` (text)
- `password_hash` (text)
- `name` (text)
- `role` (USER-DEFINED enum: customer/seller/admin)
- `seller_status` (text)
- `trust_level` (text)
- `is_verified` (boolean)
- `verified_at` (timestamp)
- `verification_method` (text)
- `otp_hash` (text)
- `otp_expires_at` (timestamp)
- `otp_attempts` (integer)
- `otp_locked_until` (timestamp)
- `otp_request_count` (integer)
- `otp_request_window_start` (timestamp)
- `created_at` (timestamp)
- `account_status` (text) — added via migration
- `suspended_reason` (text) — added via migration
- `suspended_by` (integer) — added via migration
- `suspended_at` (timestamptz) — added via migration
- `reset_otp_hash` (text) — added via migration
- `reset_otp_expires_at` (timestamptz) — added via migration
- `reset_otp_attempts` (integer) — added via migration
- `reset_otp_locked_until` (timestamptz) — added via migration

## Columns Added via Additive Migrations (run-migrations.ts)
These are NOT in the Drizzle schema files — added at runtime:
- `orders.shipping_company` (text)
- `orders.tracking_number` (text)
- `cart_items.variant_id` (integer)
- `order_items.variant_id` (integer)
- `order_items.variant_details` (text)
- `product_variants.price` (numeric 10,2)
- `product_variants.compare_at_price` (numeric 10,2)
- `product_variants.barcode` (text)
- `product_variants.weight_grams` (integer)
- `product_variants.dimensions` (text)
- `products.sales_count` (integer, default 0)
- `users.account_status` (text, default 'active')
- `users.suspended_reason` (text)
- `users.suspended_by` (integer)
- `users.suspended_at` (timestamptz)

## Root Owner Account Requirements
- **Email:** `delewatiamer7@gmail.com` ← PERMANENT, IMMUTABLE
- **Password:** `00Amer00` (env var: `ROOT_ADMIN_PASSWORD`)
- **Role:** `admin`
- **`account_status`:** `active`
- **`is_verified`:** `true`
- Self-healing: automatically created/repaired on every API startup
- Protected: cannot be deleted via admin UI (403 returned)
- Any legacy typo variant (`delewaitamer7@gmail.com`) is auto-removed at startup

## Seed Requirements
- Platform settings row must exist for exchange rate and flash sale end date
- Created automatically when first `/api/settings` is called

## Migration Strategy
- ALWAYS use `IF NOT EXISTS` / `IF EXISTS` guards
- NEVER use `drizzle-kit push` interactively in CI — use `echo "" | drizzle-kit push`
- NEVER use `sql.array()` — use `sql.join(ids.map(id=>sql\`\${id}\`), sql\`, \`)` with IN()
- For fresh DB: run `drizzle-kit push` first, then `run-migrations.ts` handles additive columns

## Drizzle Raw SQL Array Pattern
```typescript
// WRONG:
sql.array(ids)  // does not exist

// CORRECT:
sql`${id}` with sql.join(..., sql`, `)  // use IN() not ANY()
```
