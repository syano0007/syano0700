/**
 * routeCacheService.ts — Route Cache (Phase A6.6)
 *
 * TTL: 60 seconds per entry
 * Invalidates early when courier moves > 100 m (A6.9)
 *
 * Cache key: missionId (number)
 * Stores: geometry + distance + duration + last courier position
 */

import { calculateDistanceKm } from "../utils/haversine";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CachedRouteData {
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  source: "osrm" | "haversine";
  cachedAt: number;          // Date.now()
  courierLat: number;
  courierLng: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS          = 60_000; // 60 s
const MOVEMENT_THRESHOLD_KM = 0.1;    // 100 m

// ── Store ─────────────────────────────────────────────────────────────────────

const cache = new Map<number, CachedRouteData>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns cached route if still valid (TTL not expired, courier hasn't moved > 100 m).
 * Returns null if stale or missing — caller must fetch fresh route.
 */
export function getCachedRoute(
  missionId:  number,
  courierLat: number,
  courierLng: number,
): CachedRouteData | null {
  const entry = cache.get(missionId);
  if (!entry) return null;

  // TTL check
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(missionId);
    return null;
  }

  // Movement check (A6.9)
  const movedKm = calculateDistanceKm(courierLat, courierLng, entry.courierLat, entry.courierLng);
  if (movedKm > MOVEMENT_THRESHOLD_KM) {
    cache.delete(missionId);
    return null;
  }

  return entry;
}

/**
 * Store a route result for a mission.
 */
export function setCachedRoute(
  missionId:  number,
  courierLat: number,
  courierLng: number,
  data: Pick<CachedRouteData, "geometry" | "distanceMeters" | "durationSeconds" | "source">,
): void {
  cache.set(missionId, {
    ...data,
    cachedAt: Date.now(),
    courierLat,
    courierLng,
  });
}

/**
 * Manually invalidate a mission's cached route (e.g. on pickup / status change).
 */
export function invalidateRouteCache(missionId: number): void {
  cache.delete(missionId);
}

/**
 * Diagnostics: return current cache state.
 */
export function getRouteCacheStats(): {
  size: number;
  entries: { missionId: number; ageMs: number; source: string; hit?: boolean }[];
} {
  const now = Date.now();
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([missionId, entry]) => ({
      missionId,
      ageMs: now - entry.cachedAt,
      source: entry.source,
    })),
  };
}
