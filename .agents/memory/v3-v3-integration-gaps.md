---
name: V3.2 / V3.3 integration gaps
description: Five bugs bridging the V3.2 courier_assignments system and the V3.3 delivery_missions/tracking system — all fixed June 19, 2026.
---

# V3.2 ↔ V3.3 Integration Gaps (All Fixed)

## Why two systems exist
- **V3.2 path:** `courier_assignments` table. Routes: `/couriers/assignments/:id/pickup|start-delivery|deliver|fail-delivery`. Created by `POST /admin/orders/:id/assign-courier`.
- **V3.3 path:** `delivery_missions` + `mission_offers` + `tracking_sessions` tables. Assignment via `assignMissionToCourier()` in `missionAssignmentEngine.ts`, offer acceptance via `POST /courier/missions/offers/:id/accept`.

## The Gap (Before Fix)
`assignMissionToCourier()` set `delivery_missions.status=ASSIGNED` but:
1. Did NOT create a `courier_assignments` record → pickup/deliver routes returned 404
2. Did NOT call `updateMissionStatus('ACCEPTED')` → tracking session never started
3. `startTrackingSession` used `.onConflictDoNothing()` on unique `mission_id` → reactivation silently skipped on re-run
4. V3.2 deliver/fail-delivery routes updated `orders` + `courier_assignments` but never called `updateMissionStatus('DELIVERED'/'FAILED')` → delivery_missions stayed ACCEPTED forever, tracking sessions never closed

## Fixes Applied
All in `mission-offers.ts` accept route (file: `artifacts/api-server/src/routes/mission-offers.ts`):
- Insert `courier_assignments` record after successful `assignMissionToCourier()`
- Call `updateMissionStatus(missionId, 'ACCEPTED')` fire-and-forget → starts tracking session

In `trackingService.ts` (`artifacts/api-server/src/services/trackingService.ts`):
- `.onConflictDoNothing()` → `.onConflictDoUpdate({ target: missionId, set: { isActive:true, courierId, endedAt:null, endReason:null } })`

In `couriers.ts` (`artifacts/api-server/src/routes/couriers.ts`) — deliver + fail-delivery routes:
- Fire-and-forget: `getMissionByOrderId(orderId).then(m => updateMissionStatus(m.id, 'DELIVERED'/'FAILED'))`

## How to apply
Any future courier flow change must update BOTH tables atomically:
- `courier_assignments` (V3.2 pickup/deliver view)
- `delivery_missions` (V3.3 tracking/admin view)

**Why:** The mobile courier dashboard reads `courier_assignments`. The admin tracking monitor reads `delivery_missions` + `tracking_sessions`. Both must stay in sync.
