/**
 * CourierHistory — Phase W8
 * Separate page: completed, failed, and cancelled delivery history.
 * Map is NOT required here (per spec).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Truck, CheckCircle2, XCircle, AlertTriangle, MapPin,
  User, Calendar, DollarSign, ShoppingBag, Search, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────
interface HistoryItem {
  id: number;
  orderId: number;
  status: "delivered" | "delivery_failed";
  assignedAt: string;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  orderTotal: number;
  deliveryFee: number;
  yourCut: number;
  shippingAddress: string;
  customerName: string | null;
  customerPhone: string | null;
  orderDate: string;
  zoneNameEn: string | null;
  zoneNameAr: string | null;
  products: { name: string; quantity: number }[];
}

// ── Courier Nav (shared) ──────────────────────────────────────────────────────
function CourierNav({ active }: { active: "workspace" | "history" | "earnings" | "profile" }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",          icon: Truck,       labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",   icon: CheckCircle2, labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings",  icon: DollarSign,  labelKey: "courier.nav_earnings" },
    { id: "profile",   href: "/courier/profile",   icon: User,        labelKey: "courier.nav_profile" },
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

export default function CourierHistory() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [filter, setFilter] = useState<"all" | "delivered" | "delivery_failed">("all");
  const [search, setSearch] = useState("");

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const { data: history = [], isLoading, refetch } = useQuery<HistoryItem[]>({
    queryKey: ["courier-history-full"],
    queryFn: () => fetch("/api/couriers/history", { headers }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });

  const filtered = history.filter((h) => {
    if (filter !== "all" && h.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        h.shippingAddress.toLowerCase().includes(q) ||
        h.customerName?.toLowerCase().includes(q) ||
        String(h.orderId).includes(q)
      );
    }
    return true;
  });

  const delivered = history.filter((h) => h.status === "delivered").length;
  const failed    = history.filter((h) => h.status === "delivery_failed").length;
  const rate      = history.length > 0 ? Math.round((delivered / history.length) * 100) : 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b bg-card shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-bold text-lg">{t("courier.history_title")}</h1>
            <p className="text-xs text-muted-foreground">{t("courier.history_subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: t("courier.history_delivered"), value: delivered, color: "text-emerald-600 dark:text-emerald-400" },
            { label: t("courier.history_failed"),    value: failed,    color: "text-red-500" },
            { label: t("courier.history_rate"),      value: `${rate}%`, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-2.5 text-center">
              <p className={cn("text-base font-black", color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("courier.history_search")}
            className="ps-9 h-8 text-sm"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(["all", "delivered", "delivery_failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? t("common.all")
                : f === "delivered" ? t("courier.history_delivered")
                : t("courier.history_failed")}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("courier.history_empty")}</p>
          </div>
        )}

        {filtered.map((h) => {
          const isOk  = h.status === "delivered";
          const date  = new Date(h.deliveredAt ?? h.failedAt ?? h.assignedAt).toLocaleDateString();
          const StatusIcon = isOk ? CheckCircle2 : XCircle;

          return (
            <div key={h.id} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              {/* Header row */}
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4 shrink-0", isOk ? "text-emerald-500" : "text-red-500")} />
                  <span className="font-bold text-sm" translate="no">#{h.orderId}</span>
                  <span className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                    isOk
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                  )}>
                    {isOk ? t("courier.status_delivered") : t("courier.status_failed")}
                  </span>
                </div>
                {h.yourCut > 0 && (
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400" translate="no">
                    +${h.yourCut.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-2">
                {h.customerName && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm">{h.customerName}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground leading-snug truncate">{h.shippingAddress}</p>
                </div>
                {(h.zoneNameEn || h.zoneNameAr) && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {i18n.language === "ar" ? h.zoneNameAr : h.zoneNameEn}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {date}
                </div>
                {h.products.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {h.products.slice(0, 3).map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        <ShoppingBag className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate max-w-[90px]">{p.name}</span>
                        {p.quantity > 1 && <span className="font-semibold">×{p.quantity}</span>}
                      </span>
                    ))}
                    {h.products.length > 3 && (
                      <span className="text-[11px] text-muted-foreground px-1">+{h.products.length - 3}</span>
                    )}
                  </div>
                )}
                {!isOk && h.failureReason && (
                  <div className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/20 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300 italic">{h.failureReason}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CourierNav active="history" />
    </div>
  );
}
