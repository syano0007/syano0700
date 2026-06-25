import { Router, type IRouter } from "express";
import { eq, and, avg, count, desc, sql, ne } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  sellerApplicationsTable,
  productsTable,
  reviewsTable,
  ordersTable,
  orderItemsTable,
  storeFollowsTable,
  sellerReviewsTable,
} from "@workspace/db";
import { requireAuth, requireRole, requireActiveAccount } from "../middlewares/auth";
import { createNotification, bi } from "../lib/notif";
import { sellersCache } from "../services/cacheService";

const router: IRouter = Router();

/* ── Shared: compute store stats ────────────────────────────── */
async function getStoreStats(sellerId: number) {
  const [productStats, orderStats, followerStat, sellerReviewStat] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(productsTable)
        .where(eq(productsTable.sellerId, sellerId)),

      db
        .select({
          total: sql<number>`cast(count(distinct ${ordersTable.id}) as int)`,
          delivered: sql<number>`cast(count(distinct case when ${ordersTable.status} = 'delivered' then ${ordersTable.id} end) as int)`,
          revenue: sql<string>`coalesce(sum(case when ${ordersTable.status} = 'delivered' then ${orderItemsTable.unitPrice}::numeric * ${orderItemsTable.quantity} end), 0)`,
        })
        .from(orderItemsTable)
        .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
        .where(eq(orderItemsTable.sellerId, sellerId)),

      db
        .select({ count: count() })
        .from(storeFollowsTable)
        .where(eq(storeFollowsTable.sellerId, sellerId)),

      db
        .select({
          avgCommunication: avg(sellerReviewsTable.communicationRating),
          avgShipping: avg(sellerReviewsTable.shippingRating),
          avgProfessionalism: avg(sellerReviewsTable.professionalismRating),
          total: count(),
        })
        .from(sellerReviewsTable)
        .where(eq(sellerReviewsTable.sellerId, sellerId)),
    ]);

  const totalOrders = Number(orderStats[0]?.total ?? 0);
  const deliveredOrders = Number(orderStats[0]?.delivered ?? 0);
  const completionRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100;

  const sr = sellerReviewStat[0];
  const sellerScore =
    sr && Number(sr.total) > 0
      ? parseFloat(
          (
            parseFloat(sr.avgCommunication ?? "0") * 0.4 +
            parseFloat(sr.avgShipping ?? "0") * 0.3 +
            parseFloat(sr.avgProfessionalism ?? "0") * 0.3
          ).toFixed(1)
        )
      : null;

  return {
    totalProducts: Number(productStats[0]?.count ?? 0),
    averageRating: sellerScore, // from seller reviews (store reviews), NOT product reviews
    reviewCount: Number(sr?.total ?? 0),
    totalOrders,
    completionRate,
    totalRevenue: parseFloat(parseFloat(orderStats[0]?.revenue ?? "0").toFixed(2)),
    followerCount: Number(followerStat[0]?.count ?? 0),
    sellerScore,
    sellerReviewCount: Number(sr?.total ?? 0),
  };
}

/* ── GET /sellers/featured (public — homepage verified stores) ── */
router.get("/sellers/featured", async (_req, res): Promise<void> => {
  try {
    const stores = await db
      .select({
        sellerId: sellerApplicationsTable.userId,
        storeName: sellerApplicationsTable.storeName,
        storeSlug: sellerApplicationsTable.storeSlug,
        storeLogo: sellerApplicationsTable.storeLogo,
        storeBanner: sellerApplicationsTable.storeBanner,
        accentColor: sellerApplicationsTable.accentColor,
        categories: sellerApplicationsTable.categories,
        city: sellerApplicationsTable.city,
        verifiedAt: usersTable.verifiedAt,
      })
      .from(sellerApplicationsTable)
      .innerJoin(usersTable, eq(usersTable.id, sellerApplicationsTable.userId))
      .where(eq(sellerApplicationsTable.status, "approved"))
      .orderBy(desc(usersTable.createdAt))
      .limit(6);

    const result = await Promise.all(
      stores.map(async (s) => {
        const stats = await getStoreStats(s.sellerId);
        return {
          sellerId: s.sellerId,
          storeName: s.storeName ?? "متجر",
          storeSlug: s.storeSlug,
          storeLogo: s.storeLogo ?? null,
          storeBanner: s.storeBanner ?? null,
          accentColor: s.accentColor ?? null,
          categories: s.categories ?? [],
          city: s.city ?? null,
          isVerified: !!s.verifiedAt,
          productsCount: stats.totalProducts,
          followersCount: stats.followerCount,
          averageRating: stats.averageRating,
          reviewsCount: stats.reviewCount,
        };
      }),
    );

    res.json(result);
  } catch {
    res.json([]);
  }
});

/* ── GET /sellers/directory (public — searchable paginated store list) ── */
router.get("/sellers/directory", async (req, res): Promise<void> => {
  try {
    const {
      search = "", sort = "newest", verified, category,
      page: pageStr = "1", limit: limitStr = "12",
    } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(pageStr,  10) || 1);
    const limitNum = Math.min(48, parseInt(limitStr, 10) || 12);

    // ── STEP 4.6: Sellers directory cache (2min TTL) ─────────────────────────
    const dirCacheKey = `sellers:directory:${search}:${sort}:${verified ?? ""}:${category ?? ""}:${pageNum}:${limitNum}`;
    const dirCached = sellersCache.get(dirCacheKey);
    if (dirCached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
      res.json(dirCached);
      return;
    }

    const conditions: any[] = [eq(sellerApplicationsTable.status, "approved")];
    if (search.trim()) {
      const pat = `%${search.trim()}%`;
      conditions.push(sql`lower(${sellerApplicationsTable.storeName}) like lower(${pat})`);
    }
    if (verified === "true") {
      conditions.push(sql`${usersTable.verifiedAt} is not null`);
    }

    const rows = await db
      .select({
        sellerId:    sellerApplicationsTable.userId,
        storeName:   sellerApplicationsTable.storeName,
        storeSlug:   sellerApplicationsTable.storeSlug,
        storeLogo:   sellerApplicationsTable.storeLogo,
        storeBanner: sellerApplicationsTable.storeBanner,
        accentColor: sellerApplicationsTable.accentColor,
        categories:  sellerApplicationsTable.categories,
        city:        sellerApplicationsTable.city,
        description: sellerApplicationsTable.description,
        createdAt:   usersTable.createdAt,
        verifiedAt:  usersTable.verifiedAt,
      })
      .from(sellerApplicationsTable)
      .innerJoin(usersTable, eq(usersTable.id, sellerApplicationsTable.userId))
      .where(and(...conditions))
      .orderBy(desc(usersTable.createdAt));

    let filtered = rows;
    if (category && category !== "all") {
      filtered = rows.filter(
        (s) => (s.categories ?? []).some((c: string) => c === category),
      );
    }

    const withStats = await Promise.all(
      filtered.map(async (s) => {
        const stats = await getStoreStats(s.sellerId);
        return {
          sellerId:    s.sellerId,
          storeName:   s.storeName ?? "متجر",
          storeSlug:   s.storeSlug,
          storeLogo:   s.storeLogo ?? null,
          storeBanner: s.storeBanner ?? null,
          accentColor: s.accentColor ?? null,
          categories:  s.categories ?? [],
          city:        s.city ?? null,
          description: s.description ?? null,
          isVerified:  !!s.verifiedAt,
          createdAt:   s.createdAt.toISOString(),
          ...stats,
        };
      }),
    );

    const sorted = [...withStats];
    if      (sort === "rating")    sorted.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    else if (sort === "followers") sorted.sort((a, b) => b.followerCount - a.followerCount);
    else if (sort === "products")  sorted.sort((a, b) => b.totalProducts  - a.totalProducts);

    const total     = sorted.length;
    const paginated = sorted.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    const dirResponse = { stores: paginated, total, page: pageNum, limit: limitNum };
    sellersCache.set(dirCacheKey, dirResponse as unknown as Record<string, unknown>);
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    res.json(dirResponse);
  } catch {
    res.json({ stores: [], total: 0, page: 1, limit: 12 });
  }
});

/* ── GET /sellers/store/:slug ────────────────────────────────── */
router.get("/sellers/store/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;

  const [storeData] = await db
    .select({
      sellerId: usersTable.id,
      userName: usersTable.name,
      trustLevel: usersTable.trustLevel,
      isVerified: usersTable.isVerified,
      verifiedAt: usersTable.verifiedAt,
      verificationLevel: usersTable.verificationLevel,
      trustScore: usersTable.trustScore,
      memberSince: usersTable.createdAt,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
      storeDescription: sellerApplicationsTable.description,
      storeLogo: sellerApplicationsTable.storeLogo,
      storeBanner: sellerApplicationsTable.storeBanner,
      accentColor: sellerApplicationsTable.accentColor,
      categories: sellerApplicationsTable.categories,
      city: sellerApplicationsTable.city,
      website: sellerApplicationsTable.website,
      socialLinks: sellerApplicationsTable.socialLinks,
      contactPhone: sellerApplicationsTable.contactPhone,
      contactEmail: sellerApplicationsTable.contactEmail,
      whatsapp: sellerApplicationsTable.whatsapp,
      telegram: sellerApplicationsTable.telegram,
      facebook: sellerApplicationsTable.facebook,
      instagram: sellerApplicationsTable.instagram,
      shippingPolicy: sellerApplicationsTable.shippingPolicy,
      returnPolicy: sellerApplicationsTable.returnPolicy,
      warrantyPolicy: sellerApplicationsTable.warrantyPolicy,
      privacyPolicy: sellerApplicationsTable.privacyPolicy,
    })
    .from(sellerApplicationsTable)
    .innerJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
    .where(
      and(
        eq(sellerApplicationsTable.storeSlug, slug),
        eq(sellerApplicationsTable.status, "approved")
      )
    );

  if (!storeData) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  const stats = await getStoreStats(storeData.sellerId);

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.json({
    sellerId: storeData.sellerId,
    storeName: storeData.storeName,
    storeSlug: storeData.storeSlug,
    storeDescription: storeData.storeDescription,
    storeLogo: storeData.storeLogo ?? null,
    storeBanner: storeData.storeBanner ?? null,
    accentColor: storeData.accentColor ?? null,
    categories: storeData.categories ?? [],
    city: storeData.city ?? null,
    website: storeData.website ?? null,
    socialLinks: storeData.socialLinks ?? null,
    contactPhone: storeData.contactPhone ?? null,
    contactEmail: storeData.contactEmail ?? null,
    whatsapp: storeData.whatsapp ?? null,
    telegram: storeData.telegram ?? null,
    facebook: storeData.facebook ?? null,
    instagram: storeData.instagram ?? null,
    shippingPolicy: storeData.shippingPolicy ?? null,
    returnPolicy: storeData.returnPolicy ?? null,
    warrantyPolicy: storeData.warrantyPolicy ?? null,
    privacyPolicy: storeData.privacyPolicy ?? null,
    sellerName: storeData.userName,
    trustLevel: storeData.trustLevel ?? "new",
    isVerified: storeData.isVerified ?? false,
    verifiedAt: storeData.verifiedAt?.toISOString() ?? null,
    verificationLevel: storeData.verificationLevel ?? "none",
    trustScore: storeData.trustScore ?? null,
    memberSince: storeData.memberSince.toISOString(),
    ...stats,
  });
});

/* ── GET /sellers/:id/store-preview ─────────────────────────── */
router.get("/sellers/:id/store-preview", async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [data] = await db
    .select({
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
      storeLogo: sellerApplicationsTable.storeLogo,
      trustLevel: usersTable.trustLevel,
      isVerified: usersTable.isVerified,
      verifiedAt: usersTable.verifiedAt,
      verificationLevel: usersTable.verificationLevel,
      trustScore: usersTable.trustScore,
      memberSince: usersTable.createdAt,
    })
    .from(sellerApplicationsTable)
    .innerJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
    .where(
      and(
        eq(sellerApplicationsTable.userId, sellerId),
        eq(sellerApplicationsTable.status, "approved")
      )
    );

  if (!data) { res.status(404).json({ error: "Seller not found" }); return; }

  const [[storeReviewRow], [followerRow]] = await Promise.all([
    db
      .select({
        avgCommunication: avg(sellerReviewsTable.communicationRating),
        avgShipping: avg(sellerReviewsTable.shippingRating),
        avgProfessionalism: avg(sellerReviewsTable.professionalismRating),
        total: count(),
      })
      .from(sellerReviewsTable)
      .where(eq(sellerReviewsTable.sellerId, sellerId)),
    db
      .select({ count: count() })
      .from(storeFollowsTable)
      .where(eq(storeFollowsTable.sellerId, sellerId)),
  ]);

  const storeRating = storeReviewRow && Number(storeReviewRow.total) > 0
    ? parseFloat((
        parseFloat(storeReviewRow.avgCommunication ?? "0") * 0.4 +
        parseFloat(storeReviewRow.avgShipping ?? "0") * 0.3 +
        parseFloat(storeReviewRow.avgProfessionalism ?? "0") * 0.3
      ).toFixed(1))
    : null;

  res.json({
    sellerId,
    storeName: data.storeName,
    storeSlug: data.storeSlug ?? null,
    storeLogo: data.storeLogo ?? null,
    trustLevel: data.trustLevel ?? "new",
    isVerified: data.isVerified ?? false,
    verifiedAt: data.verifiedAt?.toISOString() ?? null,
    verificationLevel: data.verificationLevel ?? "none",
    trustScore: data.trustScore ?? null,
    memberSince: data.memberSince.toISOString(),
    averageRating: storeRating,
    reviewCount: Number(storeReviewRow?.total ?? 0),
    followerCount: Number(followerRow?.count ?? 0),
  });
});

/* ── POST /sellers/:id/follow ───────────────────────────────── */
router.post("/sellers/:id/follow", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const followerId = req.user!.userId;
  if (followerId === sellerId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }

  const [seller] = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(and(eq(usersTable.id, sellerId), eq(usersTable.role, "seller")));

  if (!seller) { res.status(404).json({ error: "Seller not found" }); return; }

  const [follow] = await db
    .insert(storeFollowsTable)
    .values({ followerId, sellerId })
    .onConflictDoNothing()
    .returning();

  if (follow) {
    const [follower] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, followerId));

    createNotification({
      userId: sellerId,
      type: "new_follower",
      title: bi("New Store Follower", "متابع جديد لمتجرك"),
      body: bi(
        `${follower?.name ?? "Someone"} is now following your store.`,
        `${follower?.name ?? "شخص ما"} يتابع متجرك الآن.`
      ),
      link: `/seller/dashboard`,
      priority: "normal",
    }).catch(() => {});
  }

  const [countRow] = await db
    .select({ count: count() })
    .from(storeFollowsTable)
    .where(eq(storeFollowsTable.sellerId, sellerId));

  res.json({ following: true, followerCount: Number(countRow?.count ?? 0) });
});

/* ── DELETE /sellers/:id/follow ─────────────────────────────── */
router.delete("/sellers/:id/follow", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const followerId = req.user!.userId;

  await db
    .delete(storeFollowsTable)
    .where(and(eq(storeFollowsTable.followerId, followerId), eq(storeFollowsTable.sellerId, sellerId)));

  const [countRow] = await db
    .select({ count: count() })
    .from(storeFollowsTable)
    .where(eq(storeFollowsTable.sellerId, sellerId));

  res.json({ following: false, followerCount: Number(countRow?.count ?? 0) });
});

/* ── GET /sellers/:id/follow-status ─────────────────────────── */
router.get("/sellers/:id/follow-status", requireAuth, async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const followerId = req.user!.userId;

  const [[follow], [countRow]] = await Promise.all([
    db
      .select({ id: storeFollowsTable.id })
      .from(storeFollowsTable)
      .where(and(eq(storeFollowsTable.followerId, followerId), eq(storeFollowsTable.sellerId, sellerId))),
    db
      .select({ count: count() })
      .from(storeFollowsTable)
      .where(eq(storeFollowsTable.sellerId, sellerId)),
  ]);

  res.json({ following: !!follow, followerCount: Number(countRow?.count ?? 0) });
});

/* ── GET /me/following-stores ───────────────────────────────── */
router.get("/me/following-stores", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const follows = await db
    .select({
      sellerId: storeFollowsTable.sellerId,
      followedAt: storeFollowsTable.createdAt,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
      storeLogo: sellerApplicationsTable.storeLogo,
      trustLevel: usersTable.trustLevel,
      verifiedAt: usersTable.verifiedAt,
    })
    .from(storeFollowsTable)
    .innerJoin(usersTable, eq(usersTable.id, storeFollowsTable.sellerId))
    .leftJoin(
      sellerApplicationsTable,
      and(
        eq(sellerApplicationsTable.userId, storeFollowsTable.sellerId),
        eq(sellerApplicationsTable.status, "approved")
      )
    )
    .where(eq(storeFollowsTable.followerId, userId))
    .orderBy(desc(storeFollowsTable.createdAt));

  res.json(
    follows.map((f) => ({
      sellerId: f.sellerId,
      storeName: f.storeName ?? null,
      storeSlug: f.storeSlug ?? null,
      storeLogo: f.storeLogo ?? null,
      trustLevel: f.trustLevel ?? "new",
      verifiedAt: f.verifiedAt?.toISOString() ?? null,
      followedAt: f.followedAt.toISOString(),
    }))
  );
});

/* ── GET /sellers/:id/reviews ───────────────────────────────── */
router.get("/sellers/:id/reviews", async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);
  const offset = parseInt((req.query.offset as string) || "0", 10);

  const [reviews, [summary]] = await Promise.all([
    db
      .select({
        id: sellerReviewsTable.id,
        customerId: sellerReviewsTable.customerId,
        customerName: usersTable.name,
        communicationRating: sellerReviewsTable.communicationRating,
        shippingRating: sellerReviewsTable.shippingRating,
        professionalismRating: sellerReviewsTable.professionalismRating,
        comment: sellerReviewsTable.comment,
        createdAt: sellerReviewsTable.createdAt,
        sellerReply: sellerReviewsTable.sellerReply,
        sellerReplyAt: sellerReviewsTable.sellerReplyAt,
        sellerReplyUpdatedAt: sellerReviewsTable.sellerReplyUpdatedAt,
      })
      .from(sellerReviewsTable)
      .innerJoin(usersTable, eq(usersTable.id, sellerReviewsTable.customerId))
      .where(eq(sellerReviewsTable.sellerId, sellerId))
      .orderBy(desc(sellerReviewsTable.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({
        avgCommunication: avg(sellerReviewsTable.communicationRating),
        avgShipping: avg(sellerReviewsTable.shippingRating),
        avgProfessionalism: avg(sellerReviewsTable.professionalismRating),
        total: count(),
        repliedCount: sql<number>`cast(count(${sellerReviewsTable.sellerReply}) as int)`,
        oldestReplyMs: sql<number>`extract(epoch from min(${sellerReviewsTable.sellerReplyAt} - ${sellerReviewsTable.createdAt})) * 1000`,
      })
      .from(sellerReviewsTable)
      .where(eq(sellerReviewsTable.sellerId, sellerId)),
  ]);

  const totalCount = Number(summary?.total ?? 0);
  const repliedCount = Number(summary?.repliedCount ?? 0);
  const responseRate = totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0;

  const overallScore =
    summary && totalCount > 0
      ? parseFloat(
          (
            parseFloat(summary.avgCommunication ?? "0") * 0.4 +
            parseFloat(summary.avgShipping ?? "0") * 0.3 +
            parseFloat(summary.avgProfessionalism ?? "0") * 0.3
          ).toFixed(1)
        )
      : null;

  res.json({
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      sellerReplyAt: r.sellerReplyAt ? r.sellerReplyAt.toISOString() : null,
      sellerReplyUpdatedAt: r.sellerReplyUpdatedAt ? r.sellerReplyUpdatedAt.toISOString() : null,
    })),
    summary: {
      total: totalCount,
      overallScore,
      avgCommunication: summary?.avgCommunication ? parseFloat(summary.avgCommunication) : null,
      avgShipping: summary?.avgShipping ? parseFloat(summary.avgShipping) : null,
      avgProfessionalism: summary?.avgProfessionalism ? parseFloat(summary.avgProfessionalism) : null,
      repliedCount,
      responseRate,
    },
  });
});

/* ── GET /sellers/:id/review-status ─────────────────────────── */
router.get("/sellers/:id/review-status", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const { userId, role } = req.user!;

  if (role !== "customer" || userId === sellerId) {
    res.json({ eligible: false, alreadyReviewed: false, deliveredOrderId: null, existingReview: null });
    return;
  }

  const [[existing], [deliveredOrder]] = await Promise.all([
    db
      .select({
        id: sellerReviewsTable.id,
        communicationRating: sellerReviewsTable.communicationRating,
        shippingRating: sellerReviewsTable.shippingRating,
        professionalismRating: sellerReviewsTable.professionalismRating,
        comment: sellerReviewsTable.comment,
        createdAt: sellerReviewsTable.createdAt,
      })
      .from(sellerReviewsTable)
      .where(and(eq(sellerReviewsTable.sellerId, sellerId), eq(sellerReviewsTable.customerId, userId))),

    db
      .select({ orderId: ordersTable.id })
      .from(ordersTable)
      .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          eq(ordersTable.customerId, userId),
          eq(ordersTable.status, "delivered"),
          eq(orderItemsTable.sellerId, sellerId)
        )
      )
      .limit(1),
  ]);

  const alreadyReviewed = !!existing;
  const eligible = !!deliveredOrder && !alreadyReviewed;

  res.json({
    eligible,
    alreadyReviewed,
    deliveredOrderId: deliveredOrder?.orderId ?? null,
    existingReview: existing
      ? { ...existing, createdAt: (existing.createdAt as Date).toISOString() }
      : null,
  });
});

/* ── POST /sellers/:id/reviews ──────────────────────────────── */
router.post("/sellers/:id/reviews", requireAuth, requireRole("customer"), requireActiveAccount, async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const customerId = req.user!.userId;
  if (customerId === sellerId) { res.status(400).json({ error: "Cannot review yourself" }); return; }

  const { communicationRating, shippingRating, professionalismRating, comment } = req.body;

  if (
    ![communicationRating, shippingRating, professionalismRating].every(
      (r) => typeof r === "number" && r >= 1 && r <= 5
    )
  ) {
    res.status(400).json({ error: "Each rating must be between 1 and 5" });
    return;
  }

  if (comment !== undefined && comment !== null) {
    if (typeof comment !== "string") {
      res.status(400).json({ error: "Comment must be a string" });
      return;
    }
    if (comment.length > 1000) {
      res.status(400).json({ error: "Comment must be 1000 characters or fewer" });
      return;
    }
  }

  const [[existing], [deliveredOrder], [customer]] = await Promise.all([
    db
      .select({ id: sellerReviewsTable.id })
      .from(sellerReviewsTable)
      .where(and(eq(sellerReviewsTable.sellerId, sellerId), eq(sellerReviewsTable.customerId, customerId))),

    db
      .select({ orderId: ordersTable.id })
      .from(ordersTable)
      .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(
        and(
          eq(ordersTable.customerId, customerId),
          eq(ordersTable.status, "delivered"),
          eq(orderItemsTable.sellerId, sellerId)
        )
      )
      .limit(1),

    db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, customerId)),
  ]);

  if (existing) { res.status(409).json({ error: "You have already reviewed this seller" }); return; }
  if (!deliveredOrder) { res.status(403).json({ error: "You can only review sellers from delivered orders" }); return; }

  const [inserted] = await db
    .insert(sellerReviewsTable)
    .values({
      sellerId,
      customerId,
      orderId: deliveredOrder.orderId,
      communicationRating: Math.round(communicationRating),
      shippingRating: Math.round(shippingRating),
      professionalismRating: Math.round(professionalismRating),
      comment: comment ?? null,
    })
    .returning();

  createNotification({
    userId: sellerId,
    type: "new_seller_review",
    title: bi("New Store Review", "تقييم جديد لمتجرك"),
    body: bi(
      `${customer?.name ?? "A customer"} rated your store.`,
      `${customer?.name ?? "عميل"} قيّم متجرك.`
    ),
    link: `/seller/dashboard`,
    priority: "normal",
  }).catch(() => {});

  res.status(201).json({ ...inserted, createdAt: inserted.createdAt.toISOString() });
});

/* ── PATCH /sellers/store/branding ──────────────────────────── */
router.patch("/sellers/store/branding", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const {
    storeLogo, logoUrl, storeBanner,
    storeName, storeNameAr,
    storeDescription, descriptionAr,
    storeSlug, storeCity,
    website, socialLinks,
    accentColor, contactPhone, contactEmail,
    // new: structured social
    whatsapp, telegram, facebook, instagram,
    // new: policies
    shippingPolicy, returnPolicy, warrantyPolicy, privacyPolicy,
    // new: seo
    metaTitle, metaDescription, seoImageUrl,
  } = req.body;

  const [app] = await db
    .select({ id: sellerApplicationsTable.id })
    .from(sellerApplicationsTable)
    .where(and(eq(sellerApplicationsTable.userId, userId), eq(sellerApplicationsTable.status, "approved")));

  if (!app) { res.status(404).json({ error: "Approved store not found" }); return; }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (storeLogo !== undefined)    patch.storeLogo     = storeLogo;
  if (logoUrl !== undefined)      patch.storeLogo     = logoUrl;
  if (storeBanner !== undefined)  patch.storeBanner   = storeBanner;
  if (storeName !== undefined)    patch.storeName     = storeName;
  if (storeNameAr !== undefined)  patch.storeNameAr   = storeNameAr;
  if (storeDescription !== undefined) patch.description = storeDescription;
  if (descriptionAr !== undefined)    patch.descriptionAr = descriptionAr;
  if (website !== undefined)      patch.website       = website;
  if (socialLinks !== undefined)  patch.socialLinks   = socialLinks;
  if (accentColor !== undefined)  patch.accentColor   = accentColor;
  if (contactPhone !== undefined) patch.contactPhone  = contactPhone;
  if (contactEmail !== undefined) patch.contactEmail  = contactEmail;
  if (storeCity !== undefined)    patch.city          = storeCity;
  if (whatsapp !== undefined)     patch.whatsapp      = whatsapp;
  if (telegram !== undefined)     patch.telegram      = telegram;
  if (facebook !== undefined)     patch.facebook      = facebook;
  if (instagram !== undefined)    patch.instagram     = instagram;
  if (shippingPolicy !== undefined) patch.shippingPolicy = shippingPolicy;
  if (returnPolicy !== undefined)   patch.returnPolicy   = returnPolicy;
  if (warrantyPolicy !== undefined) patch.warrantyPolicy = warrantyPolicy;
  if (privacyPolicy !== undefined)  patch.privacyPolicy  = privacyPolicy;
  if (metaTitle !== undefined)      patch.metaTitle      = metaTitle;
  if (metaDescription !== undefined) patch.metaDescription = metaDescription;
  if (seoImageUrl !== undefined)    patch.seoImageUrl    = seoImageUrl;
  if (storeSlug !== undefined) {
    const [slugConflict] = await db
      .select({ id: sellerApplicationsTable.id })
      .from(sellerApplicationsTable)
      .where(and(
        eq(sellerApplicationsTable.storeSlug, storeSlug),
        ne(sellerApplicationsTable.id, app.id),
        eq(sellerApplicationsTable.status, "approved")
      ));
    if (slugConflict) {
      res.status(409).json({ error: "This store URL is already taken. Please choose a different one." });
      return;
    }
    patch.storeSlug = storeSlug;
  }

  const [updated] = await db
    .update(sellerApplicationsTable)
    .set(patch as any)
    .where(eq(sellerApplicationsTable.id, app.id))
    .returning();

  res.json(updated);
});

/* ── Helper: resolve slug → seller row ──────────────────────── */
async function resolveSlug(slug: string) {
  const [row] = await db
    .select({
      sellerId: usersTable.id,
      storeName: sellerApplicationsTable.storeName,
      categories: sellerApplicationsTable.categories,
    })
    .from(sellerApplicationsTable)
    .innerJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
    .where(
      and(
        eq(sellerApplicationsTable.storeSlug, String(slug)),
        eq(sellerApplicationsTable.status, "approved")
      )
    );
  return row ?? null;
}

/* ── GET /sellers/store/:slug/metrics ───────────────────────── */
router.get("/sellers/store/:slug/metrics", async (req, res): Promise<void> => {
  const seller = await resolveSlug(String(req.params.slug));
  if (!seller) { res.status(404).json({ error: "Store not found" }); return; }

  const stats = await getStoreStats(seller.sellerId);

  const [trustRow] = await db
    .select({ trustScore: usersTable.trustScore, verificationLevel: usersTable.verificationLevel })
    .from(usersTable)
    .where(eq(usersTable.id, seller.sellerId));

  res.json({
    sellerId: seller.sellerId,
    storeName: seller.storeName,
    productsCount: stats.totalProducts,
    reviewsCount: stats.reviewCount,
    followersCount: stats.followerCount,
    averageRating: stats.averageRating,
    completedOrders: stats.totalOrders,
    completionRate: stats.completionRate,
    sellerReviewCount: stats.sellerReviewCount,
    sellerScore: stats.sellerScore,
    trustScore: trustRow?.trustScore ?? null,
    verificationLevel: trustRow?.verificationLevel ?? "none",
  });
});

/* ── PATCH /sellers/reviews/:reviewId/reply ─────────────────── */
// DB columns: seller_reply (text), seller_reply_at (timestamp), seller_reply_updated_at (timestamp)
router.patch("/sellers/reviews/:reviewId/reply", requireAuth, requireRole("seller"), requireActiveAccount, async (req, res): Promise<void> => {
  const sellerId = req.user!.userId;
  const reviewId = parseInt(String(req.params.reviewId), 10);
  if (isNaN(reviewId)) { res.status(400).json({ error: "Invalid review ID" }); return; }

  const { reply } = req.body;

  if (reply !== undefined && reply !== null && reply !== "") {
    if (typeof reply !== "string") { res.status(400).json({ error: "Reply must be a string" }); return; }
    const trimmed = reply.trim();
    if (trimmed.length > 1000) { res.status(400).json({ error: "Reply must be 1000 characters or fewer" }); return; }
    if (trimmed.length === 0) { res.status(400).json({ error: "Reply cannot be empty" }); return; }
  }

  const [existing] = await db
    .select({ id: sellerReviewsTable.id, sellerId: sellerReviewsTable.sellerId, customerId: sellerReviewsTable.customerId, sellerReply: sellerReviewsTable.sellerReply, sellerReplyAt: sellerReviewsTable.sellerReplyAt })
    .from(sellerReviewsTable)
    .where(eq(sellerReviewsTable.id, reviewId));

  if (!existing) { res.status(404).json({ error: "Review not found" }); return; }
  if (existing.sellerId !== sellerId) { res.status(403).json({ error: "You can only reply to your own reviews" }); return; }

  const isDelete = reply === null || reply === "" || reply === undefined;
  const now = new Date();

  const [updated] = await db
    .update(sellerReviewsTable)
    .set(isDelete
      ? { sellerReply: null, sellerReplyAt: null, sellerReplyUpdatedAt: null }
      : {
          sellerReply: reply.trim(),
          sellerReplyAt: existing.sellerReply ? existing.sellerReplyAt : now,
          sellerReplyUpdatedAt: existing.sellerReply ? now : null,
        }
    )
    .where(eq(sellerReviewsTable.id, reviewId))
    .returning();

  // Notify customer when seller creates a new reply (not on edit or delete)
  if (!isDelete && !existing.sellerReply) {
    db.select({ storeName: sellerApplicationsTable.storeName, storeSlug: sellerApplicationsTable.storeSlug })
      .from(sellerApplicationsTable)
      .where(eq(sellerApplicationsTable.userId, sellerId))
      .limit(1)
      .then(([app]) => {
        const slug = app?.storeSlug;
        const storeName = app?.storeName ?? "The seller";
        createNotification({
          userId: existing.customerId,
          type: "seller_review_reply" as any,
          title: bi("Seller Replied to Your Review", "ردّ البائع على تقييمك"),
          body: bi(
            `${storeName} replied to your store review.`,
            `ردّ ${storeName} على تقييمك للمتجر.`
          ),
          link: slug ? `/store/${slug}` : `/orders`,
          priority: "normal",
        }).catch(() => {});
      })
      .catch(() => {});
  }

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    sellerReplyAt: updated.sellerReplyAt ? updated.sellerReplyAt.toISOString() : null,
    sellerReplyUpdatedAt: updated.sellerReplyUpdatedAt ? updated.sellerReplyUpdatedAt.toISOString() : null,
  });
});

/* ── GET /sellers/store/:slug/reviews ───────────────────────── */
router.get("/sellers/store/:slug/reviews", async (req, res): Promise<void> => {
  const seller = await resolveSlug(String(req.params.slug));
  if (!seller) { res.status(404).json({ error: "Store not found" }); return; }

  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 50);
  const offset = parseInt((req.query.offset as string) || "0", 10);

  const [reviews, [summary]] = await Promise.all([
    db
      .select({
        id: sellerReviewsTable.id,
        customerId: sellerReviewsTable.customerId,
        customerName: usersTable.name,
        communicationRating: sellerReviewsTable.communicationRating,
        shippingRating: sellerReviewsTable.shippingRating,
        professionalismRating: sellerReviewsTable.professionalismRating,
        comment: sellerReviewsTable.comment,
        createdAt: sellerReviewsTable.createdAt,
        sellerReply: sellerReviewsTable.sellerReply,
        sellerReplyAt: sellerReviewsTable.sellerReplyAt,
        sellerReplyUpdatedAt: sellerReviewsTable.sellerReplyUpdatedAt,
      })
      .from(sellerReviewsTable)
      .innerJoin(usersTable, eq(usersTable.id, sellerReviewsTable.customerId))
      .where(eq(sellerReviewsTable.sellerId, seller.sellerId))
      .orderBy(desc(sellerReviewsTable.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({
        avgCommunication: avg(sellerReviewsTable.communicationRating),
        avgShipping: avg(sellerReviewsTable.shippingRating),
        avgProfessionalism: avg(sellerReviewsTable.professionalismRating),
        total: count(),
        repliedCount: sql<number>`cast(count(${sellerReviewsTable.sellerReply}) as int)`,
      })
      .from(sellerReviewsTable)
      .where(eq(sellerReviewsTable.sellerId, seller.sellerId)),
  ]);

  const totalCount = Number(summary?.total ?? 0);
  const repliedCount = Number(summary?.repliedCount ?? 0);
  const responseRate = totalCount > 0 ? Math.round((repliedCount / totalCount) * 100) : 0;

  const overallScore =
    summary && totalCount > 0
      ? parseFloat(
          (
            parseFloat(summary.avgCommunication ?? "0") * 0.4 +
            parseFloat(summary.avgShipping ?? "0") * 0.3 +
            parseFloat(summary.avgProfessionalism ?? "0") * 0.3
          ).toFixed(1)
        )
      : null;

  res.json({
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      sellerReplyAt: r.sellerReplyAt ? r.sellerReplyAt.toISOString() : null,
      sellerReplyUpdatedAt: r.sellerReplyUpdatedAt ? r.sellerReplyUpdatedAt.toISOString() : null,
    })),
    summary: {
      total: totalCount,
      overallScore,
      avgCommunication: summary?.avgCommunication ? parseFloat(summary.avgCommunication) : null,
      avgShipping: summary?.avgShipping ? parseFloat(summary.avgShipping) : null,
      avgProfessionalism: summary?.avgProfessionalism ? parseFloat(summary.avgProfessionalism) : null,
      repliedCount,
      responseRate,
    },
  });
});

/* ── GET /sellers/store/:slug/categories ────────────────────── */
router.get("/sellers/store/:slug/categories", async (req, res): Promise<void> => {
  const seller = await resolveSlug(String(req.params.slug));
  if (!seller) { res.status(404).json({ error: "Store not found" }); return; }

  const rows = await db
    .select({
      category: productsTable.category,
      cnt: count(productsTable.id),
    })
    .from(productsTable)
    .where(eq(productsTable.sellerId, seller.sellerId))
    .groupBy(productsTable.category);

  const categories = rows
    .filter((r) => r.category)
    .map((r) => ({ name: r.category as string, count: Number(r.cnt) }))
    .sort((a, b) => b.count - a.count);

  res.json({ categories, storeCategories: seller.categories ?? [] });
});

/* ── GET /sellers/store/:slug/featured ──────────────────────── */
router.get("/sellers/store/:slug/featured", async (req, res): Promise<void> => {
  const seller = await resolveSlug(String(req.params.slug));
  if (!seller) { res.status(404).json({ error: "Store not found" }); return; }

  const [featuredRows, newestRows] = await Promise.all([
    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        discountPercent: productsTable.discountPercent,
        imageUrl: productsTable.imageUrl,
        category: productsTable.category,
        featured: productsTable.featured,
      })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.sellerId, seller.sellerId),
          eq(productsTable.featured, true)
        )
      )
      .limit(12),

    db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        price: productsTable.price,
        discountPercent: productsTable.discountPercent,
        imageUrl: productsTable.imageUrl,
        category: productsTable.category,
        featured: productsTable.featured,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(eq(productsTable.sellerId, seller.sellerId))
      .orderBy(desc(productsTable.createdAt))
      .limit(8),
  ]);

  const mapProduct = (p: typeof featuredRows[0] & { createdAt?: Date }) => ({
    id: p.id,
    name: p.name,
    price: parseFloat(String(p.price)),
    finalPrice: p.discountPercent
      ? parseFloat((parseFloat(String(p.price)) * (1 - parseFloat(String(p.discountPercent)) / 100)).toFixed(2))
      : parseFloat(String(p.price)),
    discountPercent: p.discountPercent ? parseFloat(String(p.discountPercent)) : null,
    imageUrl: p.imageUrl ?? null,
    category: p.category ?? null,
    featured: p.featured ?? false,
  });

  res.json({
    featured: featuredRows.map(mapProduct),
    newArrivals: newestRows.map(mapProduct),
  });
});

/* ── GET /sellers/:id/trust ─────────────────────────────────── */
router.get("/sellers/:id/trust", async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.id), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      trustScore: usersTable.trustScore,
      trustLevel: usersTable.trustLevel,
      trustScoreUpdatedAt: usersTable.trustScoreUpdatedAt,
      isVerified: usersTable.isVerified,
      verificationLevel: usersTable.verificationLevel,
      verifiedAt: usersTable.verifiedAt,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, sellerId), eq(usersTable.role, "seller")));

  if (!user) { res.status(404).json({ error: "Seller not found" }); return; }

  const { computeTrustScore, scoreToBand } = await import("../lib/trustScore");
  const breakdown = await computeTrustScore(sellerId);

  res.json({
    userId: user.id,
    name: user.name,
    cachedScore: user.trustScore,
    cachedLevel: user.trustLevel ?? scoreToBand(user.trustScore ?? 0),
    cachedScoreUpdatedAt: user.trustScoreUpdatedAt?.toISOString() ?? null,
    isVerified: user.isVerified,
    verificationLevel: user.verificationLevel ?? "none",
    verifiedAt: user.verifiedAt?.toISOString() ?? null,
    liveBreakdown: breakdown,
  });
});

/* ── Seller: Product Quality Report ─────────────────────────── */
router.get("/seller/products/quality-report", requireAuth, requireRole("seller"), async (req, res): Promise<void> => {
  try {
    const sellerId = req.user!.userId;

    const { rows } = await pool.query<{
      id: number;
      name: string;
      name_ar: string | null;
      image_count: number;
      desc_len: number;
      desc_ar_len: number;
      price_val: string;
      stock: number;
      not_embedded: boolean;
    }>(`
      SELECT
        id,
        name,
        name_ar,
        COALESCE(array_length(image_urls, 1), 0)                       AS image_count,
        COALESCE(LENGTH(TRIM(COALESCE(description, ''))), 0)            AS desc_len,
        COALESCE(LENGTH(TRIM(COALESCE(description_ar, ''))), 0)         AS desc_ar_len,
        COALESCE(price::numeric, 0)::text                               AS price_val,
        stock,
        (embedding IS NULL)                                             AS not_embedded
      FROM products
      WHERE seller_id = $1
      ORDER BY id DESC
    `, [sellerId]);

    const flagged = rows
      .map((row) => {
        const issues: string[] = [];
        if (row.image_count === 0)                    issues.push("missing_images");
        if (row.desc_len < 20)                        issues.push("short_description");
        if (row.desc_ar_len < 20)                     issues.push("short_description_ar");
        if (!row.name_ar || row.name_ar.trim() === "") issues.push("missing_name_ar");
        if (parseFloat(row.price_val) === 0)           issues.push("zero_price");
        if (row.stock === 0)                           issues.push("out_of_stock");
        if (row.not_embedded)                          issues.push("not_embedded");
        return { id: row.id, name: row.name, name_ar: row.name_ar ?? "", issues };
      })
      .filter((p) => p.issues.length > 0);

    res.json({
      total_products: rows.length,
      flagged_count: flagged.length,
      products: flagged,
    });
  } catch (err) {
    console.error("[seller/products/quality-report]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
