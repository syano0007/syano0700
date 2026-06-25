---
name: Full Platform Audit — June 2026
description: Comprehensive audit findings and fixes applied to the entire Syano platform; avoids re-auditing the same issues.
---

## Security Fixes (Earlier Pass)

**push-subscriptions.ts DELETE** — was deleting any endpoint by URL alone without verifying ownership. Fixed: added `AND user_id = $userId` to WHERE clause. Any caller could previously delete another user's push subscription if they knew the endpoint URL.

**sellers.ts POST /sellers/:id/reviews** — comment field had no type or length validation. Fixed: added string-type check + 1000-character max.

## Security Fixes (June 2, 2026 Audit)

**Stored XSS — products.ts** — `name`, `description`, `nameAr` fields accepted raw HTML/script tags verbatim. Fixed: `stripHtml(value) = value.replace(/<[^>]*>/g, "").trim()` applied at product create AND update.

**Stored XSS — auth.ts registration** — user `name` field accepted raw HTML. Fixed: same `stripHtml` pattern applied before insert. Also: a `name.replace(/<[^>]*>/g, "")` pattern is preferable to a library dependency for this narrow use.

## Runtime Crash Fixes (June 2, 2026 Audit)

**messaging.ts — `sql` template + `ANY()` with JS array**  
`sql\`${usersTable.id} = ANY(${arr})\`` serializes a JS array as a scalar param → Postgres `ANY($1)` fails.  
Fix: use `inArray(usersTable.id, arr)` (Drizzle) for `.select()`, or `ANY(ARRAY[${sql.raw(arr.join(','))}])` for `db.execute()` raw SQL. Integer arrays are safe with `sql.raw`.

**messaging.ts — wrong column name case in `sql` tag**  
`sql\`${messagesTable.sender_id} != ${v}\`` — snake_case key doesn't exist on Drizzle column object (camelCase `senderId`). Compiles to empty string → `AND  != $3`.  
Fix: use `ne(messagesTable.senderId, v)` (Drizzle operator).

**dashboard.ts — `db.execute()` returns `{rows:[]}` not plain array**  
`(await db.execute(sql\`...\`) as any[]).map(...)` crashes because `db.execute` returns `{rows, fields}`.  
Fix: `((await db.execute(sql\`...\`)) as any).rows as any[]`.  
**Why:** drizzle-orm node-postgres adapter behavior — applies to ALL `db.execute()` calls site-wide.

**sellers.ts — store branding PATCH silently ignored fields**  
Only destructured `{storeLogo, storeBanner}` — storeName, storeSlug, storeDescription, storeCity, logoUrl all discarded.  
Fix: expanded destructuring + added all fields to the update patch.

## New Endpoints Added (June 2, 2026 Audit)

- `PATCH /auth/me` — profile update (name, phone). Was missing entirely; frontend called `PATCH /users/profile` (404).

## N+1 Query Fixes (Earlier Pass)

**messaging.ts GET /conversations** — was issuing N individual queries for last-message-per-conversation, and N for unread-count. Fixed with two raw SQL queries: `DISTINCT ON (conversation_id)` for last messages, `GROUP BY conversation_id` for unread counts. Always 3 total queries.

**orders.ts GET /orders** — `buildOrderResponse()` per-order was O(N×M). Fixed with 4 batched queries total for the entire list.

## Database Indexes Added (Earlier Pass)

- `idx_order_items_seller_id` on `order_items(seller_id)`
- `idx_order_items_product_id` on `order_items(product_id)`

## Frontend Performance Fixes (Earlier Pass)

**home.tsx countdown isolation** — `useCountdown` caused full-page reconciliation every second. Fixed by extracting Hot Deals into `React.memo`.

**Layout.tsx overflow-x-hidden** — missing on root div caused horizontal scroll on mobile.

## Contracts That Trip Up Future Work

**Checkout `shippingAddress`** — must be a flat **string**, not an object. Zod schema has `shippingAddress: zod.string()`.

**Store branding gate** — `PATCH /sellers/store/branding` requires an approved `seller_applications` row. Sellers promoted directly via SQL get 404 until an approved row is inserted.

**Product reviews gate** — `POST /products/:id/reviews` returns 403 unless customer has a `delivered` order containing the product. The `delivered` status cannot be reached via the standard seller status API (customer confirm-delivery step is missing).

**`db.execute()` returns `{rows, fields}`** — never `.map()` directly on the result; always use `.rows` first.

## Missing Features (Not Bugs — Build These Next)

- `POST/GET /api/wishlist` — no `wishlist_items` table or routes
- `PATCH /api/admin/users/:id/status` — admin user suspension (only verify/delete exist)
- `GET /api/admin/messages/flagged` + `POST /api/admin/messages/:id/flag` — message moderation
- `GET /api/admin/seller-applications` — admin-namespaced route
- Root `/healthz` — only at `/api/healthz`
- Customer confirm-delivery step for orders

## What Was Already Good (Do Not Re-Audit)

- React Query config: solid staleTime/gcTime with per-query overrides
- Route-level lazy loading with `React.lazy`
- `RoutePreloader` using `requestIdleCallback`
- `ProductCard` wrapped in `React.memo` with IntersectionObserver prefetch
- `OptimizedImage` component preventing CLS
- All four messaging/conversation schema indexes present
- Products schema indexes: seller_id, category, featured, created_at, stock
- Orders schema indexes: customer_id, status, created_at
- RBAC middleware (`requireAuth`, `requireRole`) applied correctly
- Order status machine with `SELLER_TRANSITIONS` prevents illegal transitions
- Ownership checks on Orders, Products, Messaging

## How to Apply New Schema Indexes

drizzle-kit push requires TTY. Use:
```js
await executeSql({ sqlQuery: `CREATE INDEX IF NOT EXISTS idx_name ON table(col)` });
```
Then also update `lib/db/src/schema/` so the next full migration picks it up.
