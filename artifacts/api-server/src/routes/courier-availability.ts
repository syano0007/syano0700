import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, couriersTable, usersTable, deliveryMissionsTable } from "@workspace/db";
import { requireAuth, requireActiveAccount, requireRole } from "../middlewares/auth";
import {
  setAvailabilityByUserId,
  getAvailabilityByUserId,
  canReceiveMission,
} from "../services/courierAvailabilityService";

const router: IRouter = Router();

// ─── PATCH /courier/availability ─────────────────────────────────────────────
// Courier sets their own availability status: ONLINE or OFFLINE

router.patch("/courier/availability", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const { userId, role } = req.user!;
  if (role !== "courier") { res.status(403).json({ error: "Only couriers can update availability" }); return; }

  const { status } = req.body;
  if (!status || !["ONLINE", "OFFLINE"].includes(status)) {
    res.status(400).json({ error: "status must be ONLINE or OFFLINE" }); return;
  }

  try {
    const result = await setAvailabilityByUserId(userId, status);
    if (!result) { res.status(404).json({ error: "Courier profile not found" }); return; }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Failed to update availability" });
  }
});

// ─── GET /courier/availability ────────────────────────────────────────────────
// Courier gets their own availability status

router.get("/courier/availability", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = req.user!;
  if (role !== "courier") { res.status(403).json({ error: "Only couriers can access this" }); return; }

  const result = await getAvailabilityByUserId(userId);
  if (!result) { res.status(404).json({ error: "Courier profile not found" }); return; }

  const eligible = await canReceiveMission(result.courierId);
  res.json({ ...result, canReceiveMission: eligible });
});

// ─── GET /admin/couriers/availability ────────────────────────────────────────
// Admin: operational visibility of all courier availability states

router.get("/admin/couriers/availability", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: couriersTable.id,
      userId: couriersTable.userId,
      name: usersTable.name,
      phone: couriersTable.phone,
      vehicleType: couriersTable.vehicleType,
      status: couriersTable.status,
      availabilityStatus: couriersTable.availabilityStatus,
      isAcceptingDeliveries: couriersTable.isAcceptingDeliveries,
      lastAvailabilityChangeAt: couriersTable.lastAvailabilityChangeAt,
      completedDeliveries: couriersTable.completedDeliveries,
    })
    .from(couriersTable)
    .innerJoin(usersTable, eq(usersTable.id, couriersTable.userId))
    .where(eq(couriersTable.status, "approved"))
    .orderBy(desc(couriersTable.lastAvailabilityChangeAt));

  // For each ONLINE/BUSY courier, check active mission
  const courierIds = rows.map((r) => r.id);
  const activeMissions = courierIds.length > 0
    ? await db
        .select({
          courierId: deliveryMissionsTable.courierId,
          missionId: deliveryMissionsTable.id,
          orderId: deliveryMissionsTable.orderId,
          missionStatus: deliveryMissionsTable.status,
        })
        .from(deliveryMissionsTable)
        .where(
          eq(deliveryMissionsTable.status, "IN_TRANSIT"),
        )
    : [];

  const activeMissionMap = new Map(
    activeMissions.map((m) => [m.courierId, { missionId: m.missionId, orderId: m.orderId, status: m.missionStatus }]),
  );

  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    vehicleType: r.vehicleType,
    availabilityStatus: r.availabilityStatus ?? "OFFLINE",
    isAcceptingDeliveries: r.isAcceptingDeliveries ?? false,
    lastAvailabilityChangeAt: r.lastAvailabilityChangeAt?.toISOString() ?? null,
    completedDeliveries: r.completedDeliveries,
    activeMission: activeMissionMap.get(r.id) ?? null,
  })));
});

export default router;
