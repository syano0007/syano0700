---
name: Courier Workspace W1-W12
description: Web-first courier experience — pages, hooks, routes, i18n keys added.
---

# Courier Workspace (Phases W1-W12)

## New files created
- `artifacts/marketplace/src/hooks/useBrowserLocation.ts` — W6 GPS hook (watchPosition → PATCH /api/courier/location, 8s interval)
- `artifacts/marketplace/src/pages/courier/workspace.tsx` — W1-W7 map-first interface (primary courier page at /courier)
- `artifacts/marketplace/src/pages/courier/history.tsx` — W8 delivery history
- `artifacts/marketplace/src/pages/courier/earnings.tsx` — W9 wallet + earnings
- `artifacts/marketplace/src/pages/courier/profile.tsx` — W10 settings + availability toggle

## Route changes in App.tsx
- `/courier` → CourierWorkspace (was CourierDashboard)
- `/courier/history` → CourierHistory (NEW)
- `/courier/earnings` → CourierEarnings (NEW)
- `/courier/profile` → CourierProfilePage (NEW)
- `/courier/dashboard` → CourierDashboard (legacy, kept for backward compat)

## Key design decisions
- missionId IS included in /api/couriers/assignments response — used to query /api/tracking/:missionId for map data
- Workspace layout: top nav bar + map (flex-[7]) + operational panel (flex-[3]) + bottom courier nav
- Offer cards overlay sits at z-[1000] above the Leaflet map (z=1000)
- GPS enabled only when availability != OFFLINE
- TrackingMap: courierLat/Lng from browser GPS first, falls back to tracking API

## i18n keys added
~35 new keys in `courier.*` namespace, en.json + ar.json in sync.
All at line ~2715 in each file, ending just before closing `}` of the courier block.

**Why:** Web-first = map always visible; old dashboard was a list-only view with no GPS.
**How to apply:** Always check workspace.tsx before touching any courier page — it is now the primary entry point.
