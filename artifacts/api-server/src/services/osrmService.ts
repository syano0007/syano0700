/**
 * osrmService.ts — OSRM Real Road Routing Client (Phase A6.1-A6.3)
 *
 * Uses the public OSRM demo server: https://router.project-osrm.org
 * All requests come from the backend only (A6.15 — never from browser).
 *
 * Supports:
 *  - Single-leg routes (A → B)
 *  - Multi-waypoint routes (A → B → C)
 *  - Per-leg breakdown for two-leg ETA
 */

import { logger } from "../lib/logger";

const OSRM_BASE = "https://router.project-osrm.org";
const TIMEOUT_MS = 5_000;

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface RouteData {
  distanceMeters: number;
  durationSeconds: number;
  /** Leaflet-compatible [lat, lng][] (OSRM returns [lng, lat], we flip here) */
  geometry: [number, number][];
  source: "osrm";
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface MultiLegRouteData extends RouteData {
  legs: RouteLeg[];
}

// ── OSRM fetch helper ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function osrmFetch(url: string): Promise<Record<string, any> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, any>;
    if (data["code"] !== "Ok" || !(data["routes"] as unknown[])?.length) return null;
    return data;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Geometry decoder (A6.3) ───────────────────────────────────────────────────

/**
 * Convert OSRM GeoJSON [lng, lat] coordinates to Leaflet [lat, lng][].
 */
function decodeGeometry(coordinates: [number, number][]): [number, number][] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

// ── Single-leg route ──────────────────────────────────────────────────────────

/**
 * Get a route between two points.
 * Returns null on failure (OSRM unreachable, timeout, route not found).
 */
export async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): Promise<RouteData | null> {
  const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const data = await osrmFetch(url);
  if (!data) return null;

  try {
    const route = data.routes[0];
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: decodeGeometry(route.geometry.coordinates),
      source: "osrm",
    };
  } catch (err) {
    logger.warn({ err }, "[osrm] Failed to parse single-leg route");
    return null;
  }
}

// ── Multi-waypoint route (A → B → C) ─────────────────────────────────────────

/**
 * Get a multi-leg route through ordered waypoints.
 * Returns per-leg breakdown alongside total distance/duration/geometry.
 */
export async function getMultiLegRoute(
  waypoints: { lat: number; lng: number }[],
): Promise<MultiLegRouteData | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const data = await osrmFetch(url);
  if (!data) return null;

  try {
    const route = data.routes[0];
    const legs: RouteLeg[] = (route.legs ?? []).map((leg: any) => ({
      distanceMeters: Math.round(leg.distance),
      durationSeconds: Math.round(leg.duration),
    }));

    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: decodeGeometry(route.geometry.coordinates),
      legs,
      source: "osrm",
    };
  } catch (err) {
    logger.warn({ err }, "[osrm] Failed to parse multi-leg route");
    return null;
  }
}

// ── Ping / health check ───────────────────────────────────────────────────────

/**
 * Quick OSRM reachability test (Aleppo center → nearby point).
 * Returns response time in ms, or -1 on failure.
 */
export async function pingOSRM(): Promise<{ reachable: boolean; responseMs: number }> {
  const t = Date.now();
  const data = await osrmFetch(
    `${OSRM_BASE}/route/v1/driving/37.1343,36.2021;37.1400,36.2100?overview=false`,
  );
  const responseMs = Date.now() - t;
  return { reachable: data !== null, responseMs };
}
