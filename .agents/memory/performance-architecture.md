---
name: Performance architecture
description: What is already optimized vs what was added in the performance pass — avoid re-auditing known-good areas
---

## Already optimized (do not re-investigate)
- **React Query global config**: staleTime=2min, gcTime=10min, refetchOnWindowFocus=false, retry=false
- **Home page query overrides**: products staleTime=3min, bestsellers/settings staleTime=5min
- **All routes**: React.lazy() + Suspense code splitting — every page is a separate JS chunk
- **Vite bundle**: manualChunks (vendor-react, vendor-query, vendor-icons, vendor-i18n, vendor-motion, vendor-date, vendor-router, vendor-forms), esbuild minifier, ES2020 target, console.log stripped in production
- **ProductCard**: React.memo + onMouseEnter prefetchQuery for product detail data
- **OptimizedImage**: lazy loading, fetchpriority=high/low, decoding=async, CLS-safe aspect-ratio wrapper
- **PageTransition**: 120ms GPU-composited CSS (opacity+transform only, will-change promoted)
- **Hero/featured images**: fetchPriority="high" already set
- **Search**: 300ms debounce in Navbar
- **Notifications**: SSE stream (no polling) + 60s count poll — appropriate
- **Products list API**: single JOIN query (no N+1), description truncated to 200 chars

## Phase 2 performance pass (June 2026) — COMPLETE
- **i18n static imports**: Converted dynamic `import("./en.json")` to static. Removed TLA + LanguageDetector. i18next v26 inits synchronously. No chunk waterfall before React renders.
- **Self-hosted Inter font**: `public/fonts/inter-latin.woff2`, `@font-face` in index.css, preload hint in index.html. Google Fonts removed entirely.
- **Inline API prefetch**: `<script>` in index.html fires fetch('/api/settings'), '/api/products', '/api/products/best-sellers?limit=4' before JS loads. Seeded into RQ cache in App.tsx. On fast connections, home renders with zero loading states.
- **Home page eager import**: `import Home from "@/pages/home"` (direct import, not lazy). Eliminates one async chunk waterfall step on first visit LCP critical path. All other pages stay lazy.
- **SW v3 install-time font precache**: sw.js install handler uses `self.registration.scope + "fonts/inter-latin.woff2"` to warm font into cache on SW install. Font served instantly from cache on every visit after the first.
- **Vite target "esnext"**: Changed from "es2022" (which was needed for TLA, now removed). No transpilation, smallest possible bundle output.
- **cssMinify: "lightningcss"**: Enabled lightningcss CSS minifier (available as Vite peer dep, no install needed). Faster + smaller CSS than esbuild's default CSS minifier.
- **RoutePreloader bug fix**: `getListProductsQueryKey()` (no args) ≠ `getListProductsQueryKey({})` (empty obj). Both App.tsx cache seeding and home.tsx use `{}` form. RoutePreloader was warming the WRONG key. Fixed to `getListProductsQueryKey({})`.
- **RoutePreloader: removed Home from tier1**: Home has no lazy chunk after the eager import change.
- **Cloudinary + Unsplash preconnect**: Upgraded from `dns-prefetch` → `preconnect crossorigin`. Saves ~150-300ms TCP+TLS handshake for first product image on each CDN domain.

## Critical alignment rule for products query key
Always use `getListProductsQueryKey({})` (explicit empty object), never `getListProductsQueryKey()` (no args). The generated code spreads params conditionally: `[...params ? [params] : []]`. Empty object IS truthy, so `{}` IS spread; undefined is not. This produces different cache keys.

## Phase 1 performance pass
- **14 new DB indexes**: cart_items(user_id, product_id), orders(customer_id, status, created_at, seller_status composite), order_items(order_id), reviews(product_id, user_id), notifications(user_id, user+is_read, user+created_at), products(active_category partial)
- **buildProductResponse**: 3 serial DB queries → 2 parallel (Promise.all: seller+ratings in one LEFT JOIN + variantData in parallel). Saves ~1 RTT per product detail view.
- **imageUrls stripping from list/bestsellers**: cards only need imageUrl (singular); imageUrls[] only returned by the detail endpoint. Reduces JSON payload.
- **Cache-Control tuning**: product list 10s→30s, product detail 10s→60s (stale-while-revalidate 60s→180s)
- **NavigationProgress**: thin top bar progress indicator on every route change (src/components/NavigationProgress.tsx)
- **RoutePreloader**: idle-time prefetch of 5 most common route chunks (src/components/RoutePreloader.tsx)
- **PageLoader**: made smaller (was 60vh spinner, now 40vh)
- **Schema files updated**: cart.ts, reviews.ts, notifications.ts, orders.ts all have index() declarations + orders.ts has shippedAt/notes columns

## DB schema drift fixed (orders from merged task #5)
- orders.shipped_at: added via executeSql + schema file
- orders.notes: added via executeSql + schema file
- users_phone_unique: already existed (constraint was partial — WHERE phone IS NOT NULL)

**Why:** buildProductResponse previously did 3 serial DB round-trips on every product detail page. Parallelising saved ~30-50ms per request. Indexes cut full table scans on every cart/order/notification load.
