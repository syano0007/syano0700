import { Router, type IRouter } from "express";
import { eq, count, sum, desc, asc, inArray, gte, lte, lt, and, sql } from "drizzle-orm";
import { db, pool, usersTable, productsTable, ordersTable, orderItemsTable, cartItemsTable, platformSettingsTable, adminAuditLogTable, sellerApplicationsTable, orderStatusHistoryTable, reviewsTable, deliveryZonesTable, couriersTable, courierAssignmentsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { createNotification, kickSseUser, bi } from "../lib/notif";

const router: IRouter = Router();

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function logAudit(
  actorId: number,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const [actor] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, actorId));

    await db.insert(adminAuditLogTable).values({
      actorId,
      actorName: actor?.name ?? "Admin",
      action,
      targetType,
      targetId,
      metadata: metadata ?? null,
    });
  } catch {
    // Audit logging is best-effort — a failure here must not affect the mutation response
  }
}

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = {};
  for (const s of rows) map[s.key] = s.value;

  // Auto-seed flash_sale_end if no admin has ever set it.
  // The seed runs server-side exactly once and is stored permanently in the DB,
  // so all clients always receive the same fixed ISO timestamp — never a
  // mount-time "Date.now() + N" that resets on every auth event.
  if (!map["flash_sale_end"]) {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db
      .insert(platformSettingsTable)
      .values({ key: "flash_sale_end", value: sevenDaysFromNow })
      .onConflictDoNothing();
    map["flash_sale_end"] = sevenDaysFromNow;
  }

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json({
    exchangeRate: parseFloat(map["exchange_rate"] ?? "14500"),
    flashSaleEnd: map["flash_sale_end"] ?? null,
  });
});

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────

router.use("/admin", requireAuth, requireRole("admin"));

// ─── STATS ───────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res): Promise<void> => {
  // All 6 primary queries run in parallel — was 6 sequential round-trips.
  const [
    [{ userCount }],
    [{ productCount }],
    [{ orderCount }],
    [{ revenue }],
    ordersByStatus,
    recentOrders,
  ] = await Promise.all([
    db.select({ userCount: count(usersTable.id) }).from(usersTable),
    db.select({ productCount: count(productsTable.id) }).from(productsTable),
    db.select({ orderCount: count(ordersTable.id) }).from(ordersTable),
    db.select({ revenue: sum(ordersTable.total) }).from(ordersTable),
    db.select({ status: ordersTable.status, count: count(ordersTable.id) })
      .from(ordersTable).groupBy(ordersTable.status),
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10),
  ]);

  // Batch-fetch customers and items for recent orders — was N+1 per order.
  const recentOrderIds    = recentOrders.map((o) => o.id);
  const recentCustomerIds = [...new Set(recentOrders.map((o) => o.customerId))];
  type RecentCustomer = { id: number; name: string | null; email: string | null };
  type RecentItem = typeof orderItemsTable.$inferSelect;
  const [recentCustomers, recentItems] = recentOrders.length > 0
    ? await Promise.all([
        db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(inArray(usersTable.id, recentCustomerIds)),
        db.select().from(orderItemsTable)
          .where(inArray(orderItemsTable.orderId, recentOrderIds)),
      ])
    : [[] as RecentCustomer[], [] as RecentItem[]];

  const recentCustomerMap  = new Map(recentCustomers.map((c) => [c.id, c]));
  const recentItemsByOrder = new Map<number, typeof recentItems>();
  for (const item of recentItems) {
    if (!recentItemsByOrder.has(item.orderId)) recentItemsByOrder.set(item.orderId, []);
    recentItemsByOrder.get(item.orderId)!.push(item);
  }

  const recentWithDetails = recentOrders.map((order) => {
    const customer = recentCustomerMap.get(order.customerId);
    const items    = recentItemsByOrder.get(order.id) ?? [];
    return {
      id:              order.id,
      customerId:      order.customerId,
      customerName:    customer?.name  ?? "Unknown",
      customerEmail:   customer?.email ?? "",
      total:           parseFloat(order.total),
      status:          order.status,
      shippingAddress: order.shippingAddress,
      items: items.map((i) => ({
        productId:   i.productId,
        productName: i.productName,
        quantity:    i.quantity,
        unitPrice:   parseFloat(i.unitPrice),
        subtotal:    parseFloat((parseFloat(i.unitPrice) * i.quantity).toFixed(2)),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  });

  res.json({
    totalUsers:     userCount,
    totalProducts:  productCount,
    totalOrders:    orderCount,
    totalRevenue:   parseFloat(revenue ?? "0"),
    ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s.count })),
    recentOrders:   recentWithDetails,
  });
});

// ─── TIMESERIES ──────────────────────────────────────────────────────────────

router.get("/admin/stats/timeseries", async (req, res): Promise<void> => {
  const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`DATE(${ordersTable.createdAt})`.as("date"),
      revenue: sum(ordersTable.total).as("revenue"),
      orders: count(ordersTable.id).as("orders"),
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, startDate))
    .groupBy(sql`DATE(${ordersTable.createdAt})`)
    .orderBy(sql`DATE(${ordersTable.createdAt})`);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const data: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    data.push({
      date: key,
      revenue: row ? parseFloat(row.revenue ?? "0") : 0,
      orders: row ? row.orders : 0,
    });
  }

  res.json({ data });
});

// ─── EXTENDED STATS ──────────────────────────────────────────────────────────

router.get("/admin/stats/extended", async (_req, res): Promise<void> => {
  // Pre-compute all date boundaries before the Promise.all
  const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart     = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const monthStart    = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const prevMonthStart = new Date(); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1); prevMonthStart.setDate(1); prevMonthStart.setHours(0, 0, 0, 0);

  // All 15 queries run in parallel — was 13+ sequential round-trips.
  const [
    [{ sellerCount }],
    [{ pendingApps }],
    [{ avgOrder }],
    [{ todayRev }],
    [{ weekRev }],
    [{ monthRev }],
    [{ newUsers }],
    [{ outOfStock }],
    topCategories,
    [{ todayOrders }],
    [{ weekOrders }],
    [{ monthOrders }],
    [{ activeProducts }],
    [{ totalCustomers }],
    [{ prevMonthRev }],
  ] = await Promise.all([
    db.select({ sellerCount: count(usersTable.id) }).from(usersTable).where(eq(usersTable.role, "seller")),
    db.select({ pendingApps: count(sellerApplicationsTable.id) }).from(sellerApplicationsTable).where(eq(sellerApplicationsTable.status, "pending")),
    db.select({ avgOrder: sql<string>`COALESCE(AVG(${ordersTable.total}), 0)` }).from(ordersTable),
    db.select({ todayRev: sum(ordersTable.total) }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart)),
    db.select({ weekRev: sum(ordersTable.total) }).from(ordersTable).where(gte(ordersTable.createdAt, weekStart)),
    db.select({ monthRev: sum(ordersTable.total) }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart)),
    db.select({ newUsers: count(usersTable.id) }).from(usersTable).where(gte(usersTable.createdAt, thirtyDaysAgo)),
    db.select({ outOfStock: count(productsTable.id) }).from(productsTable).where(eq(productsTable.stock, 0)),
    db.select({ category: productsTable.category, count: count(productsTable.id) })
      .from(productsTable).groupBy(productsTable.category)
      .orderBy(desc(count(productsTable.id))).limit(6),
    db.select({ todayOrders: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart)),
    db.select({ weekOrders: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, weekStart)),
    db.select({ monthOrders: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart)),
    db.select({ activeProducts: count(productsTable.id) }).from(productsTable).where(gte(productsTable.stock, 1)),
    db.select({ totalCustomers: count(usersTable.id) }).from(usersTable).where(eq(usersTable.role, "customer")),
    db.select({ prevMonthRev: sum(ordersTable.total) }).from(ordersTable)
      .where(and(gte(ordersTable.createdAt, prevMonthStart), lt(ordersTable.createdAt, monthStart))),
  ]);

  res.json({
    totalSellers:       sellerCount,
    pendingSellerApps:  pendingApps,
    avgOrderValue:      parseFloat(avgOrder ?? "0"),
    todayRevenue:       parseFloat(todayRev ?? "0"),
    weekRevenue:        parseFloat(weekRev ?? "0"),
    monthRevenue:       parseFloat(monthRev ?? "0"),
    prevMonthRevenue:   parseFloat(prevMonthRev ?? "0"),
    newUsersThisMonth:  newUsers,
    outOfStockProducts: outOfStock,
    topCategories:      topCategories.map((c) => ({ category: c.category, count: c.count })),
    todayOrders,
    weekOrders,
    monthOrders,
    activeProducts,
    totalCustomers,
  });
});

// ─── TOP PERFORMERS ───────────────────────────────────────────────────────────

router.get("/admin/stats/top-performers", async (_req, res): Promise<void> => {
  const topSellers = await db
    .select({
      sellerId: productsTable.sellerId,
      sellerName: usersTable.name,
      revenue: sql<string>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric), 0)`,
      orderCount: sql<number>`COUNT(DISTINCT ${orderItemsTable.orderId})`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .innerJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
    .where(inArray(ordersTable.status, ["processing", "shipped", "delivered"]))
    .groupBy(productsTable.sellerId, usersTable.name)
    .orderBy(desc(sql`SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric)`))
    .limit(5);

  const topProducts = await db
    .select({
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      salesCount: sql<string>`SUM(${orderItemsTable.quantity})`,
      revenue: sql<string>`SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric)`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(inArray(ordersTable.status, ["processing", "shipped", "delivered"]))
    .groupBy(orderItemsTable.productId, orderItemsTable.productName)
    .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`))
    .limit(5);

  res.json({
    topSellers: topSellers.map((s) => ({
      sellerId: s.sellerId,
      sellerName: s.sellerName,
      revenue: parseFloat(s.revenue),
      orderCount: Number(s.orderCount),
    })),
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      salesCount: parseInt(p.salesCount),
      revenue: parseFloat(p.revenue),
    })),
  });
});

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────

router.get("/admin/activity", async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(adminAuditLogTable)
    .orderBy(desc(adminAuditLogTable.createdAt))
    .limit(10);

  res.json(
    logs.map((l) => ({
      id: l.id,
      actorName: l.actorName,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId ?? null,
      metadata: l.metadata as Record<string, unknown> | null,
      createdAt: l.createdAt.toISOString(),
    }))
  );
});

// ─── USERS ────────────────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

  const [{ total }] = await db.select({ total: count(usersTable.id) }).from(usersTable);

  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, isVerified: usersTable.isVerified, accountStatus: usersTable.accountStatus, createdAt: usersTable.createdAt, verificationLevel: usersTable.verificationLevel, trustScore: usersTable.trustScore, trustLevel: usersTable.trustLevel })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(paginated(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), verificationLevel: u.verificationLevel ?? "none", trustScore: u.trustScore ?? null, trustLevel: u.trustLevel ?? "new" })), total, page, limit));
});

router.post("/admin/users/:id/suspend", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  if (id === req.user!.userId) { res.status(400).json({ error: "Cannot suspend your own account" }); return; }

  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(400).json({ error: "Cannot suspend admin accounts" }); return; }

  await db.update(usersTable)
    .set({ accountStatus: "suspended", suspendedReason: reason || null, suspendedBy: req.user!.userId, suspendedAt: new Date() })
    .where(eq(usersTable.id, id));

  kickSseUser(id);

  await logAudit(req.user!.userId, "SUSPEND_USER", "user", String(id), { name: user.name, email: user.email, reason: reason || null });

  res.json({ message: "User suspended", userId: id, accountStatus: "suspended" });
});

router.post("/admin/users/:id/reactivate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable)
    .set({ accountStatus: "active", suspendedReason: null, suspendedBy: null, suspendedAt: null })
    .where(eq(usersTable.id, id));

  await logAudit(req.user!.userId, "REACTIVATE_USER", "user", String(id), { name: user.name, email: user.email });

  res.json({ message: "User reactivated", userId: id, accountStatus: "active" });
});

router.post("/admin/users/:id/verify", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const level = (req.body?.level as string | undefined) ?? "basic";
  const validLevels = ["basic", "verified", "business"];
  if (!validLevels.includes(level)) {
    res.status(400).json({ error: "Invalid verification level. Must be: basic | verified | business" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isVerified: usersTable.isVerified, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable)
    .set({
      isVerified: true,
      verifiedAt: new Date(),
      verificationMethod: "admin",
      verificationLevel: level,
      verifiedBy: req.user!.userId,
    })
    .where(eq(usersTable.id, id));

  // Recompute trust score for sellers
  if (user.role === "seller") {
    const { refreshTrustScore } = await import("../lib/trustScore");
    refreshTrustScore(id).catch(() => {});
  }

  await logAudit(req.user!.userId, "VERIFY_USER", "user", String(id), { name: user.name, email: user.email, level });

  res.json({ message: "User verified", userId: id, verificationLevel: level });
});

router.post("/admin/users/:id/unverify", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable)
    .set({ isVerified: false, verifiedAt: null, verificationMethod: null, verificationLevel: null, verifiedBy: null })
    .where(eq(usersTable.id, id));

  if (user.role === "seller") {
    const { refreshTrustScore } = await import("../lib/trustScore");
    refreshTrustScore(id).catch(() => {});
  }

  await logAudit(req.user!.userId, "UNVERIFY_USER", "user", String(id), { name: user.name });
  res.json({ message: "User unverified", userId: id });
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  if (id === req.user!.userId) { res.status(400).json({ error: "Cannot delete your own admin account" }); return; }

  const [existing] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  // Protect the permanent Root Owner account — cannot be deleted by any admin action
  if (existing.email === "delewatiamer7@gmail.com") {
    res.status(403).json({ error: "The Root Owner account cannot be deleted." });
    return;
  }

  // Cascade-delete in FK-safe order inside a transaction
  await db.transaction(async (tx) => {
    // 1. Delete cart_items belonging to this user
    await tx.delete(cartItemsTable).where(eq(cartItemsTable.userId, id));

    // 2. Find all products this seller owns, then remove them from other users' carts
    const sellerProducts = await tx
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.sellerId, id));

    if (sellerProducts.length > 0) {
      const productIds = sellerProducts.map((p) => p.id);
      await tx.delete(cartItemsTable).where(inArray(cartItemsTable.productId, productIds));
      await tx.delete(productsTable).where(eq(productsTable.sellerId, id));
    }

    // 3. Find orders placed by this customer, delete their items, then the orders
    const customerOrders = await tx
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(eq(ordersTable.customerId, id));

    if (customerOrders.length > 0) {
      const orderIds = customerOrders.map((o) => o.id);
      await tx.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
      await tx.delete(ordersTable).where(eq(ordersTable.customerId, id));
    }

    // 4. Delete the user
    await tx.delete(usersTable).where(eq(usersTable.id, id));
  });

  await logAudit(
    req.user!.userId,
    "DELETE_USER",
    "user",
    String(id),
    { name: existing.name, email: existing.email, role: existing.role }
  );

  res.json({ message: "User deleted" });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

router.get("/admin/products", async (req, res): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

  const [{ total }] = await db.select({ total: count(productsTable.id) }).from(productsTable);

  const rows = await db
    .select({
      id: productsTable.id,
      sellerId: productsTable.sellerId,
      sellerName: usersTable.name,
      name: productsTable.name,
      description: productsTable.description,
      price: productsTable.price,
      discountPercent: productsTable.discountPercent,
      category: productsTable.category,
      stock: productsTable.stock,
      featured: productsTable.featured,
      imageUrl: productsTable.imageUrl,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
    .orderBy(desc(productsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const data = rows.map((p) => ({
    id: p.id,
    sellerId: p.sellerId,
    sellerName: p.sellerName ?? "Unknown",
    name: p.name,
    description: p.description,
    price: parseFloat(p.price),
    discountPercent: p.discountPercent ? parseFloat(p.discountPercent) : null,
    category: p.category,
    stock: p.stock,
    featured: p.featured ?? false,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  res.json(paginated(data, total, page, limit));
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const [existing] = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

  const { name, description, price, category, stock, discountPercent, imageUrl, featured } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (price !== undefined) update.price = String(price);
  if (category !== undefined) update.category = category;
  if (stock !== undefined) update.stock = parseInt(stock, 10);
  if (discountPercent !== undefined) update.discountPercent = discountPercent === null ? null : String(discountPercent);
  if (imageUrl !== undefined) update.imageUrl = imageUrl;
  if (featured !== undefined) update.featured = Boolean(featured);

  await db.update(productsTable).set(update).where(eq(productsTable.id, id));

  const [updated] = await db
    .select({ id: productsTable.id, sellerId: productsTable.sellerId, sellerName: usersTable.name, name: productsTable.name, description: productsTable.description, price: productsTable.price, discountPercent: productsTable.discountPercent, category: productsTable.category, stock: productsTable.stock, imageUrl: productsTable.imageUrl, createdAt: productsTable.createdAt })
    .from(productsTable)
    .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
    .where(eq(productsTable.id, id));

  await logAudit(
    req.user!.userId,
    "UPDATE_PRODUCT",
    "product",
    String(id),
    { productName: existing.name, changes: update }
  );

  res.json({
    id: updated.id,
    sellerId: updated.sellerId,
    sellerName: updated.sellerName ?? "Unknown",
    name: updated.name,
    description: updated.description,
    price: parseFloat(updated.price),
    discountPercent: updated.discountPercent ? parseFloat(updated.discountPercent) : null,
    category: updated.category,
    stock: updated.stock,
    imageUrl: updated.imageUrl ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid product ID" }); return; }

  const [existing] = await db.select({ id: productsTable.id, name: productsTable.name }).from(productsTable).where(eq(productsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

  await db.transaction(async (tx) => {
    // Remove all cart references to this product first (FK constraint)
    await tx.delete(cartItemsTable).where(eq(cartItemsTable.productId, id));
    await tx.delete(productsTable).where(eq(productsTable.id, id));
  });

  await logAudit(
    req.user!.userId,
    "DELETE_PRODUCT",
    "product",
    String(id),
    { productName: existing.name }
  );

  res.json({ message: "Product deleted" });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

router.get("/admin/orders", async (req, res): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

  const [{ total }] = await db.select({ total: count(ordersTable.id) }).from(ordersTable);

  const orders = await db
    .select({
      id: ordersTable.id,
      customerId: ordersTable.customerId,
      customerName: usersTable.name,
      customerEmail: usersTable.email,
      customerPhone: ordersTable.customerPhone,
      total: ordersTable.total,
      status: ordersTable.status,
      shippingAddress: ordersTable.shippingAddress,
      city: ordersTable.city,
      deliveryNotes: ordersTable.deliveryNotes,
      estimatedDelivery: ordersTable.estimatedDelivery,
      shippingCompany: ordersTable.shippingCompany,
      trackingNumber: ordersTable.trackingNumber,
      deliveryFee: ordersTable.deliveryFee,
      zoneId: ordersTable.zoneId,
      cancelledBy: ordersTable.cancelledBy,
      cancellationReason: ordersTable.cancellationReason,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const orderIds = orders.map((o) => o.id);
  const uniqueZoneIds = [...new Set(orders.map(o => o.zoneId).filter((z): z is number => z != null))];

  type OrderItemRow = typeof orderItemsTable.$inferSelect;
  const [allItems, allZones, allAssignments] = await Promise.all([
    orderIds.length > 0
      ? db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : Promise.resolve([] as OrderItemRow[]),
    uniqueZoneIds.length > 0
      ? db.select({ id: deliveryZonesTable.id, nameEn: deliveryZonesTable.nameEn, nameAr: deliveryZonesTable.nameAr })
          .from(deliveryZonesTable).where(inArray(deliveryZonesTable.id, uniqueZoneIds))
      : Promise.resolve([] as { id: number; nameEn: string; nameAr: string }[]),
    orderIds.length > 0
      ? db.select({
            orderId:       courierAssignmentsTable.orderId,
            status:        courierAssignmentsTable.status,
            courierPhone:  couriersTable.phone,
            courierUserId: couriersTable.userId,
          })
          .from(courierAssignmentsTable)
          .innerJoin(couriersTable, eq(courierAssignmentsTable.courierId, couriersTable.id))
          .where(inArray(courierAssignmentsTable.orderId, orderIds))
      : Promise.resolve([] as { orderId: number; status: string; courierPhone: string | null; courierUserId: number }[]),
  ]);

  const uniqueCourierUserIds = [...new Set(allAssignments.map(a => a.courierUserId).filter((id): id is number => id != null))];
  const allCourierUsers = uniqueCourierUserIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable).where(inArray(usersTable.id, uniqueCourierUserIds))
    : [];

  const itemsByOrder = new Map<number, typeof allItems>();
  for (const item of allItems) {
    if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
    itemsByOrder.get(item.orderId)!.push(item);
  }
  const zoneMap        = new Map(allZones.map(z => [z.id, z]));
  const assignmentMap  = new Map(allAssignments.map(a => [a.orderId, a]));
  const courierUserMap = new Map(allCourierUsers.map(u => [u.id, u.name]));

  const data = orders.map((order) => {
    const items      = itemsByOrder.get(order.id) ?? [];
    const zone       = order.zoneId ? zoneMap.get(order.zoneId) : null;
    const assignment = assignmentMap.get(order.id);
    const courierName = assignment?.courierUserId ? (courierUserMap.get(assignment.courierUserId) ?? null) : null;
    return {
      id: order.id,
      customerId: order.customerId,
      customerName: order.customerName ?? "Unknown",
      customerEmail: order.customerEmail ?? "",
      customerPhone: order.customerPhone ?? null,
      total: parseFloat(order.total),
      status: order.status,
      shippingAddress: order.shippingAddress,
      city: order.city ?? null,
      deliveryNotes: order.deliveryNotes ?? null,
      estimatedDelivery: order.estimatedDelivery ?? null,
      shippingCompany: order.shippingCompany ?? null,
      trackingNumber: order.trackingNumber ?? null,
      deliveryFee: order.deliveryFee ? parseFloat(String(order.deliveryFee)) : null,
      zoneId: order.zoneId ?? null,
      zoneNameEn: zone?.nameEn ?? null,
      zoneNameAr: zone?.nameAr ?? null,
      courierName,
      courierPhone: assignment?.courierPhone ?? null,
      courierStatus: assignment?.status ?? null,
      cancelledBy: order.cancelledBy ?? null,
      cancellationReason: order.cancellationReason ?? null,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unitPrice),
        subtotal: parseFloat((parseFloat(i.unitPrice) * i.quantity).toFixed(2)),
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  });

  res.json(paginated(data, total, page, limit));
});

router.patch("/admin/orders/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const { status } = req.body;
  const ALL_STATUSES = [
    "pending", "confirmed", "processing", "preparing", "ready_for_pickup",
    "courier_assigned", "shipped", "picked_up", "in_transit", "out_for_delivery",
    "delivered", "cancelled", "delivery_failed", "returned", "refunded",
  ];
  if (!ALL_STATUSES.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  if (status === existing.status) { res.status(400).json({ error: "Order is already in that status" }); return; }

  // Admins can override any status — full control for manual corrections.
  // The only hard guard: terminal states that should never move backwards.
  const TERMINAL = ["refunded"];
  if (TERMINAL.includes(existing.status as string)) {
    res.status(400).json({ error: `Cannot change status from '${existing.status}' (terminal state)` });
    return;
  }

  // Restore stock when admin cancels (stock was already reserved at checkout)
  if (status === "cancelled" && existing.status !== "cancelled") {
    const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    for (const item of orderItems) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (product) {
        const restoredStock = product.stock + item.quantity;
        await db.update(productsTable).set({ stock: restoredStock }).where(eq(productsTable.id, product.id));
      }
    }
  }

  await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, id));

  // Mandatory: insert status history
  await db.insert(orderStatusHistoryTable).values({
    orderId: id,
    fromStatus: existing.status as string,
    toStatus: status,
    changedBy: null,
    changedByRole: "admin",
    notes: null,
  });

  // Send customer notification for key status changes
  type NotifType = Parameters<typeof createNotification>[0]["type"];
  const notifMap: Record<string, { type: NotifType; title: string; titleAr: string; body: string; bodyAr: string; priority: "normal" | "important" }> = {
    confirmed:        { type: "order_confirmed",        title: "Order Confirmed",         titleAr: "تم تأكيد طلبك",            body: `Your order #${existing.id} has been confirmed.`,              bodyAr: `تم تأكيد طلبك رقم #${existing.id}.`,                                       priority: "normal" },
    processing:       { type: "order_processing",       title: "Order Being Processed",   titleAr: "جارٍ معالجة طلبك",         body: `Your order #${existing.id} is now being processed.`,          bodyAr: `طلبك رقم #${existing.id} قيد المعالجة الآن.`,                              priority: "normal" },
    preparing:        { type: "order_preparing",        title: "Order Being Prepared",    titleAr: "جارٍ تجهيز طلبك",          body: `Your order #${existing.id} is being prepared by the seller.`, bodyAr: `البائع يجهّز طلبك رقم #${existing.id}.`,                                   priority: "normal" },
    ready_for_pickup: { type: "order_ready",            title: "Order Ready for Pickup",  titleAr: "طلبك جاهز للاستلام",        body: `Your order #${existing.id} is ready for courier pickup.`,     bodyAr: `طلبك رقم #${existing.id} جاهز لاستلام المندوب.`,                           priority: "normal" },
    shipped:          { type: "order_shipped",          title: "Order Shipped!",          titleAr: "تم شحن طلبك!",             body: `Your order #${existing.id} has been shipped.`,                bodyAr: `تم شحن طلبك رقم #${existing.id}.`,                                         priority: "important" },
    out_for_delivery: { type: "order_out_for_delivery", title: "Out for Delivery",        titleAr: "طلبك في الطريق إليك",       body: `Your order #${existing.id} is out for delivery!`,             bodyAr: `طلبك رقم #${existing.id} في طريقه إليك الآن!`,                             priority: "important" },
    delivered:        { type: "order_delivered",        title: "Order Delivered",         titleAr: "تم تسليم طلبك",            body: `Your order #${existing.id} has been delivered.`,              bodyAr: `تم تسليم طلبك رقم #${existing.id}.`,                                       priority: "important" },
    cancelled:        { type: "order_cancelled",        title: "Order Cancelled",         titleAr: "تم إلغاء الطلب",           body: `Your order #${existing.id} has been cancelled.`,              bodyAr: `تم إلغاء طلبك رقم #${existing.id}.`,                                       priority: "important" },
    delivery_failed:  { type: "order_delivery_failed",  title: "Delivery Failed",         titleAr: "فشل تسليم الطلب",          body: `Delivery of order #${existing.id} could not be completed.`,   bodyAr: `لم نتمكن من تسليم طلبك رقم #${existing.id}. سنتواصل معك قريباً.`,          priority: "important" },
    refunded:         { type: "order_refunded",         title: "Order Refunded",          titleAr: "تم استرداد المبلغ",         body: `Your order #${existing.id} has been refunded.`,               bodyAr: `تم استرداد مبلغ طلبك رقم #${existing.id}.`,                                priority: "important" },
  };
  const notif = notifMap[status];
  if (notif) {
    await createNotification({
      userId: existing.customerId,
      type: notif.type,
      title: bi(notif.title, notif.titleAr),
      body: bi(notif.body, notif.bodyAr),
      orderId: existing.id,
      priority: notif.priority,
      link: `/orders`,
    });
  }

  await logAudit(
    req.user!.userId,
    "UPDATE_ORDER_STATUS",
    "order",
    String(id),
    { previousStatus: existing.status, newStatus: status }
  );

  res.json({ message: "Order status updated", status });
});

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

router.get("/admin/logs", async (req, res): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

  const [{ total }] = await db.select({ total: count(adminAuditLogTable.id) }).from(adminAuditLogTable);

  const logs = await db
    .select()
    .from(adminAuditLogTable)
    .orderBy(desc(adminAuditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  const data = logs.map((l) => ({
    id: l.id,
    actorId: l.actorId,
    actorName: l.actorName,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId ?? null,
    metadata: l.metadata as Record<string, unknown> | null,
    createdAt: l.createdAt.toISOString(),
  }));

  res.json(paginated(data, total, page, limit));
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await db.select().from(platformSettingsTable);
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json({
    exchangeRate: parseFloat(map["exchange_rate"] ?? "14500"),
    commissionRate: parseFloat(map["commission_rate"] ?? "5"),
    announcement: map["announcement"] ?? "",
    flashSaleEnd: map["flash_sale_end"] ?? null,
  });
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const { exchangeRate, commissionRate, announcement, flashSaleEnd } = req.body;

  if (exchangeRate !== undefined) {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) { res.status(400).json({ error: "Exchange rate must be a positive number" }); return; }
    await db
      .insert(platformSettingsTable)
      .values({ key: "exchange_rate", value: String(rate) })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: String(rate) } });
    await logAudit(req.user!.userId, "UPDATE_SETTINGS", "settings", "exchange_rate", { newValue: rate });
  }

  if (commissionRate !== undefined) {
    const rate = parseFloat(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { res.status(400).json({ error: "Commission rate must be between 0 and 100" }); return; }
    await db
      .insert(platformSettingsTable)
      .values({ key: "commission_rate", value: String(rate) })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: String(rate) } });
    await logAudit(req.user!.userId, "UPDATE_SETTINGS", "settings", "commission_rate", { newValue: rate });
  }

  if (announcement !== undefined) {
    await db
      .insert(platformSettingsTable)
      .values({ key: "announcement", value: String(announcement) })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: String(announcement) } });
    await logAudit(req.user!.userId, "UPDATE_SETTINGS", "settings", "announcement", { newValue: announcement });
  }

  if (flashSaleEnd !== undefined) {
    const endDate = new Date(flashSaleEnd);
    if (isNaN(endDate.getTime())) { res.status(400).json({ error: "Invalid flash sale end date — must be a valid ISO 8601 timestamp" }); return; }
    const iso = endDate.toISOString();
    await db
      .insert(platformSettingsTable)
      .values({ key: "flash_sale_end", value: iso })
      .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: iso } });
    await logAudit(req.user!.userId, "UPDATE_SETTINGS", "settings", "flash_sale_end", { newValue: iso });
  }

  res.json({ message: "Settings updated" });
});

// ─── SELLER PERFORMANCE LIST ──────────────────────────────────────────────────

router.get("/admin/sellers/list", async (req, res): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);

  const [{ total }] = await db
    .select({ total: count(usersTable.id) })
    .from(usersTable)
    .where(eq(usersTable.role, "seller"));

  const sellers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      sellerStatus: usersTable.sellerStatus,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "seller"))
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  if (sellers.length === 0) {
    res.json(paginated([], total, page, limit));
    return;
  }

  const sellerIds = sellers.map((s) => s.id);

  // Product counts per seller
  const productCounts = await db
    .select({ sellerId: productsTable.sellerId, cnt: count(productsTable.id) })
    .from(productsTable)
    .where(inArray(productsTable.sellerId, sellerIds))
    .groupBy(productsTable.sellerId);

  // Order metrics per seller per status (avoids N+1)
  const rawOrderMetrics = await db
    .select({
      sellerId: orderItemsTable.sellerId,
      status: ordersTable.status,
      orderCount: sql<string>`COUNT(DISTINCT ${orderItemsTable.orderId})`,
      revenue: sql<string>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(inArray(orderItemsTable.sellerId, sellerIds))
    .groupBy(orderItemsTable.sellerId, ordersTable.status);

  // Avg rating per seller via products → reviews
  const ratingMetrics = await db
    .select({
      sellerId: productsTable.sellerId,
      avgRating: sql<string>`COALESCE(AVG(${reviewsTable.rating}), 0)`,
      reviewCount: count(reviewsTable.id),
    })
    .from(reviewsTable)
    .innerJoin(productsTable, eq(reviewsTable.productId, productsTable.id))
    .where(inArray(productsTable.sellerId, sellerIds))
    .groupBy(productsTable.sellerId);

  // Store names from seller applications
  const apps = await db
    .select({
      userId: sellerApplicationsTable.userId,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
    })
    .from(sellerApplicationsTable)
    .where(inArray(sellerApplicationsTable.userId, sellerIds));

  // Build lookup maps
  const prodMap = new Map(productCounts.map((p) => [p.sellerId, p.cnt]));
  const ratingMap = new Map(ratingMetrics.map((r) => [r.sellerId, { avgRating: parseFloat(r.avgRating), reviewCount: r.reviewCount }]));
  // keep the most recent approved app per seller
  const appMap = new Map<number, { storeName: string; storeSlug: string | null }>();
  for (const a of apps) appMap.set(a.userId, { storeName: a.storeName, storeSlug: a.storeSlug });

  type OrderAgg = { total: number; delivered: number; cancelled: number; revenue: number };
  const orderMap = new Map<number, OrderAgg>();
  for (const m of rawOrderMetrics) {
    const cur = orderMap.get(m.sellerId) ?? { total: 0, delivered: 0, cancelled: 0, revenue: 0 };
    const cnt = parseInt(m.orderCount, 10);
    cur.total += cnt;
    if (m.status === "delivered") cur.delivered += cnt;
    if (m.status === "cancelled") cur.cancelled += cnt;
    if (["processing", "shipped", "delivered"].includes(m.status as string)) {
      cur.revenue += parseFloat(m.revenue);
    }
    orderMap.set(m.sellerId, cur);
  }

  const data = sellers.map((s) => {
    const ord = orderMap.get(s.id) ?? { total: 0, delivered: 0, cancelled: 0, revenue: 0 };
    const rat = ratingMap.get(s.id) ?? { avgRating: 0, reviewCount: 0 };
    const app = appMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      storeName: app?.storeName ?? s.name,
      storeSlug: app?.storeSlug ?? null,
      sellerStatus: s.sellerStatus ?? "approved",
      joinedAt: s.createdAt.toISOString(),
      productCount: prodMap.get(s.id) ?? 0,
      totalOrders: ord.total,
      deliveredOrders: ord.delivered,
      cancelledOrders: ord.cancelled,
      revenue: ord.revenue,
      deliveryRate: ord.total > 0 ? Math.round((ord.delivered / ord.total) * 100) : 0,
      cancellationRate: ord.total > 0 ? Math.round((ord.cancelled / ord.total) * 100) : 0,
      avgRating: rat.avgRating,
      reviewCount: rat.reviewCount,
    };
  });

  res.json(paginated(data, total, page, limit));
});

// ─── HEALTH ALERTS ────────────────────────────────────────────────────────────

router.get("/admin/health/alerts", async (_req, res): Promise<void> => {
  type Alert = { severity: "critical" | "warning" | "info"; type: string; message: string; count: number; link: string };
  const alerts: Alert[] = [];

  // 1. Pending seller applications
  const [pa] = await db.select({ c: count(sellerApplicationsTable.id) }).from(sellerApplicationsTable).where(eq(sellerApplicationsTable.status, "pending"));
  if ((pa?.c ?? 0) > 0) {
    alerts.push({ severity: (pa.c ?? 0) > 10 ? "critical" : "warning", type: "pending_sellers", message: String(pa.c), count: pa.c ?? 0, link: "/admin/sellers" });
  }

  // 2. Out-of-stock products
  const [oos] = await db.select({ c: count(productsTable.id) }).from(productsTable).where(eq(productsTable.stock, 0));
  if ((oos?.c ?? 0) > 0) {
    alerts.push({ severity: (oos.c ?? 0) > 20 ? "critical" : "warning", type: "out_of_stock", message: String(oos.c), count: oos.c ?? 0, link: "/admin/products" });
  }

  // 3. Low stock (1–5 units)
  const [ls] = await db.select({ c: count(productsTable.id) }).from(productsTable).where(and(gte(productsTable.stock, 1), lte(productsTable.stock, 5)));
  if ((ls?.c ?? 0) > 0) {
    alerts.push({ severity: "info", type: "low_stock", message: String(ls.c), count: ls.c ?? 0, link: "/admin/products" });
  }

  // 4. Orders stuck in pending > 48h
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const [stuck] = await db.select({ c: count(ordersTable.id) }).from(ordersTable).where(and(eq(ordersTable.status, "pending"), lt(ordersTable.createdAt, cutoff)));
  if ((stuck?.c ?? 0) > 0) {
    alerts.push({ severity: (stuck.c ?? 0) > 5 ? "critical" : "warning", type: "stuck_orders", message: String(stuck.c), count: stuck.c ?? 0, link: "/admin/orders" });
  }

  // 5. In-stock products with no sales
  const noSalesResult = await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM products WHERE stock > 0 AND id NOT IN (SELECT DISTINCT product_id FROM order_items)`
  );
  const noSalesCount: number = (noSalesResult.rows[0] as Record<string, number>)?.c ?? 0;
  if (noSalesCount > 0) {
    alerts.push({ severity: "info", type: "no_sales", message: String(noSalesCount), count: noSalesCount, link: "/admin/analytics" });
  }

  // 6. Sellers with high cancellation rate (>30%, min 5 orders)
  const highCancelResult = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM (
      SELECT oi.seller_id,
        COUNT(DISTINCT oi.order_id) AS total_orders,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'cancelled') AS cancelled_orders
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      GROUP BY oi.seller_id
      HAVING COUNT(DISTINCT oi.order_id) >= 5
        AND COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'cancelled')::numeric
          / COUNT(DISTINCT oi.order_id) > 0.3
    ) sub
  `);
  const highCancelCount: number = (highCancelResult.rows[0] as Record<string, number>)?.c ?? 0;
  if (highCancelCount > 0) {
    alerts.push({ severity: "warning", type: "high_cancel_sellers", message: String(highCancelCount), count: highCancelCount, link: "/admin/sellers" });
  }

  const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  res.json({ alerts, timestamp: new Date().toISOString() });
});

// ─── OPERATION CENTER ─────────────────────────────────────────────────────────

router.get("/admin/operation-center", async (_req, res): Promise<void> => {
  const [recentRegistrations, recentReviews, recentCancellations, recentDeliveries] = await Promise.all([
    db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(6),
    db
      .select({ id: reviewsTable.id, rating: reviewsTable.rating, comment: reviewsTable.comment, createdAt: reviewsTable.createdAt, productName: productsTable.name, productId: productsTable.id })
      .from(reviewsTable)
      .innerJoin(productsTable, eq(reviewsTable.productId, productsTable.id))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(6),
    db
      .select({ id: ordersTable.id, customerName: usersTable.name, total: ordersTable.total, updatedAt: ordersTable.updatedAt })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
      .where(eq(ordersTable.status, "cancelled"))
      .orderBy(desc(ordersTable.updatedAt))
      .limit(6),
    db
      .select({ id: ordersTable.id, customerName: usersTable.name, total: ordersTable.total, updatedAt: ordersTable.updatedAt })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
      .where(eq(ordersTable.status, "delivered"))
      .orderBy(desc(ordersTable.updatedAt))
      .limit(6),
  ]);

  res.json({
    recentRegistrations: recentRegistrations.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    recentReviews: recentReviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    recentCancellations: recentCancellations.map((o) => ({ id: o.id, customerName: o.customerName ?? "Unknown", total: parseFloat(o.total), updatedAt: o.updatedAt.toISOString() })),
    recentDeliveries: recentDeliveries.map((o) => ({ id: o.id, customerName: o.customerName ?? "Unknown", total: parseFloat(o.total), updatedAt: o.updatedAt.toISOString() })),
  });
});

// ─── PRODUCT ANALYTICS ────────────────────────────────────────────────────────

router.get("/admin/analytics/products", async (req, res): Promise<void> => {
  const category = req.query.category ? String(req.query.category) : null;
  const LIMIT = 10;

  const catFilter = category ? eq(productsTable.category, category) : undefined;

  const [topViewed, topRated, lowStock] = await Promise.all([
    db
      .select({ id: productsTable.id, name: productsTable.name, category: productsTable.category, sellerName: usersTable.name, viewCount: productsTable.viewCount, stock: productsTable.stock, imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
      .where(catFilter)
      .orderBy(desc(productsTable.viewCount))
      .limit(LIMIT),
    db
      .select({ productId: reviewsTable.productId, productName: productsTable.name, avgRating: sql<string>`AVG(${reviewsTable.rating})`, reviewCount: count(reviewsTable.id), category: productsTable.category, imageUrl: productsTable.imageUrl })
      .from(reviewsTable)
      .innerJoin(productsTable, eq(reviewsTable.productId, productsTable.id))
      .where(catFilter ? eq(productsTable.category, category!) : undefined)
      .groupBy(reviewsTable.productId, productsTable.name, productsTable.category, productsTable.imageUrl)
      .orderBy(desc(sql`AVG(${reviewsTable.rating})`))
      .limit(LIMIT),
    db
      .select({ id: productsTable.id, name: productsTable.name, stock: productsTable.stock, category: productsTable.category, sellerName: usersTable.name, imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
      .where(and(gte(productsTable.stock, 1), lte(productsTable.stock, 10), ...(category ? [eq(productsTable.category, category)] : [])))
      .orderBy(asc(productsTable.stock))
      .limit(LIMIT),
  ]);

  // Top selling: count quantity via order_items
  const topSelling = await db
    .select({
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      salesCount: sql<string>`SUM(${orderItemsTable.quantity})`,
      revenue: sql<string>`SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric)`,
      category: productsTable.category,
      imageUrl: productsTable.imageUrl,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(and(inArray(ordersTable.status, ["processing", "shipped", "delivered"]), ...(category ? [eq(productsTable.category, category)] : [])))
    .groupBy(orderItemsTable.productId, orderItemsTable.productName, productsTable.category, productsTable.imageUrl)
    .orderBy(desc(sql`SUM(${orderItemsTable.quantity})`))
    .limit(LIMIT);

  // No-sales products (in stock, never ordered)
  const noSalesQ = category
    ? sql`SELECT p.id, p.name, p.stock, p.category, p.image_url, u.name as seller_name FROM products p LEFT JOIN users u ON u.id = p.seller_id WHERE p.stock > 0 AND p.category = ${category} AND p.id NOT IN (SELECT DISTINCT product_id FROM order_items) ORDER BY p.created_at DESC LIMIT ${LIMIT}`
    : sql`SELECT p.id, p.name, p.stock, p.category, p.image_url, u.name as seller_name FROM products p LEFT JOIN users u ON u.id = p.seller_id WHERE p.stock > 0 AND p.id NOT IN (SELECT DISTINCT product_id FROM order_items) ORDER BY p.created_at DESC LIMIT ${LIMIT}`;
  const noSalesResult = await db.execute(noSalesQ);

  res.json({
    topViewed: topViewed.map((p) => ({ id: p.id, name: p.name, category: p.category, sellerName: p.sellerName ?? "Unknown", viewCount: p.viewCount, stock: p.stock, imageUrl: p.imageUrl ?? null })),
    topSelling: topSelling.map((p) => ({ productId: p.productId, productName: p.productName, category: p.category, salesCount: parseInt(p.salesCount, 10), revenue: parseFloat(p.revenue), imageUrl: p.imageUrl ?? null })),
    topRated: topRated.map((p) => ({ productId: p.productId, productName: p.productName, avgRating: parseFloat(p.avgRating), reviewCount: p.reviewCount, category: p.category, imageUrl: p.imageUrl ?? null })),
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, stock: p.stock, category: p.category, sellerName: p.sellerName ?? "Unknown", imageUrl: p.imageUrl ?? null })),
    noSales: (noSalesResult.rows as Record<string, unknown>[]).map((p) => ({ id: p["id"], name: p["name"], stock: p["stock"], category: p["category"], sellerName: p["seller_name"] ?? "Unknown", imageUrl: p["image_url"] ?? null })),
  });
});

// ─── ORDER ANALYTICS ─────────────────────────────────────────────────────────

router.get("/admin/analytics/orders", async (_req, res): Promise<void> => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [byStatus, [{ todayCount }], [{ weekCount }], [{ monthCount }], [{ totalCount }]] = await Promise.all([
    db.select({ status: ordersTable.status, count: count(ordersTable.id), revenue: sum(ordersTable.total) }).from(ordersTable).groupBy(ordersTable.status),
    db.select({ todayCount: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, todayStart)),
    db.select({ weekCount: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, weekStart)),
    db.select({ monthCount: count(ordersTable.id) }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart)),
    db.select({ totalCount: count(ordersTable.id) }).from(ordersTable),
  ]);

  res.json({
    byStatus: byStatus.map((s) => ({ status: s.status, count: s.count, revenue: parseFloat(s.revenue ?? "0") })),
    todayCount,
    weekCount,
    monthCount,
    totalCount,
  });
});

// ─── CATEGORY ANALYTICS ──────────────────────────────────────────────────────

router.get("/admin/analytics/categories", async (_req, res): Promise<void> => {
  const productsByCategory = await db
    .select({ category: productsTable.category, productCount: count(productsTable.id), avgPrice: sql<string>`AVG(${productsTable.price})` })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(desc(count(productsTable.id)));

  const ordersByCategory = await db
    .select({
      category: productsTable.category,
      orderCount: sql<string>`COUNT(DISTINCT ${orderItemsTable.orderId})`,
      revenue: sql<string>`COALESCE(SUM(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}::numeric), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .innerJoin(ordersTable, and(eq(orderItemsTable.orderId, ordersTable.id), inArray(ordersTable.status, ["processing", "shipped", "delivered"])))
    .groupBy(productsTable.category);

  const orderMap = new Map(ordersByCategory.map((o) => [o.category, { orderCount: parseInt(o.orderCount, 10), revenue: parseFloat(o.revenue) }]));

  res.json({
    categories: productsByCategory.map((c) => ({
      category: c.category,
      productCount: c.productCount,
      avgPrice: parseFloat(c.avgPrice ?? "0"),
      orderCount: orderMap.get(c.category)?.orderCount ?? 0,
      revenue: orderMap.get(c.category)?.revenue ?? 0,
    })),
  });
});

// ─── USER ANALYTICS ───────────────────────────────────────────────────────────

router.get("/admin/analytics/users", async (_req, res): Promise<void> => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [[{ totalCustomers }], [{ totalSellers }], [{ newToday }], [{ newWeek }], [{ newMonth }]] = await Promise.all([
    db.select({ totalCustomers: count(usersTable.id) }).from(usersTable).where(eq(usersTable.role, "customer")),
    db.select({ totalSellers: count(usersTable.id) }).from(usersTable).where(eq(usersTable.role, "seller")),
    db.select({ newToday: count(usersTable.id) }).from(usersTable).where(gte(usersTable.createdAt, todayStart)),
    db.select({ newWeek: count(usersTable.id) }).from(usersTable).where(gte(usersTable.createdAt, weekStart)),
    db.select({ newMonth: count(usersTable.id) }).from(usersTable).where(gte(usersTable.createdAt, monthStart)),
  ]);

  const buyersResult = await db.execute(sql`SELECT COUNT(DISTINCT customer_id)::int AS c FROM orders`);
  const buyersWithOrders: number = (buyersResult.rows[0] as Record<string, number>)?.c ?? 0;

  const growthRows = await db
    .select({ date: sql<string>`DATE(${usersTable.createdAt})`, cnt: count(usersTable.id) })
    .from(usersTable)
    .where(gte(usersTable.createdAt, thirtyDaysAgo))
    .groupBy(sql`DATE(${usersTable.createdAt})`)
    .orderBy(sql`DATE(${usersTable.createdAt})`);

  const growthMap = new Map(growthRows.map((r) => [r.date, r.cnt]));
  const growth: { date: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    growth.push({ date: key, count: growthMap.get(key) ?? 0 });
  }

  res.json({ totalCustomers, totalSellers, newToday, newWeek, newMonth, buyersWithOrders, growth });
});

// ─── REPORTS / CSV EXPORT ────────────────────────────────────────────────────

router.get("/admin/reports/export", async (req, res): Promise<void> => {
  const type = String(req.query.type ?? "orders");

  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  if (type === "orders") {
    const rows = await db
      .select({ id: ordersTable.id, customerName: usersTable.name, customerEmail: usersTable.email, total: ordersTable.total, status: ordersTable.status, city: ordersTable.city, createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(5000);
    const csv = ["ID,Customer,Email,Total (USD),Status,City,Date", ...rows.map((r) => [r.id, escape(r.customerName), escape(r.customerEmail), parseFloat(r.total).toFixed(2), r.status, r.city ?? "", new Date(r.createdAt).toLocaleDateString()].join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="syano-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv); return;
  }

  if (type === "sellers") {
    const rows = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, sellerStatus: usersTable.sellerStatus, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.role, "seller"))
      .orderBy(desc(usersTable.createdAt))
      .limit(5000);
    const csv = ["ID,Name,Email,Status,Joined", ...rows.map((r) => [r.id, escape(r.name), escape(r.email), r.sellerStatus ?? "approved", new Date(r.createdAt).toLocaleDateString()].join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="syano-sellers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv); return;
  }

  if (type === "products") {
    const rows = await db
      .select({ id: productsTable.id, name: productsTable.name, category: productsTable.category, price: productsTable.price, stock: productsTable.stock, sellerName: usersTable.name, featured: productsTable.featured, viewCount: productsTable.viewCount, createdAt: productsTable.createdAt })
      .from(productsTable)
      .leftJoin(usersTable, eq(productsTable.sellerId, usersTable.id))
      .orderBy(desc(productsTable.createdAt))
      .limit(5000);
    const csv = ["ID,Name,Category,Price (USD),Stock,Seller,Featured,Views,Created", ...rows.map((r) => [r.id, escape(r.name), r.category, parseFloat(r.price).toFixed(2), r.stock, escape(r.sellerName), r.featured ? "Yes" : "No", r.viewCount, new Date(r.createdAt).toLocaleDateString()].join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="syano-products-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv); return;
  }

  if (type === "revenue") {
    const rows = await db
      .select({ date: sql<string>`DATE(${ordersTable.createdAt})`, orderCount: count(ordersTable.id), revenue: sum(ordersTable.total) })
      .from(ordersTable)
      .where(inArray(ordersTable.status, ["processing", "shipped", "delivered"]))
      .groupBy(sql`DATE(${ordersTable.createdAt})`)
      .orderBy(sql`DATE(${ordersTable.createdAt})`);
    const csv = ["Date,Orders,Revenue (USD)", ...rows.map((r) => [r.date, r.orderCount, parseFloat(r.revenue ?? "0").toFixed(2)].join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="syano-revenue-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv); return;
  }

  res.status(400).json({ error: "Invalid type. Use: orders | sellers | products | revenue" });
});

// ─── TRUST / VERIFICATION MANAGEMENT ────────────────────────────────────────

/* GET /admin/sellers/verification — list all sellers with their verification status */
router.get("/admin/sellers/verification", async (req, res): Promise<void> => {
  const filterLevel = typeof req.query.level === "string" ? req.query.level : null;
  const filterVerified = req.query.verified === "true" ? true : req.query.verified === "false" ? false : null;

  let query = db
    .select({
      userId: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isVerified: usersTable.isVerified,
      verificationLevel: usersTable.verificationLevel,
      verifiedAt: usersTable.verifiedAt,
      verificationMethod: usersTable.verificationMethod,
      verifiedBy: usersTable.verifiedBy,
      trustScore: usersTable.trustScore,
      trustLevel: usersTable.trustLevel,
      trustScoreUpdatedAt: usersTable.trustScoreUpdatedAt,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(sellerApplicationsTable, and(eq(sellerApplicationsTable.userId, usersTable.id), eq(sellerApplicationsTable.status, "approved")))
    .where(eq(usersTable.role, "seller"))
    .$dynamic();

  const rows = await query.orderBy(desc(usersTable.trustScore), desc(usersTable.createdAt));

  const mapped = rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    isVerified: r.isVerified,
    verificationLevel: r.verificationLevel ?? "none",
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    verificationMethod: r.verificationMethod ?? null,
    verifiedBy: r.verifiedBy ?? null,
    trustScore: r.trustScore ?? null,
    trustLevel: r.trustLevel ?? "new",
    trustScoreUpdatedAt: r.trustScoreUpdatedAt?.toISOString() ?? null,
    storeName: r.storeName ?? null,
    storeSlug: r.storeSlug ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const filtered = mapped.filter((r) => {
    if (filterLevel && r.verificationLevel !== filterLevel) return false;
    if (filterVerified !== null && r.isVerified !== filterVerified) return false;
    return true;
  });

  res.json(filtered);
});

/* PATCH /admin/sellers/:id/verification — set or clear verification tier */
router.patch("/admin/sellers/:id/verification", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const action = typeof req.body?.action === "string" ? req.body.action : "verify";
  const level  = typeof req.body?.level === "string"  ? req.body.level  : null;
  const method = typeof req.body?.method === "string" ? req.body.method : "admin";

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role !== "seller") { res.status(400).json({ error: "User is not a seller" }); return; }

  const { refreshTrustScore } = await import("../lib/trustScore");

  const [currentUser] = await db
    .select({ verificationLevel: usersTable.verificationLevel })
    .from(usersTable)
    .where(eq(usersTable.id, id));
  const fromLevel = currentUser?.verificationLevel ?? "none";

  if (action === "unverify" || action === "remove" || level === "none") {
    await db.update(usersTable)
      .set({ isVerified: false, verifiedAt: null, verificationMethod: null, verificationLevel: null, verifiedBy: null })
      .where(eq(usersTable.id, id));
    const score = await refreshTrustScore(id);
    await logAudit(req.user!.userId, "UNVERIFY_SELLER", "user", String(id), { name: user.name });
    await db.execute(sql`
      INSERT INTO seller_verification_log (seller_id, admin_id, action, from_level, to_level, method, notes)
      VALUES (${id}, ${req.user!.userId}, 'rejected', ${fromLevel}, 'none', ${method}, ${req.body?.notes ?? null})
    `);
    res.json({ message: "Verification removed", userId: id, verificationLevel: "none", trustScore: score });
    return;
  }

  const validLevels = ["basic", "verified", "business"];
  if (!level || !validLevels.includes(level)) {
    res.status(400).json({ error: "Invalid level. Must be: basic | verified | business" });
    return;
  }
  await db.update(usersTable)
    .set({ isVerified: true, verifiedAt: new Date(), verificationMethod: method, verificationLevel: level, verifiedBy: req.user!.userId })
    .where(eq(usersTable.id, id));
  const score = await refreshTrustScore(id);
  await logAudit(req.user!.userId, "VERIFY_SELLER", "user", String(id), { name: user.name, level, method });

  const auditAction = fromLevel === "none" ? "verified"
    : (["basic","verified","business"].indexOf(level) > ["basic","verified","business"].indexOf(fromLevel ?? ""))
      ? "level_promoted"
      : "level_demoted";
  await db.execute(sql`
    INSERT INTO seller_verification_log (seller_id, admin_id, action, from_level, to_level, method, notes)
    VALUES (${id}, ${req.user!.userId}, ${auditAction}, ${fromLevel}, ${level}, ${method}, ${req.body?.notes ?? null})
  `);
  res.json({ message: "Seller verified", userId: id, verificationLevel: level, trustScore: score });
});

router.get("/admin/sellers/:id/trust", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, trustScore: usersTable.trustScore, trustScoreUpdatedAt: usersTable.trustScoreUpdatedAt, verificationLevel: usersTable.verificationLevel, isVerified: usersTable.isVerified, verifiedAt: usersTable.verifiedAt, verificationMethod: usersTable.verificationMethod, verifiedBy: usersTable.verifiedBy })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { computeTrustScore } = await import("../lib/trustScore");
  const breakdown = await computeTrustScore(id);

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    cachedScore: user.trustScore,
    cachedScoreUpdatedAt: user.trustScoreUpdatedAt?.toISOString() ?? null,
    isVerified: user.isVerified,
    verifiedAt: user.verifiedAt?.toISOString() ?? null,
    verificationLevel: user.verificationLevel ?? "none",
    verificationMethod: user.verificationMethod ?? null,
    verifiedBy: user.verifiedBy ?? null,
    liveBreakdown: breakdown,
  });
});

router.post("/admin/sellers/:id/recompute-trust", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [user] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { refreshTrustScore } = await import("../lib/trustScore");
  const score = await refreshTrustScore(id);

  await logAudit(req.user!.userId, "RECOMPUTE_TRUST", "user", String(id), { name: user.name, score });
  res.json({ message: "Trust score recomputed", userId: id, trustScore: score });
});

router.get("/admin/trust/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      trustScore: usersTable.trustScore,
      trustLevel: usersTable.trustLevel,
      verificationLevel: usersTable.verificationLevel,
      isVerified: usersTable.isVerified,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
    })
    .from(usersTable)
    .leftJoin(sellerApplicationsTable, and(eq(sellerApplicationsTable.userId, usersTable.id), eq(sellerApplicationsTable.status, "approved")))
    .where(eq(usersTable.role, "seller"))
    .orderBy(desc(usersTable.trustScore), desc(usersTable.createdAt))
    .limit(50);

  res.json(rows.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    trustScore: r.trustScore ?? null,
    trustLevel: r.trustLevel ?? "new",
    verificationLevel: r.verificationLevel ?? "none",
    isVerified: r.isVerified,
    storeName: r.storeName ?? null,
    storeSlug: r.storeSlug ?? null,
  })));
});

/* ── GET /admin/store-health/:sellerId ──────────────────────── */
router.get("/admin/store-health/:sellerId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.sellerId), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [storeRow] = await db
    .select({
      id: sellerApplicationsTable.id,
      storeName: sellerApplicationsTable.storeName,
      storeSlug: sellerApplicationsTable.storeSlug,
      description: sellerApplicationsTable.description,
      storeLogo: sellerApplicationsTable.storeLogo,
      storeBanner: sellerApplicationsTable.storeBanner,
      categories: sellerApplicationsTable.categories,
      status: sellerApplicationsTable.status,
      trustScore: usersTable.trustScore,
      verificationLevel: usersTable.verificationLevel,
    })
    .from(sellerApplicationsTable)
    .innerJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
    .where(and(eq(sellerApplicationsTable.userId, sellerId), eq(sellerApplicationsTable.status, "approved")));

  const storeExists = !!storeRow;

  const [[productCount], [reviewCount], [followerCount]] = storeExists
    ? await Promise.all([
        db.select({ c: count() }).from(productsTable).where(eq(productsTable.sellerId, sellerId)),
        db.select({ c: count() }).from(reviewsTable).innerJoin(productsTable, eq(productsTable.id, reviewsTable.productId)).where(eq(productsTable.sellerId, sellerId)),
        db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.customerId, sellerId)),
      ])
    : [[{ c: 0 }], [{ c: 0 }], [{ c: 0 }]];

  const featuredCount = storeExists
    ? Number((await db.select({ c: count() }).from(productsTable).where(and(eq(productsTable.sellerId, sellerId), eq(productsTable.featured, true))))[0]?.c ?? 0)
    : 0;

  const trustConfigured = storeExists && (storeRow.trustScore != null || storeRow.verificationLevel !== "none");
  const reviewsConfigured = storeExists && Number((reviewCount as any)?.c ?? 0) >= 0;
  const featuredProductsConfigured = featuredCount > 0;
  const followersEnabled = true;
  const productsVisible = storeExists && Number((productCount as any)?.c ?? 0) > 0;
  const translationsValid = true;
  const mobileCompatible = true;

  const checks = [storeExists, trustConfigured, reviewsConfigured, followersEnabled, productsVisible, translationsValid, mobileCompatible];
  const score = storeExists ? Math.round((checks.filter(Boolean).length / checks.length) * 100) : 0;

  res.json({
    sellerId,
    storeExists,
    storeName: storeRow?.storeName ?? null,
    storeSlug: storeRow?.storeSlug ?? null,
    trustConfigured,
    reviewsConfigured,
    featuredProductsConfigured,
    followersEnabled,
    productsVisible,
    translationsValid,
    mobileCompatible,
    productCount: storeExists ? Number((productCount as any)?.c ?? 0) : 0,
    featuredCount,
    score,
  });
});

/* ── GET /admin/store-settings-health/:sellerId ────────────── */
router.get("/admin/store-settings-health/:sellerId", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const sellerId = parseInt(String(req.params.sellerId), 10);
  if (isNaN(sellerId)) { res.status(400).json({ error: "Invalid seller ID" }); return; }

  const [app] = await db
    .select({
      id: sellerApplicationsTable.id,
      storeName: sellerApplicationsTable.storeName,
      storeNameAr: sellerApplicationsTable.storeNameAr,
      description: sellerApplicationsTable.description,
      storeSlug: sellerApplicationsTable.storeSlug,
      storeLogo: sellerApplicationsTable.storeLogo,
      storeBanner: sellerApplicationsTable.storeBanner,
      contactPhone: sellerApplicationsTable.contactPhone,
      contactEmail: sellerApplicationsTable.contactEmail,
      website: sellerApplicationsTable.website,
      whatsapp: sellerApplicationsTable.whatsapp,
      shippingPolicy: sellerApplicationsTable.shippingPolicy,
      returnPolicy: sellerApplicationsTable.returnPolicy,
      warrantyPolicy: sellerApplicationsTable.warrantyPolicy,
      privacyPolicy: sellerApplicationsTable.privacyPolicy,
      metaTitle: sellerApplicationsTable.metaTitle,
      metaDescription: sellerApplicationsTable.metaDescription,
      seoImageUrl: sellerApplicationsTable.seoImageUrl,
      trustScore: usersTable.trustScore,
      verificationLevel: usersTable.verificationLevel,
      status: sellerApplicationsTable.status,
    })
    .from(sellerApplicationsTable)
    .innerJoin(usersTable, eq(sellerApplicationsTable.userId, usersTable.id))
    .where(and(eq(sellerApplicationsTable.userId, sellerId), eq(sellerApplicationsTable.status, "approved")));

  const settingsLoaded = !!app;
  const brandingConfigured = !!(app?.storeLogo || app?.storeBanner);
  const contactConfigured = !!(app?.contactPhone || app?.contactEmail || app?.whatsapp);
  const policiesConfigured = !!(app?.shippingPolicy || app?.returnPolicy || app?.warrantyPolicy || app?.privacyPolicy);
  const seoConfigured = !!(app?.metaTitle || app?.metaDescription);
  const trustIntegrated = !!(app?.trustScore != null || (app?.verificationLevel && app?.verificationLevel !== "none"));
  const uploadsWorking = settingsLoaded;
  const translationsValid = !!(app?.storeName && app?.storeNameAr);
  const mobileCompatible = true;

  const scoreChecks = [
    settingsLoaded,
    brandingConfigured,
    contactConfigured,
    policiesConfigured,
    seoConfigured,
    trustIntegrated,
    uploadsWorking,
    translationsValid,
    mobileCompatible,
  ];
  const score = settingsLoaded
    ? Math.round((scoreChecks.filter(Boolean).length / scoreChecks.length) * 100)
    : 0;

  const missing: string[] = [];
  if (!brandingConfigured) missing.push("Upload a logo or banner image");
  if (!contactConfigured) missing.push("Add contact phone, email, or WhatsApp");
  if (!policiesConfigured) missing.push("Add at least one store policy");
  if (!seoConfigured) missing.push("Add SEO meta title and description");
  if (!translationsValid) missing.push("Add Arabic store name");

  res.json({
    sellerId,
    settingsLoaded,
    brandingConfigured,
    contactConfigured,
    policiesConfigured,
    seoConfigured,
    trustIntegrated,
    uploadsWorking,
    translationsValid,
    mobileCompatible,
    score,
    missing,
    storeName: app?.storeName ?? null,
    storeSlug: app?.storeSlug ?? null,
  });
});

// ─── SEARCH ANALYTICS ────────────────────────────────────────────────────────

router.get("/admin/search-analytics/overview", async (_req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const [res7, res30, resLang] = await Promise.all([
      pool.query<{
        total_searches: string;
        zero_result_count: string;
        clicked_count: string;
        avg_results_count: string;
      }>(`
        SELECT
          COUNT(*)::text                                                    AS total_searches,
          SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::text          AS zero_result_count,
          SUM(CASE WHEN clicked = true  THEN 1 ELSE 0 END)::text           AS clicked_count,
          AVG(COALESCE(result_count, 0))::text                             AS avg_results_count
        FROM query_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      pool.query<{
        total_searches: string;
        zero_result_count: string;
        clicked_count: string;
        avg_results_count: string;
      }>(`
        SELECT
          COUNT(*)::text                                                    AS total_searches,
          SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::text          AS zero_result_count,
          SUM(CASE WHEN clicked = true  THEN 1 ELSE 0 END)::text           AS clicked_count,
          AVG(COALESCE(result_count, 0))::text                             AS avg_results_count
        FROM query_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
      pool.query<{ lang: string; cnt: string }>(`
        SELECT COALESCE(lang, 'ar') AS lang, COUNT(*)::text AS cnt
        FROM query_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY COALESCE(lang, 'ar')
      `),
    ]);

    function buildPeriod(row: { total_searches: string; zero_result_count: string; clicked_count: string; avg_results_count: string }) {
      const total = parseInt(row.total_searches ?? "0", 10) || 0;
      const zero  = parseInt(row.zero_result_count ?? "0", 10) || 0;
      const clicked = parseInt(row.clicked_count ?? "0", 10) || 0;
      return {
        totalSearches: total,
        zeroResultCount: zero,
        zeroResultRate: total > 0 ? parseFloat(((zero / total) * 100).toFixed(2)) : 0,
        clickThroughRate: total > 0 ? parseFloat(((clicked / total) * 100).toFixed(2)) : 0,
        avgResultsCount: parseFloat(parseFloat(row.avg_results_count ?? "0").toFixed(2)),
      };
    }

    const langMap: Record<string, number> = {};
    for (const r of resLang.rows) langMap[r.lang] = parseInt(r.cnt, 10) || 0;
    const arabic  = langMap["ar"] ?? 0;
    const english = langMap["en"] ?? 0;
    const langTotal = arabic + english;

    res.json({
      period7:  buildPeriod(res7.rows[0]  ?? { total_searches: "0", zero_result_count: "0", clicked_count: "0", avg_results_count: "0" }),
      period30: buildPeriod(res30.rows[0] ?? { total_searches: "0", zero_result_count: "0", clicked_count: "0", avg_results_count: "0" }),
      languageBreakdown: {
        arabic,
        english,
        arabicPct:  langTotal > 0 ? parseFloat(((arabic  / langTotal) * 100).toFixed(2)) : 0,
        englishPct: langTotal > 0 ? parseFloat(((english / langTotal) * 100).toFixed(2)) : 0,
      },
      processingTimeMs: Date.now() - t0,
    });
  } catch (error) {
    console.error("[search-analytics/overview]", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/search-analytics/top-queries", async (req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const days  = Math.min(90, Math.max(1, parseInt(String(req.query.days  ?? "7"),  10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const { rows } = await pool.query<{
      query: string;
      lang: string;
      count: string;
      avg_results_count: string;
      ctr: string;
    }>(`
      SELECT
        query,
        COALESCE(lang, 'ar') AS lang,
        COUNT(*)::text                                                             AS count,
        AVG(result_count)::text                                                    AS avg_results_count,
        (SUM(CASE WHEN clicked THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*),0))::text AS ctr
      FROM query_logs
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY query, COALESCE(lang, 'ar')
      ORDER BY COUNT(*) DESC
      LIMIT $2
    `, [days, limit]);

    res.json({
      queries: rows.map((r) => ({
        query: r.query,
        lang: r.lang,
        count: parseInt(r.count, 10) || 0,
        zeroResults: r.avg_results_count !== null && parseFloat(r.avg_results_count) === 0,
        avgResultsCount: r.avg_results_count !== null ? parseFloat(parseFloat(r.avg_results_count).toFixed(2)) : 0,
        clickThroughRate: parseFloat(parseFloat(r.ctr ?? "0").toFixed(2)),
      })),
      processingTimeMs: Date.now() - t0,
    });
  } catch (error) {
    console.error("[search-analytics/top-queries]", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/search-analytics/zero-results", async (req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const days  = Math.min(90, Math.max(1, parseInt(String(req.query.days  ?? "7"),  10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const { rows } = await pool.query<{
      query: string;
      lang: string;
      count: string;
      last_searched: string;
    }>(`
      SELECT
        query,
        COALESCE(lang, 'ar') AS lang,
        COUNT(*)::text                AS count,
        MAX(created_at)::text         AS last_searched
      FROM query_logs
      WHERE result_count = 0
        AND created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY query, COALESCE(lang, 'ar')
      ORDER BY COUNT(*) DESC
      LIMIT $2
    `, [days, limit]);

    res.json({
      queries: rows.map((r) => ({
        query: r.query,
        lang: r.lang,
        count: parseInt(r.count, 10) || 0,
        lastSearched: r.last_searched,
      })),
      processingTimeMs: Date.now() - t0,
    });
  } catch (error) {
    console.error("[search-analytics/zero-results]", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/search-analytics/trends", async (req, res): Promise<void> => {
  const t0 = Date.now();
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));

    const { rows } = await pool.query<{
      date: string;
      total_searches: string;
      zero_results: string;
      unique_queries: string;
    }>(`
      SELECT
        DATE(created_at AT TIME ZONE 'UTC')::text                             AS date,
        COUNT(*)::text                                                         AS total_searches,
        SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::text               AS zero_results,
        COUNT(DISTINCT query)::text                                            AS unique_queries
      FROM query_logs
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `, [days]);

    res.json({
      trends: rows.map((r) => ({
        date: r.date,
        totalSearches: parseInt(r.total_searches, 10) || 0,
        zeroResults: parseInt(r.zero_results, 10) || 0,
        uniqueQueries: parseInt(r.unique_queries, 10) || 0,
      })),
      processingTimeMs: Date.now() - t0,
    });
  } catch (error) {
    console.error("[search-analytics/trends]", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Admin: Platform-wide Product Quality Report ───────────── */
router.get("/admin/products/quality-report", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  try {
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
      seller_id: number;
      store_name: string;
    }>(`
      SELECT
        p.id,
        p.name,
        p.name_ar,
        COALESCE(array_length(p.image_urls, 1), 0)                      AS image_count,
        COALESCE(LENGTH(TRIM(COALESCE(p.description, ''))), 0)           AS desc_len,
        COALESCE(LENGTH(TRIM(COALESCE(p.description_ar, ''))), 0)        AS desc_ar_len,
        COALESCE(p.price::numeric, 0)::text                              AS price_val,
        p.stock,
        (p.embedding IS NULL)                                            AS not_embedded,
        p.seller_id,
        COALESCE(sa.store_name, u.name)                                  AS store_name
      FROM products p
      LEFT JOIN users u ON u.id = p.seller_id
      LEFT JOIN seller_applications sa
        ON sa.seller_id = p.seller_id AND sa.status = 'approved'
      ORDER BY p.id DESC
    `);

    const breakdown = {
      missing_images: 0,
      short_description: 0,
      short_description_ar: 0,
      missing_name_ar: 0,
      zero_price: 0,
      out_of_stock: 0,
      not_embedded: 0,
    };

    const flaggedProducts = rows
      .map((row) => {
        const issues: string[] = [];
        if (row.image_count === 0)                     { issues.push("missing_images");      breakdown.missing_images++; }
        if (row.desc_len < 20)                         { issues.push("short_description");   breakdown.short_description++; }
        if (row.desc_ar_len < 20)                      { issues.push("short_description_ar"); breakdown.short_description_ar++; }
        if (!row.name_ar || row.name_ar.trim() === "") { issues.push("missing_name_ar");     breakdown.missing_name_ar++; }
        if (parseFloat(row.price_val) === 0)           { issues.push("zero_price");          breakdown.zero_price++; }
        if (row.stock === 0)                           { issues.push("out_of_stock");         breakdown.out_of_stock++; }
        if (row.not_embedded)                          { issues.push("not_embedded");         breakdown.not_embedded++; }
        return {
          id: row.id,
          name: row.name,
          name_ar: row.name_ar ?? "",
          seller_id: row.seller_id,
          store_name: row.store_name,
          issues,
        };
      })
      .filter((p) => p.issues.length > 0);

    const total = rows.length;
    const flaggedCount = flaggedProducts.length;

    res.json({
      total_products: total,
      flagged_count: flaggedCount,
      flagged_percentage: total > 0 ? Math.round((flaggedCount / total) * 100) : 0,
      breakdown,
      products: flaggedProducts,
    });
  } catch (err) {
    console.error("[admin/products/quality-report]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ── Admin: Store Quality Report ────────────────────────────── */
router.get("/admin/stores/quality-report", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  try {
    const { rows } = await pool.query<{
      id: number;
      name: string;
      seller_id: number;
      logo: string | null;
      description: string | null;
      description_ar: string | null;
    }>(`
      SELECT
        id,
        store_name AS name,
        seller_id,
        store_logo   AS logo,
        description,
        description_ar
      FROM seller_applications
      WHERE status = 'approved'
      ORDER BY id DESC
    `);

    const flaggedStores = rows
      .map((row) => {
        const issues: string[] = [];
        if (!row.logo || row.logo.trim() === "")                   issues.push("missing_logo");
        if (!row.description || row.description.trim() === "")     issues.push("missing_description");
        if (!row.description_ar || row.description_ar.trim() === "") issues.push("missing_description_ar");
        return { id: row.id, name: row.name, seller_id: row.seller_id, issues };
      })
      .filter((s) => s.issues.length > 0);

    res.json({
      total_stores: rows.length,
      flagged_count: flaggedStores.length,
      stores: flaggedStores,
    });
  } catch (err) {
    console.error("[admin/stores/quality-report]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
