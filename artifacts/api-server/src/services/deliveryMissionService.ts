import { eq, desc, and, inArray } from "drizzle-orm";
import { db, deliveryMissionsTable, ordersTable, usersTable, sellerApplicationsTable, couriersTable } from "@workspace/db";
import type { DeliveryMission, InsertDeliveryMission } from "@workspace/db";
import { getAvailableCouriers, setCourierBusy } from "./courierAvailabilityService";
import { calculateDistanceKm } from "../utils/haversine";
import { logger } from "../lib/logger";

// ─── Status transition map ────────────────────────────────────────────────────
const MISSION_TRANSITIONS: Record<string, string[]> = {
  PENDING:             ["ASSIGNED", "CANCELLED"],
  ASSIGNED:            ["ACCEPTED", "CANCELLED"],
  ACCEPTED:            ["PICKED_UP", "CANCELLED", "RESCHEDULE_REQUIRED"],
  PICKED_UP:           ["IN_TRANSIT", "CANCELLED", "RESCHEDULE_REQUIRED"],
  IN_TRANSIT:          ["DELIVERED", "FAILED", "RESCHEDULE_REQUIRED"],
  RESCHEDULE_REQUIRED: ["PENDING", "CANCELLED"],
  DELIVERED:           [],
  FAILED:              [],
  CANCELLED:           [],
};

// ─── createDeliveryMission ────────────────────────────────────────────────────
export async function createDeliveryMission(params: {
  orderId: number;
  sellerId: number;
  customerId: number;
  deliveryFee?: string | null;
  deliverySize?: "SMALL" | "MEDIUM" | "LARGE";
}): Promise<DeliveryMission> {
  const { orderId, sellerId, customerId, deliveryFee, deliverySize = "MEDIUM" } = params;

  // Fetch order for addresses
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) throw new Error(`Order ${orderId} not found`);

  // Fetch seller store address for pickup
  const [sellerApp] = await db
    .select({ address: sellerApplicationsTable.address, storeName: sellerApplicationsTable.storeName })
    .from(sellerApplicationsTable)
    .where(eq(sellerApplicationsTable.userId, sellerId));

  const pickupAddress = sellerApp?.address ?? "Seller address on file";
  const dropoffAddress = order.shippingAddress;

  const [mission] = await db
    .insert(deliveryMissionsTable)
    .values({
      orderId,
      sellerId,
      customerId,
      deliveryFee: deliveryFee ?? order.deliveryFee ?? null,
      deliverySize,
      pickupAddress,
      dropoffAddress,
      status: "PENDING",
    })
    .returning();

  return mission;
}

// ─── getMission ───────────────────────────────────────────────────────────────
export async function getMission(missionId: number): Promise<DeliveryMission | null> {
  const [mission] = await db
    .select()
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId));
  return mission ?? null;
}

export async function getMissionByOrderId(orderId: number): Promise<DeliveryMission | null> {
  const [mission] = await db
    .select()
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.orderId, orderId));
  return mission ?? null;
}

// ─── updateMissionStatus ──────────────────────────────────────────────────────
export async function updateMissionStatus(
  missionId: number,
  newStatus: string,
): Promise<DeliveryMission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Delivery mission ${missionId} not found`);

  const allowed = MISSION_TRANSITIONS[mission.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition mission from '${mission.status}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}`,
    );
  }

  const now = new Date();
  const timestamps: Record<string, Date | null> = {};
  if (newStatus === "ACCEPTED")   timestamps.acceptedAt  = now;
  if (newStatus === "PICKED_UP")  timestamps.pickedUpAt  = now;
  if (newStatus === "DELIVERED")  timestamps.deliveredAt = now;
  if (newStatus === "CANCELLED")  timestamps.cancelledAt = now;
  if (newStatus === "FAILED")     timestamps.failedAt    = now;

  const [updated] = await db
    .update(deliveryMissionsTable)
    .set({ status: newStatus as any, updatedAt: now, ...timestamps })
    .where(eq(deliveryMissionsTable.id, missionId))
    .returning();

  // ── A4 Tracking Lifecycle (fire-and-forget, never throws) ────────────────
  void (async () => {
    try {
      const { recordTrackingEvent, startTrackingSession, stopTrackingSession } =
        await import("./trackingService");
      const eventMap: Record<string, string> = {
        ACCEPTED:   "MISSION_ACCEPTED",
        PICKED_UP:  "PICKED_UP",
        IN_TRANSIT: "IN_TRANSIT",
        DELIVERED:  "DELIVERED",
        FAILED:     "FAILED",
        CANCELLED:  "CANCELLED",
      };
      const eventType = eventMap[newStatus];
      if (eventType) {
        await recordTrackingEvent(missionId, eventType as any, {
          courierId: mission.courierId ?? undefined,
          payload:   { fromStatus: mission.status, toStatus: newStatus },
        });
      }
      if (newStatus === "ACCEPTED" && mission.courierId) {
        await startTrackingSession(
          missionId,
          mission.courierId,
          mission.orderId,
          mission.sellerId,
          mission.customerId,
        );
      }
      if (["DELIVERED", "FAILED", "CANCELLED"].includes(newStatus)) {
        await stopTrackingSession(
          missionId,
          newStatus as "DELIVERED" | "FAILED" | "CANCELLED",
        );
      }
    } catch (_err) {
      // tracking lifecycle must never break mission transitions
    }
  })();

  return updated;
}

// ─── V3.3: offerMissionToCourier ──────────────────────────────────────────────
// Internal: marks a mission as OFFERED to a specific courier.
// Does NOT auto-accept — courier must accept via their dashboard.
// Sets assignmentStartedAt + assignmentExpiresAt (5-min window) + increments round.
export async function offerMissionToCourier(
  missionId: number,
  courierId: number,
  expiryMinutes = 5,
): Promise<DeliveryMission> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (!["PENDING", "ASSIGNED"].includes(mission.status)) {
    throw new Error(`Mission is not in an offerable state (current: ${mission.status})`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  const currentRound = (mission as any).assignmentRound ?? 0;

  const [updated] = await db
    .update(deliveryMissionsTable)
    .set({
      courierId,
      status: "ASSIGNED",
      updatedAt: now,
      ...(Object.fromEntries([
        ["assignment_started_at", now],
        ["assignment_expires_at", expiresAt],
        ["assignment_round", currentRound + 1],
        ["assignment_status", "OFFERED"],
      ])),
    } as any)
    .where(eq(deliveryMissionsTable.id, missionId))
    .returning();

  return updated;
}

// ─── V3.3 Phase A1: Courier Discovery Engine ─────────────────────────────────

export interface NearestCourierResult {
  courierId: number;
  /** Distance from pickup to courier's last-known location in km.
   *  null when the courier has no location data yet. */
  distanceKm: number | null;
}

/** Location freshness threshold in milliseconds (A3.7) */
const LOCATION_FRESH_MS = 60_000;

/**
 * findNearestCouriers — Courier Discovery Engine (Phase A1 + A3.7 freshness)
 *
 * Uses a SINGLE DB query (via getAvailableCouriers) to load all eligible couriers
 * (approved + ONLINE + isAcceptingDeliveries + no active mission), then:
 *  - A3.7: Excludes couriers whose location is STALE (has location but > 60s old)
 *  - Computes Haversine distances in-memory for couriers with fresh/no location
 *  - Couriers with no location ever set are appended at end with distanceKm=null
 * Never throws — returns [] on any error or when no couriers are available.
 */
export async function findNearestCouriers(
  pickupLat: number,
  pickupLng: number,
  limit = 3,
): Promise<NearestCourierResult[]> {
  try {
    logger.info({ pickupLat, pickupLng, limit }, "[discovery] Mission discovery started");

    // Single query — filters: approved + ONLINE + isAcceptingDeliveries + no active mission
    const available = await getAvailableCouriers();
    logger.info({ count: available.length }, "[discovery] Available couriers found");

    if (available.length === 0) {
      logger.info("[discovery] No available couriers — returning empty");
      return [];
    }

    const now = Date.now();
    const withLoc: NearestCourierResult[] = [];
    const withoutLoc: NearestCourierResult[] = [];
    let staleExcluded = 0;

    for (const c of available) {
      // A3.7: If courier has a location but it is stale (>60s), exclude from discovery
      if (c.lastLocationUpdateAt != null) {
        const ageMs = now - new Date(c.lastLocationUpdateAt).getTime();
        if (ageMs > LOCATION_FRESH_MS) {
          staleExcluded++;
          logger.info(
            { courierId: c.id, ageSeconds: Math.floor(ageMs / 1000) },
            "[discovery] Courier excluded — stale GPS location",
          );
          continue;
        }
      }

      if (c.currentLat != null && c.currentLng != null) {
        const distanceKm = calculateDistanceKm(
          pickupLat,
          pickupLng,
          parseFloat(String(c.currentLat)),
          parseFloat(String(c.currentLng)),
        );
        withLoc.push({ courierId: c.id, distanceKm });
      } else {
        // No location yet — still eligible, appended at end
        withoutLoc.push({ courierId: c.id, distanceKm: null });
      }
    }

    logger.info(
      { withLocation: withLoc.length, withoutLocation: withoutLoc.length, staleExcluded },
      "[discovery] Distances calculated",
    );

    // Sort couriers with known fresh location ascending, then append those without
    withLoc.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    const combined = [...withLoc, ...withoutLoc];
    const nearest = combined.slice(0, limit);

    logger.info(
      { nearest: nearest.map((n) => ({ id: n.courierId, km: n.distanceKm?.toFixed(2) ?? "null" })) },
      "[discovery] Nearest couriers selected",
    );

    return nearest;
  } catch (err) {
    logger.error({ err }, "[discovery] findNearestCouriers error — returning empty");
    return [];
  }
}

// ─── V3.3: assignMission ──────────────────────────────────────────────────────
// Admin/system: directly assigns a mission to a specific courier (no offer window).
// Transitions status to ASSIGNED and marks courier BUSY.
// If courierId is omitted, picks the first available courier automatically.
export async function assignMission(
  missionId: number,
  courierId?: number,
): Promise<{ mission: DeliveryMission; courierId: number }> {
  const mission = await getMission(missionId);
  if (!mission) throw new Error(`Mission ${missionId} not found`);
  if (mission.status !== "PENDING") {
    throw new Error(`Mission must be PENDING to assign (current: ${mission.status})`);
  }

  let resolvedCourierId = courierId;

  if (!resolvedCourierId) {
    const available = await getAvailableCouriers();
    if (available.length === 0) throw new Error("No couriers available for assignment");
    resolvedCourierId = available[0].id;
  }

  const now = new Date();
  const [updated] = await db
    .update(deliveryMissionsTable)
    .set({
      courierId: resolvedCourierId,
      status: "ASSIGNED",
      updatedAt: now,
      ...(Object.fromEntries([
        ["assignment_started_at", now],
        ["assignment_round", 1],
        ["assignment_status", "DIRECT"],
      ])),
    } as any)
    .where(eq(deliveryMissionsTable.id, missionId))
    .returning();

  // Mark courier BUSY
  await setCourierBusy(resolvedCourierId).catch(() => {});

  return { mission: updated, courierId: resolvedCourierId };
}
