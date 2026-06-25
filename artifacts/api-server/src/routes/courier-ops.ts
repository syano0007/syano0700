/**
 * courier-ops.ts — Courier Operations Center (Phase A8)
 *
 * Endpoints:
 *   GET  /courier/navigation-preference         — get nav preference
 *   PATCH /courier/navigation-preference        — update nav preference
 *   POST /courier/missions/:id/proof            — submit delivery proof
 *   POST /courier/missions/:id/failure          — structured failure report
 *   POST /courier/missions/:id/reschedule       — reschedule request
 *   POST /courier/missions/:id/safety-event     — log a safety incident
 *   GET  /courier/performance                   — detailed performance stats
 *   GET  /courier/ratings                       — own rating history
 *   POST /missions/:id/rate                     — customer rates courier
 *   GET  /admin/dispatch-center                 — active + pending missions
 *   GET  /admin/missions/:id/operations         — full ops timeline
 *   PATCH /admin/delivery-missions/:id/reschedule — admin resolves reschedule
 */

import { Router } from "express";
import { eq, and, desc, count, avg, sql } from "drizzle-orm";
import {
  db,
  deliveryMissionsTable,
  couriersTable,
  usersTable,
  courierRatingsTable,
  missionSafetyEventsTable,
  missionOffersTable,
  dispatchAlertsTable,
  trackingEventsTable,
  courierWalletTransactionsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { recordTrackingEvent } from "../services/trackingService";
import { logger } from "../lib/logger";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCourierForUser(userId: number) {
  const [courier] = await db
    .select()
    .from(couriersTable)
    .where(eq(couriersTable.userId, userId));
  return courier ?? null;
}

// ── Navigation Preference ─────────────────────────────────────────────────────

router.get("/courier/navigation-preference", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }
    res.json({ navigationPreference: courier.navigationPreference ?? "google" });
  } catch (err) {
    logger.error({ err }, "[courier-ops] GET /courier/navigation-preference failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/courier/navigation-preference", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const { navigationPreference } = req.body as { navigationPreference: string };
    const allowed = ["google", "apple", "waze", "osm"];
    if (!navigationPreference || !allowed.includes(navigationPreference)) {
      res.status(400).json({ error: "Invalid navigationPreference. Allowed: " + allowed.join(", ") }); return;
    }
    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }

    await db
      .update(couriersTable)
      .set({ navigationPreference, updatedAt: new Date() })
      .where(eq(couriersTable.id, courier.id));

    res.json({ navigationPreference });
  } catch (err) {
    logger.error({ err }, "[courier-ops] PATCH /courier/navigation-preference failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delivery Proof Submission ──────────────────────────────────────────────────

router.post("/courier/missions/:id/proof", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { proofImageUrl } = req.body as { proofImageUrl?: string };

    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(403).json({ error: "Not a courier" }); return; }

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(and(
        eq(deliveryMissionsTable.id, missionId),
        eq(deliveryMissionsTable.courierId, courier.id),
      ));

    if (!mission) { res.status(404).json({ error: "Mission not found or not yours" }); return; }
    if (!["IN_TRANSIT", "PICKED_UP"].includes(mission.status)) {
      res.status(409).json({ error: `Cannot upload proof in status ${mission.status}` }); return;
    }

    const [updated] = await db
      .update(deliveryMissionsTable)
      .set({
        proofImageUrl: proofImageUrl ?? null,
        confirmedByCourier: true,
        updatedAt: new Date(),
      })
      .where(eq(deliveryMissionsTable.id, missionId))
      .returning({ id: deliveryMissionsTable.id, confirmedByCourier: deliveryMissionsTable.confirmedByCourier });

    void recordTrackingEvent(missionId, "DELIVERY_PROOF_UPLOADED", {
      courierId: courier.id,
      payload: { hasImage: !!proofImageUrl },
    });

    res.json({ ok: true, confirmedByCourier: updated.confirmedByCourier });
  } catch (err) {
    logger.error({ err }, "[courier-ops] POST /courier/missions/:id/proof failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Structured Failure Reporting ──────────────────────────────────────────────

const VALID_FAILURE_TYPES = [
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ADDRESS",
  "PACKAGE_DAMAGED",
  "CUSTOMER_REFUSED",
  "ACCESS_DENIED",
  "VEHICLE_BREAKDOWN",
  "ROAD_BLOCKED",
  "OTHER",
] as const;

router.post("/courier/missions/:id/failure", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { failureType, failureReason } = req.body as { failureType: string; failureReason?: string };

    if (!VALID_FAILURE_TYPES.includes(failureType as (typeof VALID_FAILURE_TYPES)[number])) {
      res.status(400).json({ error: "Invalid failureType", allowed: VALID_FAILURE_TYPES }); return;
    }

    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(403).json({ error: "Not a courier" }); return; }

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(and(
        eq(deliveryMissionsTable.id, missionId),
        eq(deliveryMissionsTable.courierId, courier.id),
      ));

    if (!mission) { res.status(404).json({ error: "Mission not found or not yours" }); return; }
    if (!["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(mission.status)) {
      res.status(409).json({ error: `Cannot report failure in status ${mission.status}` }); return;
    }

    const now = new Date();
    await db
      .update(deliveryMissionsTable)
      .set({
        failureType,
        failureReason: failureReason ?? null,
        status: "FAILED" as const,
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(deliveryMissionsTable.id, missionId));

    void recordTrackingEvent(missionId, "PROBLEM_REPORTED", {
      courierId: courier.id,
      payload: { failureType, failureReason },
    });

    res.json({ ok: true, failureType, status: "FAILED" });
  } catch (err) {
    logger.error({ err }, "[courier-ops] POST /courier/missions/:id/failure failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reschedule Request ─────────────────────────────────────────────────────────

router.post("/courier/missions/:id/reschedule", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { rescheduleReason } = req.body as { rescheduleReason: string };

    if (!rescheduleReason?.trim()) {
      res.status(400).json({ error: "rescheduleReason is required" }); return;
    }

    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(403).json({ error: "Not a courier" }); return; }

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(and(
        eq(deliveryMissionsTable.id, missionId),
        eq(deliveryMissionsTable.courierId, courier.id),
      ));

    if (!mission) { res.status(404).json({ error: "Mission not found or not yours" }); return; }
    if (!["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(mission.status)) {
      res.status(409).json({ error: `Cannot reschedule in status ${mission.status}` }); return;
    }

    const now = new Date();
    await db
      .update(deliveryMissionsTable)
      .set({
        status: "RESCHEDULE_REQUIRED" as const,
        rescheduleRequestedAt: now,
        rescheduleReason: rescheduleReason.trim(),
        rescheduleRequestedBy: req.user!.userId,
        updatedAt: now,
      })
      .where(eq(deliveryMissionsTable.id, missionId));

    void recordTrackingEvent(missionId, "RESCHEDULE_REQUESTED", {
      courierId: courier.id,
      payload: { reason: rescheduleReason },
    });

    res.json({ ok: true, status: "RESCHEDULE_REQUIRED" });
  } catch (err) {
    logger.error({ err }, "[courier-ops] POST /courier/missions/:id/reschedule failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Safety Event Reporting ─────────────────────────────────────────────────────

const VALID_INCIDENT_TYPES = [
  "ROAD_HAZARD",
  "VEHICLE_ACCIDENT",
  "THREAT_OR_ASSAULT",
  "THEFT",
  "MEDICAL_EMERGENCY",
  "OTHER",
] as const;

router.post("/courier/missions/:id/safety-event", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { incidentType, note } = req.body as { incidentType: string; note?: string };

    if (!VALID_INCIDENT_TYPES.includes(incidentType as (typeof VALID_INCIDENT_TYPES)[number])) {
      res.status(400).json({ error: "Invalid incidentType", allowed: VALID_INCIDENT_TYPES }); return;
    }

    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(403).json({ error: "Not a courier" }); return; }

    const [event] = await db
      .insert(missionSafetyEventsTable)
      .values({
        missionId,
        courierId: courier.id,
        incidentType,
        note: note ?? null,
        notifiedAdmin: true,
      })
      .returning();

    void recordTrackingEvent(missionId, "SAFETY_INCIDENT", {
      courierId: courier.id,
      payload: { incidentType, note, eventId: event.id },
    });

    // Create a dispatch alert so admin is notified in the dispatch center
    db.insert(dispatchAlertsTable).values({
      missionId,
      type: "SAFETY_INCIDENT",
      message: `Safety incident reported by courier ${courier.id}: ${incidentType}${note ? " — " + note : ""}`,
    }).catch((err) => logger.error({ err }, "[courier-ops] Failed to insert dispatch alert for safety event"));

    logger.warn({ missionId, courierId: courier.id, incidentType }, "[courier-ops] Safety event reported");

    res.json({ ok: true, eventId: event.id });
  } catch (err) {
    logger.error({ err }, "[courier-ops] POST /courier/missions/:id/safety-event failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Courier Performance Center ─────────────────────────────────────────────────

router.get("/courier/performance", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }

    const cid = courier.id;

    // All queries in parallel
    const [statusCounts, ratingRow, walletRow, safetyRow, failureBreakdown, offerStats] = await Promise.all([
      db.select({ status: deliveryMissionsTable.status, cnt: count() })
        .from(deliveryMissionsTable)
        .where(eq(deliveryMissionsTable.courierId, cid))
        .groupBy(deliveryMissionsTable.status),
      db.select({ avg: avg(courierRatingsTable.rating), cnt: count() })
        .from(courierRatingsTable)
        .where(eq(courierRatingsTable.courierId, cid))
        .then((rows) => rows[0]),
      db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(courierWalletTransactionsTable)
        .where(eq(courierWalletTransactionsTable.courierId, cid))
        .then((rows) => rows[0]),
      db.select({ cnt: count() })
        .from(missionSafetyEventsTable)
        .where(eq(missionSafetyEventsTable.courierId, cid))
        .then((rows) => rows[0]),
      db.select({ failureType: deliveryMissionsTable.failureType, cnt: count() })
        .from(deliveryMissionsTable)
        .where(and(eq(deliveryMissionsTable.courierId, cid), eq(deliveryMissionsTable.status, "FAILED")))
        .groupBy(deliveryMissionsTable.failureType),
      db.select({
        total:    count(),
        accepted: sql<string>`COUNT(*) FILTER (WHERE status = 'ACCEPTED')`,
        declined: sql<string>`COUNT(*) FILTER (WHERE status = 'DECLINED')`,
        expired:  sql<string>`COUNT(*) FILTER (WHERE status = 'EXPIRED')`,
      })
        .from(missionOffersTable)
        .where(eq(missionOffersTable.courierId, cid))
        .then((rows) => rows[0]),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) statusMap[row.status] = Number(row.cnt);

    const totalDeliveries  = statusMap["DELIVERED"]           ?? 0;
    const totalFailed      = statusMap["FAILED"]              ?? 0;
    const totalCancelled   = statusMap["CANCELLED"]           ?? 0;
    const totalRescheduled = statusMap["RESCHEDULE_REQUIRED"] ?? 0;
    const totalAssigned    = Object.values(statusMap).reduce((s, v) => s + v, 0);
    const successRate      = totalAssigned > 0 ? (totalDeliveries / totalAssigned) * 100 : 0;
    const cancellationRate = totalAssigned > 0 ? (totalCancelled / totalAssigned) * 100 : 0;

    const totalOffers   = Number(offerStats?.total ?? 0);
    const offersAccepted = Number(offerStats?.accepted ?? 0);
    const offersDeclined = Number(offerStats?.declined ?? 0);
    const offersExpired  = Number(offerStats?.expired  ?? 0);
    const acceptanceRate = totalOffers > 0 ? (offersAccepted / totalOffers) * 100 : 0;

    const avgRating   = ratingRow?.avg ? parseFloat(String(ratingRow.avg)) : null;
    const ratingCount = Number(ratingRow?.cnt ?? 0);
    const lifetimeEarnings = parseFloat(String(walletRow?.total ?? "0"));
    const totalSafetyEvents = Number(safetyRow?.cnt ?? 0);

    // Milestone tiers based on completed deliveries
    const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000];
    const nextMilestone = MILESTONES.find((m) => m > totalDeliveries) ?? null;

    res.json({
      courierId: cid,
      totalAssigned,
      totalDeliveries,
      totalFailed,
      totalCancelled,
      totalRescheduled,
      successRate: parseFloat(successRate.toFixed(2)),
      cancellationRate: parseFloat(cancellationRate.toFixed(2)),
      acceptanceRate: parseFloat(acceptanceRate.toFixed(2)),
      avgRating,
      ratingCount,
      lifetimeEarnings,
      totalSafetyEvents,
      offerStats: { total: totalOffers, accepted: offersAccepted, declined: offersDeclined, expired: offersExpired },
      milestone: { completed: totalDeliveries, next: nextMilestone },
      failureBreakdown: failureBreakdown.map((r) => ({
        type: r.failureType ?? "UNKNOWN",
        count: Number(r.cnt),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[courier-ops] GET /courier/performance failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Courier Ratings History ────────────────────────────────────────────────────

router.get("/courier/ratings", requireAuth, requireRole("courier"), async (req, res): Promise<void> => {
  try {
    const courier = await getCourierForUser(req.user!.userId);
    if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }

    const ratings = await db
      .select({
        id:        courierRatingsTable.id,
        missionId: courierRatingsTable.missionId,
        rating:    courierRatingsTable.rating,
        comment:   courierRatingsTable.comment,
        createdAt: courierRatingsTable.createdAt,
      })
      .from(courierRatingsTable)
      .where(eq(courierRatingsTable.courierId, courier.id))
      .orderBy(desc(courierRatingsTable.createdAt))
      .limit(50);

    const [summary] = await db
      .select({ avg: avg(courierRatingsTable.rating), cnt: count() })
      .from(courierRatingsTable)
      .where(eq(courierRatingsTable.courierId, courier.id));

    res.json({
      avgRating: summary?.avg ? parseFloat(parseFloat(String(summary.avg)).toFixed(2)) : null,
      totalRatings: Number(summary?.cnt ?? 0),
      ratings: ratings.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    logger.error({ err }, "[courier-ops] GET /courier/ratings failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Rate Courier (customer, post-delivery) ────────────────────────────────────

router.post("/missions/:id/rate", requireAuth, requireRole("customer"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { rating, comment } = req.body as { rating: number; comment?: string };

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be an integer 1–5" }); return;
    }

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(eq(deliveryMissionsTable.id, missionId));

    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
    if (mission.customerId !== req.user!.userId) { res.status(403).json({ error: "Not your mission" }); return; }
    if (mission.status !== "DELIVERED") { res.status(409).json({ error: "Can only rate after delivery" }); return; }
    if (!mission.courierId) { res.status(409).json({ error: "No courier on this mission" }); return; }

    const [row] = await db
      .insert(courierRatingsTable)
      .values({
        missionId,
        courierId: mission.courierId,
        customerId: req.user!.userId,
        rating,
        comment: comment ?? null,
      })
      .onConflictDoUpdate({
        target: [courierRatingsTable.missionId, courierRatingsTable.customerId],
        set: { rating, comment: comment ?? null },
      })
      .returning();

    void recordTrackingEvent(missionId, "COURIER_RATED", {
      payload: { rating, courierId: mission.courierId },
    });

    res.json({ ok: true, id: row.id });
  } catch (err) {
    logger.error({ err }, "[courier-ops] POST /missions/:id/rate failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin Dispatch Center ─────────────────────────────────────────────────────

router.get("/admin/dispatch-center", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const activeMissions = await db
      .select({
        id:                    deliveryMissionsTable.id,
        status:                deliveryMissionsTable.status,
        orderId:               deliveryMissionsTable.orderId,
        courierId:             deliveryMissionsTable.courierId,
        pickupAddress:         deliveryMissionsTable.pickupAddress,
        dropoffAddress:        deliveryMissionsTable.dropoffAddress,
        deliverySize:          deliveryMissionsTable.deliverySize,
        createdAt:             deliveryMissionsTable.createdAt,
        updatedAt:             deliveryMissionsTable.updatedAt,
        failureType:           deliveryMissionsTable.failureType,
        failureReason:         deliveryMissionsTable.failureReason,
        rescheduleRequestedAt: deliveryMissionsTable.rescheduleRequestedAt,
        rescheduleReason:      deliveryMissionsTable.rescheduleReason,
        courierName:           usersTable.name,
        courierPhone:          usersTable.phone,
        courierLat:            couriersTable.currentLat,
        courierLng:            couriersTable.currentLng,
        courierLastLocationAt: couriersTable.lastLocationUpdateAt,
        courierAvailability:   couriersTable.availabilityStatus,
      })
      .from(deliveryMissionsTable)
      .leftJoin(couriersTable, eq(deliveryMissionsTable.courierId, couriersTable.id))
      .leftJoin(usersTable, eq(couriersTable.userId, usersTable.id))
      .where(sql`${deliveryMissionsTable.status} NOT IN ('DELIVERED', 'CANCELLED')`)
      .orderBy(desc(deliveryMissionsTable.updatedAt))
      .limit(100);

    const counts = await db
      .select({ status: deliveryMissionsTable.status, cnt: count() })
      .from(deliveryMissionsTable)
      .where(sql`${deliveryMissionsTable.status} NOT IN ('DELIVERED', 'CANCELLED')`)
      .groupBy(deliveryMissionsTable.status);

    const summary: Record<string, number> = {};
    for (const row of counts) summary[row.status] = Number(row.cnt);

    const now = Date.now();
    res.json({
      summary,
      missions: activeMissions.map((m) => {
        const lastLocAt = m.courierLastLocationAt ? new Date(m.courierLastLocationAt).getTime() : null;
        const ageSeconds = lastLocAt ? Math.floor((now - lastLocAt) / 1000) : null;
        const gpsFreshness = ageSeconds === null ? "UNKNOWN"
          : ageSeconds < 15  ? "FRESH"
          : ageSeconds < 60  ? "WARNING"
          : "STALE";
        return {
          ...m,
          createdAt:             m.createdAt.toISOString(),
          updatedAt:             m.updatedAt.toISOString(),
          rescheduleRequestedAt: m.rescheduleRequestedAt?.toISOString() ?? null,
          courierLastLocationAt: m.courierLastLocationAt?.toISOString() ?? null,
          gpsFreshness,
          gpsAgeSeconds: ageSeconds,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "[courier-ops] GET /admin/dispatch-center failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: Full Ops Timeline ──────────────────────────────────────────────────

router.get("/admin/missions/:id/operations", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(eq(deliveryMissionsTable.id, missionId));

    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

    const events = await db
      .select()
      .from(trackingEventsTable)
      .where(eq(trackingEventsTable.missionId, missionId))
      .orderBy(desc(trackingEventsTable.occurredAt))
      .limit(100);

    const safetyEvents = await db
      .select()
      .from(missionSafetyEventsTable)
      .where(eq(missionSafetyEventsTable.missionId, missionId))
      .orderBy(desc(missionSafetyEventsTable.createdAt));

    const ratings = await db
      .select()
      .from(courierRatingsTable)
      .where(eq(courierRatingsTable.missionId, missionId));

    const m = mission as typeof mission & {
      acceptedAt?: Date | null;
      pickedUpAt?: Date | null;
      deliveredAt?: Date | null;
      cancelledAt?: Date | null;
      failedAt?: Date | null;
      rescheduleRequestedAt?: Date | null;
    };

    res.json({
      mission: {
        ...m,
        createdAt:             m.createdAt.toISOString(),
        updatedAt:             m.updatedAt.toISOString(),
        acceptedAt:            m.acceptedAt?.toISOString() ?? null,
        pickedUpAt:            m.pickedUpAt?.toISOString() ?? null,
        deliveredAt:           m.deliveredAt?.toISOString() ?? null,
        cancelledAt:           m.cancelledAt?.toISOString() ?? null,
        failedAt:              m.failedAt?.toISOString() ?? null,
        rescheduleRequestedAt: m.rescheduleRequestedAt?.toISOString() ?? null,
      },
      events: events.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() })),
      safetyEvents: safetyEvents.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
      ratings: ratings.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    });
  } catch (err) {
    logger.error({ err }, "[courier-ops] GET /admin/missions/:id/operations failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: Resolve Reschedule ──────────────────────────────────────────────────

router.patch("/admin/delivery-missions/:id/reschedule", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const missionId = Number(req.params.id);
    const { action, courierId } = req.body as { action: "reassign" | "cancel"; courierId?: number };

    const [mission] = await db
      .select()
      .from(deliveryMissionsTable)
      .where(eq(deliveryMissionsTable.id, missionId));

    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
    if ((mission.status as string) !== "RESCHEDULE_REQUIRED") {
      res.status(409).json({ error: `Mission is not in RESCHEDULE_REQUIRED state (current: ${mission.status})` }); return;
    }

    if (action === "cancel") {
      const now = new Date();
      await db
        .update(deliveryMissionsTable)
        .set({ status: "CANCELLED" as const, cancelledAt: now, updatedAt: now })
        .where(eq(deliveryMissionsTable.id, missionId));
      res.json({ ok: true, action: "cancel", missionId }); return;
    }

    if (action === "reassign") {
      await db
        .update(deliveryMissionsTable)
        .set({
          status: "PENDING" as const,
          courierId: courierId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(deliveryMissionsTable.id, missionId));
      res.json({ ok: true, action: "reassign", missionId }); return;
    }

    res.status(400).json({ error: "action must be 'reassign' or 'cancel'" });
  } catch (err) {
    logger.error({ err }, "[courier-ops] PATCH /admin/delivery-missions/:id/reschedule failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
