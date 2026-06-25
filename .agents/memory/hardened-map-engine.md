---
name: Hardened Map Engine
description: 6-layer gray tile fix, SW v4 tile caching, persistent LocationMapModal, CartoDB fallback, AbortController Nominatim, geofence prefetch. Implemented 2026-06-25.
---

## Overview
The SYANO map engine was hardened with 6 layers to eliminate gray tiles, reduce RAM, and enable offline resilience.

## SW v4 (public/sw.js)
- **New caches**: `syano-tile-cache-v1` (tiles) + `syano-tile-meta-v1` (LRU metadata)
- **Strategy**: Cache First for OSM + CartoDB tiles (mode: cors — both have CORS headers)
- **LRU eviction**: runs every 50 tile writes; evicts oldest-access tiles until under cap (750)
- **Runtime invalidation**: `postMessage({ type: 'INVALIDATE_TILE_CACHE' })` — helper: `invalidateSWTileCache()` in map-hardening.ts
- **Asset cache name unchanged**: `syano-assets-v2` — backward compatible

## Shared utilities (src/lib/map-hardening.ts)
- `injectMapHardeningCSS()` — Layer 1+2: injects `#e8e0d5` background + tile fade-in transitions once per page load (guarded by element ID)
- `getKeepBuffer()` — Layer 4: returns 6 for mobile (<768px), 10 for desktop
- `TILE_PROVIDERS` — `{ osm: '...openstreetmap...', carto: '...cartocdn.com/rastertiles/voyager...' }`
- `prefetchTilesAround(lat, lng, zooms?)` — geofence prefetch: 3×3 tile grid at zoom 13–16, throttled 100ms, deduplicates via caches.match()
- `invalidateSWTileCache()` — sends postMessage to SW via MessageChannel

## 6 Layers (both TrackingMap + LocationMapModal)
1. CSS injection: `#e8e0d5` warm earth background replaces Leaflet gray
2. CSS transitions: `.leaflet-tile { transition: opacity 0.25s }` fade-in
3. `updateWhenZooming={false}` — suppresses tile flood during zoom
4. `updateWhenIdle={true}` + dynamic `keepBuffer` (6/10) — RAM fix (was 276 MB issue)
5. Dual TileLayer crossfade: stale layer `key=stale-${staleKey}` `zIndex=1` stays 3s on provider switch; active layer `zIndex=2` with `eventHandlers={{ tileerror }}`
6. `MapResizeObserver` inner component: `ResizeObserver` + `map.invalidateSize({ pan: false })` on container resize

## Tile provider switching logic
- Active TileLayer receives `eventHandlers={{ tileerror: handleTileError }}`
- After 3 consecutive tile errors on OSM → switch to CartoDB (stale OSM layer persists 3s)
- After 3 errors on CartoDB → `setIsOffline(true)` → WifiOff overlay renders

## LocationMapModal persistent mount
- `if (!open) return null` → REMOVED
- Always renders via `createPortal`; controlled by `visibility: hidden / visible` + `opacity: 0/1` + `pointer-events: none/auto` + `zIndex: -1/9999`
- **Why**: `visibility: hidden` preserves container dimensions so Leaflet keeps tiles in GPU memory — subsequent opens are instant with no tile reload
- MapContainer stays alive across all open/close cycles; state reset still handled by `useEffect([open])`

## AbortController for Nominatim
- `geocodeAbortRef = useRef<AbortController | null>(null)`
- On each `debouncedCenter` change: abort previous controller, create new one, pass `signal` to fetch
- Cleanup: `return () => { controller.abort(); setAutoMatching(false); }`
- Catches AbortError explicitly and ignores it — other errors fall through silently

## Geofence tile prefetch
- Called in `LocationMapModal.handleConfirm` (non-blocking, no await)
- `prefetchTilesAround(center[0], center[1])` — prefetches zooms 13,14,15,16 around confirmed location

## What NOT to change
- Never add `keepBuffer={12}` back — the new value is 6 (mobile) / 10 (desktop) dynamic
- Never add `updateWhenIdle={false}` back — now true for request flood prevention
- Never re-add `if (!open) return null` to LocationMapModal — breaks persistent mount
- Never add `mapKey` increment on modal open — causes double-mount gray tiles bug
- Do not change SW cache name `syano-assets-v2` — this is backward compat with existing installs
