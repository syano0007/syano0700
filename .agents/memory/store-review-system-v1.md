---
name: Store Review System V1
description: Complete customer review submission lifecycle — components, pages, mobile, analytics integration, and recovery check module.
---

## Architecture

### Backend (already complete before this session)
- `GET /sellers/:id/review-status` → returns `{ eligible, alreadyReviewed, deliveredOrderId, existingReview }`
- `POST /sellers/:id/reviews` → creates review (requireActiveAccount + customer role + delivered order gate)
- `GET /sellers/:id/reviews` → public reviews list with summary
- `useGetSellerReviewStatus(sellerId)` hook in `lib/api-client-react/src/sellers.ts`
- `getSellerReviewStatusQueryKey(sellerId)` exported

### Web Frontend Components
- `SellerReviewModal.tsx` — Radix Dialog with 3 StarRating categories (communication/shipping/professionalism) + comment TextArea + success state
- `SellerReviewPrompt.tsx` — thin wrapper that checks review-status and conditionally renders modal trigger OR "already reviewed" chip; supports `compact` prop for order list cards

### Web Integration Points
- `orders/[id].tsx`: shows `<SellerReviewPrompt>` after OrderStatusTimeline when `order.status === "delivered"` and `order.items[0]?.sellerId` exists
- `orders/index.tsx`: shows `<SellerReviewPrompt compact>` below each delivered order card for customer role
- `store/[slug].tsx` ReviewCard: adds "Verified Purchase" emerald badge (CheckCircle2 icon); ReviewsTab now accepts `sellerName` prop and renders `<SellerReviewPrompt>` at top so eligible customers can write reviews inline on the store page
- `seller/reviews.tsx` (NEW page at `/seller/reviews`): seller's received reviews dashboard — overview cards, rating breakdown bars, All/Critical filter tabs, ReviewCards with verified purchase badge

### Seller Analytics Integration
- `seller/analytics.tsx`: imports `useGetSellerReviews`, queries with `user?.userId`, renders "Store Reputation" SectionCard after the KPI grid and before Financial Summary — shows overall score, star display, and 3 metric bars

### Mobile (Expo)
- `mobile/app/order/[id].tsx`: imports `useGetSellerReviewStatus`, `usePostSellerReview`, `getSellerReviewStatusQueryKey`; shows amber "Rate This Seller" card for eligible delivered orders; bottom-sheet Modal with 3 star rows (Pressable Ionicons) + TextInput comment + submit button; "Already reviewed" green chip for repeat visits

### i18n
- `orders` section: `review_leave_desc`, `review_submit_btn`, `review_rate_all`, `review_error`, `already_reviewed`, `review_success_title`, `review_success_desc`
- `store` section: `review_title`, `review_comment_label`, `review_comment_ph`, `verified_purchase`
- `seller_reviews` section: full set (title, subtitle, avg_rating, total_reviews, communication_avg, shipping_avg, professionalism_avg, overview_title, recent_title, all_reviews, low_title, no_reviews, no_reviews_desc, verified_purchase)

### Recovery Check
- Section 18 `checkReviewSystem()` — validates: review-status endpoint, post endpoint, eligible/alreadyReviewed fields, SellerReviewModal/Prompt component files, integration in order detail page, verified_purchase badge in store page, seller reviews page existence, api-client hook, i18n keys
- Weight: `reviewSystem: 5` in WEIGHTS object
- Total sections: 19 (was 18)
- roadmapState: "Store Review System V1" entry

## Key Patterns
- `order.items[0]?.sellerId` — single-seller-per-order assumption for review targeting
- `order.items[0]?.sellerName` — display name passed to SellerReviewPrompt as `sellerName` prop
- ReviewsTab early return removed — now uses `hasReviews` boolean to conditionally show empty state vs review cards while always rendering SellerReviewPrompt first
- Mobile uses `useGetSellerReviewStatus` with `enabled: !!sellerId && isDelivered && isCustomer` guard
