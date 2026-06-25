import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  productVariantGroupsTable,
  productVariantOptionsTable,
  productVariantsTable,
  productVariantValuesTable,
  variantImagesTable,
  productsTable,
} from "@workspace/db";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";
import { productDetailCache } from "../services/cacheService";

const router: IRouter = Router();

function invalidateProductDetailCache(productId: number) {
  productDetailCache.delete(`product:detail:${productId}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function buildVariantData(productId: number) {
  const [groups, rawVariants] = await Promise.all([
    db.select().from(productVariantGroupsTable)
      .where(eq(productVariantGroupsTable.productId, productId))
      .orderBy(productVariantGroupsTable.position),
    db.select().from(productVariantsTable)
      .where(eq(productVariantsTable.productId, productId))
      .orderBy(productVariantsTable.id),
  ]);

  if (groups.length === 0 && rawVariants.length === 0) {
    return { groups: [], variants: [] };
  }

  const groupIds   = groups.map((g) => g.id);
  const variantIds = rawVariants.map((v) => v.id);

  // Batch-fetch options, values, and images — 3 queries regardless of N.
  const [allOptions, allValues, allImages] = await Promise.all([
    groupIds.length > 0
      ? db.select({
            id:       productVariantOptionsTable.id,
            groupId:  productVariantOptionsTable.groupId,
            value:    productVariantOptionsTable.value,
            position: productVariantOptionsTable.position,
          })
          .from(productVariantOptionsTable)
          .where(inArray(productVariantOptionsTable.groupId, groupIds))
          .orderBy(productVariantOptionsTable.position)
      : Promise.resolve([] as { id: number; groupId: number; value: string; position: number }[]),

    variantIds.length > 0
      ? db.select({
            variantId: productVariantValuesTable.variantId,
            groupId:   productVariantGroupsTable.id,
            groupName: productVariantGroupsTable.name,
            optionId:  productVariantOptionsTable.id,
            value:     productVariantOptionsTable.value,
          })
          .from(productVariantValuesTable)
          .innerJoin(productVariantOptionsTable, eq(productVariantOptionsTable.id, productVariantValuesTable.optionId))
          .innerJoin(productVariantGroupsTable, eq(productVariantGroupsTable.id, productVariantOptionsTable.groupId))
          .where(inArray(productVariantValuesTable.variantId, variantIds))
      : Promise.resolve([] as { variantId: number; groupId: number; groupName: string; optionId: number; value: string }[]),

    variantIds.length > 0
      ? db.select({
            variantId:    variantImagesTable.variantId,
            id:           variantImagesTable.id,
            url:          variantImagesTable.url,
            position:     variantImagesTable.position,
            optionValueId: variantImagesTable.optionValueId,
          })
          .from(variantImagesTable)
          .where(inArray(variantImagesTable.variantId, variantIds))
          .orderBy(variantImagesTable.position)
      : Promise.resolve([] as { variantId: number; id: number; url: string; position: number; optionValueId: number | null }[]),
  ]);

  // Build lookup maps.
  const optionsByGroup  = new Map<number, { id: number; value: string; position: number }[]>();
  for (const opt of allOptions) {
    if (!optionsByGroup.has(opt.groupId)) optionsByGroup.set(opt.groupId, []);
    optionsByGroup.get(opt.groupId)!.push({ id: opt.id, value: opt.value, position: opt.position });
  }

  const valuesByVariant = new Map<number, { groupId: number; groupName: string; optionId: number; value: string }[]>();
  for (const val of allValues) {
    if (!valuesByVariant.has(val.variantId)) valuesByVariant.set(val.variantId, []);
    valuesByVariant.get(val.variantId)!.push({
      groupId: val.groupId, groupName: val.groupName, optionId: val.optionId, value: val.value,
    });
  }

  const imagesByVariant = new Map<number, { id: number; url: string; position: number; optionValueId: number | null }[]>();
  for (const img of allImages) {
    if (!imagesByVariant.has(img.variantId)) imagesByVariant.set(img.variantId, []);
    imagesByVariant.get(img.variantId)!.push({
      id: img.id, url: img.url, position: img.position, optionValueId: img.optionValueId,
    });
  }

  const groupsWithOptions = groups.map((g) => ({
    id:       g.id,
    name:     g.name,
    position: g.position,
    options:  optionsByGroup.get(g.id) ?? [],
  }));

  const variants = rawVariants.map((v) => {
    const vals = valuesByVariant.get(v.id) ?? [];
    const imgs = imagesByVariant.get(v.id) ?? [];
    return {
      id:              v.id,
      productId:       v.productId,
      sku:             v.sku ?? null,
      // Absolute price model — null means inherit from product base price
      price:           v.price != null ? parseFloat(v.price) : null,
      compareAtPrice:  v.compareAtPrice != null ? parseFloat(v.compareAtPrice) : null,
      // Legacy field — kept for backward compat with old variants
      priceAdjustment: parseFloat(v.priceAdjustment),
      barcode:         v.barcode ?? null,
      weightGrams:     v.weightGrams ?? null,
      dimensions:      v.dimensions ?? null,
      stock:           v.stock,
      imageUrl:        v.imageUrl ?? null,
      images:          imgs.map((i) => ({ id: i.id, url: i.url, position: i.position, optionValueId: i.optionValueId })),
      active:          v.active,
      options:         vals,
      label:           vals.map((x) => x.value).join(" / "),
    };
  });

  return { groups: groupsWithOptions, variants };
}

async function requireProductOwner(productId: number, sellerId: number): Promise<boolean> {
  const [product] = await db.select({ sellerId: productsTable.sellerId })
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  return !!product && product.sellerId === sellerId;
}

// ── GET /products/:id/variants ────────────────────────────────────────────────

router.get("/products/:id/variants", async (req, res): Promise<void> => {
  const productId = parseInt(String(req.params.id), 10);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }
  res.json(await buildVariantData(productId));
});

// ── POST /products/:id/variants/bulk ─────────────────────────────────────────

const BulkVariantBody = z.object({
  groups: z.array(z.object({
    name:    z.string().min(1),
    options: z.array(z.string().min(1)).min(1),
  })).min(0),
  variants: z.array(z.object({
    options: z.array(z.object({
      groupIndex:  z.number().int().min(0),
      optionIndex: z.number().int().min(0),
    })),
    sku:             z.string().optional(),
    price:           z.number().positive().nullish(),
    compareAtPrice:  z.number().positive().nullish(),
    priceAdjustment: z.number().default(0),
    barcode:         z.string().optional(),
    weightGrams:     z.number().int().min(0).nullish(),
    dimensions:      z.string().optional(),
    stock:           z.number().int().min(0).default(0),
    images:          z.array(z.string().url()).max(10).default([]),
    imageUrl:        z.string().optional(),
    active:          z.boolean().default(true),
  })),
});

router.post(
  "/products/:id/variants/bulk",
  requireAuth,
  requireRole("seller"),
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const productId = parseInt(String(req.params.id), 10);
    if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

    if (!(await requireProductOwner(productId, req.user!.userId))) {
      res.status(404).json({ error: "Product not found or access denied" });
      return;
    }

    const parsed = BulkVariantBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { groups, variants } = parsed.data;

    // Delete all existing variant groups (cascades to options, variants, values, images)
    await db.delete(productVariantGroupsTable)
      .where(eq(productVariantGroupsTable.productId, productId));

    if (groups.length === 0) {
      res.json(await buildVariantData(productId));
      return;
    }

    // Create groups + options
    const createdGroups: { id: number; options: { id: number }[] }[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const [group] = await db.insert(productVariantGroupsTable)
        .values({ productId, name: g.name, position: gi })
        .returning();
      const createdOptions: { id: number }[] = [];
      for (let oi = 0; oi < g.options.length; oi++) {
        const [opt] = await db.insert(productVariantOptionsTable)
          .values({ groupId: group.id, value: g.options[oi], position: oi })
          .returning();
        createdOptions.push(opt);
      }
      createdGroups.push({ id: group.id, options: createdOptions });
    }

    // Create variants + option links + images
    let totalStock = 0;
    for (const v of variants) {
      const [variant] = await db.insert(productVariantsTable)
        .values({
          productId,
          sku:             v.sku?.trim() || null,
          price:           v.price != null ? String(v.price) : null,
          compareAtPrice:  v.compareAtPrice != null ? String(v.compareAtPrice) : null,
          priceAdjustment: String(v.priceAdjustment ?? 0),
          barcode:         v.barcode?.trim() || null,
          weightGrams:     v.weightGrams ?? null,
          dimensions:      v.dimensions?.trim() || null,
          stock:           v.stock ?? 0,
          imageUrl:        v.imageUrl?.trim() || null,
          active:          v.active !== false,
        })
        .returning();

      totalStock += v.stock ?? 0;

      for (const optRef of v.options) {
        const group  = createdGroups[optRef.groupIndex];
        const option = group?.options[optRef.optionIndex];
        if (option) {
          await db.insert(productVariantValuesTable)
            .values({ variantId: variant.id, optionId: option.id });
        }
      }

      // Insert variant images
      if (v.images && v.images.length > 0) {
        // Determine the option_value_id for the first group option (Color grouping for gallery)
        const firstOptRef = v.options[0];
        const firstOption = firstOptRef
          ? createdGroups[firstOptRef.groupIndex]?.options[firstOptRef.optionIndex]
          : null;

        await db.insert(variantImagesTable).values(
          v.images.map((url, pos) => ({
            variantId:    variant.id,
            url,
            position:     pos,
            optionValueId: pos === 0 && firstOption ? firstOption.id : null,
          }))
        );
      }
    }

    // Keep product.stock in sync
    await db.update(productsTable)
      .set({ stock: totalStock })
      .where(eq(productsTable.id, productId));

    invalidateProductDetailCache(productId);
    res.status(201).json(await buildVariantData(productId));
  }
);

// ── PATCH /products/:id/variants/:variantId ───────────────────────────────────

const PatchVariantBody = z.object({
  sku:             z.string().optional(),
  price:           z.number().positive().nullish(),
  compareAtPrice:  z.number().positive().nullish(),
  priceAdjustment: z.number().optional(),
  barcode:         z.string().optional(),
  weightGrams:     z.number().int().min(0).nullish(),
  dimensions:      z.string().optional(),
  stock:           z.number().int().min(0).optional(),
  imageUrl:        z.string().nullish(),
  images:          z.array(z.string().url()).max(10).optional(),
  active:          z.boolean().optional(),
});

router.patch(
  "/products/:id/variants/:variantId",
  requireAuth,
  requireRole("seller"),
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const productId  = parseInt(String(req.params.id), 10);
    const variantId  = parseInt(String(req.params.variantId), 10);
    if (isNaN(productId) || isNaN(variantId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    if (!(await requireProductOwner(productId, req.user!.userId))) {
      res.status(404).json({ error: "Product not found or access denied" });
      return;
    }

    const [variant] = await db.select().from(productVariantsTable)
      .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId)));
    if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }

    const parsed = PatchVariantBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const update: Record<string, unknown> = {};
    if (parsed.data.sku            !== undefined) update.sku             = parsed.data.sku?.trim() || null;
    if ("price" in parsed.data)                   update.price           = parsed.data.price != null ? String(parsed.data.price) : null;
    if ("compareAtPrice" in parsed.data)          update.compareAtPrice  = parsed.data.compareAtPrice != null ? String(parsed.data.compareAtPrice) : null;
    if (parsed.data.priceAdjustment !== undefined) update.priceAdjustment = String(parsed.data.priceAdjustment);
    if (parsed.data.barcode        !== undefined) update.barcode         = parsed.data.barcode?.trim() || null;
    if ("weightGrams" in parsed.data)             update.weightGrams     = parsed.data.weightGrams ?? null;
    if (parsed.data.dimensions     !== undefined) update.dimensions      = parsed.data.dimensions?.trim() || null;
    if (parsed.data.stock          !== undefined) update.stock           = parsed.data.stock;
    if ("imageUrl" in parsed.data)                update.imageUrl        = parsed.data.imageUrl ?? null;
    if (parsed.data.active         !== undefined) update.active          = parsed.data.active;

    if (Object.keys(update).length > 0) {
      await db.update(productVariantsTable).set(update as any)
        .where(eq(productVariantsTable.id, variantId));
    }

    // Replace images if provided
    if (parsed.data.images !== undefined) {
      await db.delete(variantImagesTable).where(eq(variantImagesTable.variantId, variantId));
      if (parsed.data.images.length > 0) {
        await db.insert(variantImagesTable).values(
          parsed.data.images.map((url, pos) => ({
            variantId,
            url,
            position: pos,
            optionValueId: null,
          }))
        );
      }
    }

    // Sync product.stock
    if (parsed.data.stock !== undefined) {
      const allVariants = await db.select({ stock: productVariantsTable.stock })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, productId));
      const totalStock = allVariants.reduce((s, v) => s + v.stock, 0);
      await db.update(productsTable).set({ stock: totalStock }).where(eq(productsTable.id, productId));
    }

    invalidateProductDetailCache(productId);
    res.json(await buildVariantData(productId));
  }
);

// ── DELETE /products/:id/variants/:variantId ─────────────────────────────────

router.delete(
  "/products/:id/variants/:variantId",
  requireAuth,
  requireRole("seller"),
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const productId = parseInt(String(req.params.id), 10);
    const variantId = parseInt(String(req.params.variantId), 10);
    if (isNaN(productId) || isNaN(variantId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    if (!(await requireProductOwner(productId, req.user!.userId))) {
      res.status(404).json({ error: "Product not found or access denied" });
      return;
    }

    const [variant] = await db.select({ id: productVariantsTable.id })
      .from(productVariantsTable)
      .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId)));
    if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }

    await db.delete(productVariantsTable).where(eq(productVariantsTable.id, variantId));

    const remaining = await db.select({ stock: productVariantsTable.stock })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, productId));
    const totalStock = remaining.reduce((s, v) => s + v.stock, 0);
    await db.update(productsTable).set({ stock: totalStock }).where(eq(productsTable.id, productId));

    invalidateProductDetailCache(productId);
    res.json({ message: "Variant deleted", remaining: remaining.length });
  }
);

// ── DELETE /products/:id/variants ─────────────────────────────────────────────

router.delete(
  "/products/:id/variants",
  requireAuth,
  requireRole("seller"),
  requireActiveAccount,
  async (req, res): Promise<void> => {
    const productId = parseInt(String(req.params.id), 10);
    if (isNaN(productId)) { res.status(400).json({ error: "Invalid product ID" }); return; }

    if (!(await requireProductOwner(productId, req.user!.userId))) {
      res.status(404).json({ error: "Product not found or access denied" });
      return;
    }

    await db.delete(productVariantGroupsTable)
      .where(eq(productVariantGroupsTable.productId, productId));

    invalidateProductDetailCache(productId);
    res.json({ message: "All variants deleted" });
  }
);

export default router;
