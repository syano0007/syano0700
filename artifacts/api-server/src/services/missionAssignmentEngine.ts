/**
 * SYANO — Mission Assignment Engine (V3.3)
 *
 * Strategy: up to 3 rounds × 3 couriers per round × 60-second offer window.
 * Nearest courier = sorted by Haversine distance from pickup_lat/pickup_lng.
 * Falls back to completedDeliveries DESC when location data is unavailable.
 */

import { eq, and, notInArray, desc } from "drizzle-orm";
import {
  pool, db,
  couriersTable, deliveryMissionsTable, missionOffersTable, usersTable,
  dispatchAlertsTable,
} from "@workspace/db";
import { createNotification, bi } from "../lib/notif";
import { logger } from "../lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const OFFER_SECONDS      = 60;
const MAX_ROUNDS         = 3;
const COURIERS_PER_ROUND = 3;

// ─── findNearestCouriers ──────────────────────────────────────────────────────
// Returns up to `limit` available couriers ordered by geographical distance
// from the mission pickup location (Haversine formula).
// Falls back to completedDeliveries DESC when lat/lng is unavailable.

export async function findNearestCouriers(
  missionId: number,
  excludeCourierIds: number[] = [],
  limit = COURIERS_PER_ROUND,
): Promise<Array<{ id: number; userId: number; completedDeliveries: number }>> {
  // Fetch mission pickup coordinates
  const [mission] = await db
    .select({ pickupLat: deliveryMissionsTable.pickupLat, pickupLng: deliveryMissionsTable.pickupLng })
    .from(deliveryMissionsTable)
    .where(eq(deliveryMissionsTable.id, missionId));

  const pickupLat = mission?.pickupLat ? parseFloat(String(mission.pickupLat)) : null;
  const pickupLng = mission?.pickupLng ? parseFloat(String(mission.pickupLng)) : null;

  let sql: string;
  let params: unknown[];

  if (pickupLat !== null && pickupLng !== null) {
    // Haversine path: $1=pickupLat, $2=pickupLng, $3+= excludeIds
    const excludeClause = excludeCourierIds.length > 0
      ? `AND c.id NOT IN (${excludeCourierIds.map((_, i) => `$${i + 3}`).join(", ")})`
      : "";
    params = [pickupLat, pickupLng, ...excludeCourierIds];
    sql = `
      SELECT c.id, c.user_id, c.completed_deliveries,
        CASE
          WHEN c.current_lat IS NOT NULL
          THEN 6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS((c.current_lat::float - $1::float) / 2)), 2) +
            COS(RADIANS($1::float)) * COS(RADIANS(c.current_lat::float)) *
            POWER(SIN(RADIANS((c.current_lng::float - $2::float) / 2)), 2)
          ))
          ELSE NULL
        END AS distance_km
      FROM couriers c
      WHERE c.status = 'approved'
        AND c.availability_status = 'ONLINE'
        AND c.is_accepting_deliveries = true
        ${excludeClause}
      ORDER BY
        CASE WHEN c.current_lat IS NULL THEN 1 ELSE 0 END ASC,
        distance_km ASC NULLS LAST,
        c.completed_deliveries DESC
      LIMIT ${limit}
    `;
  } else {
    // No pickup location — fallback: sort by completedDeliveries DESC only.
    // Do NOT pass null params; PostgreSQL cannot infer the type of untyped NULLs.
    const excludeClause = excludeCourierIds.length > 0
      ? `AND c.id NOT IN (${excludeCourierIds.map((_, i) => `$${i + 1}`).join(", ")})`
      : "";
    params = [...excludeCourierIds];
    sql = `
      SELECT c.id, c.user_id, c.completed_deliveries,
        NULL::float AS distance_km
      FROM couriers c
      WHERE c.status = 'approved'
        AND c.availability_status = 'ONLINE'
        AND c.is_accepting_deliveries = true
        ${excludeClause}
      ORDER BY c.completed_deliveries DESC
      LIMIT ${limit}
    `;
  }

  const result = await pool.query<{ id: number; user_id: number; completed_deliveries: number }>(sql, params);
  return result.rows.map((r) => ({
    id:                  r.id,
    userId:              r.user_id,
    completedDeliveries: r.completed_deliveries,
  }));
}

// ─── createMissionOffers ──────────────────────────────────────────────────────

export async function createMissionOffers(
  missionId: number,
  courierIds: number[],
  round: number,
): Promise<void> {
  if (courierIds.length === 0) return;
  const expiresAt = new Date(Date.now() + OFFER_SECONDS * 1000);

  await db.insert(missionOffersTable).values(
    courierIds.map((courierId) => ({
      missionId,
      courierId,
      status:    "OFFERED" as const,
      round,
      offeredAt: new Date(),
      expiresAt,
    })),
  );
}

// ─── expireStaleMissionOffers ─────────────────────────────────────────────────

export async function expireStaleMissionOffers(missionId: number): Promise<void> {
  await db
    .update(missionOffersTable)
    .set({ status: "EXPIRED" as any, respondedAt: new Date() })
    .where(and(
      eq(missionOffersTable.missionId, missionId),
      eq(missionOffersTable.status, "OFFERED"),
    ));
}

// ─── assignMissionToCourier ───────────────────────────────────────────────────
// Atomic: accept offer, assign mission, mark courier BUSY, cancel other offers.
// Uses SELECT FOR UPDATE NOWAIT to prevent race conditions.

export async function assignMissionToCourier(
  missionId: number,
  courierId: number,
  offerId: number,
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock offer row — fail fast if someone else has it (NOWAIT)
    const offerRes = await client.query<{ id: number; status: string }>(
      `SELECT id, status FROM mission_offers WHERE id = $1 AND courier_id = $2 FOR UPDATE NOWAIT`,
      [offerId, courierId],
    );

    if (offerRes.rows.length === 0 || offerRes.rows[0].status !== "OFFERED") {
      await client.query("ROLLBACK");
      return { success: false, error: "Offer is no longer available" };
    }

    // Lock mission row
    const missionRes = await client.query<{ id: number; status: string }>(
      `SELECT id, status FROM delivery_missions WHERE id = $1 FOR UPDATE NOWAIT`,
      [missionId],
    );

    if (missionRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Mission not found" };
    }

    if (!["PENDING", "SEARCHING"].includes(missionRes.rows[0].status)) {
      await client.query("ROLLBACK");
      return { success: false, error: "Mission is already assigned" };
    }

    const now = new Date();

    await client.query(
      `UPDATE mission_offers SET status='ACCEPTED', responded_at=$1 WHERE id=$2`,
      [now, offerId],
    );
    await client.query(
      `UPDATE delivery_missions SET status='ASSIGNED', courier_id=$1, updated_at=$2 WHERE id=$3`,
      [courierId, now, missionId],
    );
    // Section 5: Auto BUSY — courier becomes BUSY + stops accepting new deliveries
    await client.query(
      `UPDATE couriers SET availability_status='BUSY', is_accepting_deliveries=false,
         last_availability_change_at=$1, updated_at=$1 WHERE id=$2`,
      [now, courierId],
    );
    // Section 8: Offer cleanup — cancel all remaining OFFERED offers for this mission
    await client.query(
      `UPDATE mission_offers SET status='CANCELLED', responded_at=$1
         WHERE mission_id=$2 AND id != $3 AND status='OFFERED'`,
      [now, missionId, offerId],
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (err.code === "55P03") {
      return { success: false, error: "Concurrent request — try again" };
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── startAssignmentRound ─────────────────────────────────────────────────────

export async function startAssignmentRound(
  missionId: number,
  round: number,
  excludedCourierIds: number[],
): Promise<{ courierIds: number[] }> {
  // Mark mission SEARCHING
  await db
    .update(deliveryMissionsTable)
    .set({ status: "SEARCHING" as any, updatedAt: new Date() })
    .where(eq(deliveryMissionsTable.id, missionId));

  const couriers = await findNearestCouriers(missionId, excludedCourierIds, COURIERS_PER_ROUND);
  if (couriers.length === 0) return { courierIds: [] };

  const courierIds = couriers.map((c) => c.id);
  await createMissionOffers(missionId, courierIds, round);

  logger.info({ missionId, round, courierIds }, "[AssignmentEngine] Round started — offers sent");

  for (const c of couriers) {
    createNotification({
      userId:   c.userId,
      type:     "order_processing" as any,
      title:    bi("🚚 New Delivery Mission!", "🚚 مهمة توصيل جديدة!"),
      body:     bi(
        `Mission #${missionId} is available. You have ${OFFER_SECONDS} seconds to accept.`,
        `المهمة رقم #${missionId} متاحة. لديك ${OFFER_SECONDS} ثانية للقبول.`,
      ),
      priority: "important",
      link:     "/courier/dashboard",
    }).catch(() => {});
  }

  return { courierIds };
}

// ─── runAssignmentEngine ──────────────────────────────────────────────────────
// Orchestrates up to MAX_ROUNDS rounds with OFFER_SECONDS wait between each.
// After all rounds fail → mission = NO_COURIER_FOUND + dispatch alert.

export async function runAssignmentEngine(missionId: number): Promise<void> {
  const excludedCourierIds: number[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Guard: mission may have been manually assigned or cancelled
    const [mission] = await db
      .select({ status: deliveryMissionsTable.status })
      .from(deliveryMissionsTable)
      .where(eq(deliveryMissionsTable.id, missionId));

    if (!mission || !["PENDING", "SEARCHING"].includes(mission.status as string)) {
      logger.info({ missionId, status: mission?.status }, "[AssignmentEngine] Mission handled externally — stopping");
      return;
    }

    logger.info({ missionId, round, maxRounds: MAX_ROUNDS }, `[AssignmentEngine] Starting round ${round}/${MAX_ROUNDS}`);

    const { courierIds } = await startAssignmentRound(missionId, round, excludedCourierIds);
    excludedCourierIds.push(...courierIds);

    // Wait for offers to expire (60 seconds)
    await new Promise<void>((resolve) => setTimeout(resolve, OFFER_SECONDS * 1000));

    // Check if accepted during wait
    const [missionPost] = await db
      .select({ status: deliveryMissionsTable.status })
      .from(deliveryMissionsTable)
      .where(eq(deliveryMissionsTable.id, missionId));

    if (!missionPost || missionPost.status === "ASSIGNED") {
      logger.info({ missionId, round }, "[AssignmentEngine] Accepted during round — engine done");
      return;
    }

    // Expire stale offers before next round
    await expireStaleMissionOffers(missionId);

    logger.info({ missionId, round }, `[AssignmentEngine] Round ${round} exhausted — no acceptance`);
  }

  // All rounds exhausted — no courier found
  logger.warn({ missionId }, "[AssignmentEngine] ALL ROUNDS EXHAUSTED — NO_COURIER_FOUND");

  await db
    .update(deliveryMissionsTable)
    .set({ status: "NO_COURIER_FOUND" as any, updatedAt: new Date() })
    .where(eq(deliveryMissionsTable.id, missionId));

  // Section 4: Insert dispatch alert record
  const alertMessage = `Mission #${missionId} failed after ${MAX_ROUNDS} rounds (${MAX_ROUNDS * COURIERS_PER_ROUND} couriers tried). Manual assignment required.`;
  await db.insert(dispatchAlertsTable).values({
    missionId,
    type:    "NO_COURIER_FOUND",
    message: alertMessage,
  }).catch((err) => {
    logger.error({ err, missionId }, "[AssignmentEngine] Failed to insert dispatch alert");
  });

  // Also notify admins via notification system
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  await Promise.allSettled(
    admins.map((admin) =>
      createNotification({
        userId:   admin.id,
        type:     "dispatch_alert" as any,
        title:    bi("⚠️ No Courier Found", "⚠️ لم يتم إيجاد مندوب"),
        body:     bi(
          `Mission #${missionId} failed after ${MAX_ROUNDS} rounds. Manual assignment required.`,
          `فشلت المهمة رقم #${missionId} بعد ${MAX_ROUNDS} جولات. التعيين اليدوي مطلوب.`,
        ),
        priority: "critical",
        link:     `/admin/delivery-missions`,
      }),
    ),
  );
}

// ─── triggerAssignmentEngine ──────────────────────────────────────────────────

export function triggerAssignmentEngine(missionId: number): void {
  runAssignmentEngine(missionId).catch((err) => {
    logger.error({ err, missionId }, "[AssignmentEngine] Unhandled engine error");
  });
}
