---
name: Product list imageUrls omission
description: GET /products list and best-sellers queries must explicitly SELECT imageUrls column or it returns []
---

## Rule
The Drizzle `.select({...})` object in the product list and best-sellers endpoints must explicitly include `imageUrls: productsTable.imageUrls`. If omitted, the response mapping returns `imageUrls: []` regardless of DB contents.

## How to apply
- `artifacts/api-server/src/routes/products.ts` — both the `GET /products` (list) and `GET /products/best-sellers` SELECT objects must have `imageUrls: productsTable.imageUrls`.
- The response mapping must read `imageUrls: row.imageUrls ?? []` (not hardcoded `[]`).
- `buildProductResponse` (detail view) already does this correctly via a separate full fetch.

**Why:** Gallery images were not appearing on product cards or in the GuestCart item rows because the list endpoint returned `imageUrls: []` even when the DB had images. The detail page was fine because it uses a different query path.
