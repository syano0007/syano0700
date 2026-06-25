---
name: Syano Responsive Design System
description: Where design tokens live, how the system is structured, and key decisions made during the mobile audit.
---

## Location
All tokens and utility classes are in `artifacts/marketplace/src/index.css` — appended after the page-transition animation block (line ~310+). Tailwind v4 is used (no tailwind.config.js), so tokens go in CSS, not a config file.

## Token Namespacing
All custom design tokens use `--ds-*` prefix to avoid collision with Tailwind v4's `--color-*`, `--radius-*` etc:
- `--ds-text-*` — typography scale (xs=12px through 3xl=30px)
- `--ds-icon-*` — icon sizes (sm=16px through xl=24px)
- `--ds-space-*` — spacing (1=4px through 12=48px)
- `--ds-radius-*` — border radii (sm=6px through xl=24px)
- `--ds-touch` — 44px minimum touch target (WCAG 2.5.5)

## Utility Classes Added
- `.pt-safe`, `.pb-safe`, `.ps-safe`, `.pe-safe`, `.mt-safe`, `.mb-safe` — safe-area insets
- `.pb-safe-4`, `.pb-safe-5`, `.pb-safe-6` — safe-area + minimum padding combos
- `.touch-min` — pseudo-element expands tap area to 44px without changing layout
- `.heading-hero` — fluid clamp(1.625rem, 1.25rem + 2.5vw, 3.25rem): 26px → 52px
- `.heading-section` — fluid clamp(1.125rem, 1rem + 1.5vw, 1.875rem): 18px → 30px
- `.heading-card` — fluid clamp(0.875rem, 0.8rem + 0.5vw, 1.125rem): 14px → 18px
- `.product-grid` — responsive 2/3/4 column grid
- `.scroll-hidden` — cross-browser scrollbar hiding

## Key Decisions

**Touch targets**: All interactive elements bumped to h-11 w-11 (44px) using Tailwind: Navbar mobile buttons, ProductCard add-to-cart/login buttons, Footer social icons. MobileNavLink uses `min-h-[44px]`. Logout button uses `min-h-[44px]`.

**Typography minimums**: `text-[10px]` was in 6+ places — all replaced with `text-xs` (12px minimum). Exception: the "SYANO" brand wordmark under the mobile logo went from `text-[8.5px]` to `text-[10px]` (brand aesthetic preserved, slightly larger).

**Safe area**: Navbar already had `paddingTop: env(safe-area-inset-top)`. Added `pb-safe-4` to Navbar drawer bottom, `pb-safe-5` to Footer copyright zone (Zone 4).

**Heading system**: Replaced scattered `text-3xl sm:text-4xl md:text-5xl` with `heading-hero`, `text-xl sm:text-2xl` with `heading-section`, `text-sm sm:text-base` in cards with `heading-card`. These use clamp() for smooth linear scaling.

**Why clamp() over breakpoints**: Breakpoints cause discrete jumps. clamp() gives proportional scaling on every device width, not just 3 predefined sizes.
