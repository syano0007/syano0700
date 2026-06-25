---
name: Wishlist System V1
description: Architecture of the wishlist feature — backend schema/routes, frontend context/page/components.
---

## Schema
- Table: `wishlists` (id, user_id, product_id, created_at, UNIQUE(user_id, product_id))
- Added via `run-migrations.ts` CREATE TABLE IF NOT EXISTS block
- Index on `user_id`

## Backend routes (`artifacts/api-server/src/routes/wishlist.ts`)
- Inline table definition (pgTable) — avoids regenerating lib typings
- `GET /wishlist` — full product objects, requires auth
- `GET /wishlist/ids` — lightweight IDs only, requires auth
- `POST /wishlist` — add, body: `{ productId }`, uses onConflictDoNothing, requires auth
- `DELETE /wishlist/:productId` — remove, requires auth
- Registered in routes/index.ts under `/api`

## Frontend
- **WishlistContext** (`src/contexts/WishlistContext.tsx`): `// @refresh reset` at top; ids state; fetchIds on auth change; optimistic toggle; useMemo'd value
- **WishlistProvider** position: inside GuestCartProvider, wrapping NotificationProvider
- **Navbar**: `useWishlist()` for count badge; heart icon button gated on `isCustomer`; links to `/wishlist`
- **ProductCard**: heart button at `absolute top-2 start-2 z-10`; `opacity-0 group-hover:opacity-100` + always visible when wishlisted; filled rose-500 when wishlisted; shows toast if not authenticated
- **wishlist.tsx page**: ProtectedRoute for customer role; fetches `/api/wishlist` on ids.length change; ProductCard grid

## Recovery module
- `checkWishlistSystem()` in recovery-check.ts — checks table accessible + auth gates (401 without token)
- WEIGHTS.wishlistSystem = 3

**Why:**
Wishlist uses inline table definition in the route file to avoid needing to regenerate orval API client types or rebuild lib/db. This pattern keeps the wishlist self-contained.
