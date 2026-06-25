import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { SellerTrustBadge, TrustScoreBar, type VerificationLevel } from "@/components/SellerTrustBadge";
import { Shield, ShieldCheck, Award, CheckCircle, XCircle, ChevronRight, TrendingDown, MessageCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetSellerReviews, getSellerReviewsQueryKey } from "@workspace/api-client-react";

function ScoreRow({ label, score, max, tip, isNegative }: { label: string; score: number; max: number; tip?: string; isNegative?: boolean }) {
  const display = isNegative ? Math.abs(score) : score;
  const pct = max > 0 ? Math.round((display / max) * 100) : 0;
  const color = isNegative
    ? "bg-red-500"
    : pct >= 75 ? "bg-emerald-500"
    : pct >= 50 ? "bg-blue-500"
    : pct >= 25 ? "bg-amber-500"
    : "bg-muted-foreground";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {tip && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{tip}</p>}
      </div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-16 text-end ${isNegative ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
        {isNegative ? `−${display}` : `${score}`}/{isNegative ? max : max}
      </span>
    </div>
  );
}

export default function SellerTrustPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const sellerId = user?.id;

  const { data: trustData, isLoading, isError, refetch } = useQuery({
    queryKey: ["seller-trust", sellerId],
    queryFn: async () => {
      const res = await fetch(`/api/sellers/${sellerId}/trust`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load trust data");
      return res.json();
    },
    enabled: !!sellerId && !!token,
  });

  const { data: reviewsData } = useGetSellerReviews(sellerId ?? 0, {
    query: { enabled: !!sellerId, queryKey: getSellerReviewsQueryKey(sellerId ?? 0) },
  });

  const level = (trustData?.verificationLevel ?? "none") as VerificationLevel;
  const isVerified = trustData?.isVerified ?? false;
  const score = trustData?.liveBreakdown?.total ?? null;
  const components = trustData?.liveBreakdown?.components ?? null;
  const details = trustData?.liveBreakdown?.details ?? null;

  const tierConfig = {
    none:     { icon: Shield,      color: "text-muted-foreground", bg: "bg-muted/60" },
    basic:    { icon: Shield,      color: "text-blue-600",         bg: "bg-blue-500/10" },
    verified: { icon: ShieldCheck, color: "text-emerald-600",      bg: "bg-emerald-500/10" },
    business: { icon: Award,       color: "text-violet-600",       bg: "bg-violet-500/10" },
  }[level] ?? { icon: Shield, color: "text-muted-foreground", bg: "bg-muted/60" };

  const TierIcon = tierConfig.icon;

  return (
    <Layout>
      <SellerNav />
      <div className="container max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground">{t("trust_panel.title", "Store Trust Level")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("trust_panel.page_desc", "Your trust score is computed from live data — reviews, orders, profile completeness, and more.")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="font-semibold text-foreground">{t("common.error_title")}</p>
            <p className="text-sm text-muted-foreground">{t("common.error_subtitle")}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4" />{t("common.retry")}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current tier card */}
            <div className={`p-5 rounded-2xl border ${isVerified ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl ${tierConfig.bg} flex items-center justify-center shrink-0`}>
                  <TierIcon className={`h-6 w-6 ${tierConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <SellerTrustBadge level={level} isVerified={isVerified} size="md" allowNone />
                  </div>
                  {trustData?.verifiedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("trust_panel.verified_since", "Verified since")} {new Date(trustData.verifiedAt).toLocaleDateString()}
                    </p>
                  )}
                  {!isVerified && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("trust_panel.unverified_desc", "Complete your profile to improve your score.")}
                    </p>
                  )}
                </div>
              </div>

              {score != null && (
                <div className="mt-4">
                  <TrustScoreBar score={score} size="md" />
                </div>
              )}
            </div>

            {/* Score breakdown */}
            {components && (
              <div className="p-5 rounded-2xl border border-border bg-card">
                <h2 className="text-sm font-bold text-foreground mb-4">{t("trust_panel.score_breakdown", "Score Breakdown")}</h2>
                <div className="space-y-3">
                  <ScoreRow
                    label={t("trust_panel.factor_orders", "Completed orders")}
                    score={components.completedOrders ?? 0}
                    max={30}
                    tip={t("trust_panel.tip_orders", "More fulfilled orders → higher score (log scale)")}
                  />
                  <ScoreRow
                    label={t("trust_panel.factor_rating", "Store rating")}
                    score={components.storeRating ?? 0}
                    max={25}
                    tip={t("trust_panel.tip_rating", "Average product rating across your store")}
                  />
                  <ScoreRow
                    label={t("trust_panel.factor_delivery", "Delivery success")}
                    score={components.deliverySuccess ?? 0}
                    max={20}
                    tip={t("trust_panel.tip_delivery", "% of orders successfully delivered")}
                  />
                  <ScoreRow
                    label={t("trust_panel.factor_reviews", "Review count")}
                    score={components.reviewCount ?? 0}
                    max={10}
                    tip={t("trust_panel.tip_reviews", "More reviews builds credibility")}
                  />
                  <ScoreRow
                    label={t("trust_panel.factor_age", "Account age")}
                    score={components.accountAge ?? 0}
                    max={5}
                    tip={t("trust_panel.tip_age", "1 pt per 3 months active, up to 5")}
                  />
                  <ScoreRow
                    label={t("trust_panel.factor_followers", "Store followers")}
                    score={components.followers ?? 0}
                    max={5}
                    tip={t("trust_panel.tip_followers", "Social proof from your followers")}
                  />
                  {(components.cancellationPenalty ?? 0) < 0 && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                          {t("trust_panel.penalties", "Deductions")}
                        </span>
                      </div>
                      <ScoreRow
                        label={t("trust_panel.factor_cancellation", "Cancellation rate")}
                        score={components.cancellationPenalty ?? 0}
                        max={10}
                        tip={t("trust_panel.tip_cancellation", "High cancellation rate reduces score")}
                        isNegative
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats snapshot */}
            {details && (
              <div className="p-5 rounded-2xl border border-border bg-card">
                <h2 className="text-sm font-bold text-foreground mb-3">{t("trust_panel.stats_snapshot", "Stats Snapshot")}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: t("trust_panel.total_orders", "Total orders"),       value: details.totalOrders ?? 0 },
                    { label: t("trust_panel.delivery_rate", "Delivery rate"),     value: `${details.deliverySuccessRate ?? 0}%` },
                    { label: t("trust_panel.review_count", "Reviews"),            value: details.reviewCount ?? 0 },
                    { label: t("trust_panel.avg_rating", "Avg rating"),           value: details.avgProductRating != null ? Number(details.avgProductRating).toFixed(1) : "—" },
                    { label: t("trust_panel.followers", "Followers"),             value: details.followerCount ?? 0 },
                    { label: t("trust_panel.products", "Products"),               value: details.totalProducts ?? 0 },
                    { label: t("trust_panel.account_age", "Account age"),         value: `${details.accountAgeMonths ?? 0}mo` },
                    { label: t("trust_panel.cancel_rate", "Cancellation rate"),   value: `${details.cancellationRate ?? 0}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/40 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                      <p className="text-lg font-black text-foreground mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How to improve */}
            <div className="p-5 rounded-2xl border border-border bg-card">
              <h2 className="text-sm font-bold text-foreground mb-3">{t("trust_panel.how_to_improve", "How to Improve Your Score")}</h2>
              <div className="space-y-2">
                {[
                  { done: isVerified, label: t("trust_panel.tip_get_verified", "Get verified by SYANO (up to +30 pts)") },
                  { done: (details?.reviewCount ?? 0) >= 10, label: t("trust_panel.tip_earn_reviews", "Earn 10+ product reviews (+10 pts)") },
                  { done: (details?.deliveredOrders ?? 0) >= 10, label: t("trust_panel.tip_complete_orders", "Complete 10+ orders (+15 pts)") },
                  { done: (details?.deliverySuccessRate ?? 100) >= 90, label: t("trust_panel.tip_delivery_rate", "Maintain 90%+ delivery success (+20 pts)") },
                  { done: (details?.followerCount ?? 0) >= 10, label: t("trust_panel.tip_followers_goal", "Get 10+ store followers (+2.5 pts)") },
                ].map(({ done, label }) => (
                  <div key={label} className="flex items-center gap-2 py-1">
                    {done
                      ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                    <span className={`text-xs ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review transparency metrics — NOT a trust score factor */}
            {reviewsData && reviewsData.summary.total > 0 && (
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">
                    {t("trust_panel.review_transparency_title", "Review Transparency")}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("trust_panel.review_transparency_desc", "These metrics are displayed publicly on your store. Replies do not affect your trust score.")}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xl font-black text-amber-700 dark:text-amber-400 tabular-nums">
                      {reviewsData.summary.total}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t("trust_panel.total_reviews", "Reviews")}
                    </p>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xl font-black text-violet-700 dark:text-violet-400 tabular-nums">
                      {reviewsData.summary.repliedCount ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t("seller_reviews.replied_count", "Replied")}
                    </p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {reviewsData.summary.responseRate ?? 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t("seller_reviews.response_rate", "Response Rate")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* How to get verified */}
            {!isVerified && (
              <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("trust_panel.how_to_verify_title", "How to get verified")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("trust_panel.how_to_verify", "To get verified, contact SYANO support or complete seller onboarding.")}
                    </p>
                    <Link href="/seller/store-settings">
                      <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                        {t("trust_panel.edit_profile", "Edit Store Profile")}
                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
