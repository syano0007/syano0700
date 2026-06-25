---
name: Homepage V6 Architecture
description: Commerce-first homepage with HeroV4 flex-row hero (mockup-graduated); section order, component hierarchy, zero-state behaviors, and design decisions.
---

# Homepage V6 Architecture (June 2026)

## Section Order (home.tsx)
Hero → Popular Categories → Hot Deals → Verified Stores → Best Sellers → New Arrivals → Recently Viewed → Join CTA + Trust strip

## Component Hierarchy

```
home.tsx
├── <HeroV4 />
│   ├── Desktop: flex-row (image LEFT 50%, text RIGHT flex:1)
│   ├── Mobile: full-height overlay layout
│   ├── <FloatingCardsLayer /> — AnimatePresence per slide; circular thumbnails
│   ├── Built-in HERO_SLIDES (5 slides, Pexels) — fallback when 0 DB banners
│   └── DB BannerCarousel — priority when ≥1 banner in DB
├── <PopularCategoriesSection />  — horizontal scroll chips with Pexels images
├── <VerifiedStoresSection />     — horizontal-scroll premium cards
├── <HotDealsSection />           — conditional (hidden when 0 deals)
├── Best Sellers section          — conditional (hidden when 0)
├── New Arrivals section          — always rendered
├── Recently Viewed section       — conditional (hidden when empty localStorage)
└── Join CTA + TRUST_ITEMS strip  — Truck, ShieldCheck, BadgeCheck, Zap
```

## HeroV4 Architecture
See `hero-banner-system.md` for full detail. Key:
- Desktop: flex row; image LEFT (50%, borderRadius:18); text RIGHT (flex:1)
- Section: always `#040404` dark bg + radial-gradient grid dots; border-bottom rgba(255,255,255,0.06)
- Height: 552px desktop; clamp(420px,72vh,580px) mobile
- Padding: `paddingLeft:100, paddingRight:32, paddingTop:32, paddingBottom:24` (desktop wrapper)

## API Endpoints Used

| Endpoint | Used By | Stale Time |
|---|---|---|
| `GET /api/banners` | HeroV4.tsx | Fresh on mount |
| `GET /api/products/best-sellers?limit=4` | Best Sellers section | 5min |
| `GET /api/products` | home.tsx (New Arrivals + Hot Deals) | 3min |
| `GET /api/settings` | home.tsx (flash sale countdown) | 5min |
| `GET /api/sellers/featured` | VerifiedStoresSection | 5min |

## Zero-State Resilience

| State | Homepage appearance |
|---|---|
| 0 banners | Built-in 5-slide carousel (always premium) |
| Banners exist | DB BannerCarousel (same flex layout) |
| 0 deals | Hot Deals section hidden |
| 0 best sellers | Best Sellers section hidden |
| No localStorage history | Recently Viewed section hidden |

## Recovery Check Impact
Module 21 (`heroBannerSystem`) is a known false negative (95/100). HeroV4 has its own carousel; `HeroBanner.tsx` is unused.

## i18n
All section headers use `t()` via 56 `home.*` keys. Dir via `i18n.dir()`, not hardcoded. HeroV4 text direction is `isRTL ? "rtl" : "ltr"` — language-aware since Session 6.
