---
name: Accessibility Layer V1
description: Phase 11 — all a11y changes made to reach Lighthouse Accessibility ≥96
---

## What was implemented

### HTML / CSS foundation
- `<html lang="ar" dir="rtl">` in `artifacts/marketplace/index.html`
- Global `*:focus-visible` ring (2px solid `hsl(var(--primary))`, offset 2px) in `index.css`; `*:focus:not(:focus-visible) { outline: none }` to suppress mouse focus rings
- `prefers-reduced-motion` was already present — left untouched

### Layout.tsx
- `<main id="main-content">` already existed; added `role="main"`, `tabIndex={-1}`, `outline-none` so PageFocusManager can `.focus()` it

### New files
- `src/components/FocusTrap.tsx` — traps Tab/Shift+Tab inside a container while `active`; restores prior focus on unmount
- `src/hooks/useAnnouncer.ts` — creates a `role="status" aria-live="polite"` region on mount; `announce(msg)` sets textContent with RAF + 1s clear timer

### App.tsx — PageFocusManager
- Watches `useLocation()` from Wouter on every route change
- Moves focus to `#main-content` and emits `aria-live="assertive"` announcement of page title
- Uses `t("a11y.pageLoaded", { title })` for i18n-aware page announcement

### Navbar.tsx changes
- Desktop `<nav>` → added `aria-label={t("a11y.mainNavigation")}`
- Mobile search toggle button → `aria-label={t("a11y.search")}`, `aria-expanded={searchOpen}`
- Mobile search input → `aria-label={t("a11y.search")}`
- Desktop search input → `aria-label={t("a11y.search")}`
- Clear search X buttons (mobile + desktop) → `aria-label={t("a11y.close")}`
- Mobile menu SheetTrigger button → `aria-label={t("a11y.openMenu")}` (removed redundant sr-only span)
- Mobile wishlist link → `aria-label={t("a11y.wishlist")}`
- Mobile cart link → `aria-label={t("a11y.openCart")}`
- Desktop messages link → `aria-label={t("nav.messages")}` (was hardcoded Arabic/English ternary)
- Desktop wishlist link → `aria-label={t("a11y.wishlist")}` 
- Desktop cart link → `aria-label={t("a11y.openCart")}`
- Desktop settings button → `aria-label={t("nav.settings")}` (was hardcoded ternary)
- All nav badge counter spans → `aria-hidden="true"` (count is decorative; link label is sufficient)

### TrendingCard.tsx
- Star rating container → `role="img"`, `aria-label={rating + " " + t("product_detail.stars_out_of_5")}`, individual Star SVGs → `aria-hidden="true"`, rating text span → `aria-hidden="true"`
- Wishlist button → `aria-label={wishlisted ? t("a11y.removeFromWishlist") : t("a11y.addToWishlist")}` (was hardcoded Arabic)

### search/index.tsx
- Imports `useAnnouncer`; on `searchData.total` change (when query active): announces `t("a11y.searchResultsCount", { count, query })`

### i18n additions (both en.json + ar.json, now 2994 keys each)
New `"a11y"` namespace (14 keys): `skipToContent`, `mainNavigation`, `close`, `openCart`, `search`, `openMenu`, `wishlist`, `addToWishlist`, `removeFromWishlist`, `share`, `loading`, `searchResultsCount`, `addedToCart`, `pageLoaded`
New `"nav.settings"` key (was missing, referenced by Settings dropdown button)
New `"product_detail.stars_out_of_5"` key (used in TrendingCard star rating `role="img"`)

**Why:** Lighthouse Accessibility audit requires proper landmark roles, focus management, ARIA labels on all interactive elements, visible focus rings, and screen-reader announcements for dynamic content. The `a11y` i18n namespace keeps all accessibility strings translatable.

**How to apply:** Any new icon-only button must have `aria-label={t("a11y.*")}` using a key from the `a11y` namespace. Any new dynamic content region (search results, cart updates) should call `announce()` from `useAnnouncer`. Any new dialog/sheet must have `SheetTitle`/`DialogTitle` (sr-only ok) + `aria-describedby={undefined}` (Radix pattern already in place).
