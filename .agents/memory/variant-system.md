---
name: Variant system audit
description: Architecture, confirmed working pieces, and 4 bugs found+fixed in the product variant pipeline.
---

## Architecture (confirmed correct)
- DB: 5 tables — product_variant_groups → product_variant_options → product_variants + product_variant_values (join) + variant_images
- API payload format (BulkVariantBody): groups use `options: string[]` (NOT `values`); variants use `options: [{ groupIndex, optionIndex }]` positional indices
- `buildVariantPayload()` in VariantBuilder.tsx correctly produces this format
- `buildVariantData()` in variants.ts correctly returns `{ groups, variants }` with full option labels resolved
- `buildProductResponse()` in products.ts correctly calls `buildVariantData()` and includes both in response

## Confirmed working (no changes needed)
- Cart: accepts variantId, validates ownership, uses variant.stock, snapshots variantDetails
- Orders: reads variantDetails JSON snapshot, passes through correctly
- Customer product page: resolvedVariant logic, isOptionAvailable, variant selectors, variantId→addToCart all correct
- Edit product: initializes from API variantGroups/variants, shows errors via toast, calls DELETE when variantsEnabled=false

## Bugs fixed

### Bug 1 (CRITICAL) — new.tsx: silent variant save failure
`.catch(() => {})` swallowed all variant bulk save errors. Seller saw "Product created" even on failure.
Fix: Check response .ok, show toast with error, return early.

### Bug 2 (MODERATE) — new.tsx: silent discount failure
Same `.catch(() => {})` on discount PATCH. Fix: same pattern.

### Bug 3 (MODERATE) — ProductWizard.tsx: step 2 never validates
validateStep(2) always returned true. Seller could skip Generate, publish with 0 variants silently.
Fix: Block with toast if variantsEnabled && groups exist && variantRows is empty.
New i18n keys: variants.generate_warning (EN + AR).

### Bug 4 (CRITICAL) — variants.ts: productDetailCache not invalidated on variant mutation
After bulk save/PATCH/DELETE variants, the 5-minute product detail cache was NOT busted.
Customers would see stale product pages with missing/wrong variants.
Fix: Added invalidateProductDetailCache(productId) in all 3 mutation endpoints.
Key pattern: product:detail:${productId}. Cache class has .delete(key) method.

## End-to-end test result
3 colors x 4 sizes = 12 variants | stock synced | cache busted after bulk save and PATCH — ALL PASSED
