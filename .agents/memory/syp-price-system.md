---
name: SYP price system
description: DB stores all product prices in SYP. CurrencyContext format() treats input as SYP — divides by exchangeRate for USD, displays directly for SYP mode.
---

# SYP Price System

## The Rule
All prices stored in the DB (`products.price`, `products.finalPrice`, `products.compareAtPrice`) are in **Syrian Pounds (SYP)**. The `format(sypAmount)` function in `CurrencyContext.tsx` must:
- **SYP mode**: display directly → `"375,000 ل.س"`
- **USD mode**: divide by exchangeRate (default 14500) → `"$25.86"`

**Why:** The original code wrongly multiplied by 14500 (treating input as USD), resulting in absurdly large SYP values (e.g. 375,000 × 14,500 = 5.4 billion ل.س). The fix: `usd = amount / exchangeRate`.

**How to apply:**
- Every static/fallback price in homepage components (FALLBACK_CARDS, STATIC_DEALS, etc.) must be in SYP.
- When consuming product API response, pass `Number(p.price)` or `Number(p.finalPrice)` directly to `format()` — no conversion needed.
- Never multiply by exchangeRate before calling format().

## Real price examples (SYP)
- Sony WH-1000XM5 headphones: 185,000 SYP → $12.76
- Tom Ford EDP 50ml: 375,000 SYP → $25.86
- Floral Maxi Dress: 65,000 SYP → $4.48
- Nida Abaya: 55,000 SYP → $3.79
- Rolex Submariner style: 142,000 SYP → $9.79
- Samsung 65" TV: 1,850,000 SYP → $127.59
- Memory Foam Pillow: 42,000 SYP → $2.90

## Homepage data quality rules (set during audit)
- `averageRating: null, reviewCount: 0` for ALL 42 seeded products — no real ratings exist yet
- TrendingCard hides the rating row entirely when `rating === 0` (empty spacer div preserves grid height)
- FeaturedDeals, TrendingProducts, NewArrivals: pass `rating: 0, reviews: 0` and show no star UI
- HeroSection carousel: dynamically built from products prop (one per category via CAROUSEL_CATEGORIES filter); FALLBACK_SLIDES use real Pexels URLs from DB products
- FeaturedDeals hides section (`return null`) when no real `isBestDeal` products exist — no fake static deals shown
