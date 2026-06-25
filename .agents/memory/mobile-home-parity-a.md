---
name: Mobile Home Parity Phase A
description: 5 missing home sections added to mobile index.tsx to match web, plus header improvements
---

## What was added (Phase A — June 17, 2026)

**5 new components in `artifacts/mobile/app/(tabs)/index.tsx`:**
1. `HeroBannerSection` — emerald glow card, SYANO badge, tagline, stats row (500+/10K+/50K+)
2. `CategoryGridSection` — 2x4 image grid, dark overlays, color bars, same Unsplash URLs as web
3. `FeaturedDealsSection` — live CountdownTimer (h:m:s) + horizontal DealMiniCard scroll (discountPercent > 0)
4. `FeaturedStoresSection` — STATIC_STORES (3 entries), horizontal scroll, cover images, verified badge, logo initial
5. `JoinCTASection` — seller card (emerald #10b98108 bg) + courier card, routes to /seller-apply / /courier-apply

**Header improvements:**
- Cart icon with count badge (top-right, `useGetCart` with `as any` for enabled option)
- Notification bell wired to `router.push("/(tabs)/notifications")`

**i18n:** 28 new keys in `home.*` namespace added to both EN + AR sections of `artifacts/mobile/src/i18n/index.ts`

**Section order now matches web:**
Hero → Hot Deals → Category Grid → Featured Deals → Trusted Stores → New Arrivals → Trending → Join CTA → All Products

## Key gotchas for this file

- `useGetBestSellers(limit, options?)` — only 2 args. Previously called with 3 (bug).
- `useListProducts(params, options?)` and `useGetCart(options?)` — query option requires `queryKey` in TanStack v5. Workaround: `{ query: { enabled: ... } as any }`.
- `STATIC_STORES` fallback array (matching web's TrustedStores.tsx) — no API call needed, data is deterministic.
- Section components use `useColors()` + `t()` + `router.push()` — no web-specific deps.
- `FeaturedDealsSection` returns `null` if no products have `discountPercent > 0` (graceful empty state).

**Why:**
Phase A of Web ↔ Mobile Parity mission. Web homepage has 8 sections; mobile had only 4 (hot deals, categories chips, new arrivals, trending). These 5 sections were completely absent from mobile.
