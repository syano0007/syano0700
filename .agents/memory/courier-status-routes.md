---
name: Courier status update routes
description: Couriers use dedicated assignment endpoints, not the generic PATCH /orders/:id/status
---

# Courier Status Update Architecture

**Rule:** Never add courier role to `PATCH /orders/:id/status`. Couriers have their own dedicated endpoints.

**Why:** The generic status endpoint (orders.ts line 605) intentionally blocks couriers — they use dedicated assignment routes in couriers.ts instead. This is by design, not a bug.

**Courier endpoints (couriers.ts):**
- `PATCH /couriers/assignments/:id/pickup` — courier_assigned → picked_up
- `PATCH /couriers/assignments/:id/start-delivery` — picked_up → out_for_delivery  
- `PATCH /couriers/assignments/:id/deliver` — out_for_delivery → delivered
- `PATCH /couriers/assignments/:id/fail-delivery` — out_for_delivery → delivery_failed

**Admin assignment:** `POST /admin/orders/:id/assign-courier` (in couriers.ts, NOT admin.ts) — atomically creates courier_assignments record AND updates order status to courier_assigned. Returns empty 2xx body (not JSON) on success.

**How to apply:** If a courier can't update order status, check that the courier route (/couriers/assignments/:id/...) is being called, not PATCH /orders/:id/status.
