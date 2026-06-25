---
name: Courier V3.2 + V3.3 architecture
description: Full courier mission offer & assignment engine — schema, service, routes, frontend.
---

## V3.2 — Availability + Operations
- Single master availability control: `courier_availability` table (`ONLINE/OFFLINE/BUSY`)
- `profile.active` toggle removed — availability is the only control
- `ONLINE → BUSY` on assignment; `BUSY → ONLINE` on deliver/fail
- 4 assignment foundation columns on `delivery_missions`
- Admin `/admin/delivery-missions/stats` counter endpoint

## V3.3 — Mission Offer & Assignment Engine

### Schema
- New table: `mission_offers` (Drizzle schema at `lib/db/src/schema/mission_offers.ts`)
- `mission_offer_status` enum: `OFFERED / ACCEPTED / DECLINED / EXPIRED`
- `delivery_mission_status` enum extended with `SEARCHING` + `NO_COURIER_FOUND` (added via ALTER TYPE in `run-migrations.ts` DO block)

### Engine service (`artifacts/api-server/src/services/missionAssignmentEngine.ts`)
- `findNearestCouriers(missionId, excludeIds)` — sorted by `completedDeliveries DESC` (no GPS phase 1; GPS will replace without touching rest)
- `createMissionOffers(missionId, courierIds, round)` — bulk insert, 60s expiry
- `expireStaleMissionOffers()` — marks OFFERED→EXPIRED where expiresAt < now
- `assignMissionToCourier(offerId, courierId)` — atomic via `BEGIN/SELECT FOR UPDATE NOWAIT/COMMIT` (pool.connect() pattern, NOT Drizzle ORM) to prevent race conditions
- `startAssignmentRound(missionId, round)` — picks 3 couriers per round
- `runAssignmentEngine(missionId)` — 3 rounds × 60s wait; sets NO_COURIER_FOUND if exhausted
- `triggerAssignmentEngine(missionId)` — fire-and-forget entry point; sets mission status to SEARCHING

### Trigger points
- `routes/orders.ts`: after `createDeliveryMission()`, calls `triggerAssignmentEngine()` (chained)
- `routes/couriers.ts`: seller mark-ready hook — finds or creates mission, then triggers engine

### Routes (`artifacts/api-server/src/routes/mission-offers.ts`, registered as `/api`)
- `GET  /courier/missions/offers` — active OFFERED offers for the calling courier (5s poll)
- `POST /courier/missions/offers/:offerId/accept` — atomic accept with FOR UPDATE NOWAIT
- `POST /courier/missions/offers/:offerId/decline` — mark DECLINED
- `GET  /admin/delivery-missions/stats` — status counter grid (all statuses)
- `GET  /admin/delivery-missions/:id/offers` — per-mission offer log for admin panel
- `POST /admin/delivery-missions/:id/trigger-assignment` — manual re-trigger

### Frontend
- `MissionOfferCard` component in `courier/dashboard.tsx` — countdown timer, amber/red urgency ring, Accept/Decline buttons
- Countdown via `setInterval` in `useEffect` based on `offer.expiresAt` ISO string
- Poll via `useQuery` refetchInterval: 5000ms
- 15 i18n keys added to `en.json` + `ar.json` under `courier.offer_*` namespace

**Why atomic pool.connect():**
Race condition — two couriers could both read OFFERED and both call "accept" simultaneously. `SELECT FOR UPDATE NOWAIT` ensures only one transaction wins; the other gets a lock error and receives 409.

**Why fire-and-forget trigger:**
Engine runs 3 rounds × 60s = up to 3 minutes. HTTP requests can't hold that long. `triggerAssignmentEngine()` uses unresolved Promise (no await at call site).
