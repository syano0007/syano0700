import { eq, and, inArray } from "drizzle-orm";
import { db, couriersTable, deliveryMissionsTable } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvailabilityStatus = "OFFLINE" | "ONLINE" | "BUSY";

// ─── Internal: resolve courier row by userId ─────────────────────────────────

async function getCourierByUserId(userId: number) {
  const [courier] = await db
    .select()
    .from(couriersTable)
    .where(eq(couriersTable.userId, userId));
  return courier ?? null;
}

async function getCourierById(courierId: number) {
  const [courier] = await db
    .select()
    .from(couriersTable)
    .where(eq(couriersTable.id, courierId));
  return courier ?? null;
}

// ─── Core setters ─────────────────────────────────────────────────────────────

export async function setCourierOnline(courierId: number): Promise<void> {
  await db.update(couriersTable).set({
    availabilityStatus: "ONLINE",
    isAcceptingDeliveries: true,
    lastAvailabilityChangeAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(couriersTable.id, courierId));
}

export async function setCourierOffline(courierId: number): Promise<void> {
  await db.update(couriersTable).set({
    availabilityStatus: "OFFLINE",
    isAcceptingDeliveries: false,
    lastAvailabilityChangeAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(couriersTable.id, courierId));
}

export async function setCourierBusy(courierId: number): Promise<void> {
  await db.update(couriersTable).set({
    availabilityStatus: "BUSY",
    isAcceptingDeliveries: false,
    lastAvailabilityChangeAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(couriersTable.id, courierId));
}

// ─── Transition: BUSY → ONLINE (called when active mission completes) ─────────

export async function setCourierOnlineAfterMission(courierId: number): Promise<void> {
  const courier = await getCourierById(courierId);
  if (!courier) return;
  // Only restore to ONLINE if the courier was BUSY (not manually OFFLINE)
  if (courier.availabilityStatus === "BUSY") {
    await setCourierOnline(courierId);
  }
}

// ─── Query: can this courier receive a new mission? ───────────────────────────

export async function canReceiveMission(courierId: number): Promise<boolean> {
  const courier = await getCourierById(courierId);
  if (!courier) return false;
  if (courier.status !== "approved") return false;
  if (courier.availabilityStatus !== "ONLINE") return false;
  if (!courier.isAcceptingDeliveries) return false;

  // Hard business rule: max 1 active mission at a time
  const [activeMission] = await db
    .select({ id: deliveryMissionsTable.id })
    .from(deliveryMissionsTable)
    .where(and(
      eq(deliveryMissionsTable.courierId, courierId),
      inArray(deliveryMissionsTable.status, ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"]),
    ));

  return !activeMission;
}

// ─── Query: all couriers eligible for assignment ──────────────────────────────

export async function getAvailableCouriers() {
  const couriers = await db
    .select()
    .from(couriersTable)
    .where(and(
      eq(couriersTable.status, "approved"),
      eq(couriersTable.availabilityStatus as any, "ONLINE"),
      eq(couriersTable.isAcceptingDeliveries, true),
    ));

  // Filter out any that already have an active mission (hard business rule)
  const courierIds = couriers.map((c) => c.id);
  if (courierIds.length === 0) return [];

  const activeMissions = await db
    .select({ courierId: deliveryMissionsTable.courierId })
    .from(deliveryMissionsTable)
    .where(and(
      inArray(deliveryMissionsTable.courierId, courierIds as number[]),
      inArray(deliveryMissionsTable.status, ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"]),
    ));

  const busyCourierIds = new Set(activeMissions.map((m) => m.courierId));
  return couriers.filter((c) => !busyCourierIds.has(c.id));
}

// ─── Set availability by userId (API convenience wrapper) ─────────────────────

export async function setAvailabilityByUserId(
  userId: number,
  newStatus: AvailabilityStatus,
): Promise<{ courierId: number; availabilityStatus: string; isAcceptingDeliveries: boolean } | null> {
  const courier = await getCourierByUserId(userId);
  if (!courier) return null;
  if (courier.status !== "approved") throw new Error("Courier account not approved");

  // Validation: prevent invalid state combinations
  if (newStatus === "BUSY") {
    throw new Error("BUSY status is set automatically by the system, not manually");
  }

  if (newStatus === "ONLINE") {
    await setCourierOnline(courier.id);
  } else {
    await setCourierOffline(courier.id);
  }

  const updated = await getCourierById(courier.id);
  if (!updated) return null;
  return {
    courierId: updated.id,
    availabilityStatus: updated.availabilityStatus ?? "OFFLINE",
    isAcceptingDeliveries: updated.isAcceptingDeliveries ?? false,
  };
}

// ─── Get availability status by userId ───────────────────────────────────────

export async function getAvailabilityByUserId(userId: number) {
  const courier = await getCourierByUserId(userId);
  if (!courier) return null;
  return {
    courierId: courier.id,
    availabilityStatus: courier.availabilityStatus ?? "OFFLINE",
    isAcceptingDeliveries: courier.isAcceptingDeliveries ?? false,
    lastAvailabilityChangeAt: courier.lastAvailabilityChangeAt ?? null,
  };
}
