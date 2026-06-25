---
name: V3.3 Finalization
description: 3 correctness gaps found and closed in the Courier V3.3 Mission Offer & Assignment Engine (June 17, 2026).
---

## Gap 1 — Haversine distance sort in findNearestCouriers()

**What was wrong:** `findNearestCouriers()` sorted by `completedDeliveries DESC` (experience proxy) instead of actual geographic proximity.

**Fix:** Added `current_lat` / `current_lng` columns to `couriers` table (via run-migrations.ts). `findNearestCouriers()` in `missionAssignmentEngine.ts` now runs a raw SQL Haversine formula sorted `distance_km ASC`. Falls back to `completedDeliveries DESC` when courier location is NULL.

**Why:** Distance-first ensures nearest available courier gets the offer first — required for correct S2 round semantics.

**Files changed:**
- `lib/db/src/schema/couriers.ts` — added `currentLat`, `currentLng` (decimal, nullable)
- `artifacts/api-server/src/lib/run-migrations.ts` — ADD COLUMN IF NOT EXISTS for both
- `artifacts/api-server/src/services/missionAssignmentEngine.ts` — full Haversine rewrite

---

## Gap 2 — dispatch_alerts table (was missing)

**What was wrong:** `missionAssignmentEngine.ts` raised NO_COURIER_FOUND but only sent a notification — no persistent DB record for admin monitoring.

**Fix:** Created `dispatch_alerts` table in `lib/db/src/schema/dispatch_alerts.ts`. Engine inserts a row on NO_COURIER_FOUND. Admin routes added to `mission-offers.ts`:
- `GET /admin/dispatch-alerts` — unresolved alerts (newest first)
- `PATCH /admin/dispatch-alerts/:id/resolve` — mark resolved by admin user
- `GET /admin/delivery-missions/stats` (updated in `delivery-missions.ts`) — now includes `dispatchAlerts: <count>` field

Admin UI: `DispatchAlertsPanel` component added to `artifacts/marketplace/src/pages/admin/delivery-missions.tsx` — shows rose-tinted alert cards with Resolve button, polls every 30s, auto-hides when empty.

**Files changed:**
- `lib/db/src/schema/dispatch_alerts.ts` — new table
- `lib/db/src/schema/index.ts` — export added
- `artifacts/api-server/src/lib/run-migrations.ts` — CREATE TABLE IF NOT EXISTS dispatch_alerts
- `artifacts/api-server/src/routes/mission-offers.ts` — 2 new admin routes
- `artifacts/api-server/src/routes/delivery-missions.ts` — stats now includes dispatchAlerts count
- `artifacts/marketplace/src/pages/admin/delivery-missions.tsx` — DispatchAlertsPanel component

---

## Gap 3 — Courier ONLINE restore on order cancel

**What was wrong:** Cancelling an order from `courier_assigned` / `picked_up` / `out_for_delivery` / `in_transit` left the courier stuck in BUSY status permanently.

**Fix:** Added a restore-ONLINE block in `orders.ts` PATCH /:id/status cancel handler. Calls `setCourierOnlineAfterMission(courierId)` (already existed from deliver/fail paths) when order is cancelled from any active courier status.

**Files changed:**
- `artifacts/api-server/src/routes/orders.ts` — import + restore-ONLINE block on cancel

---

## DB table count after V3.3 finalization

37 tables total (21 base schema.sql + 16 via run-migrations.ts).
Previous doc count of "33" was stale — delivery system tables were already included.
