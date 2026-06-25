---
name: hasVariants on product list API
description: products list endpoint adds hasVariants boolean via one batch query on productVariantsTable
---

## Rule
The products list route adds `hasVariants: boolean` to every product in the response via a single batch query — not N individual queries per product.

## How to apply
After fetching product rows, run:
```ts
const vRows = await db.selectDistinct({ productId: productVariantsTable.productId })
  .from(productVariantsTable)
  .where(inArray(productVariantsTable.productId, rows.map(r => r.id)));
const variantProductIds = new Set(vRows.map(r => r.productId));
// then: hasVariants: variantProductIds.has(row.id)
```
- `productVariantsTable` must be imported from `@workspace/db` in products.ts (was not there before).
- `inArray` from drizzle-orm also needed.
- Frontend reads it as `(product as any).hasVariants` since the generated Product type doesn't include it.
- ProductCard: `hasVariants === true` → clicking cart icon navigates to `/products/:id` instead of direct add.

**Why:** Quick-add from the card for a product with variants would add the base product without a variantId, causing incorrect orders.
