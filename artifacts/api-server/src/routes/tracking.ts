/**
 * tracking.ts — Real-Time Tracking API (Phase A4)
 *
 * Routes:
 *   GET  /api/tracking/:missionId               — unified tracking data (all authorized roles)
 *   GET  /api/tracking/:missionId/positions     — position history
 *   GET  /api/tracking/:missionId/events        — event stream
 *   GET  /api/admin/tracking/sessions           — all active sessions (admin)
 *
 * Permissions (A4.14):
 *   customer  → own orders only
 *   seller    → own orders only
 *   courier   → own assigned missions only
 *   admin     → all
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, deliveryMissionsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  getTrackingData,
  getPositionHistory,
  getTrackingEvents,
  getAllActiveSessions,
} from "../services/trackingService";
import { getMultiLegRoute, getRoute, pingOSRM } from "../services/osrmService";
import { getRouteCacheStats } from "../services/routeCacheService";

const router: IRouter = Router();

// ─── Permission helper ────────────────────────────────────────────────────────
async function canAccessMission(
  missionId: number,
  userId:    number,
  role:      string,
): Promise<boolean> {
  if (role === "admin") return true;

  const [mission] = await db
    .select({
      courierId:  deliveryMissionsTable.courierId,
      sellerId:   deliveryMissionsTable.sellerId,
      customerId: deliveryMissionsTable.customerId,
    })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId))
    .limit(1);

  if (!mission) return false;

  if (role === "customer") return mission.customerId === userId;
  if (role === "seller")   return mission.sellerId   === userId;

  // courier: compare against couriers.user_id
  if (role === "courier") {
    const { couriersTable } = await import("@workspace/db");
    const [courier] = await db
      .select({ id: couriersTable.id })
      .from(couriersTable)
      .where(eq(couriersTable.userId, userId))
      .limit(1);
    if (!courier) return false;
    return mission.courierId === courier.id;
  }

  return false;
}

// ─── GET /api/tracking/:missionId ────────────────────────────────────────────
router.get("/tracking/:missionId", requireAuth, async (req, res): Promise<void> => {
  const missionId = parseInt(String(req.params.missionId), 10);
  if (!missionId || isNaN(missionId)) {
    res.status(400).json({ error: "Invalid mission ID" });
    return;
  }

  const { userId, role } = req.user!;
  const allowed = await canAccessMission(missionId, userId, role);
  if (!allowed) {
    res.status(403).json({ error: "Access denied to this tracking session" });
    return;
  }

  try {
    const data = await getTrackingData(missionId);
    if (!data) {
      res.status(404).json({ error: "Mission not found" });
      return;
    }
    res.json(data);
  } catch (err) {
    logger.error({ err, missionId }, "[tracking] Failed to get tracking data");
    res.status(500).json({ error: "Failed to retrieve tracking data" });
  }
});

// ─── GET /api/tracking/:missionId/positions ──────────────────────────────────
router.get("/tracking/:missionId/positions", requireAuth, async (req, res): Promise<void> => {
  const missionId = parseInt(String(req.params.missionId), 10);
  if (!missionId || isNaN(missionId)) {
    res.status(400).json({ error: "Invalid mission ID" });
    return;
  }

  const { userId, role } = req.user!;
  const allowed = await canAccessMission(missionId, userId, role);
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

  try {
    const positions = await getPositionHistory(missionId, limit);
    res.json({
      missionId,
      count: positions.length,
      positions: positions.map((p) => ({
        lat:        parseFloat(String(p.lat)),
        lng:        parseFloat(String(p.lng)),
        heading:    p.heading  != null ? parseFloat(String(p.heading))  : null,
        speed:      p.speed    != null ? parseFloat(String(p.speed))    : null,
        accuracy:   p.accuracy != null ? parseFloat(String(p.accuracy)) : null,
        recordedAt: p.recordedAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err, missionId }, "[tracking] Failed to get position history");
    res.status(500).json({ error: "Failed to retrieve position history" });
  }
});

// ─── GET /api/tracking/:missionId/events ─────────────────────────────────────
router.get("/tracking/:missionId/events", requireAuth, async (req, res): Promise<void> => {
  const missionId = parseInt(String(req.params.missionId), 10);
  if (!missionId || isNaN(missionId)) {
    res.status(400).json({ error: "Invalid mission ID" });
    return;
  }

  const { userId, role } = req.user!;
  const allowed = await canAccessMission(missionId, userId, role);
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

  try {
    const events = await getTrackingEvents(missionId, limit);
    res.json({
      missionId,
      count: events.length,
      events: events.map((e) => ({
        id:         e.id,
        eventType:  e.eventType,
        courierId:  e.courierId,
        payload:    e.payload,
        actorId:    e.actorId,
        actorRole:  e.actorRole,
        occurredAt: e.occurredAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err, missionId }, "[tracking] Failed to get event stream");
    res.status(500).json({ error: "Failed to retrieve events" });
  }
});

// ─── GET /api/admin/tracking/sessions ─────────────────────────────────────────
router.get("/admin/tracking/sessions", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  try {
    const sessions = await getAllActiveSessions();
    res.json({
      total: sessions.length,
      sessions,
    });
  } catch (err) {
    logger.error({ err }, "[tracking] Failed to get active sessions");
    res.status(500).json({ error: "Failed to retrieve active sessions" });
  }
});

// ─── POST /api/admin/routing/calculate (A6.12) ───────────────────────────────
router.post("/admin/routing/calculate", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { latA, lngA, latB, lngB, latC, lngC } = req.body ?? {};

  const parse = (v: unknown) => {
    const n = parseFloat(String(v ?? ""));
    return isNaN(n) ? null : n;
  };

  const a = { lat: parse(latA), lng: parse(lngA) };
  const b = { lat: parse(latB), lng: parse(lngB) };
  const c = { lat: parse(latC), lng: parse(lngC) };

  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    res.status(400).json({ error: "latA, lngA, latB, lngB are required" });
    return;
  }

  const t = Date.now();
  try {
    let route;
    if (c.lat != null && c.lng != null) {
      route = await getMultiLegRoute([
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng },
        { lat: c.lat, lng: c.lng },
      ]);
    } else {
      route = await getRoute(a.lat, a.lng, b.lat, b.lng);
    }

    const responseMs = Date.now() - t;
    const cacheStats  = getRouteCacheStats();

    res.json({
      success: route !== null,
      responseMs,
      route: route
        ? {
            distanceKm:      Math.round((route.distanceMeters / 1000) * 100) / 100,
            durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
            distanceMeters:  route.distanceMeters,
            durationSeconds: route.durationSeconds,
            geometryPoints:  route.geometry.length,
            geometry:        route.geometry,
            source:          route.source,
            legs:            "legs" in route ? route.legs : undefined,
          }
        : null,
      fallback: route === null,
      cache: cacheStats,
    });
  } catch (err) {
    logger.error({ err }, "[routing] Calculate route error");
    res.status(500).json({ error: "Route calculation failed" });
  }
});

// ─── GET /api/admin/routing/status (A6.12 — OSRM health) ─────────────────────
router.get("/admin/routing/status", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  try {
    const [osrmStatus, cacheStats] = await Promise.all([
      pingOSRM(),
      Promise.resolve(getRouteCacheStats()),
    ]);
    res.json({
      osrm: {
        reachable:  osrmStatus.reachable,
        responseMs: osrmStatus.responseMs,
        endpoint:   "https://router.project-osrm.org",
      },
      cache: cacheStats,
    });
  } catch (err) {
    logger.error({ err }, "[routing] Status check error");
    res.status(500).json({ error: "Status check failed" });
  }
});

export default router;
