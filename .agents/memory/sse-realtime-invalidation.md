---
name: SSE real-time query invalidation
description: NotificationProvider invalidates conversation/order queries on SSE events
---

## Rule
When SSE delivers a notification, invalidate the related React Query caches so the UI updates without a manual refresh.

## How to apply
In `NotificationProvider.tsx` `es.onmessage`, after the toast logic:
```ts
const type = (notif as any).type as string | undefined;
if (type === "new_message") {
  queryClient.invalidateQueries({ queryKey: getConversationsQueryKey() });
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === "string"
      && q.queryKey[0].startsWith("/api/conversations/"),
  });
} else if (ORDER_TYPES.includes(type)) {
  queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  // Also refresh any open order detail page
  queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "getOrder",
  });
}
```
ORDER_TYPES covers ALL 16 order notification types:
new_order, order_placed, order_confirmed, order_processing, order_preparing, order_ready,
order_courier_assigned, order_picked_up, order_shipped, order_out_for_delivery,
order_delivered, order_delivery_failed, order_returned, order_cancelled,
order_cancelled_by_customer, order_refunded.

**Why:** Without this, order status changes and new messages require a page reload.
Adding `["getOrder"]` predicate invalidation ensures open order detail pages
auto-refresh when courier/delivery status changes via SSE.
