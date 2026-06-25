/**
 * CourierPerformance — Phase A8 Performance Center
 * Detailed stats: success rate, failure breakdown, ratings, safety events, earnings.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Truck, CheckCircle2, DollarSign, User, Star,
  TrendingUp, AlertTriangle, Shield, RefreshCw,
  ChevronRight, Award, BarChart3, XCircle,
  ClockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────
interface PerformanceData {
  courierId: number;
  totalAssigned: number;
  totalDeliveries: number;
  totalFailed: number;
  totalCancelled: number;
  totalRescheduled: number;
  successRate: number;
  cancellationRate: number;
  acceptanceRate: number;
  avgRating: number | null;
  ratingCount: number;
  lifetimeEarnings: number;
  totalSafetyEvents: number;
  offerStats: { total: number; accepted: number; declined: number; expired: number };
  milestone: { completed: number; next: number | null };
  failureBreakdown: { type: string; count: number }[];
}

interface RatingsData {
  avgRating: number | null;
  totalRatings: number;
  ratings: {
    id: number;
    missionId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
  }[];
}

// ── Courier Nav ───────────────────────────────────────────────────────────────
function CourierNav({ active }: { active: "workspace" | "history" | "earnings" | "profile" }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",         icon: Truck,        labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",  icon: CheckCircle2, labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings", icon: DollarSign,   labelKey: "courier.nav_earnings" },
    { id: "profile",   href: "/courier/profile",  icon: User,         labelKey: "courier.nav_profile" },
  ] as const;
  return (
    <nav className="flex border-t bg-card shrink-0">
      {items.map(({ id, href, icon: Icon, labelKey }) => (
        <Link key={id} href={href} className={cn(
          "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
          active === id
            ? "text-emerald-600 dark:text-emerald-400 border-t-2 border-emerald-500"
            : "text-muted-foreground hover:text-foreground",
        )}>
          <Icon className="h-4 w-4" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}

function StarRow({ rating, max = 5 }: { rating: number | null; max?: number }) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((s) => (
        <Star
          key={s}
          className={cn(
            "h-4 w-4",
            rating != null && s <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-black", accent ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CourierPerformance() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [tab, setTab] = useState<"overview" | "ratings">("overview");

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const { data: perf, isLoading: perfLoading, refetch: refetchPerf } = useQuery<PerformanceData>({
    queryKey: ["courier-performance"],
    queryFn: () => fetch("/api/courier/performance", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery<RatingsData>({
    queryKey: ["courier-ratings"],
    queryFn: () => fetch("/api/courier/ratings", { headers }).then((r) => r.json()),
    enabled: !!token && tab === "ratings",
  });

  const FAILURE_LABEL: Record<string, string> = {
    CUSTOMER_UNAVAILABLE: t("perf.failure_customer_unavailable"),
    WRONG_ADDRESS:        t("perf.failure_wrong_address"),
    PACKAGE_DAMAGED:      t("perf.failure_package_damaged"),
    CUSTOMER_REFUSED:     t("perf.failure_customer_refused"),
    ACCESS_DENIED:        t("perf.failure_access_denied"),
    VEHICLE_BREAKDOWN:    t("perf.failure_vehicle_breakdown"),
    ROAD_BLOCKED:         t("perf.failure_road_blocked"),
    OTHER:                t("perf.failure_other"),
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b bg-card shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/courier/profile" className="p-1 text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Link>
          <div>
            <h1 className="font-bold text-lg">{t("perf.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("perf.subtitle")}</p>
          </div>
        </div>
        <button type="button" onClick={() => refetchPerf()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-card shrink-0">
        {(["overview", "ratings"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
              tab === id
                ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "overview" ? t("perf.tab_overview") : t("perf.tab_ratings")}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {tab === "overview" && (
          <>
            {perfLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
              </div>
            )}

            {perf && (
              <>
                {/* Success rate hero */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4 opacity-80" />
                    <p className="text-sm font-semibold opacity-80">{t("perf.success_rate")}</p>
                  </div>
                  <p className="text-5xl font-black">{perf.successRate.toFixed(0)}%</p>
                  <p className="text-xs mt-2 opacity-70">
                    {perf.totalDeliveries} {t("perf.delivered")} / {perf.totalAssigned} {t("perf.assigned")}
                  </p>
                </div>

                {/* Core stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label={t("perf.total_delivered")}
                    value={perf.totalDeliveries}
                    accent="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCard
                    label={t("perf.total_failed")}
                    value={perf.totalFailed}
                    accent={perf.totalFailed > 0 ? "text-red-500" : "text-muted-foreground"}
                  />
                  <StatCard
                    label={t("perf.acceptance_rate")}
                    value={`${perf.acceptanceRate?.toFixed(0) ?? 0}%`}
                    sub={`${perf.offerStats?.accepted ?? 0}/${perf.offerStats?.total ?? 0} ${t("perf.offers")}`}
                    accent="text-indigo-600 dark:text-indigo-400"
                  />
                  <StatCard
                    label={t("perf.cancellation_rate")}
                    value={`${perf.cancellationRate?.toFixed(0) ?? 0}%`}
                    sub={`${perf.totalCancelled} ${t("perf.cancelled")}`}
                    accent={perf.cancellationRate > 10 ? "text-orange-500" : "text-muted-foreground"}
                  />
                  <StatCard
                    label={t("perf.total_rescheduled")}
                    value={perf.totalRescheduled}
                    accent={perf.totalRescheduled > 0 ? "text-amber-500" : "text-muted-foreground"}
                  />
                  <StatCard
                    label={t("perf.lifetime_earnings")}
                    value={`$${perf.lifetimeEarnings.toFixed(2)}`}
                    accent="text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                {/* Milestone progress */}
                {perf.milestone && (
                  <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-semibold text-sm">{t("perf.milestone_title")}</h3>
                    </div>
                    <div className="flex items-end gap-3">
                      <div>
                        <p className="text-3xl font-black">{perf.milestone.completed}</p>
                        <p className="text-xs text-muted-foreground">{t("perf.deliveries_completed")}</p>
                      </div>
                      {perf.milestone.next && (
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{t("perf.next_milestone")}: {perf.milestone.next}</span>
                            <span>{perf.milestone.next - perf.milestone.completed} {t("perf.to_go")}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (perf.milestone.completed / perf.milestone.next) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rating summary */}
                <div className="bg-card border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold text-sm">{t("perf.rating_summary")}</h3>
                  </div>
                  {perf.avgRating != null ? (
                    <div className="flex items-center gap-3">
                      <p className="text-4xl font-black">{perf.avgRating.toFixed(1)}</p>
                      <div>
                        <StarRow rating={perf.avgRating} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("perf.based_on_ratings", { count: perf.ratingCount })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("perf.no_ratings_yet")}</p>
                  )}
                </div>

                {/* Safety events */}
                {perf.totalSafetyEvents > 0 && (
                  <div className="bg-card border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      <h3 className="font-semibold text-sm text-red-600 dark:text-red-400">{t("perf.safety_events")}</h3>
                    </div>
                    <p className="text-2xl font-black text-red-600 dark:text-red-400">{perf.totalSafetyEvents}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("perf.safety_events_desc")}</p>
                  </div>
                )}

                {/* Failure breakdown */}
                {perf.failureBreakdown.length > 0 && (
                  <div className="bg-card border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm">{t("perf.failure_breakdown")}</h3>
                    </div>
                    <div className="space-y-2">
                      {perf.failureBreakdown.map(({ type, count }) => (
                        <div key={type} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {FAILURE_LABEL[type] ?? type}
                          </span>
                          <span className="font-bold text-red-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/courier/earnings">
                    <div className="bg-card border rounded-xl p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors">
                      <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium">{t("courier.nav_earnings")}</span>
                    </div>
                  </Link>
                  <Link href="/courier/history">
                    <div className="bg-card border rounded-xl p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors">
                      <ClockIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium">{t("courier.nav_history")}</span>
                    </div>
                  </Link>
                </div>
              </>
            )}
          </>
        )}

        {tab === "ratings" && (
          <>
            {ratingsLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
              </div>
            )}

            {ratingsData && (
              <>
                {/* Rating hero */}
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-5xl font-black">
                        {ratingsData.avgRating != null ? ratingsData.avgRating.toFixed(1) : "—"}
                      </p>
                      <div className="flex gap-0.5 mt-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              ratingsData.avgRating != null && i < Math.round(ratingsData.avgRating)
                                ? "fill-white text-white"
                                : "text-white/40",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="ms-auto text-end">
                      <p className="text-2xl font-bold">{ratingsData.totalRatings}</p>
                      <p className="text-xs opacity-80">{t("perf.total_ratings")}</p>
                    </div>
                  </div>
                </div>

                {ratingsData.ratings.length > 0 ? (
                  <div className="space-y-2">
                    {ratingsData.ratings.map((r) => (
                      <div key={r.id} className="bg-card border rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <StarRow rating={r.rating} />
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("perf.mission_id_label")} #{r.missionId}
                        </p>
                        {r.comment && (
                          <p className="text-sm mt-2 text-foreground italic">"{r.comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-card border rounded-2xl text-center">
                    <Star className="h-10 w-10 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">{t("perf.no_ratings_yet")}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <CourierNav active="profile" />
    </div>
  );
}
