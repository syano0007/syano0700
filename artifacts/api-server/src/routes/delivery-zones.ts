import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, deliveryZonesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// ── Public: list active delivery zones ────────────────────────────────────────
router.get("/delivery-zones", async (_req, res): Promise<void> => {
  const zones = await db
    .select()
    .from(deliveryZonesTable)
    .where(eq(deliveryZonesTable.active, true));
  res.json(zones.map((z) => ({
    id: z.id,
    nameEn: z.nameEn,
    nameAr: z.nameAr,
    fee: parseFloat(String(z.fee ?? "0")),
  })));
});

// ── Admin: list all zones (including inactive) ────────────────────────────────
router.get("/admin/delivery-zones", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const zones = await db.select().from(deliveryZonesTable);
  res.json(zones.map((z) => ({
    id: z.id,
    nameEn: z.nameEn,
    nameAr: z.nameAr,
    fee: parseFloat(String(z.fee ?? "0")),
    active: z.active,
    createdAt: z.createdAt.toISOString(),
  })));
});

// ── Admin: create zone ────────────────────────────────────────────────────────
router.post("/admin/delivery-zones", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { nameEn, nameAr, fee, active } = req.body;
  if (!nameEn || !nameAr) { res.status(400).json({ error: "nameEn and nameAr are required" }); return; }
  const [zone] = await db.insert(deliveryZonesTable).values({
    nameEn, nameAr,
    fee: String(fee ?? "0"),
    active: active !== false,
  }).returning();
  res.status(201).json({ id: zone.id, nameEn: zone.nameEn, nameAr: zone.nameAr, fee: parseFloat(String(zone.fee)), active: zone.active });
});

// ── Admin: update zone ────────────────────────────────────────────────────────
router.patch("/admin/delivery-zones/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "Invalid zone ID" }); return; }
  const { nameEn, nameAr, fee, active } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (nameEn !== undefined) updates.nameEn = nameEn;
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (fee !== undefined)    updates.fee = String(fee);
  if (active !== undefined) updates.active = active;
  const [updated] = await db.update(deliveryZonesTable).set(updates as any).where(eq(deliveryZonesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Zone not found" }); return; }
  res.json({ id: updated.id, nameEn: updated.nameEn, nameAr: updated.nameAr, fee: parseFloat(String(updated.fee)), active: updated.active });
});

// ── Admin: delete zone ────────────────────────────────────────────────────────
router.delete("/admin/delivery-zones/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) { res.status(400).json({ error: "Invalid zone ID" }); return; }
  await db.delete(deliveryZonesTable).where(eq(deliveryZonesTable.id, id));
  res.json({ message: "Zone deleted" });
});

export default router;
