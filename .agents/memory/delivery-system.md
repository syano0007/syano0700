---
name: Delivery system architecture
description: Full courier/delivery system schema, API routes, and frontend pages added for Aleppo-only launch.
---

## Order status flow
Two parallel paths from `processing`:
- **Delivery path**: processing → ready_for_pickup → courier_assigned → picked_up → in_transit → delivered
- **Shipping path**: processing → shipped → delivered
- Seller triggers `ready_for_pickup` via "Mark Ready" button on seller/orders.tsx
- Admin assigns courier on /admin/delivery (ready_for_pickup tab)
- Courier marks pickup/delivered on /courier/dashboard

## DB tables added
- `delivery_zones` — seeded with Aleppo districts (nameEn, nameAr, fee, active)
- `couriers` — user application + approval, vehicleType, active toggle, completedDeliveries, rating
- `courier_assignments` — links courier to order, tracks status (assigned/picked_up/delivered)
- `courier_wallet_transactions` — earnings per delivery
- `orders` table: added `delivery_fee` (numeric) + `zone_id` (FK delivery_zones)

## New order status enum values (added via individual ALTER TYPE outside transactions)
confirmed, preparing, ready_for_pickup, courier_assigned, picked_up, in_transit

## API routes
- POST /api/couriers/apply — any user applies
- GET/PATCH /api/couriers/profile — courier's own profile + toggle online
- GET /api/couriers/assignments — active assignments for courier
- PATCH /api/couriers/assignments/:id/pickup — mark picked up
- PATCH /api/couriers/assignments/:id/deliver — mark delivered
- GET /api/couriers/earnings — wallet + transactions
- GET /api/admin/delivery/ready-orders — orders in ready_for_pickup state
- GET /api/admin/delivery/active — all active courier_assignments
- GET/POST/PATCH/DELETE /api/admin/delivery-zones — zone CRUD
- GET/PATCH /api/admin/couriers + /api/admin/couriers/:id — list + approve/suspend
- POST /api/admin/orders/:id/assign-courier — assign approved courier
- POST /api/seller/orders/:id/ready — seller marks order ready_for_pickup

## Frontend pages
- `/admin/delivery` — 4-tab admin page: Ready for Pickup, Active Deliveries, Couriers, Zones
- `/courier` and `/courier/dashboard` — courier dashboard: apply form → pending → full dashboard with deliveries + earnings tabs
- AdminLayout.tsx has Truck icon nav item for `/admin/delivery`
- seller/orders.tsx has "Mark Ready for Pickup" button alongside "Mark Shipped" for processing orders

## i18n keys added
- `orders.status_*` for all 6 new statuses, `orders.step_*` for timeline steps
- `seller_orders.mark_ready`, `seller_orders.ready_for_pickup`, etc.
- Full `delivery` section and `courier` section in en.json + ar.json

## Why courier uses userId not role
Couriers are regular users with an approved `couriers` table record — no new role enum needed. CourierDashboard fetches /api/couriers/profile and shows apply-form if 404.
