---
name: Product Card Uniform Heights
description: How to keep product card sections at consistent heights for Arabic/English bilingual grids.
---

## Rule
Use `.pc-category`, `.pc-title`, `.pc-seller` CSS utility classes (defined in index.css) instead of one-off Tailwind utilities.

## Why
Arabic titles are often longer/shorter than English equivalents, and Arabic line-height is 1.6 vs 1.35 for Latin. Without fixed-height sections, cards in the same grid row have varying internal layout even though the card itself is the same height (due to `h-full` + CSS grid equal-height rows).

## How to apply
- `.pc-category` — single-line label with `min-height: 1.25rem`, `white-space: nowrap`, `text-overflow: ellipsis`
- `.pc-title` — uses `-webkit-line-clamp: 2` + `min-height: calc(1.35em * 2)` (Latin) or `calc(1.6em * 2)` (RTL)
- `.pc-seller` — single-line with `min-height: 1.25rem`/`1.5rem` (sm+)

**Why em not px:** min-height uses `em` so it scales with the fluid `heading-card` font-size (clamp-based).
