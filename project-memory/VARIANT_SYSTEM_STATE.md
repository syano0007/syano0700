# VARIANT_SYSTEM_STATE.md — SYANO (سوق سوريا)

## Current State: FULLY IMPLEMENTED — RTL TOGGLE BUG FIXED 2026-06-09 (Session 2)

Last verified: 2026-06-09 (Session 2 — position:absolute toggle fix, multi-viewport QA)

---

## Current Variant System (Existing)

### Database Schema (all tables exist)
```
product_variant_groups    — e.g. "Color", "Size"
  id, product_id, name, position

product_variant_options   — e.g. "Red", "XL"
  id, group_id, name, position

product_variants          — a specific SKU (combination of options)
  id, product_id, sku, stock_quantity, is_active
  + price, compare_at_price, barcode, weight_grams, dimensions (added via migration)

product_variant_values    — junction: variant ↔ option
  id, variant_id, option_id

variant_images            — images specific to a variant
  id, variant_id, image_url, position
```

### Current API Routes (verified working 2026-06-08)
- `GET /api/products/:id/variants` → `{ groups: [], variants: [] }`
- `POST /api/products/:id/variants/groups`
- `PATCH /api/products/:id/variants/groups/:groupId`
- `DELETE /api/products/:id/variants/groups/:groupId`
- `POST /api/products/:id/variants`
- `PATCH /api/products/:id/variants/:variantId`
- `DELETE /api/products/:id/variants/:variantId`

### Cart Integration (partial)
- `cart_items.variant_id` column exists (added via migration)
- `order_items.variant_id` column exists
- `order_items.variant_details` column exists (text — stores variant snapshot)

### Frontend
- `ProductCard.tsx` — reads `(product as any).hasVariants` to decide navigate-to-detail vs quick-add
- `products/[id].tsx` — has variant selector UI (groups, options)
- `hasVariants` added to products list API response via batch inArray query

---

## Planned Upgrade: Modern Variant System

**Status:** NOT STARTED — planning phase only

**Goal:** Full marketplace-grade variant system similar to:
- Shopify
- Amazon
- Trendyol
- Noon

**Planned Features:**
- [ ] Variant option selectors (color swatches, size pills, dropdowns)
- [ ] Variant-level pricing with compare-at (strikethrough)
- [ ] Variant-level inventory tracking
- [ ] Variant-specific images with image switching
- [ ] Out-of-stock handling per variant
- [ ] Variant SKU management
- [ ] Cart enforces variant selection before add
- [ ] Checkout displays selected variant details
- [ ] Admin/seller product form with variant builder UI
- [ ] Variant image uploader

**Architecture Decisions (TBD):**
- Keep existing schema and extend, OR redesign
- UI: swatches vs pills vs dropdowns per group type
- Image association: variant → image OR option → image

**DB Impact:**
- Must use additive changes only (IF NOT EXISTS)
- Existing variant data must not be lost

**API Impact:**
- Will extend existing variant routes
- Will extend OpenAPI manually (do NOT regenerate orval)

**Frontend Impact:**
- `products/[id].tsx` variant selector redesign
- `ProductCard.tsx` variant-aware quick-add
- Seller product form variant builder
- Cart variant display
- Checkout variant display

**Mobile Impact:**
- `mobile/app/product/[id].tsx` variant selector

---

## Implementation Rules (when starting)
1. Read this file + DATABASE_STATE.md + API_STATE.md first
2. Create a git checkpoint before any schema changes
3. All DB changes: `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
4. All API changes: extend existing routes, preserve existing behavior
5. Do NOT regenerate OpenAPI — extend api.schemas.ts manually
6. Do NOT break existing products that have no variants
7. Update this file continuously during implementation
