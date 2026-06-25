/**
 * trackingService.ts — Real-Time Tracking Pipeline (Phase A4 + A5.1)
 *
 * A5.1 additions:
 *   - pickupLocation + deliveryLocation in TrackingData
 *   - routeStatus derived from mission status
 *   - missionStatus passed to ETA engine (two-leg ETA)
 *   - pickupAddress / dropoffAddress exposed to UI
 */

import { eq, desc, and, sql } from "drizzle-orm";
import {
  db,
  deliveryMissionsTable,
  couriersTable,
  usersTable,
  trackingSessionsTable,
  trackingPositionsTable,
  trackingEventsTable,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { getETA, deriveRouteStatus, type RouteStatus } from "./etaService";

// ─── Freshness thresholds (A4.7) ────────────────────────────────────────────
export const FRESH_THRESHOLD_S   = 15;
export const WARNING_THRESHOLD_S = 60;

export type FreshnessStatus = "FRESH" | "WARNING" | "STALE" | "UNKNOWN";

export function getPositionFreshness(lastPositionAt: Date | null | undefined): {
  status: FreshnessStatus;
  ageSeconds: number | null;
} {
  if (!lastPositionAt) return { status: "UNKNOWN", ageSeconds: null };
  const ageSeconds = Math.floor((Date.now() - lastPositionAt.getTime()) / 1000);
  if (ageSeconds < FRESH_THRESHOLD_S)   return { status: "FRESH",   ageSeconds };
  if (ageSeconds < WARNING_THRESHOLD_S) return { status: "WARNING", ageSeconds };
  return { status: "STALE", ageSeconds };
}

// ─── Known tracking event types (A4.9) ──────────────────────────────────────
export type TrackingEventType =
  | "MISSION_OFFERED"
  | "MISSION_ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "TRACKING_STARTED"
  | "TRACKING_STOPPED"
  | "POSITION_UPDATED"
  // A8 new events
  | "NAVIGATION_STARTED"
  | "ARRIVED_PICKUP"
  | "DELIVERY_PROOF_UPLOADED"
  | "PROBLEM_REPORTED"
  | "RESCHEDULE_REQUESTED"
  | "SAFETY_INCIDENT"
  | "COURIER_RATED";

// ─── startTrackingSession (A4.1 / A4.4) ─────────────────────────────────────
export async function startTrackingSession(
  missionId: number,
  courierId: number,
  orderId:   number,
  sellerId:  number,
  customerId: number,
): Promise<void> {
  try {
    await db
      .insert(trackingSessionsTable)
      .values({ missionId, courierId, orderId, sellerId, customerId, isActive: true })
      .onConflictDoUpdate({
        target: trackingSessionsTable.missionId,
        set: { isActive: true, courierId, endedAt: null, endReason: null },
      });

    await recordTrackingEvent(missionId, "TRACKING_STARTED", { courierId });

    logger.info({ missionId, courierId }, "[tracking] Session started");
  } catch (err) {
    logger.error({ err, missionId, courierId }, "[tracking] Failed to start session");
  }
}

// ─── stopTrackingSession (A4.4) ──────────────────────────────────────────────
export async function stopTrackingSession(
  missionId: number,
  endReason: "DELIVERED" | "FAILED" | "CANCELLED",
): Promise<void> {
  try {
    await db
      .update(trackingSessionsTable)
      .set({ isActive: false, endedAt: new Date(), endReason })
      .where(and(
        eq(trackingSessionsTable.missionId, missionId),
        eq(trackingSessionsTable.isActive, true),
      ));

    await recordTrackingEvent(missionId, "TRACKING_STOPPED", { payload: { endReason } });

    logger.info({ missionId, endReason }, "[tracking] Session stopped");
  } catch (err) {
    logger.error({ err, missionId, endReason }, "[tracking] Failed to stop session");
  }
}

// ─── getActiveSession ────────────────────────────────────────────────────────
export async function getActiveSession(missionId: number) {
  const [session] = await db
    .select()
    .from(trackingSessionsTable)
    .where(and(
      eq(trackingSessionsTable.missionId, missionId),
      eq(trackingSessionsTable.isActive, true),
    ))
    .limit(1);
  return session ?? null;
}

// ─── getActiveSessionByCourier ───────────────────────────────────────────────
export async function getActiveSessionByCourier(courierId: number) {
  const [session] = await db
    .select()
    .from(trackingSessionsTable)
    .where(and(
      eq(trackingSessionsTable.courierId, courierId),
      eq(trackingSessionsTable.isActive, true),
    ))
    .limit(1);
  return session ?? null;
}

// ─── recordPosition (A4.3) ───────────────────────────────────────────────────
export async function recordPosition(
  sessionId: number,
  missionId: number,
  courierId: number,
  pos: { lat: number; lng: number; heading?: number | null; speed?: number | null; accuracy?: number | null },
): Promise<void> {
  const now = new Date();

  await db.insert(trackingPositionsTable).values({
    sessionId,
    missionId,
    courierId,
    lat:        String(pos.lat),
    lng:        String(pos.lng),
    heading:    pos.heading  != null ? String(pos.heading)  : null,
    speed:      pos.speed    != null ? String(pos.speed)    : null,
    accuracy:   pos.accuracy != null ? String(pos.accuracy) : null,
    recordedAt: now,
  });

  await db
    .update(trackingSessionsTable)
    .set({
      lastPositionAt: now,
      positionCount: sql`${trackingSessionsTable.positionCount} + 1`,
    })
    .where(eq(trackingSessionsTable.id, sessionId));
}

// ─── recordPositionForActiveMission ─────────────────────────────────────────
export async function recordPositionForActiveMission(
  courierId: number,
  lat: number,
  lng: number,
  opts?: { heading?: number | null; speed?: number | null; accuracy?: number | null },
): Promise<void> {
  try {
    const session = await getActiveSessionByCourier(courierId);
    if (!session) return;

    await recordPosition(session.id, session.missionId, courierId, { lat, lng, ...opts });

    logger.debug({ missionId: session.missionId, courierId, lat, lng }, "[tracking] Position recorded");
  } catch (err) {
    logger.warn({ err, courierId }, "[tracking] Position record failed (non-fatal)");
  }
}

// ─── getLatestPosition ───────────────────────────────────────────────────────
export async function getLatestPosition(missionId: number) {
  const [pos] = await db
    .select()
    .from(trackingPositionsTable)
    .where(eq(trackingPositionsTable.missionId, missionId))
    .orderBy(desc(trackingPositionsTable.recordedAt))
    .limit(1);
  return pos ?? null;
}

// ─── getPositionHistory ──────────────────────────────────────────────────────
export async function getPositionHistory(missionId: number, limit = 50) {
  return db
    .select({
      lat:        trackingPositionsTable.lat,
      lng:        trackingPositionsTable.lng,
      heading:    trackingPositionsTable.heading,
      speed:      trackingPositionsTable.speed,
      accuracy:   trackingPositionsTable.accuracy,
      recordedAt: trackingPositionsTable.recordedAt,
    })
    .from(trackingPositionsTable)
    .where(eq(trackingPositionsTable.missionId, missionId))
    .orderBy(desc(trackingPositionsTable.recordedAt))
    .limit(Math.min(limit, 200));
}

// ─── recordTrackingEvent (A4.9) ──────────────────────────────────────────────
export async function recordTrackingEvent(
  missionId:  number,
  eventType:  TrackingEventType,
  opts?: {
    sessionId?: number;
    courierId?: number;
    actorId?:   number;
    actorRole?: string;
    payload?:   Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.insert(trackingEventsTable).values({
      missionId,
      sessionId: opts?.sessionId ?? null,
      courierId: opts?.courierId ?? null,
      eventType,
      payload:   opts?.payload   ?? null,
      actorId:   opts?.actorId   ?? null,
      actorRole: opts?.actorRole ?? null,
      occurredAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, missionId, eventType }, "[tracking] Event record failed (non-fatal)");
  }
}

// ─── getTrackingEvents ───────────────────────────────────────────────────────
export async function getTrackingEvents(missionId: number, limit = 20) {
  return db
    .select()
    .from(trackingEventsTable)
    .where(eq(trackingEventsTable.missionId, missionId))
    .orderBy(desc(trackingEventsTable.occurredAt))
    .limit(Math.min(limit, 100));
}

// ─── TrackingData interface (A4 + A5.1) ─────────────────────────────────────
export interface TrackingData {
  missionId:     number;
  missionStatus: string;
  routeStatus:   RouteStatus;

  // A5.1 — pickup / delivery locations
  pickupLocation: {
    lat:     number | null;
    lng:     number | null;
    address: string;
  };
  deliveryLocation: {
    lat:     number | null;
    lng:     number | null;
    address: string;
  };

  // A6.7 — real road route data
  route: {
    geometry:         [number, number][] | null;
    distanceKm:       number | null;
    durationMinutes:  number | null;
    source:           "osrm" | "haversine" | null;
  };

  session: {
    id:            number;
    isActive:      boolean;
    startedAt:     string;
    endedAt:       string | null;
    endReason:     string | null;
    positionCount: number;
  } | null;

  courier: {
    id:          number;
    name:        string;
    vehicleType: string | null;
    phone:       string;
  } | null;

  currentPosition: {
    lat:        number;
    lng:        number;
    heading:    number | null;
    speed:      number | null;
    accuracy:   number | null;
    recordedAt: string;
    freshness:  FreshnessStatus;
    ageSeconds: number | null;
  } | null;

  freshness:    FreshnessStatus;
  ageSeconds:   number | null;
  eta:          Awaited<ReturnType<typeof getETA>>;

  recentEvents: {
    eventType:  string;
    occurredAt: string;
    payload:    unknown;
  }[];

  lastUpdateAt: string | null;
}

// ─── getTrackingData — unified read (A4.5 + A5.1) ────────────────────────────
export async function getTrackingData(missionId: number): Promise<TrackingData | null> {
  const [mission] = await db
    .select()
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId))
    .limit(1);

  if (!mission) return null;

  const [session] = await db
    .select()
    .from(trackingSessionsTable)
    .where(eq(trackingSessionsTable.missionId, missionId))
    .limit(1);

  const latestPos = await getLatestPosition(missionId);
  const events    = await getTrackingEvents(missionId, 10);

  let courierInfo: TrackingData["courier"] = null;
  if (mission.courierId) {
    const rows = await db
      .select({
        id:          couriersTable.id,
        vehicleType: couriersTable.vehicleType,
        name:        usersTable.name,
        phone:       usersTable.phone,
      })
      .from(couriersTable)
      .innerJoin(usersTable, eq(couriersTable.userId, usersTable.id))
      .where(eq(couriersTable.id, mission.courierId))
      .limit(1);
    if (rows[0]) {
      courierInfo = {
        id:          rows[0].id,
        name:        rows[0].name,
        vehicleType: rows[0].vehicleType,
        phone:       rows[0].phone ?? "",
      };
    }
  }

  const { status: freshness, ageSeconds } = getPositionFreshness(session?.lastPositionAt ?? null);

  const posLat = latestPos ? parseFloat(String(latestPos.lat)) : null;
  const posLng = latestPos ? parseFloat(String(latestPos.lng)) : null;

  // A5.1 — pickup / delivery coords from mission
  const pickupLat  = mission.pickupLat  ? parseFloat(String(mission.pickupLat))  : null;
  const pickupLng  = mission.pickupLng  ? parseFloat(String(mission.pickupLng))  : null;
  const dropoffLat = mission.dropoffLat ? parseFloat(String(mission.dropoffLat)) : null;
  const dropoffLng = mission.dropoffLng ? parseFloat(String(mission.dropoffLng)) : null;

  const hasGPS = posLat != null && posLng != null;
  const routeStatus = deriveRouteStatus(mission.status, hasGPS);

  // A5.2 — two-leg ETA
  const eta = await getETA({
    missionId,
    courierId:     mission.courierId ?? 0,
    missionStatus: mission.status,
    courierLat:    posLat,
    courierLng:    posLng,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  });

  const currentPosition: TrackingData["currentPosition"] = latestPos
    ? {
        lat:        parseFloat(String(latestPos.lat)),
        lng:        parseFloat(String(latestPos.lng)),
        heading:    latestPos.heading  != null ? parseFloat(String(latestPos.heading))  : null,
        speed:      latestPos.speed    != null ? parseFloat(String(latestPos.speed))    : null,
        accuracy:   latestPos.accuracy != null ? parseFloat(String(latestPos.accuracy)) : null,
        recordedAt: latestPos.recordedAt.toISOString(),
        freshness:  getPositionFreshness(latestPos.recordedAt).status,
        ageSeconds: getPositionFreshness(latestPos.recordedAt).ageSeconds,
      }
    : null;

  return {
    missionId,
    missionStatus: mission.status,
    routeStatus,
    route: {
      geometry:        eta.routeGeometry,
      distanceKm:      eta.routeDistanceKm,
      durationMinutes: eta.routeDurationMinutes,
      source:          eta.routeSource,
    },
    pickupLocation: {
      lat:     pickupLat,
      lng:     pickupLng,
      address: mission.pickupAddress,
    },
    deliveryLocation: {
      lat:     dropoffLat,
      lng:     dropoffLng,
      address: mission.dropoffAddress,
    },
    session: session
      ? {
          id:            session.id,
          isActive:      session.isActive,
          startedAt:     session.startedAt.toISOString(),
          endedAt:       session.endedAt?.toISOString() ?? null,
          endReason:     session.endReason,
          positionCount: session.positionCount,
        }
      : null,
    courier:         courierInfo,
    currentPosition,
    freshness,
    ageSeconds,
    eta,
    recentEvents: events.map((e) => ({
      eventType:  e.eventType,
      occurredAt: e.occurredAt.toISOString(),
      payload:    e.payload,
    })),
    lastUpdateAt: session?.lastPositionAt?.toISOString() ?? null,
  };
}

// ─── getCustomerTrackingData (A4.11) ─────────────────────────────────────────
export async function getCustomerTrackingData(
  missionId:  number,
  customerId: number,
): Promise<TrackingData | null> {
  const [mission] = await db
    .select({ customerId: deliveryMissionsTable.customerId })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId))
    .limit(1);
  if (!mission || mission.customerId !== customerId) return null;
  return getTrackingData(missionId);
}

// ─── getSellerTrackingData (A4.12) ───────────────────────────────────────────
export async function getSellerTrackingData(
  missionId: number,
  sellerId:  number,
): Promise<TrackingData | null> {
  const [mission] = await db
    .select({ sellerId: deliveryMissionsTable.sellerId })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId))
    .limit(1);
  if (!mission || mission.sellerId !== sellerId) return null;
  return getTrackingData(missionId);
}

// ─── getAllActiveSessions — for admin monitor (A4.10) ─────────────────────────
export async function getAllActiveSessions() {
  const sessions = await db
    .select({
      id:             trackingSessionsTable.id,
      missionId:      trackingSessionsTable.missionId,
      courierId:      trackingSessionsTable.courierId,
      orderId:        trackingSessionsTable.orderId,
      sellerId:       trackingSessionsTable.sellerId,
      customerId:     trackingSessionsTable.customerId,
      isActive:       trackingSessionsTable.isActive,
      startedAt:      trackingSessionsTable.startedAt,
      endedAt:        trackingSessionsTable.endedAt,
      lastPositionAt: trackingSessionsTable.lastPositionAt,
      endReason:      trackingSessionsTable.endReason,
      positionCount:  trackingSessionsTable.positionCount,
      missionStatus:  deliveryMissionsTable.status,
      courierName:    usersTable.name,
      courierPhone:   usersTable.phone,
    })
    .from(trackingSessionsTable)
    .innerJoin(deliveryMissionsTable, eq(trackingSessionsTable.missionId, deliveryMissionsTable.id))
    .innerJoin(couriersTable,  eq(trackingSessionsTable.courierId, couriersTable.id))
    .innerJoin(usersTable,     eq(couriersTable.userId, usersTable.id))
    .where(eq(trackingSessionsTable.isActive, true))
    .orderBy(desc(trackingSessionsTable.startedAt));

  return sessions.map((s) => ({
    ...s,
    freshness:      getPositionFreshness(s.lastPositionAt),
    startedAt:      s.startedAt.toISOString(),
    endedAt:        s.endedAt?.toISOString() ?? null,
    lastPositionAt: s.lastPositionAt?.toISOString() ?? null,
  }));
}

// ─── pruneOldPositions — retention (A4.13) ───────────────────────────────────
export async function pruneOldPositions(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .delete(trackingPositionsTable)
      .where(sql`${trackingPositionsTable.recordedAt} < ${cutoff}`)
      .returning({ id: trackingPositionsTable.id });
    const deleted = result.length;
    if (deleted > 0) logger.info({ deleted }, "[tracking] Pruned old positions");
    return deleted;
  } catch (err) {
    logger.warn({ err }, "[tracking] Prune failed (non-fatal)");
    return 0;
  }
}
