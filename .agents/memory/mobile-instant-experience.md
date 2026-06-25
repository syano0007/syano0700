---
name: Mobile instant experience
description: Key decisions and patterns for mobile-first UX optimization in the marketplace
---

## IntersectionObserver prefetch in ProductCard
`onMouseEnter` prefetch is desktop-only (hover never fires on touchscreens). ProductCard now uses `IntersectionObserver` with `threshold: 0.1, rootMargin: "100px 0px"` to prefetch product detail data when cards scroll into view. A shared `prefetchedRef` prevents duplicate fetches from both hover and intersection triggers.

**Why:** On mobile the user taps with no prior hover signal. Prefetching when the card is 100px before entering the viewport means data is in React Query cache by the time the user taps.

**How to apply:** Any new card component that links to a detail page should use the same `IntersectionObserver` + `prefetchedRef` + `queryClient.prefetchQuery` pattern from ProductCard.

## CSS: tap highlight and touch feedback
- `-webkit-tap-highlight-color: transparent` on `*` — removes Android/iOS blue flash on tap
- `user-select: none; -webkit-user-select: none` on `button, [role="button"], [role="link"], a` — prevents text selection on long-press
- `@media (hover: none) and (pointer: coarse)` — use this to scope mobile-only CSS; avoids affecting desktop hover states

## Skeleton screens: coverage
All key user flows have skeleton loading states:
- Home: ProductSkeleton inline
- Product detail: ProductSkeleton component (image + thumbnails + all text fields)
- Products list: 8-card skeleton grid
- Cart: 2-item skeleton + summary placeholder
- Checkout: 3-row skeleton
- Customer dashboard: 4-stat-card skeleton + 3-order skeleton (was plain text — fixed)
- Seller dashboard: DashboardSkeleton component
- Orders list: 3-row skeleton
- Order detail: multi-block skeleton
- Seller orders/products/inventory: animate-pulse blocks

## product-grid CSS class
`.product-grid { contain: layout }` applied to all 7 product grid instances (5 in home.tsx, 2 in products/index.tsx). Tells browser the grid's layout is self-contained — skips layout recalcs outside the element when children change.

## CommandDialog (shadcn boilerplate)
`command.tsx` has a `DialogContent` without `DialogTitle` — this triggers a Radix UI a11y warning. However `CommandDialog` is never used anywhere in the codebase; the warning is harmless. Fix only if `CommandDialog` is ever adopted.
