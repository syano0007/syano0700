---
name: Guest cart architecture
description: localStorage cart for unauthenticated users — context, merge, route changes, all entry points
---

## Rule
/cart is open to everyone (no ProtectedRoute). Unauthenticated users get a localStorage-backed cart; login auto-merges it into the server cart. ALL product entry points (cards + detail page) must wire to addGuestItem for guests.

## How to apply
- `GuestCartContext.tsx` — provider in `artifacts/marketplace/src/contexts/`. Exposes `guestItems`, `guestTotal`, `addGuestItem`, `updateGuestQty`, `removeGuestItem`, `clearGuestCart`.
- `GUEST_CART_KEY = "syano_guest_cart"` in localStorage.
- Auto-merge: when `isAuthenticated` flips true, context calls `addToCart()` for each item, then removes the localStorage key and invalidates `getGetCartQueryKey()`.
- `App.tsx` wraps `<GuestCartProvider>` inside `<AuthProvider>` and outside `<NotificationProvider>`.
- `/cart` route is `<Route path="/cart" component={Cart} />` — no ProtectedRoute.
- `cart.tsx`: `!isAuthenticated` → `<GuestCart>` (useQueries for product data), `isCustomer` → `<ServerCart>`.
- `ProductCard.tsx`: `!isAuthenticated` click → `addGuestItem` + toast; if `hasVariants` → navigate to detail instead.
- `products/[id].tsx`: `!isAuthenticated` branch in `ActionButtons` renders Add to Cart + Buy Now buttons that call `handleGuestAddToCart` / `handleGuestBuyNow` (both use `addGuestItem`). NOT a login redirect.
- `Navbar.tsx`: cart icon shown when `!isSeller && !isAdmin` (guests + customers). Badge uses `visibleCartCount = isAuthenticated ? cartItemCount : guestTotal`.

**Why:** ProductDetail was showing "Login to purchase" instead of Add-to-Cart for guests — a conversion blocker. Navbar was hiding the cart icon from guests entirely.
