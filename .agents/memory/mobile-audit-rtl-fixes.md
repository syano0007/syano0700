---
name: Mobile UI/UX Audit – RTL & Responsive Fixes
description: Lessons from the comprehensive mobile audit of the Syano marketplace covering 320px–430px widths, RTL safety, and accessibility.
---

## The Rule
All page headings must use responsive size variants. All layout classes must use CSS logical properties for RTL safety.

## Responsive Typography Pattern
- Hero headings: `text-2xl sm:text-3xl md:text-4xl lg:text-5xl`
- Section headings: `text-2xl sm:text-3xl`
- Stats numbers: `text-2xl sm:text-3xl`
- Never use bare `text-3xl` or `text-4xl` on headings (only on components where size is intentional at all widths)

## RTL-Safe Class Replacements
- `text-left` → `text-start`
- `text-right` → `text-end`
- `pl-*` → `ps-*`, `pr-*` → `pe-*`
- `ml-*` → `ms-*`, `mr-*` → `me-*`
- `left-*` on absolute positioned → `start-*`
- `right-*` on absolute positioned → `end-*`
- Avoid `${isRtl ? "text-right" : "text-left"}` ternaries — use `text-start` instead

## Mobile Padding Pattern
- Cards/containers: `p-5 sm:p-8` (not bare `p-8`)
- Admin page containers: `p-4 md:p-8` (not bare `p-8`)

## Checkout Navigation Buttons
Checkout step buttons must use `flex-1 sm:flex-none` on both back and forward buttons to prevent overflow at 320px. The "Back to Cart" + "Pay $X.XX" row exceeds 320px when both have fixed min-widths.

## Missing Imports Bug Pattern
seller/center.tsx had `Link` used but not imported from `wouter`. Always grep for `Link` usage in pages that don't explicitly import from `wouter`.

## Accessibility
- All `DialogContent` (from Radix UI) requires a `DialogTitle`. Add `<DialogTitle className="sr-only">...</DialogTitle>` when no visible title is desired.
- The shared `CommandDialog` in `ui/command.tsx` needed this fix.

**Why:** 320px Samsung Galaxy S8+ is a very common device in Syria/MENA. Pages that overflow at 320px are unusable for many real customers.
