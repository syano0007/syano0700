---
name: Seller Ecosystem Architecture
description: Store pages, follow system, seller reviews, buyer-seller messaging, analytics — schema, API, and frontend decisions.
---

## Store URLs
- Pattern: `/store/:slug` (SEO-friendly, not /store/:id)
- Slug generated at seller application approval time in `seller-applications.ts`
- Unique partial index: `CREATE UNIQUE INDEX ... ON seller_applications(store_slug) WHERE store_slug IS NOT NULL`
- Fields added to `sellerApplicationsTable`: `storeSlug`, `storeLogo`, `storeBanner`

## New Tables
- `store_follows` (followerId → sellerId, unique constraint, createdAt)
- `seller_reviews` (customerId, sellerId, communicationRating, shippingRating, professionalismRating, comment)
- `conversations` (customerId, sellerId, productId nullable, status, lastMessageAt)
- `messages` (conversationId, senderId, body, readAt, flagged)
- `verifiedAt` column added to `users` table
- `viewCount` int column added to `products` table

## API Routes (all in `artifacts/api-server/src/routes/`)
- `sellers.ts` — GET /sellers/store/:slug, GET /sellers/:id/store-preview, GET|POST|DELETE /sellers/:id/follow, GET /sellers/:id/follow-status, GET|POST /sellers/:id/reviews, GET /me/following-stores
- `messaging.ts` — POST /conversations (start/get), GET /conversations (list), GET /conversations/:id/messages, POST /conversations/:id/messages, POST /conversations/:id/report
- `dashboard.ts` — GET /dashboard/seller/analytics?days=N (revenueByDay, topProducts, topViewedProducts, followerGrowth). Also returns followerCount, sellerScore, sellerReviewCount.
- `products.ts` — viewCount fire-and-forget increment on GET /products/:id; storeSlug/storeName/storeLogo join from sellerApplicationsTable in buildProductResponse

## Fan-out
- `artifacts/api-server/src/lib/fanout.ts` — isolated `notifyStoreFollowers(sellerId, payload)`, fire-and-forget, 50-item chunks with Promise.allSettled. Swappable with queue.

## Frontend API Client Hooks (`lib/api-client-react/src/`)
- `sellers.ts` — useGetStoreProfile, useGetStorePreview, useGetFollowStatus, useFollowStore, useUnfollowStore, useGetFollowingStores, useGetSellerReviews, usePostSellerReview, useGetSellerAnalytics
- `messaging.ts` — useStartConversation, useGetConversations (refetchInterval:15s), useGetMessages (refetchInterval:8s), useSendMessage

## Frontend Pages
- `/store/:slug` → `artifacts/marketplace/src/pages/store/[slug].tsx` — public store page with banner, logo, follow button, contact button, stats bar, Products/About/Reviews tabs
- `/messages` → `artifacts/marketplace/src/pages/messages/index.tsx` — customer inbox (protected: customer only)
- `/seller/messages` → `artifacts/marketplace/src/pages/seller/messages.tsx` — seller inbox (protected: seller only)

## Product Detail Page
- Seller trust card now links to `/store/:storeSlug` when slug is available
- Contact Seller button shown for customers when storeSlug is present
- `product.sellerId` and `product.storeSlug` are returned by the API but not in generated TS types → cast as `(product as any).sellerId`

## Seller Dashboard Additions
- 6-card stats grid (added followerCount + sellerScore cards)
- Messages quick-action card linking to `/seller/messages`
- Revenue bar chart (last 30 days) from `useGetSellerAnalytics`
- Analytics hook: `useGetSellerAnalytics(days?)` hits GET /dashboard/seller/analytics

## Hook Name Gotcha
- Products list hook is `useListProducts` (not `useGetProducts`) — generated name from orval

## Messaging Real-time Strategy
- No new SSE streams — piggybacks existing notification SSE
- New message creates a `new_message` notification → triggers push to notification SSE channel
- React Query polls conversations every 15s, messages every 8s as safety net
