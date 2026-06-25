---
name: Courier Discovery Engine A1
description: Architecture and gotchas for findNearestCouriers() — Courier V3.3 Phase A1
---

## Key decisions

**Haversine lives in `artifacts/api-server/src/utils/haversine.ts`** — pure function, no DB, no imports from project. Only re-export `calculateDistanceKm()` from here.

**`findNearestCouriers()` lives in `deliveryMissionService.ts`** — NOT in `courierAvailabilityService.ts`. It delegates DB loading to `getAvailableCouriers()` (single query), computes distances in memory. This is the intended reuse point for Phase A2.

**`couriersTable.currentLat/currentLng` are Drizzle `numeric` columns** — they come back as strings. Always `parseFloat(String(c.currentLat))` before passing to Haversine.

**Couriers with no location** — appended after sorted results with `distanceKm: null`. Never excluded. The admin panel shows "No location" for them.

**Fallback pickup coords** — `GET /admin/delivery-missions/:id/nearest-couriers` falls back to Aleppo center (36.2021, 37.1343) when mission has no pickupLat/pickupLng. Response includes `usingFallbackCoords: boolean` so the UI can display a note.

**Route ordering matters** — `GET /admin/delivery-missions/:id/nearest-couriers` MUST be registered BEFORE `GET /admin/delivery-missions/stats` would be matched as `:id` — but stats has no `:id` in its path so there's no conflict. Still, keep specific routes (with sub-paths like `/nearest-couriers`) before generic list routes.

**Why:**
Phase A1 spec required read-only discovery — no assignment, no offers. The separation of concerns (`calculateDistanceKm` utility → `findNearestCouriers` service → API endpoint) allows Phase A2 to call `findNearestCouriers()` directly to implement offer dispatch without touching the discovery logic.
