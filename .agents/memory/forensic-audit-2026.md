---
name: Forensic audit fixes June 2026
description: All bugs found and fixed in the zero-assumption forensic audit (June 2026); critical to high severity only.
---

## CRITICAL (Fixed)

### 1. Notification auto-order-transition removed (notifications.ts)
Reading a "new_order" notification auto-transitioned the order pending→processing silently.
Sellers must explicitly accept orders via the status PATCH endpoint — this side effect was removed entirely.

### 2. N+1 queries in order placement batched (orders.ts)
POST /orders fired N×3 DB round-trips per cart item (product + variant + buildVariantData) inside a Promise.all map.
Fixed by batch-fetching all products via inArray, all variants via inArray, then buildVariantData only for unique products-with-variants in parallel.

### 3. sql.raw() in messaging route replaced (messaging.ts)
DISTINCT ON and unread count queries used `sql.raw(convIds.join(','))` — convIds are DB ints so no actual injection, but bad pattern.
Replaced with `sql.array(convIds)` (Drizzle parameterized array).

## HIGH (Fixed)

### 4. storeSlug uniqueness enforced in branding update (sellers.ts)
PATCH /sellers/store/branding allowed changing storeSlug to one already used by another approved store.
Added uniqueness check (409 Conflict) before persisting the new slug.

### 5. nameAr field now updatable in PATCH /products/:id (products.ts)
nameAr was handled in POST (create) but missing from the PATCH handler.
Fixed by reading req.body.nameAr directly (bypassing the generated Zod schema that omits it) and including it in updateData + searchTokens rebuild.

## MEDIUM (Fixed)

### 6. RTL logical properties — ui/table.tsx, dropdown-menu.tsx, accordion.tsx
- table.tsx TableHead: `text-left pr-0` → `text-start pe-0`
- dropdown-menu.tsx: all `pl-8`/`pr-2` → `ps-8`/`pe-2`; `left-2` → `start-2`; `ml-auto` → `ms-auto`
- accordion.tsx AccordionTrigger: `text-left` → `text-start`

### 7. messages/index.tsx fully i18n'd
All hardcoded strings extracted to en.json/ar.json under "messages" namespace:
title, conv_count, no_conversations, no_conversations_hint, browse_products, select_conversation, select_conversation_hint, no_messages, type_message, you_prefix, read_receipt, back, seller_label, about_product, error_send_title, error_send_desc, login_prompt, login_btn.

## Still open (not fixed)
- Rate limiter is in-memory — resets on server restart; needs Redis for production hardening.
- Admin audit log silently swallows errors (admin.ts catch{} blocks).
- Product listing (GET /products list) omits imageUrls — only the detail endpoint includes gallery images.
- Mobile RTL: physical marginLeft/paddingRight/textAlign in native styles; no I18nManager.forceRTL call.
