import { Router, type IRouter } from "express";
import { eq, ilike, and, or, sql, gte, lte, gt, isNotNull, avg, count, inArray } from "drizzle-orm";
import { db, productsTable, usersTable, reviewsTable, orderItemsTable, ordersTable, sellerApplicationsTable, productVariantsTable } from "@workspace/db";
import { buildVariantData } from "./variants";
import { MAIN_CATEGORY_SLUGS } from "../categories";
import {
  ListProductsQueryParams,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  UpdateDiscountParams,
  UpdateDiscountBody,
  UpdateStockParams,
  UpdateStockBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";
import { isBestDeal } from "../lib/bestDeals";
import { searchCache } from "../services/searchCache";
import { productsCache, productDetailCache, categoriesCache } from "../services/cacheService";
import { generateSingleEmbedding } from "../scripts/generateEmbeddings";

const router: IRouter = Router();

function buildSearchTokens(p: {
  name: string; nameAr?: string | null;
  category: string; subcategory?: string | null; description: string;
}): string {
  return [
    p.name,
    p.nameAr ?? "",
    p.category,
    p.subcategory ?? "",
    p.description.substring(0, 150),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function computeFinalPrice(price: string, discountPercent: string | null): number {
  const p = parseFloat(price);
  if (!discountPercent) return p;
  const d = parseFloat(discountPercent);
  if (d <= 0 || d > 100) return p;
  return parseFloat((p * (1 - d / 100)).toFixed(2));
}

async function buildProductResponse(product: typeof productsTable.$inferSelect) {
  const [[row], [storeRow], { groups: variantGroups, variants }] = await Promise.all([
    db
      .select({
        sellerName: usersTable.name,
        averageRating: avg(reviewsTable.rating),
        reviewCount: count(reviewsTable.id),
        verificationLevel: usersTable.verificationLevel,
        trustScore: usersTable.trustScore,
        isVerified: usersTable.isVerified,
      })
      .from(usersTable)
      .leftJoin(reviewsTable, eq(reviewsTable.productId, product.id))
      .where(eq(usersTable.id, product.sellerId))
      .groupBy(usersTable.name, usersTable.verificationLevel, usersTable.trustScore, usersTable.isVerified),
    db
      .select({ storeName: sellerApplicationsTable.storeName, storeSlug: sellerApplicationsTable.storeSlug, storeLogo: sellerApplicationsTable.storeLogo })
      .from(sellerApplicationsTable)
      .where(and(eq(sellerApplicationsTable.userId, product.sellerId), eq(sellerApplicationsTable.status, "approved"))),
    buildVariantData(product.id),
  ]);
  return {
    id: product.id,
    sellerId: product.sellerId,
    sellerName: row?.sellerName ?? "Unknown",
    storeName: storeRow?.storeName ?? null,
    storeSlug: storeRow?.storeSlug ?? null,
    storeLogo: storeRow?.storeLogo ?? null,
    name: product.name,
    description: product.description,
    price: parseFloat(product.price),
    discountPercent: product.discountPercent ? parseFloat(product.discountPercent) : null,
    finalPrice: computeFinalPrice(product.price, product.discountPercent),
    category: product.category,
    subcategory: product.subcategory ?? null,
    stock: product.stock,
    imageUrl: product.imageUrl ?? null,
    imageUrls: product.imageUrls ?? [],
    featured: product.featured,
    salesCount: product.salesCount,
    isBestDeal: isBestDeal(product.discountPercent ? parseFloat(product.discountPercent) : null),
    createdAt: product.createdAt.toISOString(),
    viewCount: product.viewCount,
    averageRating: row?.averageRating != null ? parseFloat(row.averageRating) : null,
    reviewCount: Number(row?.reviewCount ?? 0),
    sellerVerificationLevel: row?.verificationLevel ?? "none",
    sellerTrustScore: row?.trustScore ?? null,
    sellerIsVerified: row?.isVerified ?? false,
    variantGroups,
    variants,
  };
}

const QUERY_TIMEOUT_MS = 8_000;

function withQueryTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
    ),
  ]);
}

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // ── STEP 4.3: Cache check ────────────────────────────────────────────────
  const cacheKey = [
    "products:list",
    params.data.limit    ?? 24,
    params.data.offset   ?? 0,
    params.data.category ?? "",
    params.data.subcategory ?? "",
    params.data.sortBy   ?? "",
    params.data.minPrice ?? "",
    params.data.maxPrice ?? "",
    params.data.search   ?? "",
    params.data.sellerId ?? "",
    params.data.featured ?? "",
    params.data.inStock  ?? "",
    params.data.hasDiscount ?? "",
    params.data.minRating   ?? "",
  ].join(":");

  const cached = productsCache.get(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(cached);
    return;
  }

  const limit = Math.min(params.data.limit ?? 24, 100);
  const offset = params.data.offset ?? 0;

  const conditions: ReturnType<typeof eq>[] = [];

  if (params.data.category) {
    conditions.push(eq(productsTable.category, params.data.category));
  }

  if (params.data.subcategory) {
    conditions.push(eq(productsTable.subcategory, params.data.subcategory));
  }

  if (params.data.search) {
    const rawSearch = params.data.search.trim();
    const term = `%${rawSearch}%`;

    const words = rawSearch
      .split(/[\s\-_،,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    const wordOrClauses = words.flatMap((word) => {
      const wt = `%${word}%`;
      return [
        ilike(productsTable.name, wt),
        ilike(productsTable.description, wt),
        ilike(productsTable.category, wt),
        ...(productsTable.subcategory ? [ilike(productsTable.subcategory, wt)] : []),
      ];
    });

    conditions.push(
      or(
        ilike(productsTable.name, term),
        ilike(productsTable.description, term),
        ilike(productsTable.category, term),
        ilike(productsTable.subcategory, term),
        ...wordOrClauses,
      )! as ReturnType<typeof eq>
    );
  }

  if (params.data.sellerId) {
    conditions.push(eq(productsTable.sellerId, params.data.sellerId));
  }

  if (params.data.minPrice != null) {
    conditions.push(gte(sql`CAST(${productsTable.price} AS numeric)`, params.data.minPrice) as ReturnType<typeof eq>);
  }

  if (params.data.maxPrice != null) {
    conditions.push(lte(sql`CAST(${productsTable.price} AS numeric)`, params.data.maxPrice) as ReturnType<typeof eq>);
  }

  if (params.data.hasDiscount === true) {
    conditions.push(
      and(
        isNotNull(productsTable.discountPercent),
        gt(sql`CAST(${productsTable.discountPercent} AS numeric)`, 0)
      )! as ReturnType<typeof eq>
    );
  }

  if (params.data.inStock === true) {
    conditions.push(gt(productsTable.stock, 0) as ReturnType<typeof eq>);
  }

  if (params.data.featured === true) {
    conditions.push(eq(productsTable.featured, true));
  } else if (params.data.featured === false) {
    conditions.push(eq(productsTable.featured, false));
  }

  const sortBy = params.data.sortBy;
  const orderClause =
    sortBy === "price_asc"       ? sql`CAST(${productsTable.price} AS numeric) asc` :
    sortBy === "price_desc"      ? sql`CAST(${productsTable.price} AS numeric) desc` :
    sortBy === "highest_rated"   ? sql`avg(${reviewsTable.rating}) desc nulls last` :
    sortBy === "most_discounted" ? sql`CAST(${productsTable.discountPercent} AS numeric) desc nulls last` :
    sortBy === "best_selling"    ? sql`${productsTable.salesCount} desc nulls last` :
    sql`${productsTable.createdAt} desc`;

  const havingClause = params.data.minRating
    ? sql`avg(${reviewsTable.rating}) >= ${params.data.minRating}`
    : undefined;

  // ── STEP 6.4: Query timeout protection — rows inferred inside try ────────
  try {
    const rows = await withQueryTimeout(
      db
        .select({
          id: productsTable.id,
          sellerId: productsTable.sellerId,
          sellerName: usersTable.name,
          name: productsTable.name,
          description: productsTable.description,
          price: productsTable.price,
          discountPercent: productsTable.discountPercent,
          category: productsTable.category,
          subcategory: productsTable.subcategory,
          stock: productsTable.stock,
          imageUrl: productsTable.imageUrl,
          imageUrls: productsTable.imageUrls,
          featured: productsTable.featured,
          salesCount: productsTable.salesCount,
          createdAt: productsTable.createdAt,
          averageRating: avg(reviewsTable.rating),
          reviewCount: count(reviewsTable.id),
        })
        .from(productsTable)
        .innerJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
        .leftJoin(reviewsTable, eq(reviewsTable.productId, productsTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(productsTable.id, usersTable.name)
        .having(havingClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset)
        .then((r) => r),
      QUERY_TIMEOUT_MS,
    );

    // Batch-check which products have active variants (one query, no N+1)
    let variantProductIds = new Set<number>();
    if (rows.length > 0) {
      const vRows = await db
        .selectDistinct({ productId: productVariantsTable.productId })
        .from(productVariantsTable)
        .where(inArray(productVariantsTable.productId, rows.map((r) => r.id)));
      variantProductIds = new Set(vRows.map((r) => r.productId));
    }

    const result = rows.map((row) => ({
      id: row.id,
      sellerId: row.sellerId,
      sellerName: row.sellerName ?? "Unknown",
      name: row.name,
      description: row.description.substring(0, 200),
      price: parseFloat(row.price),
      discountPercent: row.discountPercent ? parseFloat(row.discountPercent) : null,
      finalPrice: computeFinalPrice(row.price, row.discountPercent),
      category: row.category,
      subcategory: row.subcategory ?? null,
      stock: row.stock,
      imageUrl: row.imageUrl ?? null,
      imageUrls: row.imageUrls ?? [],
      featured: row.featured,
      salesCount: row.salesCount,
      isBestDeal: isBestDeal(row.discountPercent ? parseFloat(row.discountPercent) : null),
      createdAt: row.createdAt.toISOString(),
      averageRating: row.averageRating != null ? parseFloat(row.averageRating) : null,
      reviewCount: Number(row.reviewCount ?? 0),
      hasVariants: variantProductIds.has(row.id),
    }));

    // ── STEP 4.3: Cache store ──────────────────────────────────────────────
    productsCache.set(cacheKey, result as unknown as Record<string, unknown>);
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(result);
  } catch (err) {
    if (err instanceof Error && (
      err.message.startsWith("Query timeout") ||
      err.message.includes("canceling statement")
    )) {
      res.status(503).setHeader("Retry-After", "5").json({ error: "Service temporarily unavailable" });
      return;
    }
    throw err;
  }
});

router.get("/products/categories", async (_req, res): Promise<void> => {
  // ── STEP 4.5: Categories cache (1hr TTL) ─────────────────────────────────
  const catKey = "categories:all";
  const catCached = categoriesCache.get(catKey);
  if (catCached) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json(catCached);
    return;
  }
  categoriesCache.set(catKey, MAIN_CATEGORY_SLUGS as unknown as Record<string, unknown>);
  res.setHeader("X-Cache", "MISS");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(MAIN_CATEGORY_SLUGS);
});

/* ── Best Sellers: products ranked by total units sold across all orders ── */
router.get("/products/best-sellers", async (req, res): Promise<void> => {
  const rawLimit = parseInt(String(req.query.limit ?? "8"), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 50
    ? rawLimit
    : 8;

  const salesSub = db
    .select({
      productId:  orderItemsTable.productId,
      salesCount: sql<string>`sum(${orderItemsTable.quantity})`.as("sales_count"),
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(sql`${ordersTable.status} in ('processing', 'shipped', 'delivered')`)
    .groupBy(orderItemsTable.productId)
    .as("sales_sub");

  const reviewSub = db
    .select({
      productId:     reviewsTable.productId,
      averageRating: avg(reviewsTable.rating).as("average_rating"),
      reviewCount:   count(reviewsTable.id).as("review_count"),
    })
    .from(reviewsTable)
    .groupBy(reviewsTable.productId)
    .as("review_sub");

  const rows = await db
    .select({
      id:             productsTable.id,
      sellerId:       productsTable.sellerId,
      sellerName:     usersTable.name,
      name:           productsTable.name,
      description:    productsTable.description,
      price:          productsTable.price,
      discountPercent: productsTable.discountPercent,
      category:       productsTable.category,
      subcategory:    productsTable.subcategory,
      stock:          productsTable.stock,
      imageUrl:       productsTable.imageUrl,
      imageUrls:      productsTable.imageUrls,
      createdAt:      productsTable.createdAt,
      salesCount:     sql<string>`coalesce("sales_sub"."sales_count", '0')`,
      averageRating:  reviewSub.averageRating,
      reviewCount:    sql<number>`coalesce("review_sub"."review_count", 0)`,
    })
    .from(productsTable)
    .innerJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
    .leftJoin(salesSub, eq(salesSub.productId, productsTable.id))
    .leftJoin(reviewSub, eq(reviewSub.productId, productsTable.id))
    .orderBy(
      sql`coalesce("sales_sub"."sales_count", '0')::numeric desc`,
      sql`"review_sub"."average_rating" desc nulls last`,
    )
    .limit(limit);

  const result = rows.map((row) => ({
    id:             row.id,
    sellerId:       row.sellerId,
    sellerName:     row.sellerName ?? "Unknown",
    name:           row.name,
    description:    row.description.substring(0, 200),
    price:          parseFloat(row.price),
    discountPercent: row.discountPercent ? parseFloat(row.discountPercent) : null,
    finalPrice:     computeFinalPrice(row.price, row.discountPercent),
    category:       row.category,
    subcategory:    row.subcategory ?? null,
    stock:          row.stock,
    imageUrl:       row.imageUrl ?? null,
    imageUrls:      row.imageUrls ?? [],
    isBestDeal:     isBestDeal(row.discountPercent ? parseFloat(row.discountPercent) : null),
    createdAt:      row.createdAt.toISOString(),
    averageRating:  row.averageRating != null ? parseFloat(row.averageRating) : null,
    reviewCount:    typeof row.reviewCount === "string" ? parseInt(row.reviewCount, 10) : (row.reviewCount ?? 0),
    salesCount:     parseInt(row.salesCount, 10),
  }));

  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  res.json(result);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  // ── STEP 4.4: Product detail cache (5min TTL) ────────────────────────────
  const detailKey = `product:detail:${params.data.id}`;
  const detailCached = productDetailCache.get(detailKey);
  if (detailCached) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json(detailCached);
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Fire-and-forget view count increment — never awaited, never blocks the response
  db.update(productsTable)
    .set({ viewCount: sql`${productsTable.viewCount} + 1` })
    .where(eq(productsTable.id, product.id))
    .catch(() => {});

  const detailResponse = await buildProductResponse(product);
  productDetailCache.set(detailKey, detailResponse as unknown as Record<string, unknown>);
  res.setHeader("X-Cache", "MISS");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.json(detailResponse);
});

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

router.post("/products", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.price <= 0) {
    res.status(400).json({ error: "Price must be greater than 0" });
    return;
  }
  if (parsed.data.stock < 0) {
    res.status(400).json({ error: "Stock cannot be negative" });
    return;
  }

  const cleanGallery = (parsed.data.imageUrls ?? []).filter((u: string) => u.trim() !== "");
  const safeName = stripHtml(parsed.data.name);
  const safeDesc = stripHtml(parsed.data.description);
  const rawNameArCreate = (req.body as Record<string, unknown>).nameAr;
  const safeNameAr = typeof rawNameArCreate === "string" && rawNameArCreate.trim() ? stripHtml(rawNameArCreate) : undefined;

  if (!safeName) {
    res.status(400).json({ error: "Product name is required" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      sellerId: req.user!.userId,
      name: safeName,
      description: safeDesc,
      price: String(parsed.data.price),
      category: parsed.data.category,
      subcategory: parsed.data.subcategory ?? null,
      stock: parsed.data.stock,
      imageUrl: parsed.data.imageUrl ?? null,
      imageUrls: cleanGallery.length > 0 ? cleanGallery : null,
      nameAr: safeNameAr ?? null,
      searchTokens: buildSearchTokens({
        name: safeName,
        category: parsed.data.category,
        subcategory: parsed.data.subcategory ?? null,
        description: safeDesc,
      }),
    })
    .returning();

  const created = await buildProductResponse(product);
  // Fire-and-forget: generate semantic embedding + invalidate caches
  const embText = [product.nameAr, product.name, product.category, product.subcategory, product.description?.slice(0, 500), product.searchTokens].filter(Boolean).join(" ");
  generateSingleEmbedding(product.id, embText).catch(() => {});
  searchCache.invalidate();
  productsCache.clear();
  categoriesCache.clear();
  res.status(201).json(created);
});

router.patch("/products/:id", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing || existing.sellerId !== req.user!.userId) {
    res.status(404).json({ error: "Product not found or access denied" });
    return;
  }

  if (parsed.data.price != null && parsed.data.price <= 0) {
    res.status(400).json({ error: "Price must be greater than 0" });
    return;
  }

  const updateData: Partial<typeof productsTable.$inferInsert> = {};
  if (parsed.data.name != null) updateData.name = stripHtml(parsed.data.name);
  if (parsed.data.description != null) updateData.description = stripHtml(parsed.data.description);
  if (parsed.data.price != null) updateData.price = String(parsed.data.price);
  if (parsed.data.category != null) updateData.category = parsed.data.category;
  if ("subcategory" in parsed.data) updateData.subcategory = parsed.data.subcategory ?? null;
  if ("imageUrl" in parsed.data) updateData.imageUrl = parsed.data.imageUrl ?? null;
  if ("imageUrls" in parsed.data) {
    const cleanGallery = (parsed.data.imageUrls ?? []).filter((u: string) => u.trim() !== "");
    updateData.imageUrls = cleanGallery.length > 0 ? cleanGallery : null;
  }
  // nameAr is not in the generated Zod schema but is a valid DB field — handle directly
  const rawNameAr = (req.body as Record<string, unknown>).nameAr;
  if (rawNameAr !== undefined) {
    updateData.nameAr = typeof rawNameAr === "string" && rawNameAr.trim() !== ""
      ? stripHtml(rawNameAr.trim())
      : null;
  }

  const searchAffected =
    parsed.data.name != null ||
    parsed.data.description != null ||
    parsed.data.category != null ||
    "subcategory" in parsed.data ||
    rawNameAr !== undefined;

  if (searchAffected) {
    updateData.searchTokens = buildSearchTokens({
      name:        updateData.name        ?? existing.name,
      category:    updateData.category    ?? existing.category,
      subcategory: updateData.subcategory ?? existing.subcategory,
      description: updateData.description ?? existing.description,
      nameAr:      updateData.nameAr      ?? existing.nameAr,
    });
  }

  const [updated] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, params.data.id)).returning();
  searchCache.invalidate();
  productsCache.deleteByPrefix("products:list:");
  productDetailCache.delete(`product:detail:${params.data.id}`);
  // Re-embed when any search-affecting field changed (name, description, category, subcategory, nameAr)
  if (searchAffected) {
    const embText = [updated.nameAr, updated.name, updated.category, updated.subcategory, updated.description?.slice(0, 500), updated.searchTokens].filter(Boolean).join(" ");
    generateSingleEmbedding(updated.id, embText).catch(() => {});
  }
  const updatedResponse = await buildProductResponse(updated);
  res.json(updatedResponse);
});

router.delete("/products/:id", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing || existing.sellerId !== req.user!.userId) {
    res.status(404).json({ error: "Product not found or access denied" });
    return;
  }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  searchCache.invalidate();
  productsCache.deleteByPrefix("products:list:");
  productDetailCache.delete(`product:detail:${params.data.id}`);
  categoriesCache.clear();
  res.json({ message: "Product deleted" });
});

router.patch("/products/:id/discount", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDiscountParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = UpdateDiscountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing || existing.sellerId !== req.user!.userId) {
    res.status(404).json({ error: "Product not found or access denied" });
    return;
  }

  const discountValue = parsed.data.discountPercent;
  if (discountValue != null && (discountValue < 0 || discountValue > 100)) {
    res.status(400).json({ error: "Discount must be between 0 and 100" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({ discountPercent: discountValue != null ? String(discountValue) : null })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  searchCache.invalidate();
  productsCache.deleteByPrefix("products:list:");
  productDetailCache.delete(`product:detail:${params.data.id}`);
  res.json(await buildProductResponse(updated));
});

router.patch("/products/:id/stock", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateStockParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const parsed = UpdateStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.stock < 0) {
    res.status(400).json({ error: "Stock cannot be negative" });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!existing || existing.sellerId !== req.user!.userId) {
    res.status(404).json({ error: "Product not found or access denied" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({ stock: parsed.data.stock })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  productsCache.deleteByPrefix("products:list:");
  productDetailCache.delete(`product:detail:${params.data.id}`);
  res.json(await buildProductResponse(updated));
});

export default router;
