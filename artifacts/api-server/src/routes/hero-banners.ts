/**
 * Hero Banner System — public + admin routes
 *
 * Public:
 *   GET  /banners              — active+scheduled main-slot banners (Banner A carousel)
 *   GET  /banners/side         — active side banners { sideB, sideC }
 *   POST /banners/:id/impression — track a slide view
 *   POST /banners/:id/click      — track a CTA click
 *
 * Admin (requireAuth + requireRole("admin")):
 *   GET    /admin/banners            — list all banners
 *   GET    /admin/banners/analytics  — analytics summary
 *   POST   /admin/banners            — create
 *   PATCH  /admin/banners/:id        — update
 *   DELETE /admin/banners/:id        — delete
 */
import { Router, type IRouter } from "express";
import { eq, and, or, lte, gte, isNull, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { db, heroBannersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Public ────────────────────────────────────────────────────────────────────

/** Main-slot banners for Banner A carousel (active + within scheduling window) */
router.get("/banners", async (_req, res) => {
  try {
    const now = new Date();
    const banners = await db
      .select()
      .from(heroBannersTable)
      .where(
        and(
          eq(heroBannersTable.active, true),
          eq(heroBannersTable.slot, "main"),
          or(isNull(heroBannersTable.startDate), lte(heroBannersTable.startDate, now)),
          or(isNull(heroBannersTable.endDate), gte(heroBannersTable.endDate, now))
        )
      )
      .orderBy(asc(heroBannersTable.sortOrder));

    res.json(banners);
  } catch {
    res.status(500).json({ error: "Failed to load banners" });
  }
});

/** Side banners for Banner B (top-right) and Banner C (bottom-right) */
router.get("/banners/side", async (_req, res) => {
  try {
    const now = new Date();
    const banners = await db
      .select()
      .from(heroBannersTable)
      .where(
        and(
          eq(heroBannersTable.active, true),
          or(eq(heroBannersTable.slot, "side_b"), eq(heroBannersTable.slot, "side_c")),
          or(isNull(heroBannersTable.startDate), lte(heroBannersTable.startDate, now)),
          or(isNull(heroBannersTable.endDate), gte(heroBannersTable.endDate, now))
        )
      )
      .orderBy(asc(heroBannersTable.sortOrder));

    const sideB = banners.find((b) => b.slot === "side_b") ?? null;
    const sideC = banners.find((b) => b.slot === "side_c") ?? null;
    res.json({ sideB, sideC });
  } catch {
    res.status(500).json({ error: "Failed to load side banners" });
  }
});

/** Increment impression counter — fire-and-forget, always 200 */
router.post("/banners/:id/impression", async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (!isNaN(id)) {
    await db
      .update(heroBannersTable)
      .set({ impressions: sql`${heroBannersTable.impressions} + 1` })
      .where(eq(heroBannersTable.id, id))
      .catch(() => {});
  }
  res.json({ ok: true });
});

/** Increment click counter — fire-and-forget, always 200 */
router.post("/banners/:id/click", async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (!isNaN(id)) {
    await db
      .update(heroBannersTable)
      .set({ clicks: sql`${heroBannersTable.clicks} + 1` })
      .where(eq(heroBannersTable.id, id))
      .catch(() => {});
  }
  res.json({ ok: true });
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

router.use("/admin/banners", requireAuth, requireRole("admin"));

/** List ALL banners regardless of status/schedule */
router.get("/admin/banners", async (_req, res) => {
  try {
    const banners = await db
      .select()
      .from(heroBannersTable)
      .orderBy(asc(heroBannersTable.sortOrder));
    res.json(banners);
  } catch {
    res.status(500).json({ error: "Failed to load banners" });
  }
});

/** Analytics summary */
router.get("/admin/banners/analytics", async (_req, res) => {
  try {
    const banners = await db
      .select()
      .from(heroBannersTable)
      .orderBy(asc(heroBannersTable.sortOrder));

    const totalImpressions = banners.reduce((s, b) => s + (b.impressions ?? 0), 0);
    const totalClicks = banners.reduce((s, b) => s + (b.clicks ?? 0), 0);
    const overallCtr =
      totalImpressions > 0 ? +((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    const withCtr = banners.map((b) => ({
      ...b,
      ctr: b.impressions > 0 ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0,
    }));

    const sorted = [...withCtr].sort((a, b) => b.ctr - a.ctr);

    res.json({
      totalImpressions,
      totalClicks,
      overallCtr,
      topBanner: sorted[0] ?? null,
      worstBanner: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      banners: withCtr,
    });
  } catch {
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ─── Validation schema ─────────────────────────────────────────────────────────

const bannerBodySchema = z.object({
  titleAr: z.string().min(1),
  titleEn: z.string().min(1),
  subtitleAr: z.string().nullable().optional(),
  subtitleEn: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  desktopImage: z.string().min(1),
  mobileImage: z.string().nullable().optional(),
  ctaLabelAr: z.string().nullable().optional(),
  ctaLabelEn: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  ctaLabelArSecondary: z.string().nullable().optional(),
  ctaLabelEnSecondary: z.string().nullable().optional(),
  ctaUrlSecondary: z.string().nullable().optional(),
  backgroundColor: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
  active: z.boolean().optional(),
  slot: z.enum(["main", "side_b", "side_c"]).optional(),
  sortOrder: z.number().int().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

/** Create banner */
router.post("/admin/banners", async (req, res) => {
  const parsed = bannerBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try {
    const d = parsed.data;
    const [banner] = await db
      .insert(heroBannersTable)
      .values({
        ...d,
        startDate: d.startDate ? new Date(d.startDate) : null,
        endDate: d.endDate ? new Date(d.endDate) : null,
      })
      .returning();
    res.status(201).json(banner);
  } catch {
    res.status(500).json({ error: "Failed to create banner" });
  }
});

/** Update banner (partial) */
router.patch("/admin/banners/:id", async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = bannerBodySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try {
    const d = parsed.data;
    const updateData: Record<string, unknown> = { ...d, updatedAt: new Date() };
    if ("startDate" in d) updateData["startDate"] = d.startDate ? new Date(d.startDate) : null;
    if ("endDate" in d) updateData["endDate"] = d.endDate ? new Date(d.endDate) : null;

    const [updated] = await db
      .update(heroBannersTable)
      .set(updateData)
      .where(eq(heroBannersTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Banner not found" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update banner" });
  }
});

/** Delete banner */
router.delete("/admin/banners/:id", async (req, res) => {
  const id = parseInt(String(req.params["id"]));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.delete(heroBannersTable).where(eq(heroBannersTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete banner" });
  }
});

export default router;
