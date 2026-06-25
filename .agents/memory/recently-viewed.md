---
name: Recently Viewed Products
description: localStorage-based recently viewed product tracking; hook, product detail trigger, homepage section.
---

## Architecture

- **Storage key:** `localStorage` key `syano_recently_viewed`
- **Format:** JSON array of lightweight product snapshots (id, name, price, discountPercent, imageUrls, category, storeName, stock, isBestDeal, hasVariants)
- **Max items:** 10 (oldest trimmed when exceeded)
- **Ordering:** Most-recent-first (index 0 = last viewed)
- **Duplicate prevention:** On re-view, existing entry is filtered out, new snapshot prepended → always at position 0, no duplicate

## Hook

File: `artifacts/marketplace/src/hooks/useRecentlyViewed.ts`

Exports: `{ recentlyViewed, trackView, clearHistory }`

- `trackView(product: Product)` — call with the full product object; creates snapshot + writes to localStorage
- `recentlyViewed` — reactive array, updated by storage events (cross-tab sync via `window.storage` listener)
- `clearHistory()` — removes the key from localStorage, resets state

## Trigger Point

File: `artifacts/marketplace/src/pages/products/[id].tsx`

```ts
const { trackView } = useRecentlyViewed();
useEffect(() => {
  if (product) trackView(product);
}, [product?.id]);
```

Dependency is `product?.id` (not `product`) to avoid double-firing on re-renders.

## Homepage Display

File: `artifacts/marketplace/src/pages/home.tsx`

- Conditionally rendered section between Best Sellers and Categories
- Only appears when `recentlyViewed.length > 0`
- Uses existing `ProductCard` component (no new card implementation)
- Has a "Clear" button that calls `clearHistory()`
- i18n keys: `home.recently_viewed_title` / `home.recently_viewed_clear` (EN + AR)

## Behaviour Rules

- Works for guests (no auth required)
- Works for authenticated users
- Survives page refresh
- Cross-tab sync via `window.storage` event
- Section hidden until at least one product is viewed
- No API calls — all data comes from localStorage snapshots captured at view time

**Why localStorage (not server-side):**
- No schema change needed
- No auth requirement
- Instant read on homepage mount
- Acceptable stale risk (product data may change, but recently viewed is inherently ephemeral)
