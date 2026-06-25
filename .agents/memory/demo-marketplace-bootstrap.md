---
name: Demo marketplace bootstrap
description: Self-healing demo data (42 products, 4 stores, 14 orders, etc.) that auto-seeds on fresh DB via startup sequence.
---

## The rule
`bootstrapDemoMarketplaceData()` is step 5 of the server startup sequence in `artifacts/api-server/src/index.ts`. It runs automatically on every server start. No manual seed command is ever needed.

**Why:** Demo data (products, stores, orders, reviews) must survive a full environment recovery without any manual step. The seed script `scripts/seed.ts` was the old manual approach — it still exists but is now redundant.

## Idempotency guard
```ts
SELECT COUNT(*)::text AS n FROM products
// if n >= 42 → return immediately (log: "Demo marketplace data already present")
// if n < 42  → run full bootstrap
```

## Key implementation details
- File: `artifacts/api-server/src/lib/bootstrap-demo-data.ts`
- Uses `pool.connect()` + `client.query()` (raw pg), NOT drizzle ORM
- Text arrays use `pgArr()` helper: `{val1,val2}` literal → cast with `$1::text[]`
- `order_status_history` column is `to_status` NOT `status` (common mistake)
- All INSERT statements use `ON CONFLICT DO NOTHING` or `ON CONFLICT ... DO UPDATE` for extra safety
- Errors are caught and logged as non-fatal — server starts even if bootstrap fails

## Startup sequence (index.ts)
1. `runMigrations()` — schema, enums, tables
2. `runSearchStartup()` — search index warmup
3. `bootstrapRootAdmin()` — admin account
4. `bootstrapTestAccounts()` — seller + courier permanent accounts
5. **`bootstrapDemoMarketplaceData()`** ← demo data
6. `app.listen()` — server ready

## What it creates on a fresh DB
| Entity | Count |
|---|---|
| Sellers (with approved applications) | 4 |
| Customers | 4 |
| Products (real Pexels images) | 42 |
| Orders + items + status history | 14 |
| Product reviews | 40 |
| Seller reviews | 8 |
| Wishlist items | 12 |
| Store follows | 8 |

## Pexels URL pattern
```ts
const P = (id: number, w = 800, h = 600) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
```

## How to apply
On every recovery: just start the API server. Demo data will appear automatically if the DB is empty.
