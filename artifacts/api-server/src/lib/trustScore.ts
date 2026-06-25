/**
 * Trust Score Engine — computes a real 0-100 score from live DB data.
 *
 * Factor breakdown (max 100 pts, with penalty deductions):
 *   completed_orders  → 0-30  (log scale on delivered order count)
 *   store_rating      → 0-25  (seller review score 0-5 × 5 — from store reviews, NOT product reviews)
 *   delivery_success  → 0-20  (delivery success rate %)
 *   review_count      → 0-10  (log scale)
 *   account_age       → 0-5   (months active)
 *   followers         → 0-5   (log scale social proof)
 *   cancellation_penalty → 0 to -10  (high cancellation rate)
 *   violations_penalty   → 0         (reserved for future)
 */
import { eq, and, avg, count, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  sellerApplicationsTable,
  productsTable,
  sellerReviewsTable,
  ordersTable,
  orderItemsTable,
  storeFollowsTable,
} from "@workspace/db";

export type VerificationLevel = "none" | "basic" | "verified" | "business";

export interface TrustScoreBreakdown {
  total: number;
  verificationLevel: VerificationLevel;
  components: {
    completedOrders:     number;
    storeRating:         number;
    deliverySuccess:     number;
    reviewCount:         number;
    accountAge:          number;
    followers:           number;
    cancellationPenalty: number;
    violationsPenalty:   number;
  };
  details: {
    isVerified:          boolean;
    verificationLevel:   VerificationLevel;
    accountAgeMonths:    number;
    deliveredOrders:     number;
    totalOrders:         number;
    cancellationRate:    number;
    deliverySuccessRate: number;
    avgProductRating:    number | null;
    reviewCount:         number;
    followerCount:       number;
    totalProducts:       number;
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export async function computeTrustScore(sellerId: number): Promise<TrustScoreBreakdown> {
  const [userRow] = await db
    .select({
      createdAt:         usersTable.createdAt,
      isVerified:        usersTable.isVerified,
      verificationLevel: usersTable.verificationLevel,
    })
    .from(usersTable)
    .where(eq(usersTable.id, sellerId));

  const [appRow] = await db
    .select({
      storeName: sellerApplicationsTable.storeName,
    })
    .from(sellerApplicationsTable)
    .where(
      and(
        eq(sellerApplicationsTable.userId, sellerId),
        eq(sellerApplicationsTable.status, "approved")
      )
    );

  const [productStats, storeReviewStats, orderStats, followerRow] = await Promise.all([
    db
      .select({ totalProducts: count(productsTable.id) })
      .from(productsTable)
      .where(eq(productsTable.sellerId, sellerId)),

    db
      .select({
        avgCommunication:   avg(sellerReviewsTable.communicationRating),
        avgShipping:        avg(sellerReviewsTable.shippingRating),
        avgProfessionalism: avg(sellerReviewsTable.professionalismRating),
        reviewCount:        count(sellerReviewsTable.id),
      })
      .from(sellerReviewsTable)
      .where(eq(sellerReviewsTable.sellerId, sellerId)),

    db
      .select({
        total:      sql<number>`cast(count(distinct ${ordersTable.id}) as int)`,
        delivered:  sql<number>`cast(count(distinct case when ${ordersTable.status} = 'delivered' then ${ordersTable.id} end) as int)`,
        cancelled:  sql<number>`cast(count(distinct case when ${ordersTable.status} IN ('cancelled','returned') then ${ordersTable.id} end) as int)`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
      .where(eq(orderItemsTable.sellerId, sellerId)),

    db
      .select({ count: count() })
      .from(storeFollowsTable)
      .where(eq(storeFollowsTable.sellerId, sellerId)),
  ]);

  const level = ((userRow?.verificationLevel as VerificationLevel | null) ?? "none") as VerificationLevel;
  const isVerified = userRow?.isVerified ?? false;

  // ── Account age ──────────────────────────────────────────────────────────────
  const accountAgeMonths = userRow
    ? Math.floor((Date.now() - new Date(userRow.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  // ── Order stats ──────────────────────────────────────────────────────────────
  const totalOrders     = Number(orderStats[0]?.total     ?? 0);
  const deliveredOrders = Number(orderStats[0]?.delivered ?? 0);
  const cancelledOrders = Number(orderStats[0]?.cancelled ?? 0);
  const deliverySuccessRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 100;
  const cancellationRate    = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;

  // ── Product/store-review stats ───────────────────────────────────────────────
  // Store rating comes from seller_reviews (store reviews), NOT product reviews
  const totalProducts = Number(productStats[0]?.totalProducts ?? 0);
  const srr = storeReviewStats[0];
  const avgRating = srr && Number(srr.reviewCount) > 0
    ? parseFloat((
        parseFloat(srr.avgCommunication ?? "0") * 0.4 +
        parseFloat(srr.avgShipping ?? "0") * 0.3 +
        parseFloat(srr.avgProfessionalism ?? "0") * 0.3
      ).toFixed(2))
    : null;
  const reviewCount = Number(srr?.reviewCount ?? 0);

  // ── Followers ────────────────────────────────────────────────────────────────
  const followerCount = Number(followerRow[0]?.count ?? 0);

  // ── Factor 1: Completed orders (0-30) — log scale ────────────────────────────
  // 0 orders = 0, 10 orders ≈ 15, 100 orders ≈ 30
  const completedOrdersPts = deliveredOrders === 0
    ? 0
    : clamp(Math.floor(Math.log10(deliveredOrders + 1) * 15), 0, 30);

  // ── Factor 2: Store rating (0-25) ────────────────────────────────────────────
  // avgRating 0-5 mapped linearly to 0-25
  const storeRatingPts = avgRating != null
    ? clamp(Math.round((avgRating / 5) * 25), 0, 25)
    : 0;

  // ── Factor 3: Delivery success rate (0-20) ────────────────────────────────────
  // 100% success = 20pts, 80%+ full credit (scale proportionally)
  const deliverySuccessPts = totalOrders === 0
    ? 0  // no orders yet → no delivery data to reward
    : clamp(Math.round((deliverySuccessRate / 100) * 20), 0, 20);

  // ── Factor 4: Review count (0-10) — log scale ────────────────────────────────
  // 0 reviews = 0, 10 reviews ≈ 5, 1000 reviews ≈ 10
  const reviewCountPts = reviewCount === 0
    ? 0
    : clamp(Math.floor(Math.log10(reviewCount + 1) * 3.3), 0, 10);

  // ── Factor 5: Account age (0-5) ──────────────────────────────────────────────
  // 1pt per 3 months, max 5 (= 15 months)
  const accountAgePts = clamp(Math.floor(accountAgeMonths / 3), 0, 5);

  // ── Factor 6: Followers (0-5) — log scale ────────────────────────────────────
  // 0 followers = 0, 10 followers ≈ 2.5, 1000 followers ≈ 5
  const followersPts = followerCount === 0
    ? 0
    : clamp(Math.floor(Math.log10(followerCount + 1) * 1.66), 0, 5);

  // ── Penalty: Cancellation rate (0 to -10) ────────────────────────────────────
  // >40% cancellation = max -10 penalty, scales linearly
  const cancellationPenalty = totalOrders < 3
    ? 0  // insufficient data — no penalty
    : clamp(-Math.round((cancellationRate / 40) * 10), -10, 0);

  // ── Penalty: Violations (reserved) ──────────────────────────────────────────
  const violationsPenalty = 0;

  const raw = completedOrdersPts + storeRatingPts + deliverySuccessPts +
              reviewCountPts + accountAgePts + followersPts +
              cancellationPenalty + violationsPenalty;

  const total = clamp(Math.round(raw), 0, 100);

  return {
    total,
    verificationLevel: level,
    components: {
      completedOrders:     completedOrdersPts,
      storeRating:         storeRatingPts,
      deliverySuccess:     deliverySuccessPts,
      reviewCount:         reviewCountPts,
      accountAge:          accountAgePts,
      followers:           followersPts,
      cancellationPenalty,
      violationsPenalty,
    },
    details: {
      isVerified,
      verificationLevel:   level,
      accountAgeMonths,
      deliveredOrders,
      totalOrders,
      cancellationRate:    Math.round(cancellationRate),
      deliverySuccessRate: Math.round(deliverySuccessRate),
      avgProductRating:    avgRating,
      reviewCount,
      followerCount,
      totalProducts,
    },
  };
}

export async function refreshTrustScore(sellerId: number): Promise<number> {
  const result = await computeTrustScore(sellerId);
  await db
    .update(usersTable)
    .set({
      trustScore:          result.total,
      trustScoreUpdatedAt: new Date(),
      trustLevel:          scoreToBand(result.total),
    })
    .where(eq(usersTable.id, sellerId));
  return result.total;
}

export function scoreToBand(score: number): "new" | "basic" | "established" | "trusted" {
  if (score >= 75) return "trusted";
  if (score >= 50) return "established";
  if (score >= 25) return "basic";
  return "new";
}

export function verificationLevelLabel(level: VerificationLevel): { en: string; ar: string } {
  switch (level) {
    case "business": return { en: "Business Verified", ar: "موثّق تجاري" };
    case "verified":  return { en: "ID Verified",       ar: "موثّق بالهوية" };
    case "basic":     return { en: "Basic Verified",    ar: "موثّق أساسي" };
    default:          return { en: "Unverified",        ar: "غير موثّق" };
  }
}
