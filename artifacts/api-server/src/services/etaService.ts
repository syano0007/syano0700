/**
 * etaService.ts — ETA Engine V3 (Phase A6.4-A6.5)
 *
 * Upgrade from V2 (haversine) to real road routing via OSRM.
 *
 * Priority:
 *   1. OSRM real-road route → confidence HIGH, geometry returned
 *   2. Fallback: Haversine V2 → confidence MEDIUM (straight-line)
 *
 * Failsafe (A6.5): OSRM failures NEVER break tracking — haversine always available.
 * Route cache (A6.6/A6.9): checked before calling OSRM.
 */

import { logger } from "../lib/logger";
import { getMultiLegRoute, getRoute } from "./osrmService";
import { getCachedRoute, setCachedRoute } from "./routeCacheService";

export type RouteStatus =
  | "WAITING_PICKUP"
  | "GOING_TO_PICKUP"
  | "PICKED_UP"
  | "GOING_TO_CUSTOMER"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface ETAData {
  distanceRemainingKm:     number | null;
  estimatedTravelMinutes:  number | null;
  averageSpeed:            number | null;
  confidence:              "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
  note:                    string;
  calculatedAt:            string;
  legToPickupKm:           number | null;
  legToCustomerKm:         number | null;
  legToPickupMinutes:      number | null;
  legToCustomerMinutes:    number | null;
  routeStatus:             RouteStatus;
  // A6 additions
  routeGeometry:           [number, number][] | null;
  routeDistanceKm:         number | null;
  routeDurationMinutes:    number | null;
  routeSource:             "osrm" | "haversine" | null;
}

export interface ETAInput {
  missionId:       number;
  courierId:       number;
  missionStatus?:  string;
  courierLat:      number | null;
  courierLng:      number | null;
  pickupLat:       number | null;
  pickupLng:       number | null;
  dropoffLat:      number | null;
  dropoffLng:      number | null;
  averageSpeedKmh?: number;
}

const AVG_SPEED_KMH = 25;

// ── Haversine fallback (V2, kept intact per A6.5) ────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function deriveRouteStatus(missionStatus: string, hasGPS: boolean): RouteStatus {
  const s = (missionStatus ?? "").toUpperCase();
  if (s === "DELIVERED")                    return "DELIVERED";
  if (s === "FAILED")                       return "FAILED";
  if (s === "CANCELLED")                    return "CANCELLED";
  if (s === "IN_TRANSIT")                   return "GOING_TO_CUSTOMER";
  if (s === "PICKED_UP")                    return "PICKED_UP";
  if (s === "ACCEPTED" || s === "ASSIGNED") return hasGPS ? "GOING_TO_PICKUP" : "WAITING_PICKUP";
  return "WAITING_PICKUP";
}

// ── Haversine-only fallback builder ───────────────────────────────────────────

function buildHaversineFallback(
  input: ETAInput,
  routeStatus: RouteStatus,
  speed: number,
): ETAData | null {
  const cLat = input.courierLat!;
  const cLng = input.courierLng!;
  const isPostPickup = routeStatus === "GOING_TO_CUSTOMER" || routeStatus === "PICKED_UP";

  let distanceRemainingKm: number;
  let legToPickupKm: number | null = null;
  let legToCustomerKm: number | null = null;

  if (isPostPickup) {
    if (input.dropoffLat == null || input.dropoffLng == null) return null;
    const d = haversineKm(cLat, cLng, input.dropoffLat, input.dropoffLng);
    distanceRemainingKm = Math.round(d * 100) / 100;
    legToCustomerKm     = distanceRemainingKm;
  } else {
    if (input.pickupLat != null && input.pickupLng != null) {
      const leg1 = haversineKm(cLat, cLng, input.pickupLat, input.pickupLng);
      const leg2 = (input.dropoffLat != null && input.dropoffLng != null)
        ? haversineKm(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng)
        : 0;
      legToPickupKm       = Math.round(leg1 * 100) / 100;
      legToCustomerKm     = Math.round(leg2 * 100) / 100;
      distanceRemainingKm = Math.round((leg1 + leg2) * 100) / 100;
    } else if (input.dropoffLat != null && input.dropoffLng != null) {
      const d = haversineKm(cLat, cLng, input.dropoffLat, input.dropoffLng);
      distanceRemainingKm = Math.round(d * 100) / 100;
      legToCustomerKm     = distanceRemainingKm;
    } else {
      return null;
    }
  }

  const estimatedTravelMinutes = Math.max(1, Math.round((distanceRemainingKm / speed) * 60));

  return {
    distanceRemainingKm,
    estimatedTravelMinutes,
    averageSpeed:           speed,
    confidence:             "MEDIUM",
    note:                   "Haversine fallback (OSRM unavailable)",
    calculatedAt:           new Date().toISOString(),
    legToPickupKm,
    legToCustomerKm,
    legToPickupMinutes:     legToPickupKm != null ? Math.max(1, Math.round((legToPickupKm / speed) * 60)) : null,
    legToCustomerMinutes:   legToCustomerKm != null ? Math.max(1, Math.round((legToCustomerKm / speed) * 60)) : null,
    routeStatus,
    routeGeometry:          null,
    routeDistanceKm:        distanceRemainingKm,
    routeDurationMinutes:   estimatedTravelMinutes,
    routeSource:            "haversine",
  };
}

// ── Main ETA function (V3) ─────────────────────────────────────────────────────

export async function getETA(input: ETAInput): Promise<ETAData> {
  const speed     = input.averageSpeedKmh ?? AVG_SPEED_KMH;
  const hasGPS    = input.courierLat != null && input.courierLng != null;
  const routeStatus = deriveRouteStatus(input.missionStatus ?? "", hasGPS);

  const base: ETAData = {
    distanceRemainingKm:    null,
    estimatedTravelMinutes: null,
    averageSpeed:           null,
    confidence:             "UNAVAILABLE",
    note:                   "Insufficient coordinate data",
    calculatedAt:           new Date().toISOString(),
    legToPickupKm:          null,
    legToCustomerKm:        null,
    legToPickupMinutes:     null,
    legToCustomerMinutes:   null,
    routeStatus,
    routeGeometry:          null,
    routeDistanceKm:        null,
    routeDurationMinutes:   null,
    routeSource:            null,
  };

  if (!hasGPS) return base;

  if (
    routeStatus === "DELIVERED" ||
    routeStatus === "FAILED" ||
    routeStatus === "CANCELLED"
  ) {
    return { ...base, confidence: "UNAVAILABLE", note: "Mission completed" };
  }

  const cLat = input.courierLat!;
  const cLng = input.courierLng!;
  const isPostPickup = routeStatus === "GOING_TO_CUSTOMER" || routeStatus === "PICKED_UP";

  // ── Check route cache first (A6.6 / A6.9) ──────────────────────────────────
  const cached = getCachedRoute(input.missionId, cLat, cLng);
  if (cached) {
    const durationMinutes = Math.max(1, Math.round(cached.durationSeconds / 60));
    const distanceKm      = Math.round((cached.distanceMeters / 1000) * 100) / 100;

    logger.debug({ missionId: input.missionId }, "[eta-v3] Using cached route");

    return {
      distanceRemainingKm:    distanceKm,
      estimatedTravelMinutes: durationMinutes,
      averageSpeed:           null,
      confidence:             cached.source === "osrm" ? "HIGH" : "MEDIUM",
      note:                   cached.source === "osrm"
        ? "Real road route (cached)"
        : "Haversine fallback (cached)",
      calculatedAt:           new Date().toISOString(),
      legToPickupKm:          null,
      legToCustomerKm:        null,
      legToPickupMinutes:     null,
      legToCustomerMinutes:   null,
      routeStatus,
      routeGeometry:          cached.geometry,
      routeDistanceKm:        distanceKm,
      routeDurationMinutes:   durationMinutes,
      routeSource:            cached.source,
    };
  }

  // ── Try OSRM (A6.4) ─────────────────────────────────────────────────────────
  try {
    if (isPostPickup) {
      // Single leg: courier → customer
      if (input.dropoffLat == null || input.dropoffLng == null) {
        return buildHaversineFallback(input, routeStatus, speed) ?? base;
      }

      const route = await getRoute(cLat, cLng, input.dropoffLat, input.dropoffLng);

      if (route) {
        const distanceKm      = Math.round((route.distanceMeters / 1000) * 100) / 100;
        const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));

        setCachedRoute(input.missionId, cLat, cLng, {
          geometry:      route.geometry,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          source:        "osrm",
        });

        logger.debug(
          { missionId: input.missionId, distanceKm, durationMinutes },
          "[eta-v3] OSRM single-leg route"
        );

        return {
          distanceRemainingKm:    distanceKm,
          estimatedTravelMinutes: durationMinutes,
          averageSpeed:           null,
          confidence:             "HIGH",
          note:                   "Real road route: courier → customer",
          calculatedAt:           new Date().toISOString(),
          legToPickupKm:          null,
          legToCustomerKm:        distanceKm,
          legToPickupMinutes:     null,
          legToCustomerMinutes:   durationMinutes,
          routeStatus,
          routeGeometry:          route.geometry,
          routeDistanceKm:        distanceKm,
          routeDurationMinutes:   durationMinutes,
          routeSource:            "osrm",
        };
      }

    } else {
      // Two-leg: courier → pickup → customer
      if (input.pickupLat == null || input.pickupLng == null) {
        // No pickup coords — try direct courier→dropoff
        if (input.dropoffLat == null || input.dropoffLng == null) {
          return buildHaversineFallback(input, routeStatus, speed) ?? base;
        }

        const route = await getRoute(cLat, cLng, input.dropoffLat, input.dropoffLng);
        if (route) {
          const distanceKm      = Math.round((route.distanceMeters / 1000) * 100) / 100;
          const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));

          setCachedRoute(input.missionId, cLat, cLng, {
            geometry:      route.geometry,
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
            source:        "osrm",
          });

          return {
            distanceRemainingKm:    distanceKm,
            estimatedTravelMinutes: durationMinutes,
            averageSpeed:           null,
            confidence:             "HIGH",
            note:                   "Real road route: courier → customer (no pickup coords)",
            calculatedAt:           new Date().toISOString(),
            legToPickupKm:          null,
            legToCustomerKm:        distanceKm,
            legToPickupMinutes:     null,
            legToCustomerMinutes:   durationMinutes,
            routeStatus,
            routeGeometry:          route.geometry,
            routeDistanceKm:        distanceKm,
            routeDurationMinutes:   durationMinutes,
            routeSource:            "osrm",
          };
        }

      } else {
        // Full two-leg: courier → pickup → customer
        const waypoints: { lat: number; lng: number }[] = [
          { lat: cLat,               lng: cLng },
          { lat: input.pickupLat,    lng: input.pickupLng },
        ];
        if (input.dropoffLat != null && input.dropoffLng != null) {
          waypoints.push({ lat: input.dropoffLat, lng: input.dropoffLng });
        }

        const route = await getMultiLegRoute(waypoints);

        if (route) {
          const distanceKm      = Math.round((route.distanceMeters / 1000) * 100) / 100;
          const durationMinutes = Math.max(1, Math.round(route.durationSeconds / 60));

          const leg1Km  = route.legs[0] ? Math.round((route.legs[0].distanceMeters / 1000) * 100) / 100 : null;
          const leg2Km  = route.legs[1] ? Math.round((route.legs[1].distanceMeters / 1000) * 100) / 100 : null;
          const leg1Min = route.legs[0] ? Math.max(1, Math.round(route.legs[0].durationSeconds / 60)) : null;
          const leg2Min = route.legs[1] ? Math.max(1, Math.round(route.legs[1].durationSeconds / 60)) : null;

          setCachedRoute(input.missionId, cLat, cLng, {
            geometry:      route.geometry,
            distanceMeters: route.distanceMeters,
            durationSeconds: route.durationSeconds,
            source:        "osrm",
          });

          logger.debug(
            { missionId: input.missionId, distanceKm, durationMinutes, legs: route.legs.length },
            "[eta-v3] OSRM multi-leg route"
          );

          return {
            distanceRemainingKm:    distanceKm,
            estimatedTravelMinutes: durationMinutes,
            averageSpeed:           null,
            confidence:             "HIGH",
            note:                   "Real road route: courier → pickup → customer",
            calculatedAt:           new Date().toISOString(),
            legToPickupKm:          leg1Km,
            legToCustomerKm:        leg2Km,
            legToPickupMinutes:     leg1Min,
            legToCustomerMinutes:   leg2Min,
            routeStatus,
            routeGeometry:          route.geometry,
            routeDistanceKm:        distanceKm,
            routeDurationMinutes:   durationMinutes,
            routeSource:            "osrm",
          };
        }
      }
    }
  } catch (err) {
    logger.warn({ err, missionId: input.missionId }, "[eta-v3] OSRM error — falling back to haversine");
  }

  // ── Haversine fallback (A6.5) ────────────────────────────────────────────────
  const fallback = buildHaversineFallback(input, routeStatus, speed);
  if (fallback) {
    // Cache the haversine result too (shorter TTL via same mechanism)
    if (fallback.routeGeometry == null) {
      // Build a straight-line "geometry" for the map when OSRM fails
      const pts: [number, number][] = [[cLat, cLng]];
      if (!isPostPickup && input.pickupLat != null && input.pickupLng != null) {
        pts.push([input.pickupLat, input.pickupLng]);
      }
      if (input.dropoffLat != null && input.dropoffLng != null) {
        pts.push([input.dropoffLat, input.dropoffLng]);
      }
      fallback.routeGeometry = pts.length > 1 ? pts : null;
    }
    if (fallback.routeGeometry) {
      setCachedRoute(input.missionId, cLat, cLng, {
        geometry:      fallback.routeGeometry,
        distanceMeters: (fallback.distanceRemainingKm ?? 0) * 1000,
        durationSeconds: (fallback.estimatedTravelMinutes ?? 0) * 60,
        source:        "haversine",
      });
    }
    return fallback;
  }

  return base;
}
