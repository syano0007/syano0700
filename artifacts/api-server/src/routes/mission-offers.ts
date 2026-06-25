/**
 * Mission Offer routes — V3.3
 *
 * Courier:
 *   GET  /courier/missions/offers                  — active OFFERED missions for the courier
 *   POST /courier/missions/offers/:offerId/accept  — atomic accept (race-condition safe)
 *   POST /courier/missions/offers/:offerId/decline — decline offer
 *
 * Admin:
 *   GET  /admin/delivery-missions/:missionId/offers          — offer log for a mission
 *   POST /admin/delivery-missions/:missionId/trigger-assignment — manually kick engine
 */

import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import {
  db, pool,
  couriersTable, missionOffersTable, deliveryMissionsTable, usersTable,
  dispatchAlertsTable, courierAssignmentsTable, ordersTable,
} from "@workspace/db";
import { requireAuth, requireActiveAccount } from "../middlewares/auth";
import {
  assignMissionToCourier,
  triggerAssignmentEngine,
} from "../services/missionAssignmentEngine";
import { updateMissionStatus } from "../services/deliveryMissionService";
import { createNotification, bi } from "../lib/notif";

const router: IRouter = Router();

// ─── Helper: resolve courier row from userId ───────────────────────────────────

async function getCourierByUserId(userId: number) {
  const [c] = await db.select().from(couriersTable).where(eq(couriersTable.userId, userId));
  return c ?? null;
}

// ─── GET /courier/missions/offers ──────────────────────────────────────────────
// Returns active OFFERED missions for the authenticated courier.

router.get("/courier/missions/offers", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const courier = await getCourierByUserId(userId);
  if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }
  if (courier.status !== "approved") { res.status(403).json({ error: "Courier account not approved" }); return; }

  const offers = await db
    .select({
      offerId:    missionOffersTable.id,
      missionId:  missionOffersTable.missionId,
      status:     missionOffersTable.status,
      round:      missionOffersTable.round,
      offeredAt:  missionOffersTable.offeredAt,
      expiresAt:  missionOffersTable.expiresAt,
    })
    .from(missionOffersTable)
    .where(and(
      eq(missionOffersTable.courierId, courier.id),
      eq(missionOffersTable.status, "OFFERED"),
    ))
    .orderBy(desc(missionOffersTable.offeredAt));

  if (offers.length === 0) { res.json([]); return; }

  // Enrich with mission details (batch friendly since usually ≤ 3 active offers)
  const enriched = await Promise.all(
    offers.map(async (o) => {
      const [mission] = await db
        .select({
          id:             deliveryMissionsTable.id,
          status:         deliveryMissionsTable.status,
          pickupAddress:  deliveryMissionsTable.pickupAddress,
          dropoffAddress: deliveryMissionsTable.dropoffAddress,
          deliverySize:   deliveryMissionsTable.deliverySize,
        })
        .from(deliveryMissionsTable)
        .where(eq(deliveryMissionsTable.id, o.missionId));

      return {
        offerId:        o.offerId,
        missionId:      o.missionId,
        round:          o.round,
        offeredAt:      o.offeredAt,
        expiresAt:      o.expiresAt,
        pickupAddress:  mission?.pickupAddress  ?? "",
        dropoffAddress: mission?.dropoffAddress ?? "",
        deliverySize:   mission?.deliverySize   ?? "MEDIUM",
        missionStatus:  mission?.status         ?? "UNKNOWN",
      };
    }),
  );

  // Filter out missions that are no longer in an offerable state
  const active = enriched.filter(
    (o) => !["ASSIGNED", "CANCELLED", "FAILED", "DELIVERED", "NO_COURIER_FOUND"].includes(o.missionStatus as string),
  );

  res.json(active);
});

// ─── POST /courier/missions/offers/:offerId/accept ──────────────────────────────

router.post("/courier/missions/offers/:offerId/accept", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const offerId = parseInt(String(req.params.offerId), 10);
  if (!offerId) { res.status(400).json({ error: "Invalid offer ID" }); return; }

  const courier = await getCourierByUserId(userId);
  if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }
  if (courier.status !== "approved") { res.status(403).json({ error: "Courier not approved" }); return; }

  // Fetch the offer to verify ownership and get missionId
  const [offer] = await db
    .select()
    .from(missionOffersTable)
    .where(and(
      eq(missionOffersTable.id, offerId),
      eq(missionOffersTable.courierId, courier.id),
    ));

  if (!offer) { res.status(404).json({ error: "Offer not found" }); return; }
  if (offer.status !== "OFFERED") {
    res.status(409).json({ error: "Offer is no longer active", status: offer.status }); return;
  }
  if (offer.expiresAt < new Date()) {
    res.status(410).json({ error: "Offer has expired" }); return;
  }

  const result = await assignMissionToCourier(offer.missionId, courier.id, offerId);

  if (!result.success) {
    res.status(409).json({ error: result.error ?? "Could not accept offer" }); return;
  }

  // Fetch mission for orderId + notifications
  const [mission] = await db
    .select({ orderId: deliveryMissionsTable.orderId, customerId: deliveryMissionsTable.customerId, sellerId: deliveryMissionsTable.sellerId })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, offer.missionId));

  // ── Integration fix: create courier_assignments record so pickup/deliver routes work ──
  if (mission) {
    await db
      .delete(courierAssignmentsTable)
      .where(eq(courierAssignmentsTable.orderId, mission.orderId));

    await db.insert(courierAssignmentsTable).values({
      orderId:  mission.orderId,
      courierId: courier.id,
      status:   "assigned",
      adminId:  null,
    });
  }

  // ── Update order status to courier_assigned so pickup route works ──
  if (mission) {
    await db.update(ordersTable)
      .set({ status: "courier_assigned" as any, updatedAt: new Date() })
      .where(eq(ordersTable.id, mission.orderId));
  }

  // ── Transition ASSIGNED → ACCEPTED (starts A4 tracking session fire-and-forget) ──
  updateMissionStatus(offer.missionId, "ACCEPTED").catch(() => {});

  // Notify customer fire-and-forget
  if (mission) {
    createNotification({
      userId:   mission.customerId,
      type:     "order_courier_assigned",
      title:    bi("Courier Assigned!", "تم تعيين مندوب التوصيل!"),
      body:     bi(
        `A courier has accepted your delivery and will pick it up shortly.`,
        `قبل المندوب طلب التوصيل وسيستلمه قريباً.`,
      ),
      orderId:  mission.orderId,
      priority: "important",
      link:     "/orders",
    }).catch(() => {});
  }

  res.json({ message: "Mission accepted", missionId: offer.missionId });
});

// ─── POST /courier/missions/offers/:offerId/decline ─────────────────────────────

router.post("/courier/missions/offers/:offerId/decline", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const offerId = parseInt(String(req.params.offerId), 10);
  if (!offerId) { res.status(400).json({ error: "Invalid offer ID" }); return; }

  const courier = await getCourierByUserId(userId);
  if (!courier) { res.status(404).json({ error: "Courier profile not found" }); return; }

  const [offer] = await db
    .select()
    .from(missionOffersTable)
    .where(and(
      eq(missionOffersTable.id, offerId),
      eq(missionOffersTable.courierId, courier.id),
    ));

  if (!offer) { res.status(404).json({ error: "Offer not found" }); return; }
  if (offer.status !== "OFFERED") {
    res.status(409).json({ error: "Offer is not in OFFERED state", status: offer.status }); return;
  }

  await db
    .update(missionOffersTable)
    .set({ status: "DECLINED", respondedAt: new Date() })
    .where(eq(missionOffersTable.id, offerId));

  res.json({ message: "Offer declined" });
});

// ─── GET /admin/delivery-missions/:missionId/offers ─────────────────────────────
// Admin read-only: full offer log for a mission.

router.get("/admin/delivery-missions/:missionId/offers", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Access denied" }); return; }
  const missionId = parseInt(String(req.params.missionId), 10);
  if (!missionId) { res.status(400).json({ error: "Invalid mission ID" }); return; }

  const offers = await db
    .select({
      id:          missionOffersTable.id,
      courierId:   missionOffersTable.courierId,
      status:      missionOffersTable.status,
      round:       missionOffersTable.round,
      offeredAt:   missionOffersTable.offeredAt,
      expiresAt:   missionOffersTable.expiresAt,
      respondedAt: missionOffersTable.respondedAt,
      courierName: usersTable.name,
      courierPhone: couriersTable.phone,
    })
    .from(missionOffersTable)
    .innerJoin(couriersTable, eq(missionOffersTable.courierId, couriersTable.id))
    .innerJoin(usersTable, eq(couriersTable.userId, usersTable.id))
    .where(eq(missionOffersTable.missionId, missionId))
    .orderBy(desc(missionOffersTable.offeredAt));

  // Compute summary stats
  const summary = {
    totalSent:   offers.length,
    accepted:    offers.filter((o) => o.status === "ACCEPTED").length,
    declined:    offers.filter((o) => o.status === "DECLINED").length,
    expired:     offers.filter((o) => o.status === "EXPIRED").length,
    cancelled:   offers.filter((o) => o.status === "CANCELLED").length,
    currentRound: offers.length > 0 ? Math.max(...offers.map((o) => o.round)) : 0,
  };

  res.json({ summary, offers });
});

// ─── POST /admin/delivery-missions/:missionId/trigger-assignment ────────────────
// Admin: manually kick the assignment engine for a PENDING/SEARCHING mission.

router.post("/admin/delivery-missions/:missionId/trigger-assignment", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Access denied" }); return; }
  const missionId = parseInt(String(req.params.missionId), 10);
  if (!missionId) { res.status(400).json({ error: "Invalid mission ID" }); return; }

  const [mission] = await db
    .select({ status: deliveryMissionsTable.status })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId));

  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  if (!["PENDING", "NO_COURIER_FOUND"].includes(mission.status as string)) {
    res.status(400).json({ error: `Mission is in state '${mission.status}' — can only trigger from PENDING or NO_COURIER_FOUND` }); return;
  }

  // Reset to PENDING then kick engine
  await db
    .update(deliveryMissionsTable)
    .set({ status: "PENDING" as any, updatedAt: new Date() })
    .where(eq(deliveryMissionsTable.id, missionId));

  triggerAssignmentEngine(missionId);

  res.json({ message: "Assignment engine triggered", missionId });
});

// ─── GET /admin/dispatch-alerts ──────────────────────────────────────────────
// Returns unresolved dispatch alerts, newest first.

router.get("/admin/dispatch-alerts", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Access denied" }); return; }

  const alerts = await db
    .select({
      id:            dispatchAlertsTable.id,
      missionId:     dispatchAlertsTable.missionId,
      type:          dispatchAlertsTable.type,
      message:       dispatchAlertsTable.message,
      resolvedAt:    dispatchAlertsTable.resolvedAt,
      resolvedById:  dispatchAlertsTable.resolvedById,
      createdAt:     dispatchAlertsTable.createdAt,
    })
    .from(dispatchAlertsTable)
    .where(isNull(dispatchAlertsTable.resolvedAt))
    .orderBy(desc(dispatchAlertsTable.createdAt));

  res.json(alerts);
});

// ─── PATCH /admin/dispatch-alerts/:id/resolve ────────────────────────────────
// Admin resolves (dismisses) a dispatch alert.

router.patch("/admin/dispatch-alerts/:id/resolve", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") { res.status(403).json({ error: "Access denied" }); return; }
  const alertId = parseInt(String(req.params.id), 10);
  if (!alertId) { res.status(400).json({ error: "Invalid alert ID" }); return; }

  const [updated] = await db
    .update(dispatchAlertsTable)
    .set({ resolvedAt: new Date(), resolvedById: req.user!.userId, updatedAt: new Date() })
    .where(eq(dispatchAlertsTable.id, alertId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Alert not found" }); return; }

  res.json({ message: "Alert resolved", alert: updated });
});

export default router;
