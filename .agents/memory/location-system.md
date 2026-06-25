---
name: Location system architecture
description: How the delivery location global state flows from map modal → context → DB → checkout → account.
---

## Global State: LocationContext
- File: `artifacts/marketplace/src/contexts/LocationContext.tsx`
- Provides `{ location: LocationState, setZoneName }` to the entire app
- LocationState: `{ latitude, longitude, zoneId, zoneName, formattedAddress }`
- Hydrates on boot from `loadSavedCoords()` + `loadSavedZoneId()` (localStorage)
- Wrapped in App.tsx inside `<AuthProvider>` → `<LocationProvider>` → `<AuthModalProvider>`

## Sync Mechanism
- `LocationMapModal` dispatches `syano:location-updated` CustomEvent with `{ zoneId, lat, lng }`
- `LocationContext` listens to this event and updates its own state
- `Navbar` listens to this event independently to update the zone display button
- `Checkout` listens to this event to update `selectedZoneId` within the wizard
- `AuthContext.logout()` dispatches `syano:location-updated` with `null` values

## DB Persistence
- Users table has 3 added columns: `delivery_lat double precision`, `delivery_lng double precision`, `delivery_zone_id integer`
- `PATCH /api/auth/me` accepts `deliveryLat`, `deliveryLng`, `deliveryZoneId` (all optional)
- `formatUser()` returns these 3 fields
- `LocationContext.syncToApi()` fires a background PATCH whenever the event fires and a JWT token exists

## Checkout Integration
- Checkout Step 2 shows an "Address Preview Card" at the top with zone name + GPS coords
- "Edit Location" / "Set Location" button opens `LocationMapModal` inline
- On mount: auto-populates `selectedZoneId` from `location.zoneId` if not yet set
- Shipping fee is read from `selectedZone.fee` (delivery_zones table)
- Grand total formula: `cart.total + (selectedZone?.fee ?? 0)` (displayed in sidebar)
- Order submit payload: `{ shippingAddress, customerPhone, city, deliveryNotes, zoneId }`

## Account Page
- Uses `LOCATION_ADDR_KEY` (imported from location-storage) — no local ADDR_KEY duplicate
- Event listener `syano:location-updated` → updates `addr.zoneId` + `savedCoords` live
- Zone dropdown + coords display re-render instantly when map modal confirms from anywhere

**Why:**
Single source of truth for location avoids stale state bugs when user changes zone in Navbar but checkout still shows the old zone. The event-driven approach is lightweight and doesn't require prop drilling through the entire component tree.
