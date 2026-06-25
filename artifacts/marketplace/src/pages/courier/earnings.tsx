/**
 * CourierEarnings — Phase W9
 * Separate page: wallet balance, transactions, statistics, mission earnings history.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Truck, CheckCircle2, DollarSign, TrendingUp,
  Award, RefreshCw, User, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────
interface EarningsPeriod { earnings: number; deliveries: number; }
interface Earnings {
  today:     EarningsPeriod;
  thisWeek:  EarningsPeriod;
  thisMonth: EarningsPeriod;
  allTime:   EarningsPeriod;
  walletBalance: number;
  performance: {
    totalDeliveries: number;
    totalFailed:     number;
    successRate:     number;
    avgPerDay:       number;
    lifetimeEarnings: number;
  };
  totalEarnings: number;
  completedDeliveries: number;
  transactions: {
    id: number;
    orderId: number | null;
    amount: number;
    type: string;
    notes: string | null;
    createdAt: string;
  }[];
}

// ── Courier Nav ───────────────────────────────────────────────────────────────
function CourierNav({ active }: { active: "workspace" | "history" | "earnings" | "profile" }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",          icon: Truck,        labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",   icon: CheckCircle2, labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings",  icon: DollarSign,   labelKey: "courier.nav_earnings" },
    { id: "profile",   href: "/courier/profile",   icon: User,         labelKey: "courier.nav_profile" },
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

export default function CourierEarnings() {
  const { t } = useTranslation();
  const { token } = useAuth();

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const { data: earnings, isLoading, refetch } = useQuery<Earnings>({
    queryKey: ["courier-earnings-page"],
    queryFn: () => fetch("/api/couriers/earnings", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const periods = earnings ? [
    { label: t("courier.period_today"),      data: earnings.today },
    { label: t("courier.period_this_week"),  data: earnings.thisWeek },
    { label: t("courier.period_this_month"), data: earnings.thisMonth },
    { label: t("courier.period_all_time"),   data: earnings.allTime },
  ] : [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b bg-card shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">{t("courier.earnings_title")}</h1>
          <p className="text-xs text-muted-foreground">{t("courier.earnings_subtitle")}</p>
        </div>
        <button type="button" onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        )}

        {earnings && (
          <>
            {/* Wallet balance hero */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 opacity-80" />
                <p className="text-sm font-semibold opacity-80">{t("courier.wallet_balance")}</p>
              </div>
              <p className="text-4xl font-black" translate="no">${(earnings.walletBalance ?? 0).toFixed(2)}</p>
              <p className="text-xs mt-2 opacity-70">
                {t("courier.lifetime_earnings_label")}: ${(earnings.performance?.lifetimeEarnings ?? 0).toFixed(2)}
              </p>
            </div>

            {/* Period breakdown grid */}
            <div className="grid grid-cols-2 gap-3">
              {periods.map(({ label, data }) => (
                <div key={label} className="bg-card border rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400" translate="no">
                    ${(data?.earnings ?? 0).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {data?.deliveries ?? 0} {t("delivery.col_deliveries")}
                  </p>
                </div>
              ))}
            </div>

            {/* Performance */}
            {earnings.performance && (
              <div className="bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">{t("courier.performance_title")}</h3>
                </div>
                <div className="space-y-3">
                  {/* Success rate bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">{t("courier.perf_success_rate")}</p>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {earnings.performance.successRate.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${earnings.performance.successRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("courier.perf_total_deliveries")}</p>
                      <p className="font-bold text-sm">{earnings.performance.totalDeliveries}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("courier.perf_failed")}</p>
                      <p className={cn("font-bold text-sm", earnings.performance.totalFailed > 0 ? "text-red-500" : "text-muted-foreground")}>
                        {earnings.performance.totalFailed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t("courier.perf_avg_per_day")}</p>
                      <p className="font-bold text-sm" translate="no">${earnings.performance.avgPerDay.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions */}
            {earnings.transactions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                    {t("courier.recent_transactions")}
                  </h3>
                </div>
                {earnings.transactions.map((tx) => (
                  <div key={tx.id} className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {tx.orderId
                          ? t("courier.transaction_delivery", { id: tx.orderId })
                          : (tx.notes ?? t("courier.transaction_other"))}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400" translate="no">
                      +${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-card border rounded-2xl text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">{t("courier.no_transactions")}</p>
              </div>
            )}
          </>
        )}
      </div>

      <CourierNav active="earnings" />
    </div>
  );
}
