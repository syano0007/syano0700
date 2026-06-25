---
name: Seller Orders V2
description: Architecture and key patterns for the Shopify-grade seller order management dashboard.
---

## What was built

### New pages
- `artifacts/marketplace/src/pages/seller/orders.tsx` — V2 list with stats cards, metrics panel, table+mobile cards, bulk ops, grouped filter chips, pagination
- `artifacts/marketplace/src/pages/seller/orders/[id].tsx` — Full detail page with 5 sections: Customer, Products, Financial, Courier, Timeline + Action Center
- Route: `/seller/orders/:id` added to App.tsx before `/seller/orders`

### New backend endpoint
- `GET /dashboard/seller/metrics` in `dashboard.ts` — seller-only (403 for non-sellers); computes ordersToday/Week/Month, avgOrderValue, cancellationRate, deliverySuccessRate, preparingCount, awaitingCourierCount via single SQL aggregate on seller's orders.

### Notification fix
- `order_refunded` status now correctly fires `type: "order_refunded"` instead of `type: "order_cancelled"`; also notifies all sellers on that order.

## Key patterns

### Stats cards
Computed client-side from the `useListOrders()` data — no extra API call needed. Groups: new (pending+confirmed), preparing, ready_for_pickup, delivering (courier+picked_up+in_transit+out_for_delivery), completed (delivered), cancelled (cancelled+refunded+returned).

### Grouped filter chips
`FilterGroup` type maps to arrays of status strings in `FILTER_STATUSES`. Clicking a stats card sets the filter; clicking again clears it.

### Bulk operations
Sequential `await` loop over `updateStatus.mutate()` promises. Valid bulk actions shown based on `selected` order statuses. Floating bar uses `position:fixed bottom-6` centered.

### Metrics fetch
Uses raw `useQuery` (not generated client) with `fetch("/api/dashboard/seller/metrics")` + `Authorization: Bearer ${token}` from `useAuth().token`.

### Detail page action center
Actions shown based on `order.status`: pending → confirm/cancel, confirmed → preparing, preparing → ready, ready_for_pickup → waiting badge, courier_managed → courier badge, terminal → read-only.

## i18n
62 new keys added to `seller_orders` namespace in both `en.json` and `ar.json`. Run `python3 -c "import json; d=json.load(open('ar.json')); print(list(d['seller_orders'].keys()))"` to see full list.
