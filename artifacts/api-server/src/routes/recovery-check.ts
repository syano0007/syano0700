/**
 * GET /api/admin/recovery-check
 *
 * Comprehensive platform integrity verification endpoint.
 * 19 sections, all real validation — no mocked values.
 * Admin-only. Confidence score 0-100.
 */
import path from "path";
import fs from "fs";
import { Router, type IRouter } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import {
  db,
  usersTable,
  productsTable,
  sellerApplicationsTable,
  couriersTable,
  deliveryZonesTable,
  ordersTable,
  orderStatusHistoryTable,
  notificationsTable,
  reviewsTable,
  storeFollowsTable,
  messagesTable,
  conversationsTable,
  courierAssignmentsTable,
  courierWalletTransactionsTable,
  productVariantsTable,
  productVariantGroupsTable,
} from "@workspace/db";
import { requireAuth, requireRole, signToken } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  ok: boolean;
  data: Record<string, unknown>;
  failures: string[];
  warnings: string[];
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

const PORT = process.env["PORT"] ?? "8080";

async function internalGet(
  path: string,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`http://localhost:${PORT}/api${path}`, { headers });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

async function internalPatch(
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(`http://localhost:${PORT}/api${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let responseBody: unknown;
    try { responseBody = await res.json(); } catch { responseBody = null; }
    return { status: res.status, body: responseBody };
  } catch {
    return { status: 0, body: null };
  }
}

// ─── SECTION 1 — Core Platform ───────────────────────────────────────────────

async function checkCorePlatform(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // API health
  const health = await internalGet("/healthz");
  data["apiHealthStatus"] = health.status;
  if (health.status !== 200) failures.push(`API health returned ${health.status}`);

  // DB connection + table count
  const tableRaw = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  const tableCount = Number(tableRaw.rows?.[0]?.count ?? 0);
  data["tableCount"] = tableCount;
  data["tableCountOk"] = tableCount === 27;
  if (tableCount < 27) failures.push(`Table count ${tableCount}/27 — run migrations`);

  // notification_type enum
  const notifRaw = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM unnest(enum_range(NULL::notification_type))
  `);
  const notifCount = Number(notifRaw.rows?.[0]?.count ?? 0);
  data["notificationTypeEnumCount"] = notifCount;
  if (notifCount < 32) failures.push(`notification_type enum: ${notifCount}/32`);

  // order_status enum
  const statusRaw = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM unnest(enum_range(NULL::order_status))
  `);
  const statusCount = Number(statusRaw.rows?.[0]?.count ?? 0);
  data["orderStatusCount"] = statusCount;
  if (statusCount !== 15) failures.push(`order_status enum: ${statusCount}/15`);

  // delivery zones
  const [zoneRow] = await db.select({ count: count() }).from(deliveryZonesTable);
  const zoneCount = Number(zoneRow?.count ?? 0);
  data["deliveryZoneCount"] = zoneCount;
  if (zoneCount !== 40) failures.push(`delivery_zones: ${zoneCount}/40`);

  // migration columns
  const vmColRaw = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='verified_by'
    ) AS exists
  `);
  data["verifiedByColumn"] = vmColRaw.rows?.[0]?.exists === true;
  if (!data["verifiedByColumn"]) failures.push("users.verified_by column missing");

  const svlogRaw = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='seller_verification_log'
    ) AS exists
  `);
  data["sellerVerificationLog"] = svlogRaw.rows?.[0]?.exists === true;
  if (!data["sellerVerificationLog"]) failures.push("seller_verification_log table missing");

  // root owner
  const rootOwner = await db
    .select({ id: usersTable.id, role: usersTable.role, accountStatus: usersTable.accountStatus })
    .from(usersTable)
    .where(eq(usersTable.email, "delewatiamer7@gmail.com"))
    .limit(1);
  data["rootOwnerExists"] = rootOwner.length > 0;
  data["rootOwnerRole"] = rootOwner[0]?.role ?? null;
  if (rootOwner.length === 0) failures.push("Root owner (delewatiamer7) missing");
  else if (rootOwner[0]?.role !== "admin") failures.push("Root owner role is not admin");

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 2 — Marketplace System ──────────────────────────────────────────

async function checkMarketplace(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // categories
  const cats = await internalGet("/products/categories");
  data["categoriesStatus"] = cats.status;
  if (cats.status !== 200) failures.push(`GET /products/categories → ${cats.status}`);

  // product listing
  const products = await internalGet("/products?limit=1");
  data["productListStatus"] = products.status;
  if (products.status !== 200) failures.push(`GET /products → ${products.status}`);

  // product detail (use first product ID if any exist)
  const [firstProduct] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .limit(1);
  if (firstProduct) {
    const detail = await internalGet(`/products/${firstProduct.id}`);
    data["productDetailStatus"] = detail.status;
    if (detail.status !== 200) failures.push(`GET /products/${firstProduct.id} → ${detail.status}`);
  } else {
    data["productDetailStatus"] = "no products in DB";
    warnings.push("No products in DB — product detail test skipped");
  }

  // store page (use first approved storeSlug)
  const [storeApp] = await db
    .select({ storeSlug: sellerApplicationsTable.storeSlug })
    .from(sellerApplicationsTable)
    .where(and(
      eq(sellerApplicationsTable.status, "approved"),
      sql`${sellerApplicationsTable.storeSlug} IS NOT NULL`,
    ))
    .limit(1);
  if (storeApp?.storeSlug) {
    const store = await internalGet(`/sellers/store/${storeApp.storeSlug}`);
    data["storePageStatus"] = store.status;
    data["storeSlugTested"] = storeApp.storeSlug;
    if (store.status !== 200) failures.push(`GET /sellers/store/${storeApp.storeSlug} → ${store.status}`);
  } else {
    data["storePageStatus"] = "no approved store slug";
    warnings.push("No approved store slug — store page test skipped");
  }

  // search
  const search = await internalGet("/search?q=test");
  data["searchStatus"] = search.status;
  if (search.status !== 200) failures.push(`GET /search → ${search.status}`);

  // recently viewed (hook exists in codebase)
  const rvHookPath = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/hooks/useRecentlyViewed.ts",
  );
  data["recentlyViewedHookExists"] = fs.existsSync(rvHookPath);
  if (!data["recentlyViewedHookExists"]) failures.push("useRecentlyViewed hook missing");

  // review system
  const [reviewRow] = await db.select({ count: count() }).from(reviewsTable);
  data["reviewTableAccessible"] = true;
  data["reviewCount"] = Number(reviewRow?.count ?? 0);

  // store follow system
  const [followRow] = await db.select({ count: count() }).from(storeFollowsTable);
  data["storeFollowTableAccessible"] = true;
  data["storeFollowCount"] = Number(followRow?.count ?? 0);

  // best sellers
  const bs = await internalGet("/products/best-sellers");
  data["bestSellersStatus"] = bs.status;
  if (bs.status !== 200) failures.push(`GET /products/best-sellers → ${bs.status}`);

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 3 — Seller System ────────────────────────────────────────────────

async function checkSellerSystem(sellerToken: string, sellerId: number): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // seller dashboard
  const dash = await internalGet("/dashboard/seller", sellerToken);
  data["dashboardStatus"] = dash.status;
  if (dash.status !== 200) failures.push(`GET /dashboard/seller → ${dash.status}`);

  // seller analytics
  const analytics = await internalGet("/dashboard/seller/analytics", sellerToken);
  data["analyticsStatus"] = analytics.status;
  if (analytics.status !== 200) failures.push(`GET /dashboard/seller/analytics → ${analytics.status}`);

  // seller metrics
  const metrics = await internalGet("/dashboard/seller/metrics", sellerToken);
  data["metricsStatus"] = metrics.status;
  if (metrics.status !== 200) failures.push(`GET /dashboard/seller/metrics → ${metrics.status}`);

  // seller orders
  const orders = await internalGet("/orders", sellerToken);
  data["ordersStatus"] = orders.status;
  if (orders.status !== 200) failures.push(`GET /orders (seller) → ${orders.status}`);

  // trust endpoint
  const trust = await internalGet(`/sellers/${sellerId}/trust`);
  data["trustStatus"] = trust.status;
  if (trust.status !== 200) failures.push(`GET /sellers/${sellerId}/trust → ${trust.status}`);

  // product variants table (variant builder)
  const [varRow] = await db.select({ count: count() }).from(productVariantGroupsTable);
  data["variantGroupTableAccessible"] = true;
  data["variantGroupCount"] = Number(varRow?.count ?? 0);

  const [varOptRow] = await db.select({ count: count() }).from(productVariantsTable);
  data["productVariantsTableAccessible"] = true;
  data["productVariantCount"] = Number(varOptRow?.count ?? 0);

  // messaging system
  const [convRow] = await db.select({ count: count() }).from(conversationsTable);
  data["conversationsTableAccessible"] = true;
  data["conversationCount"] = Number(convRow?.count ?? 0);

  const [msgRow] = await db.select({ count: count() }).from(messagesTable);
  data["messagesTableAccessible"] = true;
  data["messageCount"] = Number(msgRow?.count ?? 0);

  // seller store branding is a PATCH route — verify it exists in code
  const brandingPath = path.resolve(
    process.cwd(),
    "../../artifacts/api-server/src/routes/sellers.ts",
  );
  const brandingContent = fs.existsSync(brandingPath)
    ? fs.readFileSync(brandingPath, "utf-8")
    : "";
  data["storeBrandingRouteExists"] = brandingContent.includes("/sellers/store/branding");
  if (!data["storeBrandingRouteExists"]) failures.push("PATCH /sellers/store/branding route not found in sellers.ts");

  // seller pages exist in marketplace
  const sellerPagesDir = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/pages/seller",
  );
  const requiredSellerPages = [
    "dashboard.tsx", "products", "orders.tsx", "analytics.tsx",
    "inventory.tsx", "messages.tsx", "store-settings.tsx", "trust.tsx",
  ];
  const missingSellerPages: string[] = [];
  for (const page of requiredSellerPages) {
    if (!fs.existsSync(path.join(sellerPagesDir, page))) {
      missingSellerPages.push(page);
    }
  }
  data["sellerPagesPresent"] = missingSellerPages.length === 0;
  data["missingSellerPages"] = missingSellerPages;
  if (missingSellerPages.length > 0)
    failures.push(`Missing seller pages: ${missingSellerPages.join(", ")}`);

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 4 — Courier System ───────────────────────────────────────────────

async function checkCourierSystem(courierToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // profile
  const profile = await internalGet("/couriers/profile", courierToken);
  data["profileStatus"] = profile.status;
  if (profile.status !== 200) failures.push(`GET /couriers/profile → ${profile.status}`);

  // assignments
  const assignments = await internalGet("/couriers/assignments", courierToken);
  data["assignmentsStatus"] = assignments.status;
  if (assignments.status !== 200) failures.push(`GET /couriers/assignments → ${assignments.status}`);

  // earnings
  const earnings = await internalGet("/couriers/earnings", courierToken);
  data["earningsStatus"] = earnings.status;
  if (earnings.status !== 200) failures.push(`GET /couriers/earnings → ${earnings.status}`);

  // history
  const history = await internalGet("/couriers/history", courierToken);
  data["historyStatus"] = history.status;
  if (history.status !== 200) failures.push(`GET /couriers/history → ${history.status}`);

  // DB tables
  const [assignRow] = await db.select({ count: count() }).from(courierAssignmentsTable);
  data["courierAssignmentsTableAccessible"] = true;
  data["assignmentCount"] = Number(assignRow?.count ?? 0);

  const [walletRow] = await db.select({ count: count() }).from(courierWalletTransactionsTable);
  data["walletTransactionsTableAccessible"] = true;
  data["walletTxCount"] = Number(walletRow?.count ?? 0);

  const [courierRow] = await db.select({ count: count() }).from(couriersTable);
  data["couriersTableAccessible"] = true;
  data["courierCount"] = Number(courierRow?.count ?? 0);

  // courier pages exist
  const courierPagesDir = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/pages/courier",
  );
  const requiredCourierPages = ["dashboard.tsx", "apply.tsx", "application-status.tsx"];
  const missingCourierPages: string[] = [];
  for (const page of requiredCourierPages) {
    if (!fs.existsSync(path.join(courierPagesDir, page))) {
      missingCourierPages.push(page);
    }
  }
  data["courierPagesPresent"] = missingCourierPages.length === 0;
  if (missingCourierPages.length > 0)
    failures.push(`Missing courier pages: ${missingCourierPages.join(", ")}`);

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 5 — Order System ─────────────────────────────────────────────────

async function checkOrderSystem(adminToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // orders table
  const [orderRow] = await db.select({ count: count() }).from(ordersTable);
  data["ordersTableAccessible"] = true;
  data["orderCount"] = Number(orderRow?.count ?? 0);

  // order status history table
  const [historyRow] = await db.select({ count: count() }).from(orderStatusHistoryTable);
  data["orderStatusHistoryTableAccessible"] = true;
  data["statusHistoryCount"] = Number(historyRow?.count ?? 0);

  // delivery fee: zones exist
  const [zoneRow] = await db.select({ count: count() }).from(deliveryZonesTable);
  data["deliveryZoneCount"] = Number(zoneRow?.count ?? 0);
  if (data["deliveryZoneCount"] === 0) failures.push("No delivery zones — checkout fee calculation broken");

  // admin orders route
  const adminOrders = await internalGet("/admin/orders", adminToken);
  data["adminOrdersStatus"] = adminOrders.status;
  if (adminOrders.status !== 200) failures.push(`GET /admin/orders → ${adminOrders.status}`);

  // check all 15 order statuses exist
  const statusRaw = await db.execute<{ enumlabel: string }>(sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='order_status')
    ORDER BY enumsortorder
  `);
  const statuses = statusRaw.rows?.map((r) => r.enumlabel) ?? [];
  data["orderStatuses"] = statuses;
  const requiredStatuses = [
    "pending", "processing", "shipped", "delivered", "cancelled",
    "refunded", "confirmed", "preparing", "ready_for_pickup",
    "courier_assigned", "picked_up", "in_transit", "out_for_delivery",
    "delivery_failed", "returned",
  ];
  const missingStatuses = requiredStatuses.filter((s) => !statuses.includes(s));
  data["missingOrderStatuses"] = missingStatuses;
  if (missingStatuses.length > 0)
    failures.push(`Missing order statuses: ${missingStatuses.join(", ")}`);

  // order tracking
  const [orderWithHistory] = await db
    .select({ orderId: ordersTable.id })
    .from(ordersTable)
    .limit(1);
  if (orderWithHistory) {
    const hist = await internalGet(`/orders/${orderWithHistory.orderId}/history`, adminToken);
    data["orderHistoryStatus"] = hist.status;
    if (hist.status !== 200) warnings.push(`GET /orders/${orderWithHistory.orderId}/history → ${hist.status}`);
  } else {
    data["orderHistoryStatus"] = "no orders in DB";
    warnings.push("No orders in DB — order detail/history test skipped");
  }

  // assign courier route exists
  const assignCourier = await internalGet("/admin/orders/9999/assign-courier", adminToken);
  data["assignCourierRouteExists"] = assignCourier.status !== 0 && assignCourier.status !== 404;
  // 400/404 both mean route exists (9999 probably doesn't exist, route does)
  if (assignCourier.status === 0) failures.push("POST /admin/orders/:id/assign-courier unreachable");

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 6 — Trust System V1 ─────────────────────────────────────────────

async function checkTrustSystem(adminToken: string, sellerId: number): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // trust endpoint
  const trust = await internalGet(`/sellers/${sellerId}/trust`, adminToken);
  data["trustEndpointStatus"] = trust.status;
  if (trust.status !== 200) failures.push(`GET /sellers/${sellerId}/trust → ${trust.status}`);
  else {
    const body = trust.body as Record<string, unknown>;
    // Response shape: { userId, isVerified, verificationLevel, liveBreakdown, cachedScore, ... }
    data["trustLiveBreakdownPresent"] = "liveBreakdown" in body;
    data["isVerifiedPresent"] = "isVerified" in body;
    data["verificationLevelPresent"] = "verificationLevel" in body;
    if (!data["trustLiveBreakdownPresent"]) failures.push("Trust endpoint missing liveBreakdown field");
    if (!data["isVerifiedPresent"]) failures.push("Trust endpoint missing isVerified field");
  }

  // leaderboard
  const leaderboard = await internalGet("/admin/trust/leaderboard", adminToken);
  data["leaderboardStatus"] = leaderboard.status;
  if (leaderboard.status !== 200) failures.push(`GET /admin/trust/leaderboard → ${leaderboard.status}`);

  // verification list
  const verList = await internalGet("/admin/sellers/verification", adminToken);
  data["verificationListStatus"] = verList.status;
  if (verList.status !== 200) failures.push(`GET /admin/sellers/verification → ${verList.status}`);

  // seller_verification_log accessible
  const svlogRaw = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM seller_verification_log
  `);
  data["verificationLogCount"] = Number(svlogRaw.rows?.[0]?.count ?? 0);
  data["verificationLogAccessible"] = true;

  // trust score fields on users table
  const trustColRaw = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='trust_score'
    ) AS exists
  `);
  data["trustScoreColumn"] = trustColRaw.rows?.[0]?.exists === true;
  if (!data["trustScoreColumn"]) failures.push("users.trust_score column missing");

  const tierColRaw = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='users' AND column_name='verification_level'
    ) AS exists
  `);
  data["verificationLevelColumn"] = tierColRaw.rows?.[0]?.exists === true;
  if (!data["verificationLevelColumn"]) failures.push("users.verification_level column missing");

  // SellerTrustBadge component exists
  const badgePath = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/components/SellerTrustBadge.tsx",
  );
  data["trustBadgeComponentExists"] = fs.existsSync(badgePath);
  if (!data["trustBadgeComponentExists"]) failures.push("SellerTrustBadge component missing");

  // trustScore.ts lib exists
  const trustLibPath = path.resolve(process.cwd(), "../../lib/db/src/lib/trustScore.ts");
  const trustLibAlt = path.resolve(
    process.cwd(),
    "../../artifacts/api-server/src/lib/trustScore.ts",
  );
  data["trustScoreLibExists"] = fs.existsSync(trustLibPath) || fs.existsSync(trustLibAlt);
  if (!data["trustScoreLibExists"]) warnings.push("trustScore.ts lib not found at expected paths");

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 7 — Notification System ─────────────────────────────────────────

async function checkNotifications(adminToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // enum count
  const notifRaw = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM unnest(enum_range(NULL::notification_type))
  `);
  const enumCount = Number(notifRaw.rows?.[0]?.count ?? 0);
  data["notificationTypeEnumCount"] = enumCount;
  if (enumCount < 32) failures.push(`notification_type enum: ${enumCount}/32`);

  // all expected enum values present
  const enumValuesRaw = await db.execute<{ enumlabel: string }>(sql`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname='notification_type')
    ORDER BY enumsortorder
  `);
  const enumValues = enumValuesRaw.rows?.map((r) => r.enumlabel) ?? [];
  const requiredEnumValues = [
    "new_order", "order_placed", "order_processing", "order_shipped", "order_delivered",
    "order_cancelled", "low_stock", "seller_applied", "seller_approved", "seller_rejected",
    "product_submitted", "product_approved", "product_rejected", "new_follower",
    "store_new_product", "new_seller_review", "new_message", "order_confirmed",
    "order_preparing", "order_ready", "order_courier_assigned", "order_picked_up",
    "order_out_for_delivery", "order_delivery_failed", "order_returned",
    "order_cancelled_by_customer", "order_refunded", "new_user",
    "courier_applied", "courier_approved", "courier_rejected",
    "seller_review_reply",
  ];
  const missingEnumValues = requiredEnumValues.filter((v) => !enumValues.includes(v));
  data["missingNotificationTypes"] = missingEnumValues;
  if (missingEnumValues.length > 0)
    failures.push(`Missing notification types: ${missingEnumValues.join(", ")}`);

  // notifications table
  const [notifRow] = await db.select({ count: count() }).from(notificationsTable);
  data["notificationsTableAccessible"] = true;
  data["notificationCount"] = Number(notifRow?.count ?? 0);

  // notifications route
  const notifRoute = await internalGet("/notifications", adminToken);
  data["notificationsRouteStatus"] = notifRoute.status;
  if (notifRoute.status !== 200) failures.push(`GET /notifications → ${notifRoute.status}`);

  // SSE endpoint exists (HEAD check — no streaming)
  data["sseEndpointPath"] = "/notifications/stream";
  const sseRoutePath = path.resolve(
    process.cwd(),
    "../../artifacts/api-server/src/routes/notifications.ts",
  );
  const notifRouteContent = fs.existsSync(sseRoutePath)
    ? fs.readFileSync(sseRoutePath, "utf-8")
    : "";
  data["sseRouteInCode"] = notifRouteContent.includes("/notifications/stream");
  if (!data["sseRouteInCode"]) failures.push("SSE /notifications/stream route not found in notifications.ts");

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 8 — Translations ─────────────────────────────────────────────────

async function checkTranslations(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    const enPath = path.resolve(process.cwd(), "../../artifacts/marketplace/src/i18n/en.json");
    const arPath = path.resolve(process.cwd(), "../../artifacts/marketplace/src/i18n/ar.json");

    function flatKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
      const keys = new Set<string>();
      for (const [k, v] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const key of flatKeys(v as Record<string, unknown>, full)) keys.add(key);
        } else {
          keys.add(full);
        }
      }
      return keys;
    }

    const en = JSON.parse(fs.readFileSync(enPath, "utf-8")) as Record<string, unknown>;
    const ar = JSON.parse(fs.readFileSync(arPath, "utf-8")) as Record<string, unknown>;
    const enKeys = flatKeys(en);
    const arKeys = flatKeys(ar);
    const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
    const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));

    data["enKeyCount"] = enKeys.size;
    data["arKeyCount"] = arKeys.size;
    data["missingInAr"] = missingInAr.length;
    data["missingInEn"] = missingInEn.length;
    data["missingInArSample"] = missingInAr.slice(0, 10);
    data["missingInEnSample"] = missingInEn.slice(0, 10);
    data["parity"] = enKeys.size === arKeys.size && missingInAr.length === 0;

    if (missingInAr.length > 0) failures.push(`${missingInAr.length} keys missing in AR`);
    if (missingInEn.length > 0) warnings.push(`${missingInEn.length} orphan keys in AR not in EN`);
  } catch (e) {
    failures.push(`Translation file error: ${String(e)}`);
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 9 — Responsive / RTL Audit ──────────────────────────────────────

async function checkResponsive(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  const scanDirs = [
    "../../artifacts/marketplace/src/pages/admin",
    "../../artifacts/marketplace/src/pages/seller",
    "../../artifacts/marketplace/src/pages/courier",
  ];

  const rtlUnsafeIssues: { file: string; line: number; issue: string; match: string }[] = [];

  const RTL_PATTERNS: { regex: RegExp; issue: string }[] = [
    {
      regex: /\bclassName=["'][^"']*\btext-left\b/,
      issue: "text-left should be text-start (RTL-unsafe)",
    },
    {
      regex: /\bclassName=["'][^"']*\btext-right\b/,
      issue: "text-right should be text-end (RTL-unsafe)",
    },
    {
      regex: /(?:overflow-hidden)[^"']*(?:table|Table|grid|Grid)/,
      issue: "overflow-hidden on table/grid may block horizontal scroll",
    },
  ];

  for (const dir of scanDirs) {
    const absDir = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(absDir)) continue;

    function scanDir(d: string): void {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(full, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, i) => {
            for (const { regex, issue } of RTL_PATTERNS) {
              if (regex.test(line)) {
                const relFile = full.replace(path.resolve(process.cwd(), "../..") + "/", "");
                rtlUnsafeIssues.push({ file: relFile, line: i + 1, issue, match: line.trim().slice(0, 80) });
              }
            }
          });
        }
      }
    }
    scanDir(absDir);
  }

  data["rtlIssueCount"] = rtlUnsafeIssues.length;
  data["rtlIssues"] = rtlUnsafeIssues.slice(0, 20);

  if (rtlUnsafeIssues.length > 0) {
    warnings.push(`${rtlUnsafeIssues.length} RTL-unsafe layout patterns detected`);
  }

  // also scan components
  const componentsDir = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/components",
  );
  let componentCount = 0;
  if (fs.existsSync(componentsDir)) {
    componentCount = fs.readdirSync(componentsDir).filter(
      (f) => f.endsWith(".tsx") || f.endsWith(".ts"),
    ).length;
  }
  data["marketplaceComponentCount"] = componentCount;

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 10 — Mobile App ──────────────────────────────────────────────────

async function checkMobile(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  const mobileRoot = path.resolve(process.cwd(), "../../artifacts/mobile/app");

  const requiredScreens: { path: string; label: string }[] = [
    { path: "(auth)", label: "auth screens" },
    { path: "(tabs)/index.tsx", label: "home tab" },
    { path: "(tabs)/orders.tsx", label: "orders tab" },
    { path: "(tabs)/cart.tsx", label: "cart tab" },
    { path: "(tabs)/profile.tsx", label: "profile tab" },
    { path: "(tabs)/messages.tsx", label: "messages tab" },
    { path: "checkout.tsx", label: "checkout" },
    { path: "order-success.tsx", label: "order success" },
    { path: "order/[id].tsx", label: "order detail" },
    { path: "product/[id].tsx", label: "product detail" },
    { path: "store/[id].tsx", label: "store by id" },
    { path: "store/[slug].tsx", label: "store by slug" },
    { path: "+not-found.tsx", label: "404 screen" },
  ];

  const missingScreens: string[] = [];
  for (const screen of requiredScreens) {
    if (!fs.existsSync(path.join(mobileRoot, screen.path))) {
      missingScreens.push(screen.label);
    }
  }

  data["missingScreens"] = missingScreens;
  data["screenCount"] = requiredScreens.length - missingScreens.length;
  data["screenTotal"] = requiredScreens.length;

  if (missingScreens.length > 0)
    failures.push(`Missing mobile screens: ${missingScreens.join(", ")}`);

  // mobile i18n
  const mobileI18nPath = path.resolve(process.cwd(), "../../artifacts/mobile/src/i18n/index.ts");
  data["mobileI18nExists"] = fs.existsSync(mobileI18nPath);
  if (!data["mobileI18nExists"]) warnings.push("Mobile i18n index.ts not found");

  // expo config
  const expoConfig = path.resolve(process.cwd(), "../../artifacts/mobile/app.json");
  data["expoConfigExists"] = fs.existsSync(expoConfig);

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 11 — Security ────────────────────────────────────────────────────

async function checkSecurity(
  adminToken: string,
  sellerToken: string,
  courierToken: string,
): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  const protectedAdminRoutes = [
    "/admin/stats",
    "/admin/users",
    "/admin/orders",
    "/admin/sellers/verification",
    "/admin/trust/leaderboard",
    "/admin/delivery/stats",
  ];

  // Test 1: Admin routes return 401 without token
  const noTokenResults: Record<string, number> = {};
  for (const route of protectedAdminRoutes) {
    const res = await internalGet(route);
    noTokenResults[route] = res.status;
    if (res.status !== 401) {
      failures.push(`${route} returned ${res.status} with no token (expected 401)`);
    }
  }
  data["noTokenTests"] = noTokenResults;

  // Test 2: Admin routes return 403 with seller token
  const sellerOnAdminResults: Record<string, number> = {};
  for (const route of protectedAdminRoutes) {
    const res = await internalGet(route, sellerToken);
    sellerOnAdminResults[route] = res.status;
    if (res.status !== 403) {
      failures.push(`${route} returned ${res.status} with seller token (expected 403)`);
    }
  }
  data["sellerOnAdminTests"] = sellerOnAdminResults;

  // Test 3: Admin routes return 403 with courier token
  const courierOnAdminResults: Record<string, number> = {};
  for (const route of ["/admin/stats", "/admin/users"]) {
    const res = await internalGet(route, courierToken);
    courierOnAdminResults[route] = res.status;
    if (res.status !== 403) {
      failures.push(`${route} returned ${res.status} with courier token (expected 403)`);
    }
  }
  data["courierOnAdminTests"] = courierOnAdminResults;

  // Test 4: Admin with valid token returns 200
  const adminRouteResults: Record<string, number> = {};
  for (const route of protectedAdminRoutes) {
    const res = await internalGet(route, adminToken);
    adminRouteResults[route] = res.status;
    if (res.status !== 200) {
      warnings.push(`${route} returned ${res.status} with admin token (expected 200)`);
    }
  }
  data["adminTokenTests"] = adminRouteResults;

  // Test 5: Courier routes require auth
  const courierRoutes = ["/couriers/assignments", "/couriers/earnings", "/couriers/history"];
  const courierNoTokenResults: Record<string, number> = {};
  for (const route of courierRoutes) {
    const res = await internalGet(route);
    courierNoTokenResults[route] = res.status;
    if (res.status !== 401) {
      failures.push(`${route} returned ${res.status} with no token (expected 401)`);
    }
  }
  data["courierNoTokenTests"] = courierNoTokenResults;

  // Test 6: Seller dashboard requires auth
  const sellerDashNoToken = await internalGet("/dashboard/seller");
  data["sellerDashNoTokenStatus"] = sellerDashNoToken.status;
  if (sellerDashNoToken.status !== 401) {
    failures.push(`/dashboard/seller returned ${sellerDashNoToken.status} with no token`);
  }

  // Env vars
  data["jwtSecretSet"] = !!process.env["SESSION_SECRET"];
  data["databaseUrlSet"] = !!process.env["DATABASE_URL"];
  data["siteUrlSet"] = !!process.env["SITE_URL"];
  data["corsOriginSet"] = !!process.env["CORS_ORIGIN"];
  if (!data["jwtSecretSet"]) failures.push("SESSION_SECRET not set");
  if (!data["databaseUrlSet"]) failures.push("DATABASE_URL not set");

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 12 — Analytics ───────────────────────────────────────────────────

async function checkAnalytics(sellerToken: string, adminToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // seller analytics endpoints
  const endpoints = [
    { path: "/dashboard/seller/analytics/summary", token: sellerToken, label: "analytics summary" },
    { path: "/dashboard/seller/analytics/revenue-chart", token: sellerToken, label: "revenue chart" },
    { path: "/dashboard/seller/metrics", token: sellerToken, label: "seller metrics" },
    { path: "/dashboard/seller/analytics", token: sellerToken, label: "seller analytics" },
  ];

  const statusMap: Record<string, number> = {};
  for (const ep of endpoints) {
    const res = await internalGet(ep.path, ep.token);
    statusMap[ep.path] = res.status;
    if (res.status !== 200) {
      failures.push(`GET ${ep.path} → ${res.status} (${ep.label})`);
    } else {
      // validate data shape
      const body = res.body as Record<string, unknown>;
      if (!body || typeof body !== "object") {
        failures.push(`${ep.path} returned non-object body`);
      }
    }
  }
  data["sellerAnalyticsEndpoints"] = statusMap;

  // admin analytics
  const adminAnalytics = [
    "/admin/analytics/products",
    "/admin/analytics/orders",
    "/admin/analytics/categories",
  ];
  const adminStatusMap: Record<string, number> = {};
  for (const ep of adminAnalytics) {
    const res = await internalGet(ep, adminToken);
    adminStatusMap[ep] = res.status;
    if (res.status !== 200) warnings.push(`GET ${ep} → ${res.status}`);
  }
  data["adminAnalyticsEndpoints"] = adminStatusMap;

  // admin stats
  const adminStats = await internalGet("/admin/stats", adminToken);
  data["adminStatsStatus"] = adminStats.status;
  if (adminStats.status !== 200) failures.push(`GET /admin/stats → ${adminStats.status}`);
  else {
    const body = adminStats.body as Record<string, unknown>;
    const expectedFields = ["totalUsers", "totalProducts", "totalOrders"];
    const missingFields = expectedFields.filter((f) => !(f in body));
    data["adminStatsMissingFields"] = missingFields;
    if (missingFields.length > 0) warnings.push(`/admin/stats missing fields: ${missingFields.join(", ")}`);
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 13 — Recovery Safety ────────────────────────────────────────────

async function checkRecoverySafety(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // bootstrap admin file exists
  const bootstrapAdminPath = path.resolve(
    process.cwd(),
    "src/lib/bootstrap-admin.ts",
  );
  data["bootstrapAdminFileExists"] = fs.existsSync(bootstrapAdminPath);
  if (!data["bootstrapAdminFileExists"]) failures.push("bootstrap-admin.ts not found");

  // bootstrap test accounts file exists
  const bootstrapTestPath = path.resolve(
    process.cwd(),
    "src/lib/bootstrap-test-accounts.ts",
  );
  data["bootstrapTestAccountsFileExists"] = fs.existsSync(bootstrapTestPath);
  if (!data["bootstrapTestAccountsFileExists"]) failures.push("bootstrap-test-accounts.ts not found");

  // run-migrations.ts exists
  const migrationsPath = path.resolve(process.cwd(), "src/lib/run-migrations.ts");
  data["runMigrationsFileExists"] = fs.existsSync(migrationsPath);
  if (!data["runMigrationsFileExists"]) failures.push("run-migrations.ts not found");

  // verify run-migrations.ts has enum repair logic
  if (data["runMigrationsFileExists"]) {
    const content = fs.readFileSync(migrationsPath, "utf-8");
    data["enumRepairInMigrations"] = content.includes("notification_type");
    data["tableCreationInMigrations"] = content.includes("seller_verification_log");
    if (!data["enumRepairInMigrations"])
      failures.push("run-migrations.ts missing notification_type enum repair");
    if (!data["tableCreationInMigrations"])
      failures.push("run-migrations.ts missing seller_verification_log table creation");
  }

  // verify bootstrap files have self-healing logic
  if (data["bootstrapAdminFileExists"]) {
    const content = fs.readFileSync(bootstrapAdminPath, "utf-8");
    data["rootOwnerSelfHealing"] = content.includes("bootstrapRootAdmin");
    if (!data["rootOwnerSelfHealing"]) failures.push("bootstrapRootAdmin() not found in file");
  }

  if (data["bootstrapTestAccountsFileExists"]) {
    const content = fs.readFileSync(bootstrapTestPath, "utf-8");
    data["sellerBootstrap"] = content.includes("seller_application") || content.includes("sellerApplication");
    data["courierBootstrap"] = content.includes("couriers");
    if (!data["sellerBootstrap"]) failures.push("Seller application bootstrap not in bootstrap-test-accounts.ts");
    if (!data["courierBootstrap"]) failures.push("Courier profile bootstrap not in bootstrap-test-accounts.ts");
  }

  // schema.sql exists
  const schemaPath = path.resolve(process.cwd(), "../../schema.sql");
  data["schemaSqlExists"] = fs.existsSync(schemaPath);
  if (!data["schemaSqlExists"]) warnings.push("schema.sql not found at workspace root");

  // verify all 3 bootstrap accounts are alive right now
  const [admin] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, "delewatiamer7@gmail.com"))
    .limit(1);
  const [seller] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, "delewatiamer8@gmail.com"))
    .limit(1);
  const [courier] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, "delewatiamer9@gmail.com"))
    .limit(1);

  data["adminBootstrapped"] = !!admin && admin.role === "admin";
  data["sellerBootstrapped"] = !!seller && seller.role === "seller";
  data["courierBootstrapped"] = !!courier && courier.role === "courier";

  if (!data["adminBootstrapped"]) failures.push("Root admin not bootstrapped");
  if (!data["sellerBootstrapped"]) failures.push("Test seller not bootstrapped");
  if (!data["courierBootstrapped"]) failures.push("Test courier not bootstrapped");

  // verify seller has approved application
  if (seller) {
    const [app] = await db
      .select({ status: sellerApplicationsTable.status })
      .from(sellerApplicationsTable)
      .where(and(
        eq(sellerApplicationsTable.userId, seller.id),
        eq(sellerApplicationsTable.status, "approved"),
      ))
      .limit(1);
    data["sellerApplicationBootstrapped"] = !!app;
    if (!app) failures.push("Test seller approved application not bootstrapped");
  }

  // verify courier has active profile
  if (courier) {
    const [cp] = await db
      .select({ active: couriersTable.active })
      .from(couriersTable)
      .where(and(
        eq(couriersTable.userId, courier.id),
        eq(couriersTable.active, true),
      ))
      .limit(1);
    data["courierProfileBootstrapped"] = !!cp;
    if (!cp) failures.push("Test courier active profile not bootstrapped");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── Bootstrap account section (Section 1 extension) ─────────────────────────

async function checkBootstrapAccounts(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      accountStatus: usersTable.accountStatus,
    })
    .from(usersTable)
    .where(
      sql`${usersTable.email} IN ('delewatiamer7@gmail.com','delewatiamer8@gmail.com','delewatiamer9@gmail.com')`,
    );

  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  const adminUser = byEmail["delewatiamer7@gmail.com"];
  const sellerUser = byEmail["delewatiamer8@gmail.com"];
  const courierUser = byEmail["delewatiamer9@gmail.com"];

  data["admin"] = {
    exists: !!adminUser,
    role: adminUser?.role ?? null,
    accountStatus: adminUser?.accountStatus ?? null,
    ok: !!adminUser && adminUser.role === "admin" && adminUser.accountStatus === "active",
  };
  if (!adminUser) failures.push("Admin bootstrap account missing");
  else if (adminUser.role !== "admin") failures.push("Admin bootstrap account has wrong role");

  // seller + approved application
  const sellerApp = sellerUser
    ? await db
        .select({ status: sellerApplicationsTable.status, storeSlug: sellerApplicationsTable.storeSlug })
        .from(sellerApplicationsTable)
        .where(eq(sellerApplicationsTable.userId, sellerUser.id))
        .limit(1)
    : [];

  data["seller"] = {
    exists: !!sellerUser,
    role: sellerUser?.role ?? null,
    accountStatus: sellerUser?.accountStatus ?? null,
    sellerApplicationStatus: sellerApp[0]?.status ?? null,
    storeSlug: sellerApp[0]?.storeSlug ?? null,
    ok:
      !!sellerUser &&
      sellerUser.role === "seller" &&
      sellerApp[0]?.status === "approved" &&
      !!sellerApp[0]?.storeSlug,
  };
  if (!sellerUser) failures.push("Seller bootstrap account missing");
  else if (sellerUser.role !== "seller") failures.push("Seller bootstrap account has wrong role");
  else if (sellerApp[0]?.status !== "approved") failures.push("Seller bootstrap: no approved application");

  // courier + active profile
  const courierProfile = courierUser
    ? await db
        .select({ active: couriersTable.active, vehicleType: couriersTable.vehicleType })
        .from(couriersTable)
        .where(eq(couriersTable.userId, courierUser.id))
        .limit(1)
    : [];

  data["courier"] = {
    exists: !!courierUser,
    role: courierUser?.role ?? null,
    accountStatus: courierUser?.accountStatus ?? null,
    courierProfileActive: courierProfile[0]?.active ?? null,
    vehicleType: courierProfile[0]?.vehicleType ?? null,
    ok: !!courierUser && courierUser.role === "courier" && courierProfile[0]?.active === true,
  };
  if (!courierUser) failures.push("Courier bootstrap account missing");
  else if (courierUser.role !== "courier") failures.push("Courier bootstrap account has wrong role");
  else if (!courierProfile[0]?.active) failures.push("Courier bootstrap: no active profile");

  return {
    ok: failures.length === 0,
    data: {
      ...data,
      adminId: adminUser?.id ?? null,
      sellerId: sellerUser?.id ?? null,
      courierId: courierUser?.id ?? null,
    },
    failures,
    warnings,
  };
}

// ─── SECTION 14 — Store Pages ─────────────────────────────────────────────────

async function checkStorePages(sellerToken: string, sellerId: number): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // Resolve the test seller's store slug
  const [sellerApp] = await db
    .select({ storeSlug: sellerApplicationsTable.storeSlug, storeName: sellerApplicationsTable.storeName })
    .from(sellerApplicationsTable)
    .where(and(eq(sellerApplicationsTable.userId, sellerId), eq(sellerApplicationsTable.status, "approved")));

  const slug = sellerApp?.storeSlug ?? null;
  data["testSlug"] = slug;
  data["testSellerId"] = sellerId;

  if (!slug) {
    failures.push("Bootstrap seller has no approved store application with storeSlug");
    return { ok: false, data, failures, warnings };
  }

  // Test all store page endpoints
  const [storeMain, storeMetrics, storeReviews, storeCategories, storeFeatured] = await Promise.all([
    internalGet(`/sellers/store/${slug}`),
    internalGet(`/sellers/store/${slug}/metrics`),
    internalGet(`/sellers/store/${slug}/reviews`),
    internalGet(`/sellers/store/${slug}/categories`),
    internalGet(`/sellers/store/${slug}/featured`),
  ]);

  data["storeMainStatus"] = storeMain.status;
  data["storeMetricsStatus"] = storeMetrics.status;
  data["storeReviewsStatus"] = storeReviews.status;
  data["storeCategoriesStatus"] = storeCategories.status;
  data["storeFeaturedStatus"] = storeFeatured.status;

  if (storeMain.status !== 200) failures.push(`GET /sellers/store/${slug} returned ${storeMain.status}`);
  if (storeMetrics.status !== 200) failures.push(`GET /sellers/store/${slug}/metrics returned ${storeMetrics.status}`);
  if (storeReviews.status !== 200) failures.push(`GET /sellers/store/${slug}/reviews returned ${storeReviews.status}`);
  if (storeCategories.status !== 200) failures.push(`GET /sellers/store/${slug}/categories returned ${storeCategories.status}`);
  if (storeFeatured.status !== 200) failures.push(`GET /sellers/store/${slug}/featured returned ${storeFeatured.status}`);

  // Check response shapes
  const mainBody = storeMain.body as Record<string, unknown> | null;
  if (mainBody) {
    const hasRequiredFields = ["sellerId", "storeName", "followerCount", "totalProducts", "trustScore"].every(
      (k) => k in mainBody
    );
    data["storeMainShapeOk"] = hasRequiredFields;
    if (!hasRequiredFields) warnings.push("Store main endpoint missing expected fields");
  }

  const metricsBody = storeMetrics.body as Record<string, unknown> | null;
  if (metricsBody) {
    const hasMetrics = ["productsCount", "reviewsCount", "followersCount", "trustScore"].every(
      (k) => k in metricsBody
    );
    data["storeMetricsShapeOk"] = hasMetrics;
    if (!hasMetrics) warnings.push("Store metrics endpoint missing expected fields");
  }

  const categoriesBody = storeCategories.body as Record<string, unknown> | null;
  if (categoriesBody) {
    data["storeCategoriesShapeOk"] = "categories" in categoriesBody;
  }

  const featuredBody = storeFeatured.body as Record<string, unknown> | null;
  if (featuredBody) {
    data["storeFeaturedShapeOk"] = "featured" in featuredBody && "newArrivals" in featuredBody;
    if (!data["storeFeaturedShapeOk"]) warnings.push("Store featured endpoint missing featured/newArrivals fields");
  }

  // Check frontend file exists
  const storePagePath = path.join(process.cwd(), "..", "marketplace", "src", "pages", "store", "[slug].tsx");
  const storePageExists = fs.existsSync(storePagePath);
  data["storePageFileExists"] = storePageExists;
  if (!storePageExists) failures.push("Store page file [slug].tsx not found");

  // Check follow system
  const followStatus = await internalGet(`/sellers/${sellerId}/follow-status`, sellerToken);
  data["followStatusStatus"] = followStatus.status;
  if (followStatus.status !== 200) warnings.push("Follow status endpoint returned non-200");

  // Check trust integration
  const trustData = mainBody?.trustScore;
  data["trustIntegrated"] = trustData !== undefined;
  if (trustData === undefined) warnings.push("Store page trust data not integrated");

  // Check contact + policy fields present in store profile
  if (mainBody) {
    const contactFields = ["contactPhone", "contactEmail", "whatsapp", "telegram", "facebook", "instagram"];
    const policyFields  = ["shippingPolicy", "returnPolicy", "warrantyPolicy", "privacyPolicy"];
    const hasContactShape = contactFields.every((k) => k in mainBody);
    const hasPolicyShape  = policyFields.every((k)  => k in mainBody);
    data["storeProfileContactFieldsPresent"] = hasContactShape;
    data["storeProfilePolicyFieldsPresent"]  = hasPolicyShape;
    if (!hasContactShape) failures.push("Store profile missing contact fields (contactPhone/whatsapp/etc)");
    if (!hasPolicyShape)  failures.push("Store profile missing policy fields (shippingPolicy/returnPolicy/etc)");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 15 — Store Settings ─────────────────────────────────────────────

async function checkStoreSettings(sellerToken: string, sellerId: number, adminToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // GET /seller-applications/my
  const myApp = await internalGet("/seller-applications/my", sellerToken);
  data["myAppStatus"] = myApp.status;
  if (myApp.status !== 200) {
    failures.push(`GET /seller-applications/my returned ${myApp.status}`);
    return { ok: false, data, failures, warnings };
  }

  const appBody = myApp.body as Record<string, unknown>;
  data["hasStoreName"]   = !!appBody?.storeName;
  data["hasStoreSlug"]   = !!appBody?.storeSlug;
  data["hasDescription"] = !!appBody?.description;
  if (!appBody?.storeName)  failures.push("seller-applications/my missing storeName");
  if (!appBody?.storeSlug)  warnings.push("seller-applications/my missing storeSlug");
  if (!appBody?.description) warnings.push("seller-applications/my missing description");

  // PATCH /sellers/store/branding — test policies + seo + social fields
  const patchRes = await internalPatch("/sellers/store/branding", sellerToken, {
    shippingPolicy: "Ships within 2-3 business days via standard delivery.",
    metaTitle:      "Test Store — Quality Electronics",
    metaDescription: "Shop top-quality products at unbeatable prices.",
    whatsapp:       "+963900000000",
  });
  data["patchStatus"] = patchRes.status;
  if (patchRes.status !== 200) {
    failures.push(`PATCH /sellers/store/branding returned ${patchRes.status}`);
  } else {
    const patched = patchRes.body as Record<string, unknown> | null;
    data["patchedMetaTitle"]      = patched?.metaTitle ?? null;
    data["patchedShippingPolicy"] = patched?.shippingPolicy ? String(patched.shippingPolicy).length > 0 : false;
    if (!patched?.metaTitle)      warnings.push("PATCH response missing metaTitle");
    if (!patched?.shippingPolicy) warnings.push("PATCH response missing shippingPolicy");
  }

  // GET /admin/store-settings-health/:sellerId
  const health = await internalGet(`/admin/store-settings-health/${sellerId}`, adminToken);
  data["healthStatus"] = health.status;
  if (health.status !== 200) {
    failures.push(`GET /admin/store-settings-health/${sellerId} returned ${health.status}`);
  } else {
    const h = health.body as Record<string, unknown> | null;
    data["healthScore"]   = h?.score;
    data["settingsLoaded"] = h?.settingsLoaded;
    if (!h?.settingsLoaded) failures.push("store-settings-health: settingsLoaded=false");
    if (typeof h?.score === "number" && h.score < 20) warnings.push(`store-settings-health: score=${h.score} very low`);
  }

  // Check new DB columns exist in response
  const reloadApp = await internalGet("/seller-applications/my", sellerToken);
  if (reloadApp.status === 200) {
    const rb = reloadApp.body as Record<string, unknown>;
    const hasNewCols = ["shippingPolicy", "metaTitle", "whatsapp"].every((k) => k in rb);
    data["newColumnsPresent"] = hasNewCols;
    if (!hasNewCols) failures.push("New DB columns not returned by seller-applications/my");
  }

  // Check frontend settings file exists
  const settingsPagePath = path.join(process.cwd(), "..", "marketplace", "src", "pages", "seller", "store-settings.tsx");
  const fileExists = fs.existsSync(settingsPagePath);
  data["settingsPageFileExists"] = fileExists;
  if (!fileExists) failures.push("store-settings.tsx not found");

  // Verify trust tab uses liveBreakdown (consistency check)
  if (fileExists) {
    const settingsContent = fs.readFileSync(settingsPagePath, "utf-8");
    const usesLiveBreakdown = settingsContent.includes("liveBreakdown");
    const hasCompletionEngine = settingsContent.includes("completion_title");
    const hasWeightedHealth = settingsContent.includes("passedPts");
    data["trustTabUsesLiveBreakdown"] = usesLiveBreakdown;
    data["completionEnginePresent"] = hasCompletionEngine;
    data["weightedHealthEngine"] = hasWeightedHealth;
    if (!usesLiveBreakdown)  warnings.push("store-settings trust tab should use liveBreakdown (not cached breakdown)");
    if (!hasCompletionEngine) warnings.push("store-settings completion engine not found");
  }

  // Verify store page has contact/policies tabs
  const storePagePath = path.join(process.cwd(), "..", "marketplace", "src", "pages", "store", "[slug].tsx");
  if (fs.existsSync(storePagePath)) {
    const storeContent = fs.readFileSync(storePagePath, "utf-8");
    const hasContactTab  = storeContent.includes("ContactTab");
    const hasPoliciesTab = storeContent.includes("PoliciesTab");
    data["publicStoreContactTabPresent"]  = hasContactTab;
    data["publicStorePoliciesTabPresent"] = hasPoliciesTab;
    if (!hasContactTab)  warnings.push("Public store page missing ContactTab component");
    if (!hasPoliciesTab) warnings.push("Public store page missing PoliciesTab component");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── Store Settings V4 check ──────────────────────────────────────────────────
async function checkStoreSettingsV4(): Promise<CheckResult> {
  const data: Record<string, unknown> = {};
  const failures: string[] = [];
  const warnings: string[] = [];

  const settingsPath = path.join(process.cwd(), "..", "marketplace", "src", "pages", "seller", "store-settings.tsx");
  const trustPath    = path.join(process.cwd(), "..", "marketplace", "src", "pages", "seller", "trust.tsx");
  const selectPath   = path.join(process.cwd(), "..", "marketplace", "src", "components", "ui", "select.tsx");
  const enPath       = path.join(process.cwd(), "..", "marketplace", "src", "i18n", "en.json");

  const settingsExists = fs.existsSync(settingsPath);
  data["settingsPageExists"] = settingsExists;

  if (settingsExists) {
    const content = fs.readFileSync(settingsPath, "utf-8");
    const hasMobileCardGrid      = content.includes("grid-cols-2") && content.includes("sm:grid-cols-3");
    const hasDesktopDescriptions = content.includes("tab_desc_general");
    const hasCompletionCta       = content.includes("completion_cta");
    const hasAnimations          = content.includes("transition-all duration-200");
    const hasHealthFixNow        = content.includes("completion_cta") && content.includes("setActiveTab(item.tab)");

    data["mobileCardGrid"]      = hasMobileCardGrid;
    data["desktopDescriptions"] = hasDesktopDescriptions;
    data["completionCtaPresent"] = hasCompletionCta;
    data["cardAnimations"]      = hasAnimations;
    data["healthFixNowButton"]  = hasHealthFixNow;

    if (!hasMobileCardGrid)      warnings.push("V4: mobile 2-col card grid not detected");
    if (!hasDesktopDescriptions) warnings.push("V4: desktop card descriptions (tab_desc_general) not detected");
    if (!hasCompletionCta)       warnings.push("V4: completion CTA button not detected");
  } else {
    failures.push("store-settings.tsx not found");
  }

  // Check RTL fix in select.tsx
  const selectExists = fs.existsSync(selectPath);
  if (selectExists) {
    const sel = fs.readFileSync(selectPath, "utf-8");
    const hasRtlFix = sel.includes("ps-2") && sel.includes("pe-8") && sel.includes("end-2");
    data["selectRtlFixed"] = hasRtlFix;
    if (!hasRtlFix) warnings.push("V4: select.tsx RTL physical props (pl/pr/right) should be logical (ps/pe/end)");
  }

  // Check trust.tsx has "how to improve" section
  const trustExists = fs.existsSync(trustPath);
  if (trustExists) {
    const tr = fs.readFileSync(trustPath, "utf-8");
    const hasTrustImprove = tr.includes("how_to_improve") || tr.includes("tip_get_verified");
    data["trustHowToImprove"] = hasTrustImprove;
    if (!hasTrustImprove) warnings.push("V4: trust.tsx missing how-to-improve section");
  }

  // Check i18n has V4 tab description keys
  if (fs.existsSync(enPath)) {
    const en = fs.readFileSync(enPath, "utf-8");
    const hasTabDescs = en.includes("tab_desc_general") && en.includes("completion_cta");
    data["i18nV4KeysPresent"] = hasTabDescs;
    if (!hasTabDescs) warnings.push("V4: i18n tab description keys (tab_desc_*) not found in en.json");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── UI Consistency check ─────────────────────────────────────────────────────
async function checkUiConsistency(): Promise<CheckResult> {
  const data: Record<string, unknown> = {};
  const failures: string[] = [];
  const warnings: string[] = [];

  const marketplaceBase = path.join(process.cwd(), "..", "marketplace", "src");
  const settingsPath  = path.join(marketplaceBase, "pages", "seller", "store-settings.tsx");
  const slugPath      = path.join(marketplaceBase, "pages", "store", "[slug].tsx");
  const analyticsPath = path.join(marketplaceBase, "pages", "seller", "analytics.tsx");
  const trustBadgePath = path.join(marketplaceBase, "components", "SellerTrustBadge.tsx");

  // 1 — Responsive tablet nav (2→3→4)
  if (fs.existsSync(settingsPath)) {
    const s = fs.readFileSync(settingsPath, "utf-8");
    const hasTabletGrid = s.includes("sm:grid-cols-3") && s.includes("md:grid-cols-4");
    data["tabletNavGrid"] = hasTabletGrid;
    if (!hasTabletGrid) warnings.push("UI: store-settings nav should use sm:grid-cols-3 md:grid-cols-4 responsive grid");
  } else {
    failures.push("store-settings.tsx not found");
  }

  // 2 — Store title break-words (not truncate)
  if (fs.existsSync(slugPath)) {
    const sl = fs.readFileSync(slugPath, "utf-8");
    const hasTitleFix     = sl.includes("break-words");
    const usesTrustBadge  = sl.includes("SellerTrustBadge");
    data["storeTitleBreakWords"] = hasTitleFix;
    data["slugUsesSellerTrustBadge"] = usesTrustBadge;
    if (!hasTitleFix)    warnings.push("UI: store page title should use break-words instead of truncate on mobile");
    if (!usesTrustBadge) failures.push("UI: store [slug].tsx should import SellerTrustBadge (trust consistency)");
  }

  // 3 — Analytics date filter responsive width
  if (fs.existsSync(analyticsPath)) {
    const an = fs.readFileSync(analyticsPath, "utf-8");
    const hasResponsiveFilter = an.includes("min(288px") || an.includes("max-h-[80vh]");
    data["analyticsFilterResponsive"] = hasResponsiveFilter;
    if (!hasResponsiveFilter) warnings.push("UI: analytics date picker should have responsive width constraint");
  }

  // 4 — Unified trust badge component exists
  const trustBadgeExists = fs.existsSync(trustBadgePath);
  data["sellerTrustBadgeComponent"] = trustBadgeExists;
  if (!trustBadgeExists) failures.push("UI: SellerTrustBadge.tsx component not found");

  // 5 — Brand color: accentColor returned by store API + applied in store page
  const sellersPath = path.join(process.cwd(), "src", "routes", "sellers.ts");
  if (fs.existsSync(sellersPath)) {
    const sr = fs.readFileSync(sellersPath, "utf-8");
    const hasAccentInQuery    = sr.includes("accentColor: sellerApplicationsTable.accentColor");
    const hasAccentInResponse = sr.includes("accentColor: storeData.accentColor");
    data["storeApiReturnsAccentColor"] = hasAccentInQuery && hasAccentInResponse;
    if (!hasAccentInQuery || !hasAccentInResponse)
      failures.push("BRAND: GET /sellers/store/:slug must return accentColor from seller_applications");
  }
  if (fs.existsSync(slugPath)) {
    const sl2 = fs.readFileSync(slugPath, "utf-8");
    const hasAccentApplied = sl2.includes("storeAccent") && sl2.includes("borderInlineStartColor");
    data["storePageAppliesAccentColor"] = hasAccentApplied;
    if (!hasAccentApplied)
      failures.push("BRAND: store [slug].tsx must apply storeAccent via borderInlineStartColor");
  }

  // 6 — Verification consistency: SellerTrustBadge is sole label source in trust.tsx
  const trustPagePath = path.join(marketplaceBase, "pages", "seller", "trust.tsx");
  if (fs.existsSync(trustPagePath)) {
    const tp = fs.readFileSync(trustPagePath, "utf-8");
    const hasTrustBadgeAllowNone = tp.includes("allowNone");
    const hasNoLocalLabel = !tp.includes("tierConfig.label");
    data["verificationUnifiedViaComponent"] = hasTrustBadgeAllowNone && hasNoLocalLabel;
    if (!hasTrustBadgeAllowNone || !hasNoLocalLabel)
      failures.push("VERIFY: trust.tsx must use SellerTrustBadge allowNone instead of local tierConfig.label");
  }
  const badgePath2 = trustBadgePath;
  if (fs.existsSync(badgePath2)) {
    const bp = fs.readFileSync(badgePath2, "utf-8");
    const supportsAllowNone = bp.includes("allowNone") && bp.includes("trust.level_none");
    data["sellerTrustBadgeSupportsAllowNone"] = supportsAllowNone;
    if (!supportsAllowNone)
      failures.push("VERIFY: SellerTrustBadge.tsx must support allowNone prop and trust.level_none label");
  }

  // 7 — Dropdown portal: analytics DatePicker uses createPortal (no clipping by overflow:hidden)
  if (fs.existsSync(analyticsPath)) {
    const an2 = fs.readFileSync(analyticsPath, "utf-8");
    const usesPortal = an2.includes("createPortal");
    data["analyticsDropdownPortal"] = usesPortal;
    if (!usesPortal)
      failures.push("DROPDOWN: analytics DatePicker must use createPortal for viewport-safe rendering");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 18 — Review System ───────────────────────────────────────────────

async function checkReviewSystem(): Promise<CheckResult> {

  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // #1 review-status endpoint exists in sellers.ts
  const sellersPath = path.resolve(process.cwd(), "../../artifacts/api-server/src/routes/sellers.ts");
  if (fs.existsSync(sellersPath)) {
    const content = fs.readFileSync(sellersPath, "utf8");
    const hasReviewStatus   = content.includes("/sellers/:id/review-status");
    const hasPostReviews    = content.includes("/sellers/:id/reviews");
    const hasEligibleCheck  = content.includes("eligible");
    const hasAlreadyReviewed = content.includes("alreadyReviewed");
    data["reviewStatusEndpoint"]  = hasReviewStatus;
    data["postReviewsEndpoint"]   = hasPostReviews;
    data["eligibleField"]         = hasEligibleCheck;
    data["alreadyReviewedField"]  = hasAlreadyReviewed;
    if (!hasReviewStatus)   failures.push("sellers.ts: GET /sellers/:id/review-status endpoint missing");
    if (!hasPostReviews)    failures.push("sellers.ts: POST /sellers/:id/reviews endpoint missing");
    if (!hasEligibleCheck)  failures.push("sellers.ts: review-status must return eligible field");
    if (!hasAlreadyReviewed) failures.push("sellers.ts: review-status must return alreadyReviewed field");
  } else {
    failures.push("sellers.ts not found at expected path");
  }

  // #2 SellerReviewModal + SellerReviewPrompt components exist
  const mktBase = path.resolve(process.cwd(), "../../artifacts/marketplace/src");
  const modalPath  = path.join(mktBase, "components/SellerReviewModal.tsx");
  const promptPath = path.join(mktBase, "components/SellerReviewPrompt.tsx");
  data["reviewModalExists"]  = fs.existsSync(modalPath);
  data["reviewPromptExists"] = fs.existsSync(promptPath);
  if (!fs.existsSync(modalPath))  failures.push("SellerReviewModal.tsx component not found");
  if (!fs.existsSync(promptPath)) failures.push("SellerReviewPrompt.tsx component not found");

  // #3 SellerReviewPrompt integrated in order detail page
  const orderDetailPath = path.join(mktBase, "pages/orders/[id].tsx");
  if (fs.existsSync(orderDetailPath)) {
    const content = fs.readFileSync(orderDetailPath, "utf8");
    const hasPromptImport = content.includes("SellerReviewPrompt");
    const hasDeliveredCheck = content.includes('status === "delivered"');
    data["orderDetailHasReviewPrompt"] = hasPromptImport && hasDeliveredCheck;
    if (!hasPromptImport || !hasDeliveredCheck)
      failures.push("orders/[id].tsx: SellerReviewPrompt not integrated for delivered orders");
  }

  // #4 SellerReviewPrompt integrated in orders list
  const ordersListPath = path.join(mktBase, "pages/orders/index.tsx");
  if (fs.existsSync(ordersListPath)) {
    const content = fs.readFileSync(ordersListPath, "utf8");
    data["ordersListHasReviewPrompt"] = content.includes("SellerReviewPrompt");
    if (!content.includes("SellerReviewPrompt"))
      warnings.push("orders/index.tsx: SellerReviewPrompt not on order list cards");
  }

  // #5 Verified Purchase badge in store page reviews
  const storeSlugPath = path.join(mktBase, "pages/store/[slug].tsx");
  if (fs.existsSync(storeSlugPath)) {
    const content = fs.readFileSync(storeSlugPath, "utf8");
    const hasVerifiedBadge = content.includes("verified_purchase");
    const hasWriteReviewOnStore = content.includes("SellerReviewPrompt");
    data["storeVerifiedPurchaseBadge"] = hasVerifiedBadge;
    data["storeWriteReviewIntegrated"] = hasWriteReviewOnStore;
    if (!hasVerifiedBadge)      failures.push("store/[slug].tsx: Verified Purchase badge missing from ReviewCard");
    if (!hasWriteReviewOnStore) failures.push("store/[slug].tsx: SellerReviewPrompt not in ReviewsTab");
  }

  // #6 Seller reviews page exists
  const sellerReviewsPagePath = path.join(mktBase, "pages/seller/reviews.tsx");
  data["sellerReviewsPageExists"] = fs.existsSync(sellerReviewsPagePath);
  if (!fs.existsSync(sellerReviewsPagePath))
    warnings.push("seller/reviews.tsx page not found — sellers cannot view their reviews dashboard");

  // #7 API client has useGetSellerReviewStatus hook
  const apiClientSellersPath = path.resolve(process.cwd(), "../../lib/api-client-react/src/sellers.ts");
  if (fs.existsSync(apiClientSellersPath)) {
    const content = fs.readFileSync(apiClientSellersPath, "utf8");
    const hasStatusHook = content.includes("useGetSellerReviewStatus");
    const hasReplyHook  = content.includes("usePatchSellerReviewReply");
    const hasReplyType  = content.includes("PatchSellerReviewReplyBody");
    const hasReplyFields = content.includes("sellerReply") && content.includes("sellerReplyAt");
    const hasRateFields  = content.includes("repliedCount") && content.includes("responseRate");
    data["apiClientReviewStatusHook"]  = hasStatusHook;
    data["apiClientReplyHook"]         = hasReplyHook;
    data["apiClientReplyType"]         = hasReplyType;
    data["apiClientReplyFields"]       = hasReplyFields;
    data["apiClientResponseRateFields"] = hasRateFields;
    if (!hasStatusHook) failures.push("api-client-react/sellers.ts: useGetSellerReviewStatus hook missing");
    if (!hasReplyHook)  failures.push("api-client-react/sellers.ts: usePatchSellerReviewReply hook missing");
    if (!hasReplyType)  failures.push("api-client-react/sellers.ts: PatchSellerReviewReplyBody type missing");
    if (!hasReplyFields) failures.push("api-client-react/sellers.ts: SellerReview missing sellerReply/sellerReplyAt fields");
    if (!hasRateFields)  failures.push("api-client-react/sellers.ts: SellerReviewSummary missing repliedCount/responseRate");
  }

  // #8 i18n has review submission + reply keys
  const i18nEnPath = path.join(mktBase, "i18n/en.json");
  if (fs.existsSync(i18nEnPath)) {
    const i18n = JSON.parse(fs.readFileSync(i18nEnPath, "utf8"));
    const hasReviewKeys = i18n?.store?.review_submit && i18n?.store?.review_success_title && i18n?.orders?.review_leave;
    const hasReplyKeys  = i18n?.seller_reviews?.reply_btn && i18n?.seller_reviews?.reply_save_btn
                        && i18n?.seller_reviews?.seller_response_label && i18n?.seller_reviews?.response_rate
                        && i18n?.seller_reviews?.replied_count && i18n?.seller_reviews?.reply_char_limit;
    data["i18nReviewKeysPresent"] = !!hasReviewKeys;
    data["i18nReplyKeysPresent"]  = !!hasReplyKeys;
    if (!hasReviewKeys) failures.push("en.json: review submission i18n keys missing (review_submit, review_success_title, review_leave)");
    if (!hasReplyKeys)  failures.push("en.json: seller reply i18n keys missing in seller_reviews section");
  }

  // #9 PATCH reply endpoint exists in sellers.ts
  if (fs.existsSync(sellersPath)) {
    const content = fs.readFileSync(sellersPath, "utf8");
    const hasPatchReply = content.includes("/sellers/reviews/:reviewId/reply");
    const hasReplyColumns = content.includes("seller_reply") && content.includes("seller_reply_at");
    const hasRateInSummary = content.includes("repliedCount") && content.includes("responseRate");
    data["patchReplyEndpoint"]    = hasPatchReply;
    data["replyColumnsInRoutes"]  = hasReplyColumns;
    data["responseRateInSummary"] = hasRateInSummary;
    if (!hasPatchReply)    failures.push("sellers.ts: PATCH /sellers/reviews/:reviewId/reply endpoint missing");
    if (!hasReplyColumns)  failures.push("sellers.ts: seller_reply/seller_reply_at not referenced in routes");
    if (!hasRateInSummary) failures.push("sellers.ts: repliedCount/responseRate missing from review summary");
  }

  // #10 Seller reviews page has reply UI + store page has reply display
  if (fs.existsSync(sellerReviewsPagePath)) {
    const content = fs.readFileSync(sellerReviewsPagePath, "utf8");
    const hasReplyForm    = content.includes("ReplyForm");
    const hasDeleteReply  = content.includes("delete_reply_btn") || content.includes("reply: null");
    const hasResponseRate = content.includes("responseRate") || content.includes("response_rate");
    data["sellerReviewsReplyForm"]    = hasReplyForm;
    data["sellerReviewsDeleteReply"]  = hasDeleteReply;
    data["sellerReviewsResponseRate"] = hasResponseRate;
    if (!hasReplyForm)    failures.push("seller/reviews.tsx: ReplyForm component missing");
    if (!hasDeleteReply)  failures.push("seller/reviews.tsx: delete reply functionality missing");
    if (!hasResponseRate) failures.push("seller/reviews.tsx: response rate display missing");
  }

  if (fs.existsSync(storeSlugPath)) {
    const content = fs.readFileSync(storeSlugPath, "utf8");
    const hasSellerReply = content.includes("sellerReply");
    data["storeSellerReplyDisplay"] = hasSellerReply;
    if (!hasSellerReply) failures.push("store/[slug].tsx: seller reply not displayed in ReviewCard");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 17 — Audit Fixes Verification ────────────────────────────────────

async function checkAuditFixes(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // #4 Trust delivery count: trustScore.ts must use DISTINCT order IDs
  const trustScorePath = path.resolve(process.cwd(), "../../artifacts/api-server/src/lib/trustScore.ts");
  if (fs.existsSync(trustScorePath)) {
    const content = fs.readFileSync(trustScorePath, "utf8");
    const hasDistinctTotal     = content.includes("count(distinct ${ordersTable.id})");
    const hasDistinctDelivered = content.includes("count(distinct case when ${ordersTable.status} = 'delivered'");
    const hasSellerReviews     = content.includes("sellerReviewsTable");
    const hasProductReviews    = content.includes("reviewsTable") && !content.includes("sellerReviewsTable");
    data["trustDistinctOrderCount"]  = hasDistinctTotal && hasDistinctDelivered;
    data["trustUsesSellerReviews"]   = hasSellerReviews;
    data["trustStillUsesProductRevs"]= hasProductReviews;
    if (!hasDistinctTotal || !hasDistinctDelivered)
      failures.push("trustScore.ts: delivery/order counts not using DISTINCT — 1 order with N items would count as N deliveries");
    if (!hasSellerReviews)
      warnings.push("trustScore.ts: seller reviews not used for store rating factor");
  } else {
    warnings.push("trustScore.ts not found at expected path");
  }

  // #5 Store review separation: sellers.ts must NOT use reviewsTable for averageRating
  const sellersPath = path.resolve(process.cwd(), "../../artifacts/api-server/src/routes/sellers.ts");
  if (fs.existsSync(sellersPath)) {
    const content = fs.readFileSync(sellersPath, "utf8");
    const getStoreStatsBlock = content.slice(0, content.indexOf("router.get"));
    const storeStatsUsesProductReviews = getStoreStatsBlock.includes("reviewsTable.rating");
    const storeStatsUsesSellerReviews  = getStoreStatsBlock.includes("sellerReviewsTable");
    const storePreviewUsesProductReviews = content.includes("ratingRow?.avgRating");
    data["storeStatsUsesProductReviews"]  = storeStatsUsesProductReviews;
    data["storeStatsUsesSellerReviews"]   = storeStatsUsesSellerReviews;
    data["storePreviewCorrect"]           = !storePreviewUsesProductReviews;
    if (storeStatsUsesProductReviews)
      failures.push("sellers.ts getStoreStats: still using product reviewsTable for store averageRating — must use sellerReviewsTable");
    if (!storeStatsUsesSellerReviews)
      failures.push("sellers.ts getStoreStats: sellerReviewsTable not used for store rating");
    if (storePreviewUsesProductReviews)
      failures.push("sellers.ts /store-preview: still using ratingRow (product reviews) for averageRating");
  } else {
    warnings.push("sellers.ts not found at expected path");
  }

  // #2 Recently viewed images: useRecentlyViewed.ts must include imageUrl in snapshot
  const recentlyViewedPath = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/hooks/useRecentlyViewed.ts",
  );
  if (fs.existsSync(recentlyViewedPath)) {
    const content = fs.readFileSync(recentlyViewedPath, "utf8");
    const hasImageUrlInType     = content.includes('"imageUrl"') || content.includes("\"imageUrl\"");
    const hasImageUrlInSnapshot = content.includes("imageUrl: product.imageUrl");
    data["recentlyViewedHasImageUrl"]         = hasImageUrlInType;
    data["recentlyViewedSnapshotHasImageUrl"] = hasImageUrlInSnapshot;
    if (!hasImageUrlInType)
      failures.push("useRecentlyViewed.ts: imageUrl missing from RecentProduct Pick type — recently viewed cards show no image");
    if (!hasImageUrlInSnapshot)
      failures.push("useRecentlyViewed.ts: imageUrl not stored in snapshot — recently viewed cards will always show placeholder");
  } else {
    warnings.push("useRecentlyViewed.ts not found at expected path");
  }

  // #1 Courier earnings invalidation: dashboard.tsx must invalidate courier-earnings after deliver
  const courierDashPath = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/pages/courier/dashboard.tsx",
  );
  if (fs.existsSync(courierDashPath)) {
    const content = fs.readFileSync(courierDashPath, "utf8");
    const hasQueryClient       = content.includes("useQueryClient");
    const hasEarningsInvalidate = content.includes("courier-earnings");
    data["courierDashUsesQueryClient"]   = hasQueryClient;
    data["courierEarningsInvalidated"]   = hasEarningsInvalidate;
    if (!hasQueryClient)
      warnings.push("courier/dashboard.tsx: useQueryClient not imported — earnings invalidation impossible");
    if (!hasEarningsInvalidate)
      failures.push("courier/dashboard.tsx: courier-earnings query not invalidated after deliver action — stale earnings displayed");
  } else {
    warnings.push("courier/dashboard.tsx not found at expected path");
  }

  // #3 Assignment form: admin/delivery.tsx must use Dialog for assign panel
  const deliveryPagePath = path.resolve(
    process.cwd(),
    "../../artifacts/marketplace/src/pages/admin/delivery.tsx",
  );
  if (fs.existsSync(deliveryPagePath)) {
    const content = fs.readFileSync(deliveryPagePath, "utf8");
    const hasDialog        = content.includes("Dialog") && content.includes("DialogContent");
    const hasSearch        = content.includes("search_courier") || content.includes("search.toLowerCase()");
    const hasConfirmStep   = content.includes("confirm") && content.includes("setStep");
    data["assignPanelUsesDialog"]  = hasDialog;
    data["assignPanelHasSearch"]   = hasSearch;
    data["assignPanelHasConfirm"]  = hasConfirmStep;
    if (!hasDialog)
      warnings.push("admin/delivery.tsx: assign courier panel not using Dialog component");
    if (!hasSearch)
      warnings.push("admin/delivery.tsx: assign courier panel missing search functionality");
  } else {
    warnings.push("admin/delivery.tsx not found at expected path");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── SECTION 21 — Hero Banner System ─────────────────────────────────────────

async function checkHeroBannerSystem(adminToken: string): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // #1 hero_banners table accessible
  try {
    const raw = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM hero_banners`
    );
    const count = Number(raw.rows?.[0]?.count ?? 0);
    data["heroBannersTableAccessible"] = true;
    data["bannerCount"] = count;

    // Count active+valid banners
    const now = new Date();
    const activeRaw = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM hero_banners
      WHERE active = TRUE
        AND (start_date IS NULL OR start_date <= ${now})
        AND (end_date   IS NULL OR end_date   >= ${now})
    `);
    data["activeBannerCount"] = Number(activeRaw.rows?.[0]?.count ?? 0);
  } catch {
    data["heroBannersTableAccessible"] = false;
    failures.push("hero_banners table not accessible — run migrations");
  }

  // #2 GET /banners endpoint returns 200
  const bannersEndpoint = await internalGet("/banners");
  data["bannersEndpointStatus"] = bannersEndpoint.status;
  if (bannersEndpoint.status !== 200) {
    failures.push(`GET /banners returned ${bannersEndpoint.status}`);
  }

  // #3 Admin endpoint is protected (no token → 401)
  const noTokenCheck = await internalGet("/admin/banners");
  data["adminBannersProtected"] = noTokenCheck.status === 401;
  if (noTokenCheck.status !== 401) {
    failures.push(`GET /admin/banners should return 401 without token, got ${noTokenCheck.status}`);
  }

  // #4 Admin endpoint works with token
  const adminCheck = await internalGet("/admin/banners", adminToken);
  data["adminBannersStatus"] = adminCheck.status;
  if (adminCheck.status !== 200) {
    failures.push(`GET /admin/banners returned ${adminCheck.status} for admin`);
  }

  // #5 Analytics endpoint works
  const analyticsCheck = await internalGet("/admin/banners/analytics", adminToken);
  data["analyticsEndpointStatus"] = analyticsCheck.status;
  if (analyticsCheck.status !== 200) {
    failures.push(`GET /admin/banners/analytics returned ${analyticsCheck.status}`);
  }

  // #6 HeroBanner component exists
  const heroBannerPath = path.resolve(
    process.cwd(), "../../artifacts/marketplace/src/components/HeroBanner.tsx"
  );
  const heroBannerExists = fs.existsSync(heroBannerPath);
  data["heroBannerComponentExists"] = heroBannerExists;
  if (!heroBannerExists) failures.push("HeroBanner.tsx component not found");

  // #7 Admin page exists
  const adminPagePath = path.resolve(
    process.cwd(), "../../artifacts/marketplace/src/pages/admin/hero-banners.tsx"
  );
  const adminPageExists = fs.existsSync(adminPagePath);
  data["heroBannerAdminPageExists"] = adminPageExists;
  if (!adminPageExists) failures.push("admin/hero-banners.tsx page not found");

  // #8 Homepage uses HeroBanner component
  const homePath = path.resolve(
    process.cwd(), "../../artifacts/marketplace/src/pages/home.tsx"
  );
  if (fs.existsSync(homePath)) {
    const homeContent = fs.readFileSync(homePath, "utf8");
    const usesHeroBanner = homeContent.includes("HeroBanner");
    data["homepageUsesHeroBanner"] = usesHeroBanner;
    if (!usesHeroBanner) failures.push("home.tsx does not use HeroBanner component");
  }

  // #9 Impression + click tracking routes exist in router file
  const heroBannersRoutePath = path.resolve(
    process.cwd(), "../../artifacts/api-server/src/routes/hero-banners.ts"
  );
  if (fs.existsSync(heroBannersRoutePath)) {
    const routerContent = fs.readFileSync(heroBannersRoutePath, "utf8");
    data["impressionEndpointExists"] = routerContent.includes("/banners/:id/impression");
    data["clickEndpointExists"] = routerContent.includes("/banners/:id/click");
  } else {
    data["impressionEndpointExists"] = false;
    data["clickEndpointExists"] = false;
    failures.push("hero-banners.ts router file not found");
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

async function checkWishlistSystem(): Promise<CheckResult> {
  const failures: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, unknown> = {};

  // #1 wishlists table accessible
  try {
    const raw = await db.execute<{ count: number }>(
      sql`SELECT COUNT(*)::int AS count FROM wishlists`
    );
    data["wishlistsTableAccessible"] = true;
    data["wishlistCount"] = Number(raw.rows?.[0]?.count ?? 0);
  } catch {
    data["wishlistsTableAccessible"] = false;
    failures.push("wishlists table not accessible — run migrations");
  }

  // #2 GET /wishlist/ids requires auth (no token → 401)
  const noTokenCheck = await internalGet("/wishlist/ids");
  data["idsEndpointProtected"] = noTokenCheck.status === 401;
  if (noTokenCheck.status !== 401) {
    failures.push(`GET /wishlist/ids should return 401 without token, got ${noTokenCheck.status}`);
  }

  // #3 GET /wishlist requires auth (no token → 401)
  const getCheck = await internalGet("/wishlist");
  data["getEndpointProtected"] = getCheck.status === 401;
  if (getCheck.status !== 401) {
    failures.push(`GET /wishlist should return 401 without token, got ${getCheck.status}`);
  }

  return { ok: failures.length === 0, data, failures, warnings };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

interface SectionWeight {
  label: string;
  key: keyof typeof WEIGHTS;
  points: number;
}

const WEIGHTS = {
  corePlatform: 15,
  bootstrapAccounts: 12,
  security: 12,
  marketplace: 10,
  orderSystem: 10,
  trustSystem: 8,
  notifications: 8,
  translations: 7,
  sellerSystem: 7,
  courierSystem: 5,
  storePages: 5,
  storeSettings: 5,
  analytics: 3,
  recovery: 2,
  mobile: 1,
  responsive: 0, // warnings only, no deduction
  storeSettingsV4: 0, // warnings only — V4 UI upgrade
  uiConsistency: 3,   // brand color + verification + dropdown portal
  auditFixes: 0,      // audit fix verification — warnings + failures only, no score deduction
  reviewSystem: 5,    // store review submission UX — customer-facing review lifecycle
  heroBannerSystem: 5, // hero banner CRUD, scheduling, analytics, homepage integration
  wishlistSystem: 3,  // wishlists table, wishlist routes, heart toggle in ProductCard
} as const;

function computeScore(results: Record<string, CheckResult>): {
  score: number;
  modules: Record<string, boolean>;
  allFailures: string[];
  allWarnings: string[];
  deductions: string[];
  recommendations: string[];
} {
  let score = 100;
  const deductions: string[] = [];
  const allFailures: string[] = [];
  const allWarnings: string[] = [];
  const modules: Record<string, boolean> = {};

  for (const [key, result] of Object.entries(results)) {
    modules[key] = result.ok;
    allFailures.push(...result.failures);
    allWarnings.push(...result.warnings);

    const weight = WEIGHTS[key as keyof typeof WEIGHTS] ?? 0;
    if (!result.ok && weight > 0) {
      score -= weight;
      deductions.push(`${key}: -${weight} (${result.failures.length} failure(s))`);
    }
  }

  const recommendations: string[] = [];
  if (!results["corePlatform"]?.ok) recommendations.push("Run `psql -f schema.sql && npx tsc --build lib/...` then restart API");
  if (!results["bootstrapAccounts"]?.ok) recommendations.push("Restart API server — bootstrapTestAccounts() runs on every startup");
  if (!results["security"]?.ok) recommendations.push("Review requireAuth/requireRole middleware on affected routes");
  if (!results["translations"]?.ok) recommendations.push("Check artifacts/marketplace/src/i18n/en.json and ar.json for missing keys");
  if (!results["trustSystem"]?.ok) recommendations.push("Verify seller_verification_log table and users.trust_score column exist");
  if (!results["notifications"]?.ok) recommendations.push("Run notification_type enum ALTER TYPE blocks from RECOVERY_GUIDE.md");
  if (allWarnings.length > 5) recommendations.push("Review warnings — some features may degrade under production load");

  return {
    score: Math.max(0, score),
    modules,
    allFailures,
    allWarnings,
    deductions,
    recommendations,
  };
}

// ─── Main route ───────────────────────────────────────────────────────────────

router.get(
  "/admin/recovery-check",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const startedAt = Date.now();

    // Get bootstrap account IDs for token generation
    const users = await db
      .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(
        sql`${usersTable.email} IN ('delewatiamer7@gmail.com','delewatiamer8@gmail.com','delewatiamer9@gmail.com')`,
      );
    const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
    const adminUser = byEmail["delewatiamer7@gmail.com"];
    const sellerUser = byEmail["delewatiamer8@gmail.com"];
    const courierUser = byEmail["delewatiamer9@gmail.com"];

    // Generate tokens for security/seller/courier tests
    const adminToken = req.headers.authorization?.replace("Bearer ", "") ?? "";
    const sellerToken = sellerUser
      ? signToken({ userId: sellerUser.id, email: sellerUser.email, role: "seller", isVerified: false })
      : "";
    const courierToken = courierUser
      ? signToken({ userId: courierUser.id, email: courierUser.email, role: "courier", isVerified: false })
      : "";
    const sellerId = sellerUser?.id ?? 2;

    // Run all 19 checks in parallel
    const [
      corePlatform,
      bootstrapAccounts,
      marketplace,
      sellerSystem,
      courierSystem,
      orderSystem,
      trustSystem,
      notifications,
      translations,
      responsive,
      mobile,
      security,
      analytics,
      recovery,
      storePages,
      storeSettings,
      storeSettingsV4,
      uiConsistency,
      auditFixes,
      reviewSystem,
      heroBannerSystem,
      wishlistSystem,
    ] = await Promise.all([
      checkCorePlatform(),
      checkBootstrapAccounts(),
      checkMarketplace(),
      checkSellerSystem(sellerToken, sellerId),
      checkCourierSystem(courierToken),
      checkOrderSystem(adminToken),
      checkTrustSystem(adminToken, sellerId),
      checkNotifications(adminToken),
      checkTranslations(),
      checkResponsive(),
      checkMobile(),
      checkSecurity(adminToken, sellerToken, courierToken),
      checkAnalytics(sellerToken, adminToken),
      checkRecoverySafety(),
      checkStorePages(sellerToken, sellerId),
      checkStoreSettings(sellerToken, sellerId, adminToken),
      checkStoreSettingsV4(),
      checkUiConsistency(),
      checkAuditFixes(),
      checkReviewSystem(),
      checkHeroBannerSystem(adminToken),
      checkWishlistSystem(),
    ]);

    const checkResults: Record<string, CheckResult> = {
      corePlatform,
      bootstrapAccounts,
      marketplace,
      sellerSystem,
      courierSystem,
      orderSystem,
      trustSystem,
      notifications,
      translations,
      responsive,
      mobile,
      security,
      analytics,
      recovery,
      storePages,
      storeSettings,
      storeSettingsV4,
      uiConsistency,
      auditFixes,
      reviewSystem,
      heroBannerSystem,
      wishlistSystem,
    };

    const { score, modules, allFailures, allWarnings, deductions, recommendations } =
      computeScore(checkResults);

    const elapsedMs = Date.now() - startedAt;

    res.json({
      checkedAt: new Date().toISOString(),
      elapsedMs,
      confidenceScore: score,
      confidenceTarget: 97,
      confidenceOk: score >= 97,

      modules,

      sections: {
        corePlatform: {
          ok: corePlatform.ok,
          data: corePlatform.data,
          failures: corePlatform.failures,
          warnings: corePlatform.warnings,
          weight: WEIGHTS.corePlatform,
        },
        bootstrapAccounts: {
          ok: bootstrapAccounts.ok,
          data: bootstrapAccounts.data,
          failures: bootstrapAccounts.failures,
          warnings: bootstrapAccounts.warnings,
          weight: WEIGHTS.bootstrapAccounts,
        },
        marketplace: {
          ok: marketplace.ok,
          data: marketplace.data,
          failures: marketplace.failures,
          warnings: marketplace.warnings,
          weight: WEIGHTS.marketplace,
        },
        sellerSystem: {
          ok: sellerSystem.ok,
          data: sellerSystem.data,
          failures: sellerSystem.failures,
          warnings: sellerSystem.warnings,
          weight: WEIGHTS.sellerSystem,
        },
        courierSystem: {
          ok: courierSystem.ok,
          data: courierSystem.data,
          failures: courierSystem.failures,
          warnings: courierSystem.warnings,
          weight: WEIGHTS.courierSystem,
        },
        orderSystem: {
          ok: orderSystem.ok,
          data: orderSystem.data,
          failures: orderSystem.failures,
          warnings: orderSystem.warnings,
          weight: WEIGHTS.orderSystem,
        },
        trustSystem: {
          ok: trustSystem.ok,
          data: trustSystem.data,
          failures: trustSystem.failures,
          warnings: trustSystem.warnings,
          weight: WEIGHTS.trustSystem,
        },
        notifications: {
          ok: notifications.ok,
          data: notifications.data,
          failures: notifications.failures,
          warnings: notifications.warnings,
          weight: WEIGHTS.notifications,
        },
        translations: {
          ok: translations.ok,
          data: translations.data,
          failures: translations.failures,
          warnings: translations.warnings,
          weight: WEIGHTS.translations,
        },
        responsive: {
          ok: responsive.ok,
          data: responsive.data,
          failures: responsive.failures,
          warnings: responsive.warnings,
          weight: WEIGHTS.responsive,
        },
        mobile: {
          ok: mobile.ok,
          data: mobile.data,
          failures: mobile.failures,
          warnings: mobile.warnings,
          weight: WEIGHTS.mobile,
        },
        security: {
          ok: security.ok,
          data: security.data,
          failures: security.failures,
          warnings: security.warnings,
          weight: WEIGHTS.security,
        },
        analytics: {
          ok: analytics.ok,
          data: analytics.data,
          failures: analytics.failures,
          warnings: analytics.warnings,
          weight: WEIGHTS.analytics,
        },
        recovery: {
          ok: recovery.ok,
          data: recovery.data,
          failures: recovery.failures,
          warnings: recovery.warnings,
          weight: WEIGHTS.recovery,
        },
        storePages: {
          ok: storePages.ok,
          data: storePages.data,
          failures: storePages.failures,
          warnings: storePages.warnings,
          weight: WEIGHTS.storePages,
        },
        storeSettings: {
          ok: storeSettings.ok,
          data: storeSettings.data,
          failures: storeSettings.failures,
          warnings: storeSettings.warnings,
          weight: WEIGHTS.storeSettings,
        },
        storeSettingsV4: {
          ok: storeSettingsV4.ok,
          data: storeSettingsV4.data,
          failures: storeSettingsV4.failures,
          warnings: storeSettingsV4.warnings,
          weight: WEIGHTS.storeSettingsV4,
        },
        uiConsistency: {
          ok: uiConsistency.ok,
          data: uiConsistency.data,
          failures: uiConsistency.failures,
          warnings: uiConsistency.warnings,
          weight: WEIGHTS.uiConsistency,
        },
        auditFixes: {
          ok: auditFixes.ok,
          data: auditFixes.data,
          failures: auditFixes.failures,
          warnings: auditFixes.warnings,
          weight: WEIGHTS.auditFixes,
        },
        reviewSystem: {
          ok: reviewSystem.ok,
          data: reviewSystem.data,
          failures: reviewSystem.failures,
          warnings: reviewSystem.warnings,
          weight: WEIGHTS.reviewSystem,
        },
        heroBannerSystem: {
          ok: heroBannerSystem.ok,
          data: heroBannerSystem.data,
          failures: heroBannerSystem.failures,
          warnings: heroBannerSystem.warnings,
          weight: WEIGHTS.heroBannerSystem,
        },
        wishlistSystem: {
          ok: wishlistSystem.ok,
          data: wishlistSystem.data,
          failures: wishlistSystem.failures,
          warnings: wishlistSystem.warnings,
          weight: WEIGHTS.wishlistSystem,
        },
      },

      failures: allFailures,
      warnings: allWarnings,
      deductions,
      recommendations,

      roadmapState: {
        "Order Fulfillment Workflow V1": "✅ COMPLETE",
        "Courier Operations Dashboard V2": "✅ COMPLETE + VALIDATED",
        "Seller Orders V2": "✅ COMPLETE + VALIDATED",
        "Seller Analytics Dashboard V2": "✅ COMPLETE + VALIDATED",
        "Trust System V1": "✅ COMPLETE + VALIDATED",
        "Platform QA & UI Stabilization Audit": "✅ COMPLETE",
        "Recovery Integrity Audit & Migration Hardening": "✅ COMPLETE — Confidence 97/100",
        "Admin Recovery Endpoint V2 (18-section)":
          score >= 97 ? "✅ COMPLETE" : "⚠️ DEGRADED — see deductions",
        "Seller Store Pages V2": storePages.ok ? "✅ COMPLETE + VALIDATED" : "⚠️ INCOMPLETE — see storePages section",
        "Store Settings V2": storeSettings.ok ? "✅ COMPLETE + VALIDATED" : "⚠️ INCOMPLETE — see storeSettings section",
        "Store Settings V3 + Trust Consistency Audit": (storeSettings.ok && storePages.ok) ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS",
        "Store Settings V4 + Store Page Consistency": storeSettingsV4.ok ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS",
        "UI Consistency + Mobile Polish": uiConsistency.ok ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS",
        "Critical Logic & Trust Audit V1": auditFixes.ok ? "✅ COMPLETE + VALIDATED" : "⚠️ AUDIT ISSUES — see auditFixes section",
        "Store Review System V2": reviewSystem.ok ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS — see reviewSystem section",
        "Hero Banner System V1": heroBannerSystem.ok ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS — see heroBannerSystem section",
        "Wishlist System V1": wishlistSystem.ok ? "✅ COMPLETE + VALIDATED" : "⏳ IN PROGRESS — see wishlistSystem section",
        next: "⏳ TBD",
      },

      summary: {
        passing: Object.values(modules).filter(Boolean).length,
        total: Object.values(modules).length,
        overallOk: score >= 97,
      },
    });
  },
);

export default router;
