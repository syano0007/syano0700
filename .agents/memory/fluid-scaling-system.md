---
name: Fluid Scaling System V1
description: Root clamp font-size + px→rem conversion rules across the marketplace
---

## The Engine — VIEWPORT SCALE V1
`html { font-size: clamp(10px, calc(4px + 0.75vw), 18px) }` in `artifacts/marketplace/src/index.css`

**Why:** Canvas-like scaling — 1920px vs 1280px is 24% different (was 11%). "Figma zoom" effect: identical layout, only scale changes. Spec requires clearly noticeable difference between 1280 and 1920.

**Scale table:** ≤800px→10px (floor), 1024px→11.68px, 1280px→13.6px, 1440px→14.8px, 1600px→16px, 1920px→18px (cap)

## CSS Label Vars (NEW in V1)
Three CSS custom properties in `:root` for small label text that needs a floor + ceiling:
- `--font-2xs: clamp(9px, 0.5625rem, 10px)` — 9-10px tiny labels
- `--font-xs: clamp(10px, 0.6875rem, 12px)` — 10-12px small labels
- `--font-xs-up: clamp(11px, 0.75rem, 14px)` — 11-14px sub-labels

Use `fontSize: "var(--font-2xs)"` in inline styles instead of hardcoded `"10px"`.

## pc-* Override Strategy (V1 update)
- **Base tier (<640px)**: STAYS in px — absolute minimum readable floors for tiny cards
- **640px+ tiers**: CONVERTED to rem — scales with root font at desktop
  - 640px: title=0.75rem, price=0.875rem, btn=0.625rem, rating=0.625rem
  - 1024px: title=0.8125rem, price=0.9375rem, btn=0.6875rem, rating=0.6875rem
  - 1536px: title=0.875rem, price=1rem, btn=0.75rem, rating=0.75rem
  
At 1920px (18px root): 1536px tier → title=15.75px, price=18px (full natural size)

## Conversion Rules

**CONVERT to rem (consumer-facing):**
- Inline `fontSize` values ≥ 13px in HomeSections, Navbar, product cards
- Eyebrow labels with `letterSpacing: "0.12em"` even if 12px (uppercase tracks well at 9.75px floor)
- Structural dimensions (hero card, floating cards, nav heights, grid heights)

**KEEP as px (intentional floors):**
- `fontSize` ≤ 12px for badge/label text, review counts, strikethrough prices
- `fontSize` ≤ 11px everywhere (9px, 10px, 11px)
- All admin/seller/courier page sizes (internal tools)
- Decorative blur circles (`w-[700px]`, etc.)
- `pc-*` compact card overrides in index.css (5-col grid floor)

## Product Grid Density Schedule (V2 — June 2026)
Density-first: cards scale before columns drop. Column breakpoints in `index.css`:
- `< 480px`: 2 cols, 0.5rem gap
- `480–639px`: 3 cols, 0.5rem gap  ← key improvement (was 640px before)
- `640–767px`: 3 cols, 0.625rem gap
- `768–1023px`: 4 cols, 0.625rem gap
- `1024–1279px`: 5 cols, 0.75rem gap
- `1280–1535px`: 6 cols, 0.75rem gap  ← key improvement (was 5 before)
- `1536px+`: 6 cols, 0.875rem gap

pc-* overrides are tiered (not flat): tighter at base/<640px, moderate at 640px+, comfortable at 1024px+, near-natural at 1536px+.

`.store-grid` class: same column schedule as product-grid (2→3→4→5→5) WITHOUT pc-* overrides. Used by store/[slug].tsx and wishlist.tsx.
`.category-grid`: 2→3→4→5→6 cols.

FeaturedDeals + TrendingProducts homepage sections: changed from `grid-cols-1` → `grid-cols-2` on mobile.

## Status (June 2026)
- ✅ HeroSection, FeaturedDeals, TrustedStores, NewArrivals, JoinSection, HomeFooter
- ✅ PopularCategories, TrendingProducts, TrendingCard
- ✅ Navbar (heights, logo, icons, badges, SYANO text, search)
- ✅ Products page, store pages, wishlist — density-first grids
- 📋 Remaining: HeroBanner, product detail page, messages UI

## CSS Variable
`--navbar-height` in index.css: `3.75rem` mobile / `4rem` desktop (matches `h-[3.75rem]` / `h-[4rem]` in Navbar.tsx)
