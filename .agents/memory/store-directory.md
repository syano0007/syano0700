---
name: Store Directory + Footer Theme
description: Architecture for the /stores page, /sellers/directory API endpoint, and Footer theme adaptation.
---

## /sellers/directory endpoint
- Added to `artifacts/api-server/src/routes/sellers.ts` **before** `/sellers/store/:slug` (order matters for Express routing)
- Supports query params: `search`, `sort` (newest/rating/followers/products), `verified=true`, `category`, `page`, `limit`
- In-memory sort after DB query (sorts stats computed by Promise.all getStoreStats calls)
- Returns `{ stores, total, page, limit }`

## /stores page
- At `artifacts/marketplace/src/pages/stores.tsx`
- Direct fetch pattern: `const BASE = import.meta.env.BASE_URL ?? "/"; fetch(\`${BASE}api/sellers/directory?...\`)`
- Uses `limit` state (starts 12, +12 on load more) instead of page accumulation — simpler
- useEffect resets limit when search/sort/verified filters change

## Footer theme adaptation
- `useFooterColors()` hook defined at module level in Footer.tsx — uses `useTheme` from `next-themes`
- `dark = resolvedTheme !== "light"` (default to dark for SSR/unresolved)
- Color tokens passed as `C` prop to FooterColumn component
- Dark→Light: base #050505→#F1F5F9, surface #0F0F0F→#FFF, card #141414→#F8FAFC, border #262626→#E2E8F0

## Demo data
- 8 products seeded for seller_id=2 (Test Seller / delewatiamer8)
- Products table uses `seller_id` NOT `user_id`
- No `compare_at_price` or `is_best_deal` columns — use `discount_percent` instead

**Why:** The /sellers/directory must come before /sellers/store/:slug because Express 5 matches routes in order and `:slug` would match "directory" as a slug.
