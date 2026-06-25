---
name: Seller contact button gate
description: ContactSellerButton must use sellerId not storeSlug as its render condition
---

# Seller Contact Button — Correct Gate Condition

**Rule:** `ContactSellerButton` must be gated on `(product as any).sellerId`, NOT on `(product as any).storeSlug`.

**Why:** `storeSlug` is fetched from `seller_applications WHERE status = 'approved'`. If the seller has no approved application, `storeSlug` is `null` and the button never renders — even though customers can still message any seller via `sellerId`. The conversation API only needs `sellerId`.

**How to apply:** In `artifacts/marketplace/src/pages/products/[id].tsx`:
```jsx
{isCustomer && (product as any).sellerId && (
  <ContactSellerButton sellerId={(product as any).sellerId} className="mb-5" />
)}
```

The seller card link (above the button) still correctly uses `storeSlug` as its condition — that's correct because the store page route requires a slug.
