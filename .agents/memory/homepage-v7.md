---
name: Homepage V7 architecture
description: Critical architecture facts for the dark homepage redesign — home.tsx layout, Navbar, and HomeSections components.
---

## The Rule
`home.tsx` does NOT wrap in `<Layout>`. It renders `<Navbar />` directly at the top, then 8 section components, then `<HomeFooter />`. All other pages still use `<Layout>`.

**Why:** The homepage is always-dark (`#080808` bg) and has its own dark footer. Using Layout would introduce a theme-aware background and the standard footer, breaking the dark design.

**How to apply:** If home.tsx loses the Navbar import (e.g. after a merge), the navbar disappears only on the homepage. Add `import { Navbar } from "@/components/Navbar"` and `<Navbar />` at the top of the JSX.

## Navbar V7 Architecture
- File: `artifacts/marketplace/src/components/Navbar.tsx`
- Always dark: `rgba(8,8,8,0.75)` + glassmorphism; becomes `rgba(8,8,8,0.88)` after scroll > 20px
- `position: fixed top-0 z-50`; height 72px desktop, 60px mobile
- HeroSection compensates with `pt-[72px]` on the section wrapper
- Search uses `useSearch()` hook (multilingual, debounced) + localStorage recent searches
- Role shortcuts: seller=emerald pill "متجري", courier=blue "توصيلاتي", admin=purple "Admin"
- Mobile drawer: dark `#0d0d0d` background

## HomeSections Location
`artifacts/marketplace/src/components/HomeSections/`
- `HeroSection.tsx` — floating cards use real products (first 3 from `/api/products`)
- `PopularCategories.tsx` — static categories → `/products?category=...`
- `FeaturedDeals.tsx` — uses `isBestDeal` products; "أضف" button calls `useAddToCart` (auth) or `addGuestItem` (guest)
- `TrustedStores.tsx` — fetches `/api/sellers/featured`; visit button → `/store/:slug`
- `TrendingProducts.tsx` — uses all products; add-to-cart + wishlist heart both wired
- `NewArrivals.tsx` — uses first 4 products; bento grid → `/products/:id`
- `JoinSection.tsx` — `useSellerOnboarding()` + `useCourierOnboarding()` hooks
- `HomeFooter.tsx` — always-dark footer

## Data Flow (home.tsx)
```
useListProducts({}) → products
  hotDeals    = products.filter(p => p.isBestDeal)   → FeaturedDeals
  newArrivals = products.slice(0, 4)                  → NewArrivals
  trending    = products.slice(0, 6)                  → TrendingProducts
  products                                            → HeroSection (floating cards)
TrustedStores fetches /api/sellers/featured internally
```
