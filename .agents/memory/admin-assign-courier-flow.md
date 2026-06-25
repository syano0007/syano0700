---
name: Admin assign-courier flow
description: Courier assignment must use POST /admin/orders/:id/assign-courier (in couriers.ts) — not a raw status PATCH — to atomically create the courier_assignments record
---

# Admin Assign-Courier Flow

**Rule:** To assign a courier to an order, always use:
```
POST /admin/orders/:id/assign-courier
Body: { courierId: number }
```
This route (defined in `couriers.ts`, NOT `admin.ts`) atomically:
1. Updates `orders.status` → `courier_assigned`
2. Creates a `courier_assignments` record with status=`assigned`
3. Fires a `order_courier_assigned` notification

**Why:** Using `PATCH /orders/:id/status` with `courier_assigned` updates the order status but does NOT create the `courier_assignments` record. The courier's dashboard `/couriers/assignments` endpoint reads from `courier_assignments`, not orders. Without the record, the courier never sees the job.

**Requirements:** Order must be in `ready_for_pickup` status before assigning. Returns 409 if status mismatch.

**How to apply:** Any admin UI or test that assigns a courier must POST to this dedicated route, not the generic status-change route.
