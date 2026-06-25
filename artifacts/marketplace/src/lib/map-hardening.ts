/**
 * map-hardening.ts — Shared map engine utilities
 *
 * Layer 1: Warm earth-tone CSS background (#e8e0d5) injected once into document.head
 * Layer 2: CSS fade-in transitions on .leaflet-tile and .leaflet-layer
 * Tile providers: OSM (primary) → CartoDB Voyager (automatic fallback)
 * Geofence tile prefetch: 3×3 grid, zoom 13–16, throttled 100 ms, SW-cached
 */

// ── Tile provider registry ────────────────────────────────────────────────────

export const TILE_PROVIDERS = {
  osm:   "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  carto: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
} as const;

export type TileProvider = keyof typeof TILE_PROVIDERS;

// ── Layer 1 + 2: CSS injection ────────────────────────────────────────────────

/**
 * Inject map hardening CSS into document.head once per page load.
 * - Layer 1: warm earth-tone container background (#e8e0d5) replaces Leaflet's default gray
 * - Layer 2: smooth fade-in transitions on individual tiles and tile layers
 * Safe to call multiple times — guarded by element ID check.
 */
export function injectMapHardeningCSS(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("syano-map-hardening")) return;
  const style = document.createElement("style");
  style.id = "syano-map-hardening";
  style.textContent = `
    .leaflet-container { background: #e8e0d5 !important; }
    .leaflet-tile      { transition: opacity 0.25s ease !important; }
    .leaflet-layer     { transition: opacity 0.35s ease !important; }
  `;
  document.head.appendChild(style);
}

// ── Layer 3 & 4: dynamic keepBuffer ──────────────────────────────────────────

/**
 * Returns keepBuffer based on current viewport width.
 * Mobile (<768 px) → 6  (fixes 276 MB RAM critical issue on low-end devices)
 * Desktop          → 10 (smooth panning on larger viewports)
 */
export function getKeepBuffer(): number {
  if (typeof window === "undefined") return 6;
  return window.innerWidth < 768 ? 6 : 10;
}

// ── Geofence tile prefetch queue (OPT-3) ─────────────────────────────────────

function latLngToTileXY(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

const OSM_SUBDOMAINS = ["a", "b", "c"] as const;

/**
 * Prefetch a 3×3 grid of OSM tiles at zoom levels 13–16 around the given
 * lat/lng into the SW tile cache (syano-tile-cache-v1).
 *
 * - Throttled at 100 ms per tile to respect OSM usage policy
 * - Deduplicates via caches.match() — only fetches tiles not already cached
 * - Fully non-blocking: call without await
 */
export async function prefetchTilesAround(
  lat: number,
  lng: number,
  zooms: number[] = [13, 14, 15, 16],
): Promise<void> {
  if (!("caches" in window)) return;
  let cache: Cache;
  try {
    cache = await caches.open("syano-tile-cache-v1");
  } catch {
    return;
  }

  for (const zoom of zooms) {
    const center = latLngToTileXY(lat, lng, zoom);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = center.x + dx;
        const y = center.y + dy;
        const sub = OSM_SUBDOMAINS[Math.abs(x) % 3];
        const url = `https://${sub}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

        try {
          const hit = await cache.match(url);
          if (!hit) {
            const res = await fetch(new Request(url, { mode: "cors" }));
            if (res.ok) await cache.put(url, res);
          }
        } catch { /* ignore per-tile network errors */ }

        // 100 ms throttle — OSM usage policy compliance
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}

// ── Nominatim local geocoding cache ──────────────────────────────────────────

export interface GeocodeCacheValue {
  zoneId:         number | null;
  address:        string;
  isOutsideSyria: boolean;
}

interface GeocodeCacheEntry extends GeocodeCacheValue { ts: number }

const GC_DECIMALS = 3;                     // 3 dp ≈ 111 m ("same city block")
const GC_MAX      = 500;                   // LRU cap
const GC_TTL_MS   = 30 * 60 * 1_000;      // 30-minute TTL
const GC_LS_KEY   = "syano:geocode-cache"; // localStorage key

function _gcKey(lat: number, lng: number): string {
  const f = Math.pow(10, GC_DECIMALS);
  return `${Math.round(lat * f) / f},${Math.round(lng * f) / f}`;
}

class _GeocodeCache {
  private mem = new Map<string, GeocodeCacheEntry>();

  constructor() { this._hydrate(); }

  private _hydrate(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(GC_LS_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Record<string, GeocodeCacheEntry>;
      const now = Date.now();
      for (const [k, e] of Object.entries(stored)) {
        if (now - e.ts < GC_TTL_MS) this.mem.set(k, e);
      }
    } catch { /* corrupt storage */ }
  }

  private _flush(): void {
    if (typeof localStorage === "undefined") return;
    try {
      const obj: Record<string, GeocodeCacheEntry> = {};
      for (const [k, e] of this.mem) obj[k] = e;
      localStorage.setItem(GC_LS_KEY, JSON.stringify(obj));
    } catch { /* quota exceeded */ }
  }

  get(lat: number, lng: number): GeocodeCacheValue | null {
    const key = _gcKey(lat, lng);
    const e   = this.mem.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > GC_TTL_MS) { this.mem.delete(key); return null; }
    return { zoneId: e.zoneId, address: e.address, isOutsideSyria: e.isOutsideSyria };
  }

  set(lat: number, lng: number, value: GeocodeCacheValue): void {
    if (this.mem.size >= GC_MAX) {
      const oldest = this.mem.keys().next().value;
      if (oldest !== undefined) this.mem.delete(oldest);
    }
    this.mem.set(_gcKey(lat, lng), { ...value, ts: Date.now() });
    this._flush();
  }
}

/**
 * Singleton in-memory + localStorage geocoding cache.
 * Resolution: 3 dp ≈ 111 m ("same city block").
 * Survives page reloads via localStorage. TTL: 30 min. Cap: 500 entries.
 *
 * Usage:
 *   const hit = geocodeCache.get(lat, lng);
 *   if (hit) { applyHit(hit); return; }
 *   // fetch Nominatim, then:
 *   geocodeCache.set(lat, lng, { zoneId, address, isOutsideSyria });
 */
export const geocodeCache = new _GeocodeCache();

// ── SW tile cache invalidation ────────────────────────────────────────────────

/**
 * Send INVALIDATE_TILE_CACHE postMessage to the active service worker.
 * The SW clears syano-tile-cache-v1 and syano-tile-meta-v1 and acknowledges
 * via the MessageChannel port.
 */
export function invalidateSWTileCache(): void {
  if (!navigator.serviceWorker?.controller) return;
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = () => { /* ack — tile cache cleared */ };
  navigator.serviceWorker.controller.postMessage(
    { type: "INVALIDATE_TILE_CACHE" },
    [port2],
  );
}
