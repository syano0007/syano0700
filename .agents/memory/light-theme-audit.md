---
name: Light Theme Audit
description: Full light theme CSS token uplift + image overlay + card elevation system applied to homepage
---

## What was done
Complete light theme quality pass on the homepage to match dark theme premium quality.

## CSS Token Changes (index.css :root)
- `--muted-foreground`: `220 9% 35%` → `220 13% 32%` (WCAG AA on white)
- `--border`: `220 13% 91%` → `220 13% 84%` (more visible card outlines)
- `--muted`: `220 13% 91%` → `220 18% 96%` (lighter, creates surface depth contrast)
- `--secondary`: `220 13% 91%` → `220 16% 94%`

## New CSS Variables (both :root and .dark with different values)
- `--img-dim-hero/category/product/store/arrival` — brightness multipliers (light: 0.62–0.92, dark: 0.45–0.88)
- `--shadow-card`, `--shadow-card-hover`, `--shadow-card-lg` — visible in light, none/heavy in dark
- `--section-alt` — alternate section background (light: 220 22% 96%, dark: 0 0% 2%)

## New CSS Utility Classes (appended to index.css)
- `.sy-card-elevated` — uses `var(--shadow-card)` base + hover shadow
- `.sy-overlay-category/heavy/medium/light` — theme-aware gradient overlays (lighter in light mode)
- `.sy-section-alt` — uses `var(--section-alt)` background

## Components Updated
- All 8 HomeSections: image `style={{ filter }}` now uses `brightness(var(--img-dim-X))`
- All 6 image-bearing sections: replaced `from-black/X` Tailwind gradients with `.sy-overlay-*` CSS classes
- FeaturedDeals + TrustedStores: `sy-section-alt` alternating section background
- All HomeSections cards + ProductCard: `sy-card-elevated` class for light-mode elevation
- Navbar both dropdowns: `bg-[#111] border-white/[0.1]` → `bg-popover border-border shadow-xl`; all internal text/button colors made theme-aware

## Why
Dark theme had explicit depth contrast; light theme needs explicit shadows and visible borders since there's no dark-on-dark contrast to rely on. CSS variables allow single-source truth — light vs dark values resolve automatically.
