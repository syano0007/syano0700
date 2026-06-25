---
name: Courier A5 Live Tracking Experience
description: Phase A5 — Leaflet map, ETA V2, tracking page, order buttons, mobile screen
---

## What was built
- **etaService.ts V2**: two-leg ETA (courier→pickup + pickup→customer if not picked up); single-leg post-pickup; `deriveRouteStatus()` exported; confidence HIGH/MEDIUM/LOW/UNAVAILABLE
- **trackingService.ts V2**: TrackingData includes `pickupLocation`, `deliveryLocation`, `routeStatus`, `missionStatus`; passes pickup/dropoff coords to getETA()
- **orders.ts**: `missionId` added to `buildOrderResponse()` via 5th parallel query on `deliveryMissionsTable`
- **TrackingMap.tsx**: react-leaflet v5 + Leaflet 1.9.4; custom DivIcons (emerald courier, amber pickup, blue customer); polyline trail; AutoPan component; default icon CDN fix
- **/tracking/:missionId**: 5s polling hook; Suspense-wrapped map; ETA card; courier info; event timeline; bilingual; role-aware (API enforces ownership)
- **tracking.* i18n**: 35 keys in en.json + ar.json
- **Customer orders/[id].tsx**: "Track Delivery" emerald button in courier info card when missionId + active status
- **Seller orders/[id].tsx**: "Track Courier" button in Quick Links sidebar when missionId + active status
- **Mobile tracking/[missionId].tsx**: ETA panel, courier info, addresses, event timeline, "View Live Map" via Linking.openURL
- **Mobile _layout.tsx**: `tracking/[missionId]` Stack.Screen registered

## Key decisions
**Why:** Leaflet/OSM over Google Maps — free, no API key, works offline, MIT license
**How to apply:** Any map UI in marketplace MUST use react-leaflet + OSM; delete (L.Icon.Default.prototype as any)._getIconUrl to fix bundler icon path issue

## Important patterns
- Mobile `useColors` hook: always use `@/hooks/useColors` (alias), NOT `../../src/hooks/useColors`
- Mobile i18n: `../../src/i18n` for depth-2 screens (app/tracking/, app/admin/, app/seller/)
- Leaflet install: `cd artifacts/marketplace && pnpm add leaflet react-leaflet @types/leaflet` (NOT root workspace)
- TrackingMap uses `useMap()` inside MapContainer for imperative pan — cannot call outside MapContainer
- react-leaflet v5: use `ref` on MapContainer, not `whenCreated` (removed in v5)
- Tracking page uses direct `fetch` (not generated hooks — tracking routes not in OpenAPI spec)
- `(order as any).missionId` — missionId added to API response but not in generated OpenAPI types yet
