# PERFORMANCE_STATE.md — SYANO (سوق سوريا)

## Status: ALL OPTIMIZATIONS COMPLETE (do not redo)

Last verified: 2026-06-08

---

## Completed Optimizations

### 1. React.memo
- **Status:** DONE
- **Files:** `Navbar.tsx`, `NotificationCenter.tsx`, `ProductCard.tsx`, `cart.tsx`, `home.tsx`
- **Reason:** Prevent unnecessary re-renders on parent state changes (currency, language toggle)
- **Verification:** `grep -rc "React.memo\|memo("` shows presence in all files above

### 2. Stable Callbacks (useCallback)
- **Status:** DONE
- **Files:** 13+ files across marketplace
- **Reason:** Prevent child re-renders caused by inline arrow functions
- **Verification:** `grep -rc "useCallback"` returns 13 files with matches

### 3. Bundle Splitting (manualChunks)
- **Status:** DONE
- **File:** `artifacts/marketplace/vite.config.ts`
- **Chunks:**
  - `vendor-react` — React, React-DOM, React-Router (must stay separate from vendor-radix — circular dep)
  - `vendor-radix` — Radix UI components
  - `framer-motion` — deferred/lazy loaded
  - `recharts` — deferred/lazy loaded
- **Critical rule:** Use `/node_modules/pkg/` with leading/trailing slashes (pnpm embeds peer-dep versions in folder names)
- **Critical rule:** vendor-react and vendor-radix MUST NOT be merged (causes `Cannot read properties of undefined (reading 'useLayoutEffect')` in production)

### 4. Lazy Loading
- **Status:** DONE
- **Count:** 54 lazy-loaded components in marketplace (`React.lazy`)
- **Special:** `NotificationToasts` and `PushPermissionPrompt` are lazy
- **Reason:** Reduce initial bundle size and TTI

### 5. Virtualized Product Grid
- **Status:** DONE
- **File:** `artifacts/marketplace/src/components/ProductCard.tsx`
- **Implementation:** IntersectionObserver for prefetch (replaces hover-only)
- **Extra:** `product-grid contain:layout` CSS class
- **Reason:** Avoid rendering off-screen product cards

### 6. Frame Pacing
- **Status:** DONE
- **Files:** `NavigationProgress.tsx`, `App.tsx`, `index.css`
- **Implementation:** CSS NavigationProgress animation; `will-change` removed from page transitions
- **Reason:** Smooth 60fps page transitions without jank

### 7. Long Task Optimization
- **Status:** DONE
- **File:** CSV export handler in admin routes
- **Implementation:** ISO date formatting (avoids locale-aware date parsing which blocks main thread)
- **Reason:** Eliminate long tasks >50ms during CSV export

### 8. Memory Optimization (Context Memoization)
- **Status:** DONE
- **Files:** `GuestCartContext`, `NotificationProvider`
- **Implementation:** Context values wrapped in `useMemo`; GuestCartContext uses named `useMemo` import (not React namespace)
- **Extra:** `scroll-behavior: smooth` removed from html root (caused layout recalculations)
- **Extra:** `// @refresh reset` at top of context files (prevents HMR "must be used within Provider" errors)

### 9. Mobile FlatList Optimization
- **Status:** DONE
- **Files:** `mobile/app/(tabs)/cart.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/messages.tsx`
- **Implementation:** `getItemLayout`, `removeClippedSubviews`, `initialNumToRender`
- **Reason:** Smooth scrolling on low-end Android devices

### 10. Google Translate Protection
- **Status:** DONE
- **Files:** `AdminLayout.tsx`, `Navbar.tsx`, `ProductCard.tsx`
- **Implementation:** `translate="no"` on all price/currency `<span>` elements
- **Reason:** Google Translate wraps text nodes in `<font>` tags, corrupting React reconciliation on numeric/currency values

### 11. SSE Real-time Invalidation
- **Status:** DONE
- **File:** `NotificationProvider.tsx`
- **Implementation:** `onmessage` checks `type` field: `new_message` → invalidate conversations; order events → invalidate orders query key
- **Polling fallback:** `useGetMessages` refetchInterval:3000, `useGetConversations` refetchInterval:5000

### 12. Mobile Instant Experience
- **Status:** DONE
- **Files:** `ProductCard` (IntersectionObserver prefetch), CSS (tap-highlight), all pages (skeleton screens)
- **Extra:** `product-grid contain:layout` CSS class

### 13. RTL/Arabic Support
- **Status:** DONE
- **Implementation:** `i18n.dir()` for RTL-aware rendering; `PaginationPrevious`/`PaginationNext` use `useTranslation()` + chevron flip
- **Translation files:** `artifacts/marketplace/src/i18n/en.json` and `ar.json`

---

## Pending Optimizations

### CPU Profiling Infrastructure
- **Status:** NOT STARTED
- **Planned:** After variant system is complete
- **Goal:** Identify remaining CPU hotspots via React Profiler + server-side timing

---

## Rules
- DO NOT undo any of the above
- DO NOT re-add `scroll-behavior: smooth` to html root
- DO NOT use `position: fixed` for mobile action bars (doesn't render correctly in this app)
- DO NOT put `vendor-react` and `vendor-radix` in the same manualChunk
- DO NOT use naive `id.includes("react-dom")` for chunk matching — use `/node_modules/pkg/` with slashes
