import { Router, type IRouter } from "express";
import { eq, sql, inArray, desc, and, avg, count } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  usersTable,
  storeFollowsTable,
  sellerReviewsTable,
  sellerApplicationsTable,
} from "@workspace/db";
import { requireAuth, requireActiveAccount } from "../middlewares/auth";

const router: IRouter = Router();

/* ── GET /dashboard/seller ───────────────────────────────────── */
router.get("/dashboard/seller", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "seller") {
    res.status(403).json({ error: "Seller access required" });
    return;
  }

  const sellerId = req.user!.userId;

  // All stats computed in parallel — N+1 eliminated
  const [products, orderIdRows, followerStat, sellerReviewStat, storeRow, userTrustRow] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.sellerId, sellerId)),

    db
      .selectDistinct({ orderId: orderItemsTable.orderId })
      .from(orderItemsTable)
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

    db
      .select({ storeSlug: sellerApplicationsTable.storeSlug })
      .from(sellerApplicationsTable)
      .where(and(eq(sellerApplicationsTable.userId, sellerId), eq(sellerApplicationsTable.status, "approved")))
      .limit(1),

    db
      .select({ trustScore: usersTable.trustScore, verificationLevel: usersTable.verificationLevel, isVerified: usersTable.isVerified })
      .from(usersTable)
      .where(eq(usersTable.id, sellerId))
      .limit(1),
  ]);

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock < 5).length;

  const ids = orderIdRows.map((r) => r.orderId);

  // Fetch all orders in ONE query (was N individual queries)
  let orders: (typeof ordersTable.$inferSelect)[] = [];
  if (ids.length > 0) {
    orders = await db
      .select()
      .from(ordersTable)
      .where(inArray(ordersTable.id, ids))
      .orderBy(desc(ordersTable.createdAt));
  }

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  // Revenue via SQL aggregation (was loop of N*M queries)
  const [revenueRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${orderItemsTable.unitPrice}::numeric * ${orderItemsTable.quantity}), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(and(eq(orderItemsTable.sellerId, sellerId), eq(ordersTable.status, "delivered")));

  const totalRevenue = parseFloat(parseFloat(revenueRow?.total ?? "0").toFixed(2));

  // V1 statuses — count every status so the seller dashboard reflects current pipeline
  const ALL_SELLER_STATUSES = [
    "pending", "confirmed", "processing", "preparing", "ready_for_pickup",
    "courier_assigned", "shipped", "picked_up", "in_transit", "out_for_delivery",
    "delivered", "cancelled", "delivery_failed", "returned", "refunded",
  ];
  const ordersByStatus = ALL_SELLER_STATUSES.map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length,
  }));

  // Recent orders: one query each for orders+customers and items (was N*2 queries)
  const recentIds = ids.slice(0, 5);
  let recentOrders: any[] = [];

  if (recentIds.length > 0) {
    const [recentOrdersData, recentItemsData] = await Promise.all([
      db
        .select({
          orderId: ordersTable.id,
          customerId: ordersTable.customerId,
          customerName: usersTable.name,
          customerEmail: usersTable.email,
          total: ordersTable.total,
          status: ordersTable.status,
          shippingAddress: ordersTable.shippingAddress,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
        })
        .from(ordersTable)
        .innerJoin(usersTable, eq(usersTable.id, ordersTable.customerId))
        .where(inArray(ordersTable.id, recentIds))
        .orderBy(desc(ordersTable.createdAt)),

      db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, recentIds)),
    ]);

    const itemsByOrder = new Map<number, typeof orderItemsTable.$inferSelect[]>();
    for (const item of recentItemsData) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId)!.push(item);
    }

    recentOrders = recentOrdersData.map((o) => ({
      id: o.orderId,
      customerId: o.customerId,
      customerName: o.customerName ?? "Unknown",
      customerEmail: o.customerEmail ?? "",
      items: (itemsByOrder.get(o.orderId) ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.unitPrice) * item.quantity,
      })),
      total: parseFloat(o.total),
      status: o.status,
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  const followerCount = Number(followerStat[0]?.count ?? 0);
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

  res.json({
    totalProducts,
    totalOrders,
    totalRevenue,
    pendingOrders,
    lowStockProducts,
    followerCount,
    sellerScore,
    sellerReviewCount: Number(sr?.total ?? 0),
    storeSlug: storeRow[0]?.storeSlug ?? null,
    trustScore: userTrustRow[0]?.trustScore ?? null,
    verificationLevel: userTrustRow[0]?.verificationLevel ?? "none",
    isVerified: userTrustRow[0]?.isVerified ?? false,
    recentOrders,
    ordersByStatus,
  });
});

/* ── GET /dashboard/seller/analytics ────────────────────────── */
router.get("/dashboard/seller/analytics", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "seller") {
    res.status(403).json({ error: "Seller access required" });
    return;
  }

  const sellerId = req.user!.userId;
  const days = Math.min(parseInt((req.query.days as string) || "30", 10), 90);

  const [revenueByDay, topProducts, topViewedProducts, followerGrowth] = await Promise.all([
    db.execute(sql`
      SELECT
        date_trunc('day', o.created_at)::date AS day,
        COALESCE(SUM(oi.unit_price::numeric * oi.quantity), 0)::float AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId}
        AND o.status = 'delivered'
        AND o.created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY day ORDER BY day ASC
    `),

    db.execute(sql`
      SELECT
        oi.product_id,
        oi.product_name,
        SUM(oi.unit_price::numeric * oi.quantity)::float AS revenue,
        SUM(oi.quantity)::int AS units_sold
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId} AND o.status = 'delivered'
      GROUP BY oi.product_id, oi.product_name
      ORDER BY revenue DESC LIMIT 5
    `),

    db
      .select({ id: productsTable.id, name: productsTable.name, viewCount: productsTable.viewCount })
      .from(productsTable)
      .where(eq(productsTable.sellerId, sellerId))
      .orderBy(desc(productsTable.viewCount))
      .limit(5),

    db.execute(sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*)::int AS new_followers
      FROM store_follows
      WHERE seller_id = ${sellerId}
        AND created_at >= NOW() - (${days} || ' days')::interval
      GROUP BY day ORDER BY day ASC
    `),
  ]);

  res.json({
    period: { days },
    revenueByDay: ((revenueByDay as any).rows as any[]).map((r) => ({ day: r.day, revenue: Number(r.revenue) })),
    topProducts: ((topProducts as any).rows as any[]).map((p) => ({
      productId: Number(p.product_id),
      productName: p.product_name,
      revenue: Number(p.revenue),
      unitsSold: Number(p.units_sold),
    })),
    topViewedProducts: topViewedProducts.map((p) => ({ id: p.id, name: p.name, viewCount: p.viewCount })),
    followerGrowth: ((followerGrowth as any).rows as any[]).map((r) => ({ day: r.day, newFollowers: Number(r.new_followers) })),
  });
});

/* ── GET /dashboard/seller/metrics ──────────────────────────── */
router.get("/dashboard/seller/metrics", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "seller") {
    res.status(403).json({ error: "Seller access required" });
    return;
  }
  const sellerId = req.user!.userId;

  // Get all order IDs for this seller in one query
  const orderIdRows = await db
    .selectDistinct({ orderId: orderItemsTable.orderId })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.sellerId, sellerId));

  if (orderIdRows.length === 0) {
    res.json({
      ordersToday: 0, ordersThisWeek: 0, ordersThisMonth: 0,
      avgOrderValue: 0, cancellationRate: 0, deliverySuccessRate: 0,
      preparingCount: 0, awaitingCourierCount: 0,
    });
    return;
  }

  const ids = orderIdRows.map(r => r.orderId);

  const rawResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)                                AS today,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))                   AS this_week,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))                  AS this_month,
      ROUND(AVG(total::numeric)::numeric, 2)                                            AS avg_order_value,
      COUNT(*)                                                                           AS total_count,
      COUNT(*) FILTER (WHERE status = 'cancelled')                                      AS cancelled_count,
      COUNT(*) FILTER (WHERE status = 'delivered')                                      AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('delivery_failed','returned'))                   AS failed_count,
      COUNT(*) FILTER (WHERE status = 'preparing')                                      AS preparing_count,
      COUNT(*) FILTER (WHERE status = 'ready_for_pickup')                               AS awaiting_courier_count
    FROM orders
    WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
  `) as any;

  const r = rawResult.rows?.[0] ?? rawResult[0] ?? {};
  const totalCount    = Number(r.total_count ?? 0);
  const cancelledCount = Number(r.cancelled_count ?? 0);
  const deliveredCount = Number(r.delivered_count ?? 0);
  const failedCount   = Number(r.failed_count ?? 0);

  const cancellationRate     = totalCount > 0 ? parseFloat(((cancelledCount / totalCount) * 100).toFixed(1)) : 0;
  const deliveryDenominator  = deliveredCount + failedCount;
  const deliverySuccessRate  = deliveryDenominator > 0 ? parseFloat(((deliveredCount / deliveryDenominator) * 100).toFixed(1)) : 0;

  res.json({
    ordersToday:          Number(r.today ?? 0),
    ordersThisWeek:       Number(r.this_week ?? 0),
    ordersThisMonth:      Number(r.this_month ?? 0),
    avgOrderValue:        parseFloat(String(r.avg_order_value ?? "0")),
    cancellationRate,
    deliverySuccessRate,
    preparingCount:       Number(r.preparing_count ?? 0),
    awaitingCourierCount: Number(r.awaiting_courier_count ?? 0),
  });
});

/* ── Analytics helpers ───────────────────────────────────────── */
function parseQueryDate(val: unknown, fallback: Date): Date {
  if (typeof val !== "string" || !val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}
function trendChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(1));
}
function kpi(curr: number, prev: number) { return { value: curr, prev, change: trendChange(curr, prev) }; }

/* ── GET /dashboard/seller/analytics/summary ────────────────── */
router.get("/dashboard/seller/analytics/summary", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "seller") { res.status(403).json({ error: "Seller access required" }); return; }
  const sellerId = req.user!.userId;

  const defaultTo   = new Date(); defaultTo.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 30); defaultFrom.setHours(0, 0, 0, 0);

  const currFrom = parseQueryDate(req.query.from, defaultFrom);
  const currTo   = parseQueryDate(req.query.to,   defaultTo); currTo.setHours(23, 59, 59, 999);
  const duration = currTo.getTime() - currFrom.getTime();
  const prevFrom = new Date(currFrom.getTime() - duration - 1);
  const prevTo   = new Date(currFrom.getTime() - 1);

  const cf = currFrom.toISOString(); const ct = currTo.toISOString();
  const pf = prevFrom.toISOString(); const pt = prevTo.toISOString();

  const [currKpi, prevKpi, statusRows, topProds, followerRow, prevFollRow, reviewRow, deliveryRow] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(DISTINCT oi.order_id)::int                                                                AS total_orders,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'delivered')::int                        AS completed,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'cancelled')::int                        AS cancelled,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status IN ('returned','refunded'))::int           AS refunded,
        COALESCE(SUM(oi.unit_price::numeric * oi.quantity) FILTER (WHERE o.status = 'delivered'),0)::float AS revenue,
        COALESCE(AVG(o.total::numeric) FILTER (WHERE o.status = 'delivered'), 0)::float               AS aov,
        COUNT(DISTINCT o.customer_id)::int                                                            AS unique_customers
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId} AND o.created_at >= ${cf} AND o.created_at <= ${ct}
    `),
    db.execute(sql`
      SELECT
        COUNT(DISTINCT oi.order_id)::int                                                                AS total_orders,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'delivered')::int                        AS completed,
        COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status = 'cancelled')::int                        AS cancelled,
        COALESCE(SUM(oi.unit_price::numeric * oi.quantity) FILTER (WHERE o.status = 'delivered'),0)::float AS revenue,
        COALESCE(AVG(o.total::numeric) FILTER (WHERE o.status = 'delivered'), 0)::float               AS aov,
        COUNT(DISTINCT o.customer_id)::int                                                            AS unique_customers
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId} AND o.created_at >= ${pf} AND o.created_at <= ${pt}
    `),
    db.execute(sql`
      SELECT o.status, COUNT(DISTINCT oi.order_id)::int AS cnt
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId} AND o.created_at >= ${cf} AND o.created_at <= ${ct}
      GROUP BY o.status
    `),
    db.execute(sql`
      SELECT oi.product_id, oi.product_name, p.image_url, p.image_urls, p.view_count,
        SUM(oi.quantity)::int AS units_sold,
        SUM(oi.unit_price::numeric * oi.quantity)::float AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.seller_id = ${sellerId} AND o.status = 'delivered'
        AND o.created_at >= ${cf} AND o.created_at <= ${ct}
      GROUP BY oi.product_id, oi.product_name, p.image_url, p.image_urls, p.view_count
      ORDER BY revenue DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= ${cf} AND created_at <= ${ct})::int AS new_curr
      FROM store_follows WHERE seller_id = ${sellerId}
    `),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE created_at >= ${pf} AND created_at <= ${pt})::int AS new_prev
      FROM store_follows WHERE seller_id = ${sellerId}
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
        COALESCE(AVG((communication_rating + shipping_rating + professionalism_rating)::float / 3),0)::float AS avg_rating,
        COUNT(*) FILTER (WHERE created_at >= ${cf} AND created_at <= ${ct})::int AS new_curr,
        COUNT(*) FILTER (WHERE created_at >= ${pf} AND created_at <= ${pt})::int AS new_prev
      FROM seller_reviews WHERE seller_id = ${sellerId}
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ca.status = 'delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE ca.status IN ('failed','delivery_failed'))::int AS failed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (ca.delivered_at - ca.assigned_at))/3600)
          FILTER (WHERE ca.status = 'delivered' AND ca.delivered_at IS NOT NULL),0)::float AS avg_hours
      FROM courier_assignments ca
      JOIN orders o ON o.id = ca.order_id
      WHERE o.created_at >= ${cf} AND o.created_at <= ${ct}
        AND EXISTS (
          SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = ${sellerId}
        )
    `),
  ]);

  const c  = (currKpi    as any).rows?.[0] ?? (currKpi    as any)[0] ?? {};
  const p  = (prevKpi    as any).rows?.[0] ?? (prevKpi    as any)[0] ?? {};
  const fr = (followerRow as any).rows?.[0] ?? (followerRow as any)[0] ?? {};
  const pfr= (prevFollRow as any).rows?.[0] ?? (prevFollRow as any)[0] ?? {};
  const rv = (reviewRow  as any).rows?.[0] ?? (reviewRow  as any)[0] ?? {};
  const dr = (deliveryRow as any).rows?.[0] ?? (deliveryRow as any)[0] ?? {};
  const statusData = ((statusRows as any).rows ?? (statusRows as any) ?? []) as any[];
  const prodsData  = ((topProds   as any).rows ?? (topProds   as any) ?? []) as any[];

  // Returning customers = customers in curr period who also ordered before it
  const currUnique = Number(c.unique_customers ?? 0);
  let returningCustomers = 0;
  if (currUnique > 0) {
    const custIds = await db.execute(sql`
      SELECT DISTINCT o.customer_id
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.seller_id = ${sellerId} AND o.created_at >= ${cf} AND o.created_at <= ${ct}
    `);
    const ids = ((custIds as any).rows ?? (custIds as any) ?? []).map((r: any) => Number(r.customer_id));
    if (ids.length > 0) {
      const rcRow = await db.execute(sql`
        SELECT COUNT(DISTINCT o.customer_id)::int AS cnt
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE oi.seller_id = ${sellerId}
          AND o.customer_id IN (${sql.join(ids.map((id: number) => sql`${id}`), sql`, `)})
          AND o.created_at < ${cf}
      `);
      returningCustomers = Number(((rcRow as any).rows?.[0] ?? (rcRow as any)[0] ?? {}).cnt ?? 0);
    }
  }

  const currTotal     = Number(c.total_orders  ?? 0);
  const currCompleted = Number(c.completed     ?? 0);
  const currCancelled = Number(c.cancelled     ?? 0);
  const currRefunded  = Number(c.refunded      ?? 0);
  const currRevenue   = Number(c.revenue       ?? 0);
  const currAOV       = Number(c.aov           ?? 0);
  const prevTotal     = Number(p.total_orders  ?? 0);
  const prevCompleted = Number(p.completed     ?? 0);
  const prevCancelled = Number(p.cancelled     ?? 0);
  const prevRevenue   = Number(p.revenue       ?? 0);
  const prevAOV       = Number(p.aov           ?? 0);
  const prevUnique    = Number(p.unique_customers ?? 0);
  const totalFollowers= Number(fr.total        ?? 0);
  const newFollCurr   = Number(fr.new_curr     ?? 0);
  const newFollPrev   = Number(pfr.new_prev    ?? 0);
  const totalReviews  = Number(rv.total        ?? 0);
  const avgRating     = parseFloat(Number(rv.avg_rating ?? 0).toFixed(1));
  const newRevCurr    = Number(rv.new_curr     ?? 0);
  const newRevPrev    = Number(rv.new_prev     ?? 0);
  const dlvDelivered  = Number(dr.delivered    ?? 0);
  const dlvFailed     = Number(dr.failed       ?? 0);
  const dlvHours      = parseFloat(Number(dr.avg_hours ?? 0).toFixed(1));
  const dlvTotal      = dlvDelivered + dlvFailed;
  const dlvSuccessRate= dlvTotal > 0 ? parseFloat((dlvDelivered / dlvTotal * 100).toFixed(1)) : 0;
  const repeatRate    = currUnique > 0 ? parseFloat((returningCustomers / currUnique * 100).toFixed(1)) : 0;

  res.json({
    period: { from: currFrom.toISOString().split("T")[0], to: currTo.toISOString().split("T")[0] },
    kpis: {
      totalOrders:      kpi(currTotal,     prevTotal),
      completedOrders:  kpi(currCompleted, prevCompleted),
      cancelledOrders:  kpi(currCancelled, prevCancelled),
      refundedOrders:   kpi(currRefunded,  0),
      grossRevenue:     kpi(currRevenue,   prevRevenue),
      avgOrderValue:    kpi(parseFloat(currAOV.toFixed(2)), parseFloat(prevAOV.toFixed(2))),
      followers:        kpi(totalFollowers, totalFollowers - newFollCurr + newFollPrev),
      storeRating:      kpi(avgRating,      avgRating),
    },
    orderStatusBreakdown: statusData.map((r) => ({ status: String(r.status), count: Number(r.cnt ?? 0) })),
    topProducts: prodsData.map((r) => ({
      productId:   Number(r.product_id),
      productName: String(r.product_name),
      imageUrl:    r.image_url ?? (Array.isArray(r.image_urls) ? r.image_urls[0] : null) ?? null,
      viewCount:   Number(r.view_count  ?? 0),
      unitsSold:   Number(r.units_sold  ?? 0),
      revenue:     Number(r.revenue     ?? 0),
    })),
    customers: {
      unique:               currUnique,
      returning:            returningCustomers,
      new:                  currUnique - returningCustomers,
      repeatRate,
      avgOrdersPerCustomer: currUnique > 0 ? parseFloat((currTotal / currUnique).toFixed(1)) : 0,
      prevUnique,
      change:               trendChange(currUnique, prevUnique),
    },
    delivery: {
      totalDelivered:  dlvDelivered,
      totalFailed:     dlvFailed,
      successRate:     dlvSuccessRate,
      avgDeliveryHours: dlvHours,
      cancellationRate: currTotal > 0 ? parseFloat((currCancelled / currTotal * 100).toFixed(1)) : 0,
    },
    growth: {
      totalFollowers,
      newFollowers:  newFollCurr,
      prevFollowers: newFollPrev,
      followerChange: trendChange(newFollCurr, newFollPrev),
      totalReviews,
      avgRating,
      newReviews:    newRevCurr,
      prevReviews:   newRevPrev,
      reviewChange:  trendChange(newRevCurr, newRevPrev),
    },
  });
});

/* ── GET /dashboard/seller/analytics/revenue-chart ──────────── */
router.get("/dashboard/seller/analytics/revenue-chart", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "seller") { res.status(403).json({ error: "Seller access required" }); return; }
  const sellerId = req.user!.userId;

  const defaultTo   = new Date(); defaultTo.setHours(23, 59, 59, 999);
  const defaultFrom = new Date(); defaultFrom.setDate(defaultFrom.getDate() - 30); defaultFrom.setHours(0, 0, 0, 0);

  const from  = parseQueryDate(req.query.from, defaultFrom);
  const to    = parseQueryDate(req.query.to,   defaultTo); to.setHours(23, 59, 59, 999);
  const gran  = (req.query.granularity as string) === "week" ? "week" : (req.query.granularity as string) === "month" ? "month" : "day";
  const cf = from.toISOString(); const ct = to.toISOString();

  const rows = await db.execute(sql`
    SELECT
      date_trunc(${gran}, o.created_at)::date::text AS period,
      COALESCE(SUM(oi.unit_price::numeric * oi.quantity) FILTER (WHERE o.status = 'delivered'),0)::float AS revenue,
      COUNT(DISTINCT oi.order_id)::int AS orders,
      COALESCE(AVG(o.total::numeric) FILTER (WHERE o.status = 'delivered'), 0)::float AS aov
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = ${sellerId}
      AND o.created_at >= ${cf} AND o.created_at <= ${ct}
    GROUP BY period ORDER BY period ASC
  `);

  const points = ((rows as any).rows ?? (rows as any) ?? []).map((r: any) => ({
    date:     String(r.period),
    revenue:  Number(r.revenue ?? 0),
    orders:   Number(r.orders  ?? 0),
    aov:      parseFloat(Number(r.aov ?? 0).toFixed(2)),
  }));

  res.json({ granularity: gran, points });
});

/* ── GET /dashboard/customer ─────────────────────────────────── */
router.get("/dashboard/customer", requireAuth, requireActiveAccount, async (req, res): Promise<void> => {
  if (req.user!.role !== "customer") {
    res.status(403).json({ error: "Customer access required" });
    return;
  }

  const customerId = req.user!.userId;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.customerId, customerId))
    .orderBy(desc(ordersTable.createdAt));

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const totalSpent = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  const recentIds = orders.slice(0, 5).map((o) => o.id);
  let recentOrders: any[] = [];

  if (recentIds.length > 0) {
    const [recentOrdersData, recentItemsData] = await Promise.all([
      db
        .select({
          orderId: ordersTable.id,
          customerId: ordersTable.customerId,
          customerName: usersTable.name,
          customerEmail: usersTable.email,
          total: ordersTable.total,
          status: ordersTable.status,
          shippingAddress: ordersTable.shippingAddress,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
        })
        .from(ordersTable)
        .innerJoin(usersTable, eq(usersTable.id, ordersTable.customerId))
        .where(inArray(ordersTable.id, recentIds))
        .orderBy(desc(ordersTable.createdAt)),

      db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, recentIds)),
    ]);

    const itemsByOrder = new Map<number, typeof orderItemsTable.$inferSelect[]>();
    for (const item of recentItemsData) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId)!.push(item);
    }

    recentOrders = recentOrdersData.map((o) => ({
      id: o.orderId,
      customerId: o.customerId,
      customerName: o.customerName ?? "Unknown",
      customerEmail: o.customerEmail ?? "",
      items: (itemsByOrder.get(o.orderId) ?? []).map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.unitPrice) * item.quantity,
      })),
      total: parseFloat(o.total),
      status: o.status,
      shippingAddress: o.shippingAddress,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  res.json({
    totalOrders,
    pendingOrders,
    deliveredOrders,
    totalSpent: parseFloat(totalSpent.toFixed(2)),
    recentOrders,
  });
});

export default router;
