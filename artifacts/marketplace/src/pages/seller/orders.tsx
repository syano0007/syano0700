// @refresh reset
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useListOrders,
  useUpdateOrderStatus,
  getListOrdersQueryKey,
  getListProductsQueryKey,
  getGetSellerDashboardQueryKey,
  type OrderItem,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format as dateFns } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Phone, Search, X, ChevronLeft, ChevronRight, Truck,
  CheckCircle2, Clock, XCircle, TrendingUp, BarChart3,
  ShoppingBag, RefreshCw, MapPin, User, ExternalLink,
  CheckSquare, Square, AlertCircle, Percent, Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface SellerMetrics {
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  avgOrderValue: number;
  cancellationRate: number;
  deliverySuccessRate: number;
  preparingCount: number;
  awaitingCourierCount: number;
}

/* ─── Status styles ──────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, { pill: string; dot: string; bg: string }> = {
  pending:          { pill: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",    dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/20" },
  confirmed:        { pill: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800",                dot: "bg-sky-500",     bg: "bg-sky-50 dark:bg-sky-950/20" },
  processing:       { pill: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",          dot: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/20" },
  preparing:        { pill: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",          dot: "bg-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-950/20" },
  ready_for_pickup: { pill: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", dot: "bg-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  courier_assigned: { pill: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800",         dot: "bg-teal-500",    bg: "bg-teal-50 dark:bg-teal-950/20" },
  shipped:          { pill: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800", dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
  picked_up:        { pill: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800", dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20" },
  in_transit:       { pill: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800", dot: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20" },
  out_for_delivery: { pill: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800", dot: "bg-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/20" },
  delivered:        { pill: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
  cancelled:        { pill: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",               dot: "bg-red-500",     bg: "bg-red-50 dark:bg-red-950/20" },
  delivery_failed:  { pill: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800", dot: "bg-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20" },
  returned:         { pill: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",    dot: "bg-amber-500",   bg: "bg-amber-50 dark:bg-amber-950/20" },
  refunded:         { pill: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800", dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20" },
};

/* ─── Filter groups ──────────────────────────────────────────────────────── */
type FilterGroup = "all" | "new" | "preparing" | "ready" | "delivering" | "completed" | "cancelled" | "refunded" | "returned";

const FILTER_STATUSES: Record<FilterGroup, string[]> = {
  all:        [],
  new:        ["pending", "confirmed"],
  preparing:  ["preparing"],
  ready:      ["ready_for_pickup"],
  delivering: ["courier_assigned", "picked_up", "in_transit", "out_for_delivery"],
  completed:  ["delivered"],
  cancelled:  ["cancelled"],
  refunded:   ["refunded"],
  returned:   ["returned"],
};

const PAGE_SIZE = 20;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function StatusBadge({ status, t }: { status: string; t: (k: string, opts?: Record<string, unknown>) => string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0", s?.pill ?? "bg-muted text-muted-foreground border-border")}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s?.dot ?? "bg-muted-foreground")} />
      {t(`seller_orders.${status}`, { defaultValue: status })}
    </span>
  );
}

/* ─── Stats Cards ────────────────────────────────────────────────────────── */
interface StatCard { label: string; value: number; icon: React.ElementType; color: string; filter: FilterGroup }

function StatsCards({ orders, onFilter, activeFilter, t }: {
  orders: any[]; onFilter: (f: FilterGroup) => void; activeFilter: FilterGroup;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const counts = useMemo(() => ({
    new:        orders.filter(o => ["pending","confirmed"].includes(o.status)).length,
    preparing:  orders.filter(o => o.status === "preparing").length,
    ready:      orders.filter(o => o.status === "ready_for_pickup").length,
    delivering: orders.filter(o => ["courier_assigned","picked_up","in_transit","out_for_delivery"].includes(o.status)).length,
    completed:  orders.filter(o => o.status === "delivered").length,
    cancelled:  orders.filter(o => ["cancelled","refunded","returned"].includes(o.status)).length,
  }), [orders]);

  const cards: StatCard[] = [
    { label: t("seller_orders.stats_new_orders"), value: counts.new,        icon: ShoppingBag,  color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",   filter: "new" },
    { label: t("seller_orders.preparing"),        value: counts.preparing,  icon: Package,       color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400",      filter: "preparing" },
    { label: t("seller_orders.ready_for_pickup"), value: counts.ready,      icon: CheckCircle2,  color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400", filter: "ready" },
    { label: t("seller_orders.stats_active_deliveries"), value: counts.delivering, icon: Truck,  color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400",    filter: "delivering" },
    { label: t("seller_orders.stats_completed"),  value: counts.completed,  icon: CheckCircle2,  color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",  filter: "completed" },
    { label: t("seller_orders.cancelled"),        value: counts.cancelled,  icon: XCircle,       color: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",          filter: "cancelled" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.filter;
        return (
          <button
            key={card.filter}
            onClick={() => onFilter(isActive ? "all" : card.filter)}
            className={cn(
              "flex flex-col gap-2 p-4 rounded-2xl border text-start transition-all hover:shadow-md",
              isActive
                ? "border-foreground/30 bg-foreground/5 shadow-sm ring-1 ring-foreground/20"
                : "bg-card border-border hover:border-foreground/20"
            )}
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", card.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums" translate="no">{card.value}</p>
              <p className="text-xs text-muted-foreground font-medium leading-tight mt-0.5">{card.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Operational Metrics ───────────────────────────────────────────────── */
function OperationalMetrics({ t, formatCurrency }: {
  t: (k: string, opts?: Record<string, unknown>) => string;
  formatCurrency: (n: number) => string;
}) {
  const { token } = useAuth();
  const { data: metrics, isLoading, refetch } = useQuery<SellerMetrics>({
    queryKey: ["seller-metrics"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/seller/metrics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const items = [
    { label: t("seller_orders.metrics_today"),           value: isLoading ? "—" : String(metrics?.ordersToday ?? 0),              icon: Clock,       sub: t("seller_orders.metrics_orders") },
    { label: t("seller_orders.metrics_this_week"),       value: isLoading ? "—" : String(metrics?.ordersThisWeek ?? 0),           icon: BarChart3,   sub: t("seller_orders.metrics_orders") },
    { label: t("seller_orders.metrics_this_month"),      value: isLoading ? "—" : String(metrics?.ordersThisMonth ?? 0),          icon: TrendingUp,  sub: t("seller_orders.metrics_orders") },
    { label: t("seller_orders.metrics_avg_value"),       value: isLoading ? "—" : formatCurrency(metrics?.avgOrderValue ?? 0),    icon: ShoppingBag, sub: "" },
    { label: t("seller_orders.metrics_cancellation_rate"), value: isLoading ? "—" : `${metrics?.cancellationRate ?? 0}%`,         icon: Percent,     sub: "" },
    { label: t("seller_orders.metrics_delivery_success"), value: isLoading ? "—" : `${metrics?.deliverySuccessRate ?? 0}%`,       icon: Target,      sub: "" },
    { label: t("seller_orders.metrics_preparing"),       value: isLoading ? "—" : String(metrics?.preparingCount ?? 0),           icon: Package,     sub: t("seller_orders.metrics_orders") },
    { label: t("seller_orders.metrics_awaiting_courier"), value: isLoading ? "—" : String(metrics?.awaitingCourierCount ?? 0),   icon: Truck,       sub: t("seller_orders.metrics_orders") },
  ];

  return (
    <div className="mb-6 bg-card border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("seller_orders.metrics_title")}</h2>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-lg font-black tabular-nums" translate="no">{item.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Bulk Action Bar ────────────────────────────────────────────────────── */
function BulkActionBar({ selected, orders, onAction, isPending, onClear, t }: {
  selected: Set<number>; orders: any[]; onAction: (ids: number[], status: string) => void;
  isPending: boolean; onClear: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  if (selected.size === 0) return null;

  const selectedOrders = orders.filter(o => selected.has(o.id));
  const canConfirm  = selectedOrders.some(o => o.status === "pending");
  const canPrepare  = selectedOrders.some(o => o.status === "confirmed");
  const canReady    = selectedOrders.some(o => o.status === "preparing");

  return (
    <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-2xl px-4 py-3 shadow-2xl border border-foreground/20 max-w-[calc(100vw-2rem)]">
      <span className="text-sm font-bold shrink-0" translate="no">
        {t("seller_orders.bulk_selected", { count: selected.size })}
      </span>
      <div className="h-4 w-px bg-background/20" />
      {canConfirm && (
        <Button size="sm" disabled={isPending}
          className="bg-sky-500 hover:bg-sky-600 text-white border-0 h-8 text-xs"
          onClick={() => onAction(selectedOrders.filter(o => o.status === "pending").map(o => o.id), "confirmed")}>
          <CheckCircle2 className="h-3.5 w-3.5 me-1" />
          {t("seller_orders.bulk_confirm")}
        </Button>
      )}
      {canPrepare && (
        <Button size="sm" disabled={isPending}
          className="bg-cyan-500 hover:bg-cyan-600 text-white border-0 h-8 text-xs"
          onClick={() => onAction(selectedOrders.filter(o => o.status === "confirmed").map(o => o.id), "preparing")}>
          <Package className="h-3.5 w-3.5 me-1" />
          {t("seller_orders.bulk_preparing")}
        </Button>
      )}
      {canReady && (
        <Button size="sm" disabled={isPending}
          className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 h-8 text-xs"
          onClick={() => onAction(selectedOrders.filter(o => o.status === "preparing").map(o => o.id), "ready_for_pickup")}>
          <CheckCircle2 className="h-3.5 w-3.5 me-1" />
          {t("seller_orders.bulk_ready")}
        </Button>
      )}
      <button onClick={onClear} className="ms-1 text-background/60 hover:text-background transition-colors shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Order Row (desktop table) ─────────────────────────────────────────── */
function OrderRow({ order, selected, onSelect, onForward, isPending, t, formatCurrency }: {
  order: any; selected: boolean; onSelect: (id: number) => void;
  onForward: (id: number, status: string) => void; isPending: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
  formatCurrency: (n: number) => string;
}) {
  const subtotal = order.items.reduce((s: number, i: OrderItem) => s + (i.unitPrice * i.quantity), 0);
  const totalQty = order.items.reduce((s: number, i: OrderItem) => s + i.quantity, 0);

  return (
    <tr className={cn("border-b transition-colors hover:bg-muted/30", selected && "bg-primary/5")}>
      <td className="px-4 py-3 w-10">
        <button onClick={() => onSelect(order.id)} className="flex items-center justify-center">
          {selected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
        </button>
      </td>
      <td className="px-4 py-3">
        <Link href={`/seller/orders/${order.id}`} className="font-bold text-sm text-primary hover:underline" translate="no">
          #{order.id}
        </Link>
        <p className="text-[10px] text-muted-foreground" translate="no">{dateFns(new Date(order.createdAt), "MMM d, h:mm a")}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold text-sm truncate max-w-[120px]">{order.customerName}</p>
        {order.customerPhone && (
          <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" translate="no">
            <Phone className="h-2.5 w-2.5" />{order.customerPhone}
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-semibold">{order.items.length}</span>
        <p className="text-[10px] text-muted-foreground" translate="no">×{totalQty}</p>
      </td>
      <td className="px-4 py-3 text-end" translate="no">
        <span className="text-sm font-semibold">{formatCurrency(subtotal)}</span>
      </td>
      <td className="px-4 py-3 text-end" translate="no">
        <span className="text-sm text-muted-foreground">{order.deliveryFee ? formatCurrency(order.deliveryFee) : "—"}</span>
      </td>
      <td className="px-4 py-3 text-end" translate="no">
        <span className="text-sm font-black">{formatCurrency(order.total)}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground truncate max-w-[90px] block">
          {order.zoneNameEn ?? t("seller_orders.no_zone")}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground truncate max-w-[80px] block">
          {order.courierName ?? t("seller_orders.no_courier")}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={order.status} t={t} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {order.status === "pending" && (
            <>
              <Button size="sm" disabled={isPending}
                className="h-7 px-2 text-xs bg-sky-500 hover:bg-sky-600 text-white border-0"
                onClick={() => onForward(order.id, "confirmed")}>
                {t("seller_orders.mark_confirmed")}
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending}
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => onForward(order.id, "cancelled")}>
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {order.status === "confirmed" && (
            <Button size="sm" disabled={isPending}
              className="h-7 px-2 text-xs bg-cyan-500 hover:bg-cyan-600 text-white border-0"
              onClick={() => onForward(order.id, "preparing")}>
              {t("seller_orders.mark_preparing")}
            </Button>
          )}
          {order.status === "preparing" && (
            <Button size="sm" disabled={isPending}
              className="h-7 px-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              onClick={() => onForward(order.id, "ready_for_pickup")}>
              {t("seller_orders.mark_ready")}
            </Button>
          )}
          <Link href={`/seller/orders/${order.id}`}>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </td>
    </tr>
  );
}

/* ─── Order Card (mobile) ────────────────────────────────────────────────── */
function OrderCard({ order, selected, onSelect, onForward, isPending, t, formatCurrency }: {
  order: any; selected: boolean; onSelect: (id: number) => void;
  onForward: (id: number, status: string) => void; isPending: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
  formatCurrency: (n: number) => string;
}) {
  const subtotal = order.items.reduce((s: number, i: OrderItem) => s + (i.unitPrice * i.quantity), 0);

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden transition-all", selected && "ring-2 ring-primary")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => onSelect(order.id)} className="shrink-0">
            {selected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
          </button>
          <Link href={`/seller/orders/${order.id}`} className="font-bold text-sm text-primary hover:underline shrink-0" translate="no">
            #{order.id}
          </Link>
          <StatusBadge status={order.status} t={t} />
        </div>
        <span className="text-xs text-muted-foreground shrink-0" translate="no">
          {dateFns(new Date(order.createdAt), "MMM d, yyyy")}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Customer */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{(order.customerName || "?").charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{order.customerName}</p>
            {order.customerPhone && (
              <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" translate="no">
                <Phone className="h-3 w-3" />{order.customerPhone}
              </a>
            )}
          </div>
        </div>

        {/* Financials */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">{t("seller_orders.subtotal")}: </span>
            <span className="font-semibold" translate="no">{formatCurrency(subtotal)}</span>
          </div>
          {order.deliveryFee ? (
            <div>
              <span className="text-muted-foreground text-xs">{t("seller_orders.delivery_fee")}: </span>
              <span className="font-semibold" translate="no">{formatCurrency(order.deliveryFee)}</span>
            </div>
          ) : null}
          <div>
            <span className="text-muted-foreground text-xs">{t("seller_orders.total")}: </span>
            <span className="font-black" translate="no">{formatCurrency(order.total)}</span>
          </div>
        </div>

        {/* Zone + Courier */}
        {(order.zoneNameEn || order.courierName) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {order.zoneNameEn && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{order.zoneNameEn}</span>
            )}
            {order.courierName && (
              <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{order.courierName}</span>
            )}
          </div>
        )}

        {/* Items chips */}
        <div className="flex flex-wrap gap-1.5">
          {order.items.map((item: OrderItem) => (
            <span key={item.productId}
              className="inline-flex items-center gap-1 bg-muted/50 rounded-lg px-2.5 py-1 text-xs border border-border/50">
              <span className="font-medium">{item.productName}</span>
              <span className="text-muted-foreground">×{item.quantity}</span>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          {order.status === "pending" && (
            <>
              <Button size="sm" disabled={isPending}
                className="bg-sky-500 hover:bg-sky-600 text-white border-0"
                onClick={() => onForward(order.id, "confirmed")}>
                <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                {t("seller_orders.mark_confirmed")}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending}
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                onClick={() => onForward(order.id, "cancelled")}>
                <XCircle className="h-3.5 w-3.5 me-1.5" />
                {t("seller_orders.cancel_order")}
              </Button>
            </>
          )}
          {order.status === "confirmed" && (
            <Button size="sm" disabled={isPending}
              className="bg-cyan-500 hover:bg-cyan-600 text-white border-0"
              onClick={() => onForward(order.id, "preparing")}>
              <Package className="h-3.5 w-3.5 me-1.5" />
              {t("seller_orders.mark_preparing")}
            </Button>
          )}
          {order.status === "preparing" && (
            <Button size="sm" disabled={isPending}
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              onClick={() => onForward(order.id, "ready_for_pickup")}>
              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
              {t("seller_orders.mark_ready")}
            </Button>
          )}
          {order.status === "ready_for_pickup" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <Clock className="h-3.5 w-3.5" />{t("seller_orders.awaiting_courier")}
            </span>
          )}
          {["courier_assigned","picked_up","in_transit","out_for_delivery"].includes(order.status) && (
            <span className="inline-flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 font-semibold">
              <Truck className="h-3.5 w-3.5" />{t("seller_orders.courier_handling")}
            </span>
          )}
          <Link href={`/seller/orders/${order.id}`}>
            <Button size="sm" variant="outline" className="text-xs gap-1">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("seller_orders.view_details")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function SellerOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const [search, setSearch]           = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterGroup>("all");
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<Set<number>>(new Set());

  const { data: orders = [], isLoading, refetch } = useListOrders();

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: t("seller_orders.updated") });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["seller-metrics"] });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? t("seller_orders.update_failed");
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const handleForward = useCallback((orderId: number, newStatus: string) => {
    updateStatus.mutate({ id: orderId, data: { status: newStatus as any } });
  }, [updateStatus]);

  const handleBulkAction = useCallback(async (ids: number[], status: string) => {
    let succeeded = 0;
    for (const id of ids) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateStatus.mutate(
            { id, data: { status: status as any } },
            { onSuccess: () => resolve(), onError: reject }
          );
        });
        succeeded++;
      } catch {}
    }
    toast({ title: t("seller_orders.bulk_success", { count: succeeded }) });
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["seller-metrics"] });
    setSelected(new Set());
  }, [updateStatus, queryClient, t, toast]);

  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let list = [...orders];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        o.customerName.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        (o.customerPhone ?? "").includes(q)
      );
    }
    if (activeFilter !== "all") {
      const statuses = FILTER_STATUSES[activeFilter];
      list = list.filter(o => statuses.includes(o.status));
    }
    return list;
  }, [orders, search, activeFilter]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  // Filter chip counts
  const filterCounts = useMemo(() => {
    const c: Record<FilterGroup, number> = { all: orders.length, new: 0, preparing: 0, ready: 0, delivering: 0, completed: 0, cancelled: 0, refunded: 0, returned: 0 };
    for (const o of orders) {
      for (const [key, statuses] of Object.entries(FILTER_STATUSES)) {
        if (statuses.length > 0 && statuses.includes(o.status)) {
          c[key as FilterGroup]++;
        }
      }
    }
    return c;
  }, [orders]);

  const FILTER_GROUPS: { key: FilterGroup; label: string }[] = [
    { key: "all",        label: t("seller_orders.filter_all") },
    { key: "new",        label: t("seller_orders.filter_new") },
    { key: "preparing",  label: t("seller_orders.filter_preparing") },
    { key: "ready",      label: t("seller_orders.filter_ready") },
    { key: "delivering", label: t("seller_orders.filter_delivering") },
    { key: "completed",  label: t("seller_orders.filter_completed") },
    { key: "cancelled",  label: t("seller_orders.filter_cancelled") },
    { key: "refunded",   label: t("seller_orders.refunded") },
    { key: "returned",   label: t("seller_orders.returned") },
  ];

  // Select all on current page
  const allPageSelected = paged.length > 0 && paged.every(o => selected.has(o.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      paged.forEach(o => next.delete(o.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paged.forEach(o => next.add(o.id));
      setSelected(next);
    }
  };

  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-8 max-w-7xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("seller_orders.title")}</h1>
            {!isLoading && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("seller_orders.items_count_plural", { count: orders.length })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["seller-metrics"] }); }}
            className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("seller_orders.refresh")}
          </Button>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
            </div>
            <div className="h-24 bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-muted rounded-2xl animate-pulse" />)}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-card border rounded-2xl">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t("seller_orders.no_orders")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{t("seller_orders.no_orders_desc")}</p>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <StatsCards orders={orders} onFilter={setActiveFilter} activeFilter={activeFilter} t={t} />

            {/* Operational metrics */}
            <OperationalMetrics t={t} formatCurrency={formatCurrency} />

            {/* Filter chips + search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {FILTER_GROUPS.filter(f => f.key === "all" || filterCounts[f.key] > 0).map(({ key, label }) => (
                  <button key={key}
                    onClick={() => setActiveFilter(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                      activeFilter === key
                        ? "bg-foreground text-background border-foreground"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}>
                    {label}
                    <span className={cn("text-[10px] font-bold px-1 py-0.5 rounded-full",
                      activeFilter === key ? "bg-background/20" : "bg-muted")} translate="no">
                      {filterCounts[key]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder={t("seller_orders.search_placeholder")} value={search}
                  onChange={e => setSearch(e.target.value)} className="ps-9 h-10" />
                {search && (
                  <button className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearch("")}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* No results */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card border rounded-2xl">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("seller_orders.no_results")}</p>
                <Button variant="ghost" size="sm" className="mt-2"
                  onClick={() => { setSearch(""); setActiveFilter("all"); }}>
                  <X className="h-3.5 w-3.5 me-1" />{t("common.clear_filters", "Clear filters")}
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block bg-card border rounded-2xl overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-3 w-10">
                          <button onClick={toggleSelectAll}>
                            {allPageSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.order_id")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.customer")}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">{t("seller_orders.products_count")}</th>
                        <th className="px-4 py-3 text-end text-xs font-semibold text-muted-foreground">{t("seller_orders.subtotal")}</th>
                        <th className="px-4 py-3 text-end text-xs font-semibold text-muted-foreground">{t("seller_orders.delivery_fee")}</th>
                        <th className="px-4 py-3 text-end text-xs font-semibold text-muted-foreground">{t("seller_orders.total")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.zone")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.courier")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.status")}</th>
                        <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("seller_orders.section_actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map(order => (
                        <OrderRow
                          key={order.id}
                          order={order}
                          selected={selected.has(order.id)}
                          onSelect={toggleSelect}
                          onForward={handleForward}
                          isPending={updateStatus.isPending}
                          t={t}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3 mb-4">
                  {paged.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      selected={selected.has(order.id)}
                      onSelect={toggleSelect}
                      onForward={handleForward}
                      isPending={updateStatus.isPending}
                      t={t}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="min-h-[44px] gap-1.5">
                      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                      {t("common.prev", "Previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums" translate="no">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="min-h-[44px] gap-1.5">
                      {t("common.next", "Next")}
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selected={selected}
        orders={orders}
        onAction={handleBulkAction}
        isPending={updateStatus.isPending}
        onClear={() => setSelected(new Set())}
        t={t}
      />
    </Layout>
  );
}
