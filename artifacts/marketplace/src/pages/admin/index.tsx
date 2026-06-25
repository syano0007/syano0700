import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES } from "@/lib/categories";
import {
  useAdminGetStats,
  useListNotifications,
  useMarkNotificationRead,
  getGetNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { AppNotification } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn, localizeNotif } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Users, Package, ShoppingCart, TrendingUp, Clock, Store,
  Download, Activity, AlertTriangle, CheckCircle2,
  RefreshCw, BarChart3, Layers, Trophy, Medal, Bell, XCircle,
  ShoppingBag, Zap, Truck, UserCheck, UserX, PackageCheck, PackageX,
  UserPlus, Bike,
} from "lucide-react";

// ─── Notification icon/color maps (mirrors NotificationCenter) ─────────────────

const NOTIF_ICON: Record<string, React.ElementType> = {
  new_order:         ShoppingBag,
  order_placed:      ShoppingCart,
  order_processing:  Zap,
  order_shipped:     Truck,
  order_delivered:   CheckCircle2,
  order_cancelled:   XCircle,
  low_stock:         AlertTriangle,
  seller_applied:    Store,
  seller_approved:   UserCheck,
  seller_rejected:   UserX,
  product_submitted: Package,
  product_approved:  PackageCheck,
  product_rejected:  PackageX,
  new_user:          UserPlus,
  courier_applied:   Bike,
};

const NOTIF_COLOR: Record<string, string> = {
  new_order:         "bg-blue-500",
  order_placed:      "bg-primary",
  order_processing:  "bg-amber-500",
  order_shipped:     "bg-indigo-500",
  order_delivered:   "bg-primary",
  order_cancelled:   "bg-red-500",
  low_stock:         "bg-orange-500",
  seller_applied:    "bg-violet-500",
  seller_approved:   "bg-primary",
  seller_rejected:   "bg-red-500",
  product_submitted: "bg-sky-500",
  product_approved:  "bg-primary",
  product_rejected:  "bg-red-500",
  new_user:          "bg-teal-500",
  courier_applied:   "bg-orange-500",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedStats {
  totalSellers: number;
  pendingSellerApps: number;
  avgOrderValue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  prevMonthRevenue: number;
  newUsersThisMonth: number;
  outOfStockProducts: number;
  topCategories: { category: string; count: number }[];
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  activeProducts: number;
  totalCustomers: number;
}


interface OperationCenterData {
  recentRegistrations: { id: number; name: string; email: string; role: string; createdAt: string }[];
  recentReviews: { id: number; rating: number; comment: string; createdAt: string; productName: string }[];
  recentCancellations: { id: number; customerName: string; total: number; updatedAt: string }[];
  recentDeliveries: { id: number; customerName: string; total: number; updatedAt: string }[];
}

interface TopPerformers {
  topSellers: { sellerId: number; sellerName: string; revenue: number; orderCount: number }[];
  topProducts: { productId: number; productName: string; salesCount: number; revenue: number }[];
}

interface ActivityEntry {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
}

interface ProductQualityReport {
  total_products: number;
  flagged_count: number;
  flagged_percentage: number;
  breakdown: {
    missing_images: number;
    short_description: number;
    short_description_ar: number;
    missing_name_ar: number;
    zero_price: number;
    out_of_stock: number;
    not_embedded: number;
  };
  products: Array<{
    id: number;
    name: string;
    name_ar: string;
    seller_id: number;
    store_name: string;
    issues: string[];
  }>;
}

interface StoreQualityReport {
  total_stores: number;
  flagged_count: number;
  stores: Array<{
    id: number;
    name: string;
    seller_id: number;
    issues: string[];
  }>;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function useCountUp(target: number, enabled: boolean): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!enabled || target <= 0) { setVal(0); return; }
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  emerald: { icon: "text-primary dark:text-primary", bg: "bg-primary/10", border: "border-primary/20/50 dark:border-primary/20/30" },
  teal:    { icon: "text-teal-600 dark:text-teal-400",       bg: "bg-teal-500/10",    border: "border-teal-200/50 dark:border-teal-800/30" },
  green:   { icon: "text-primary dark:text-primary",     bg: "bg-primary/10",   border: "border-primary/20/50 dark:border-primary/30" },
  cyan:    { icon: "text-cyan-600 dark:text-cyan-400",       bg: "bg-cyan-500/10",    border: "border-cyan-200/50 dark:border-cyan-800/30" },
  blue:    { icon: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-500/10",    border: "border-blue-200/50 dark:border-blue-800/30" },
  amber:   { icon: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10",   border: "border-amber-200/50 dark:border-amber-800/30" },
  indigo:  { icon: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-500/10",  border: "border-indigo-200/50 dark:border-indigo-800/30" },
  violet:  { icon: "text-violet-600 dark:text-violet-400",   bg: "bg-violet-500/10",  border: "border-violet-200/50 dark:border-violet-800/30" },
  rose:    { icon: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-500/10",    border: "border-rose-200/50 dark:border-rose-800/30" },
  orange:  { icon: "text-orange-600 dark:text-orange-400",   bg: "bg-orange-500/10",  border: "border-orange-200/50 dark:border-orange-800/30" },
} as const;

type ColorKey = keyof typeof COLOR_MAP;

function KpiCard({
  label, rawValue, formatter, sub, icon: Icon, color, loading,
}: {
  label: string;
  rawValue: number;
  formatter?: (n: number) => string;
  sub?: string;
  icon: React.ElementType;
  color: ColorKey;
  loading: boolean;
}) {
  const animated = useCountUp(rawValue, !loading);
  const styles = COLOR_MAP[color];
  const display = formatter ? formatter(animated) : animated.toLocaleString();

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 transition-[transform,border-color] duration-150",
      "hover:-translate-y-0.5 hover:border-primary/20",
      styles.border,
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground leading-snug pe-1">{label}</p>
        <div className={cn("p-2 rounded-lg shrink-0", styles.bg)}>
          <Icon className={cn("h-4 w-4", styles.icon)} />
        </div>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-7 w-28 bg-muted rounded animate-pulse" />
          <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-stat-number text-foreground leading-none">{display}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active, label, payload, formatRev,
}: {
  active?: boolean;
  label?: string;
  payload?: { name: string; value: number; color: string; dataKey?: string }[];
  formatRev: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm min-w-[150px]">
      <p className="text-muted-foreground text-xs mb-2 font-semibold">{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey ?? e.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
          <span className="text-muted-foreground flex-1">{e.name}:</span>
          <span className="font-bold text-foreground tabular-nums">
            {e.dataKey === "revenue" ? formatRev(e.value) : e.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Activity Metadata ────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ElementType; cls: string }> = {
  DELETE_USER:          { icon: Users,         cls: "text-red-500 bg-red-500/10" },
  UPDATE_PRODUCT:       { icon: Package,       cls: "text-blue-500 bg-blue-500/10" },
  DELETE_PRODUCT:       { icon: Package,       cls: "text-red-500 bg-red-500/10" },
  UPDATE_ORDER_STATUS:  { icon: ShoppingCart,  cls: "text-blue-500 bg-blue-500/10" },
  UPDATE_SETTINGS:      { icon: Activity,      cls: "text-muted-foreground bg-muted" },
  APPROVE_SELLER:       { icon: CheckCircle2,  cls: "text-primary bg-primary/10" },
  REJECT_SELLER:        { icon: Store,         cls: "text-red-500 bg-red-500/10" },
  SUSPEND_SELLER:       { icon: AlertTriangle, cls: "text-amber-500 bg-amber-500/10" },
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  shipped:    "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  delivered:  "bg-primary/10 text-primary dark:text-primary",
  cancelled:  "bg-red-500/10 text-red-600 dark:text-red-400",
};

function formatShortDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  return `${parseInt(month)}/${parseInt(day)}`;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const { token } = useAuth();
  const lang = i18n.language;
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const { data: stats, isLoading, isError: isStatsError, refetch: refetchStats } = useAdminGetStats();

  const { data: ext, isLoading: isExtLoading } = useQuery<ExtendedStats>({
    queryKey: ["admin-stats-extended"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats/extended", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load extended stats");
      return res.json();
    },
  });

  const { data: timeseries, isLoading: isTimeLoading } = useQuery<{ data: { date: string; revenue: number; orders: number }[] }>({
    queryKey: ["admin-timeseries", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats/timeseries?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load timeseries");
      return res.json();
    },
  });

  const { data: activity, isLoading: isActivityLoading, refetch: refetchActivity } = useQuery<ActivityEntry[]>({
    queryKey: ["admin-activity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activity", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load activity");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: topPerformers, isLoading: isTopLoading } = useQuery<TopPerformers>({
    queryKey: ["admin-top-performers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats/top-performers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load top performers");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data: notifications } = useListNotifications({
    query: { refetchInterval: 30_000, queryKey: getListNotificationsQueryKey() },
  });
  const { mutate: markReadMutate } = useMarkNotificationRead();

  const unreadNotifications = useMemo(
    () => (notifications ?? []).filter((n) => !n.isRead).slice(0, 10),
    [notifications]
  );

  const handleNotifClick = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) {
        markReadMutate({ id: n.id }, {
          onSettled: () => {
            queryClient.invalidateQueries({ queryKey: getGetNotificationCountQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
          },
        });
      }
      if (n.link) navigate(n.link);
    },
    [markReadMutate, navigate, queryClient]
  );

  const { data: opCenter } = useQuery<OperationCenterData>({
    queryKey: ["admin-operation-center"],
    queryFn: async () => {
      const res = await fetch("/api/admin/operation-center", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: productQuality } = useQuery<ProductQualityReport>({
    queryKey: ["admin-product-quality"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products/quality-report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const { data: storeQuality } = useQuery<StoreQualityReport>({
    queryKey: ["admin-store-quality"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stores/quality-report", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const healthScore = useMemo(() => {
    if (!stats || !ext) return null;
    const total      = stats.totalOrders ?? 0;
    const delivered  = (stats.ordersByStatus ?? []).find((s) => s.status === "delivered")?.count ?? 0;
    const cancelled  = (stats.ordersByStatus ?? []).find((s) => s.status === "cancelled")?.count ?? 0;
    const totalProds = stats.totalProducts ?? 0;
    const oos        = ext.outOfStockProducts ?? 0;
    const pendSell   = ext.pendingSellerApps ?? 0;
    const fulfillment  = total > 0      ? Math.min(100, Math.round((delivered / total) * 150))        : 75;
    const cancellation = total > 0      ? Math.max(0,   100 - Math.round((cancelled / total) * 200)) : 90;
    const stock        = totalProds > 0 ? Math.max(0,   100 - Math.round((oos / totalProds) * 150))  : 100;
    const sellerQueue  = pendSell > 15  ? 50 : pendSell > 5 ? 75 : 100;
    return Math.min(100, Math.round(0.35 * fulfillment + 0.25 * cancellation + 0.25 * stock + 0.15 * sellerQueue));
  }, [stats, ext]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const chartData = (timeseries?.data ?? []).map((d) => ({
    ...d, label: formatShortDate(d.date),
  }));
  const hasChartData = chartData.some((d) => d.revenue > 0 || d.orders > 0);
  const pendingOrders = (stats?.ordersByStatus ?? []).find((s) => s.status === "pending")?.count ?? 0;
  const maxCatCount = Math.max(...(ext?.topCategories ?? []).map((c) => c.count), 1);

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/orders?limit=1000", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data: orders } = await res.json();
      const headers = ["ID", "Customer", "Email", "Total (USD)", "Status", "Date"];
      const rows = (orders ?? []).map((o: any) => [
        o.id,
        `"${(o.customerName ?? "").replace(/"/g, '""')}"`,
        `"${(o.customerEmail ?? "").replace(/"/g, '""')}"`,
        o.total,
        o.status,
        new Date(o.createdAt).toLocaleDateString(),
      ]);
      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syano-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const dateOptions = [
    { value: 7,  label: t("admin.date_7d") },
    { value: 30, label: t("admin.date_30d") },
    { value: 90, label: t("admin.date_90d") },
  ];

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-page-title text-foreground">{t("admin.nav_dashboard")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("admin.dashboard_desc")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="gap-2 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "..." : t("admin.export_csv")}
          </Button>
        </div>

        {/* ── Stats Error Banner ── */}
        {isStatsError && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-destructive/5 border border-destructive/20 rounded-xl text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t("common.error_subtitle")}</span>
            <button
              onClick={() => refetchStats()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-destructive/30 hover:bg-destructive/10 transition-colors text-xs font-medium"
            >
              <RefreshCw className="h-3.5 w-3.5" />{t("common.retry")}
            </button>
          </div>
        )}

        {/* ── Notifications Banner ── */}
        {notifications !== undefined && unreadNotifications.length === 0 && (
          <div className="mb-5 flex items-center gap-2 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary dark:text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {t("admin.alerts_all_clear")}
          </div>
        )}
        {unreadNotifications.length > 0 && (
          <div className="mb-5 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold">{t("admin.alerts_title")}</h2>
              <span className="ms-auto text-xs text-muted-foreground">{unreadNotifications.length} {t("admin.total_count")}</span>
            </div>
            <div className="divide-y divide-border">
              {unreadNotifications.map((notif) => {
                const Icon = NOTIF_ICON[notif.type] ?? Bell;
                const dotColor = NOTIF_COLOR[notif.type] ?? "bg-blue-400";
                return (
                  <div key={notif.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={cn("w-2 h-2 rounded-full shrink-0 flex-none", dotColor)} />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm flex-1 min-w-0">
                      <span className="font-semibold">{localizeNotif(notif.title, i18n.language)}</span>
                      <span className="text-muted-foreground ms-1.5 text-xs truncate">
                        {localizeNotif(notif.body, i18n.language)}
                      </span>
                    </p>
                    {notif.link && (
                      <button
                        onClick={() => handleNotifClick(notif)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        {t("admin.alert_view")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── KPI Grid — Row 1: Revenue ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KpiCard
            label={t("admin.total_revenue")}
            rawValue={stats?.totalRevenue ?? 0}
            formatter={formatCurrency}
            icon={TrendingUp}
            color="emerald"
            loading={isLoading}
            sub={`${(stats?.totalOrders ?? 0).toLocaleString()} ${t("admin.total_orders")}`}
          />
          <KpiCard
            label={t("admin.kpi_month_revenue")}
            rawValue={ext?.monthRevenue ?? 0}
            formatter={formatCurrency}
            icon={BarChart3}
            color="teal"
            loading={isExtLoading}
          />
          <KpiCard
            label={t("admin.kpi_today_revenue")}
            rawValue={ext?.todayRevenue ?? 0}
            formatter={formatCurrency}
            icon={Activity}
            color="green"
            loading={isExtLoading}
          />
          <KpiCard
            label={t("admin.kpi_avg_order")}
            rawValue={ext?.avgOrderValue ?? 0}
            formatter={formatCurrency}
            icon={TrendingUp}
            color="cyan"
            loading={isExtLoading}
          />
        </div>

        {/* ── KPI Grid — Row 2: Operations ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label={t("admin.total_orders")}
            rawValue={stats?.totalOrders ?? 0}
            icon={ShoppingCart}
            color="blue"
            loading={isLoading}
            sub={`${pendingOrders} ${t("admin.kpi_pending_orders")}`}
          />
          <KpiCard
            label={t("admin.total_users")}
            rawValue={stats?.totalUsers ?? 0}
            icon={Users}
            color="indigo"
            loading={isLoading}
            sub={`+${ext?.newUsersThisMonth ?? 0} ${t("admin.kpi_new_users")}`}
          />
          <KpiCard
            label={t("admin.kpi_total_sellers")}
            rawValue={ext?.totalSellers ?? 0}
            icon={Store}
            color="violet"
            loading={isExtLoading}
            sub={`${ext?.pendingSellerApps ?? 0} ${t("admin.kpi_pending_sellers")}`}
          />
          <KpiCard
            label={t("admin.total_products")}
            rawValue={stats?.totalProducts ?? 0}
            icon={Package}
            color="orange"
            loading={isLoading}
            sub={`${ext?.outOfStockProducts ?? 0} ${t("admin.kpi_out_of_stock")}`}
          />
        </div>

        {/* ── KPI Grid — Row 3: Order Counts ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label={t("admin.kpi_orders_today")}
            rawValue={ext?.todayOrders ?? 0}
            icon={ShoppingCart}
            color="blue"
            loading={isExtLoading}
          />
          <KpiCard
            label={t("admin.kpi_orders_week")}
            rawValue={ext?.weekOrders ?? 0}
            icon={BarChart3}
            color="indigo"
            loading={isExtLoading}
          />
          <KpiCard
            label={t("admin.kpi_orders_month")}
            rawValue={ext?.monthOrders ?? 0}
            icon={Layers}
            color="violet"
            loading={isExtLoading}
            sub={ext?.prevMonthRevenue != null && ext?.monthRevenue != null && ext.prevMonthRevenue > 0
              ? `${ext.monthRevenue >= ext.prevMonthRevenue ? "+" : ""}${Math.round(((ext.monthRevenue - ext.prevMonthRevenue) / ext.prevMonthRevenue) * 100)}% ${t("admin.kpi_growth_mom")}`
              : undefined}
          />
          <KpiCard
            label={t("admin.kpi_active_products")}
            rawValue={ext?.activeProducts ?? 0}
            icon={Package}
            color="green"
            loading={isExtLoading}
            sub={`${ext?.totalCustomers ?? 0} ${t("admin.kpi_total_customers")}`}
          />
        </div>

        {/* ── Health Score + Top Performers ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Platform Health Score */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">{t("admin.platform_health")}</h2>
            </div>
            {(isLoading || isExtLoading) ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : (
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-28 h-28 rounded-full flex items-center justify-center border-[6px] transition-colors",
                  healthScore == null   ? "border-muted" :
                  healthScore >= 80     ? "border-primary" :
                  healthScore >= 60     ? "border-yellow-500" : "border-red-500"
                )}>
                  <div className="text-center">
                    <span className={cn(
                      "text-dashboard-kpi block leading-none",
                      healthScore == null ? "text-muted-foreground" :
                      healthScore >= 80   ? "text-primary" :
                      healthScore >= 60   ? "text-yellow-500" : "text-red-500"
                    )}>
                      {healthScore ?? "–"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">/100</span>
                  </div>
                </div>
                <p className={cn(
                  "mt-3 text-sm font-semibold",
                  healthScore == null ? "text-muted-foreground" :
                  healthScore >= 80   ? "text-primary" :
                  healthScore >= 60   ? "text-yellow-500" : "text-red-500"
                )}>
                  {healthScore == null ? t("admin.health_loading") :
                   healthScore >= 80   ? t("admin.health_excellent") :
                   healthScore >= 60   ? t("admin.health_needs_attention") : t("admin.health_action_required")}
                </p>
                <div className="w-full mt-5 space-y-2.5 text-xs">
                  {[
                    {
                      key: "order_fulfillment",
                      label: t("admin.health_order_fulfillment"),
                      val: (() => {
                        const tot = stats?.totalOrders ?? 0;
                        const del = (stats?.ordersByStatus ?? []).find((s) => s.status === "delivered")?.count ?? 0;
                        return tot > 0 ? Math.min(100, Math.round((del / tot) * 150)) : 75;
                      })(),
                    },
                    {
                      key: "stock_availability",
                      label: t("admin.health_stock_availability"),
                      val: (() => {
                        const tot = stats?.totalProducts ?? 0;
                        const oos = ext?.outOfStockProducts ?? 0;
                        return tot > 0 ? Math.max(0, 100 - Math.round((oos / tot) * 150)) : 100;
                      })(),
                    },
                    {
                      key: "seller_queue",
                      label: t("admin.health_seller_queue"),
                      val: (() => {
                        const p = ext?.pendingSellerApps ?? 0;
                        return p > 15 ? 50 : p > 5 ? 75 : 100;
                      })(),
                    },
                  ].map(({ key, label, val }) => (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold tabular-nums">{val}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700",
                            val >= 75 ? "bg-primary" : val >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Sellers Leaderboard */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-foreground text-sm">{t("admin.top_sellers_leaderboard")}</h2>
            </div>
            {isTopLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-9 bg-muted animate-pulse rounded" />)}
              </div>
            ) : !topPerformers?.topSellers?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Trophy className="h-8 w-8 mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("admin.top_sellers_empty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPerformers.topSellers.map((s, i) => (
                  <div key={s.sellerId} className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                      i === 0 ? "bg-amber-500/20 text-amber-500" :
                      i === 1 ? "bg-slate-400/20 text-slate-400" :
                      i === 2 ? "bg-orange-600/20 text-orange-600" :
                               "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{s.sellerName}</p>
                      <p className="text-[11px] text-muted-foreground">{t("admin.orders_count", { count: s.orderCount })}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0 text-foreground" translate="no">
                      {formatCurrency(s.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products Leaderboard */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Medal className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">{t("admin.top_products")}</h2>
            </div>
            {isTopLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-9 bg-muted animate-pulse rounded" />)}
              </div>
            ) : !topPerformers?.topProducts?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Medal className="h-8 w-8 mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("admin.top_products_empty")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPerformers.topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                      i === 0 ? "bg-amber-500/20 text-amber-500" :
                      i === 1 ? "bg-slate-400/20 text-slate-400" :
                      i === 2 ? "bg-orange-600/20 text-orange-600" :
                               "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-tight">{p.productName}</p>
                      <p className="text-[11px] text-muted-foreground">{t("admin.units_sold", { count: p.salesCount })}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0 text-foreground" translate="no">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Chart + Orders by Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Revenue Area Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-foreground text-sm">{t("admin.chart_title")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("admin.chart_subtitle")}</p>
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {dateOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDays(value)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                      days === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {isTimeLoading ? (
              <div className="h-56 bg-muted animate-pulse rounded-lg" />
            ) : !hasChartData ? (
              <div className="h-56 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("admin.chart_empty")}</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2, 34 85% 53%))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2, 34 85% 53%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(chartData.length / 8)}
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="left"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    width={40}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={28}
                  />
                  <Tooltip
                    content={<ChartTooltip formatRev={formatCurrency} />}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))", paddingTop: 10 }} />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    name={t("admin.chart_revenue")}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradRevenue)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    yAxisId="orders"
                    type="monotone"
                    dataKey="orders"
                    name={t("admin.chart_orders")}
                    stroke="hsl(var(--chart-2, 34 85% 53%))"
                    strokeWidth={2}
                    fill="url(#gradOrders)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Orders by Status */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground text-sm mb-4">{t("admin.orders_by_status")}</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {(stats?.ordersByStatus ?? []).map(({ status, count }) => {
                  const total = stats?.totalOrders ?? 1;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
                        )}>
                          {t(`orders.status_${status}`)}
                        </span>
                        <span className="text-sm font-bold text-foreground tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700",
                            status === "delivered" ? "bg-primary" :
                            status === "pending"   ? "bg-yellow-500" :
                            status === "processing"? "bg-blue-500"   :
                            status === "shipped"   ? "bg-purple-500" :
                                                     "bg-red-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!stats?.ordersByStatus?.length && (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.no_data")}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Top Categories + Activity Feed ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Top Categories */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground text-sm">{t("admin.top_categories")}</h2>
            </div>
            {isExtLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
              </div>
            ) : !ext?.topCategories?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers className="h-8 w-8 mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("admin.no_categories")}</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {ext.topCategories.map((cat, i) => {
                  const pct = Math.round((cat.count / maxCatCount) * 100);
                  const catDef = CATEGORIES.find((c) => c.slug === cat.category);
                  const name = catDef ? (lang === "ar" ? catDef.ar : catDef.en) : cat.category.replace(/-/g, " ");
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4 text-center">{i + 1}</span>
                          <span className="text-sm font-medium capitalize">{name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {cat.count} {t("admin.products_label")}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-[width] duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground text-sm">{t("admin.activity_feed")}</h2>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/80 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              </div>
              <button
                onClick={() => refetchActivity()}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {isActivityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 bg-muted rounded-full animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-1/2 bg-muted/60 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !activity?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("admin.activity_empty")}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
                {activity.map((entry) => {
                  const meta = ACTION_META[entry.action] ?? { icon: Activity, cls: "text-muted-foreground bg-muted" };
                  const ActionIcon = meta.icon;
                  const actionLabel = t(`admin.action_${entry.action}`, { defaultValue: entry.action.replace(/_/g, " ").toLowerCase() });
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5 group">
                      <div className={cn("p-1.5 rounded-full shrink-0 mt-0.5", meta.cls)}>
                        <ActionIcon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug">
                          <span className="text-muted-foreground">{entry.actorName}</span>
                          {" · "}
                          {actionLabel}
                          {entry.targetId && (
                            <span className="text-muted-foreground font-mono"> #{entry.targetId}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Orders Table ── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">{t("admin.recent_orders")}</h2>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start pb-2.5 font-medium text-xs text-muted-foreground ps-1">{t("admin.col_order")}</th>
                    <th className="text-start pb-2.5 font-medium text-xs text-muted-foreground">{t("admin.col_customer")}</th>
                    <th className="text-start pb-2.5 font-medium text-xs text-muted-foreground">{t("admin.col_total")}</th>
                    <th className="text-start pb-2.5 font-medium text-xs text-muted-foreground">{t("admin.col_status")}</th>
                    <th className="text-start pb-2.5 font-medium text-xs text-muted-foreground">{t("admin.col_date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(stats?.recentOrders ?? []).map((order) => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="py-3 ps-1">
                        <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors" translate="no">
                          #{order.id}
                        </span>
                      </td>
                      <td className="py-3 font-medium">{order.customerName}</td>
                      <td className="py-3 font-bold tabular-nums" translate="no">{formatCurrency(order.total)}</td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-semibold",
                          STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"
                        )}>
                          {t(`orders.status_${order.status}`)}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(order.createdAt).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                  {!stats?.recentOrders?.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {t("admin.no_data")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Operation Center ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

          {/* Recent Registrations */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t("admin.op_registrations")}
            </h3>
            {!(opCenter?.recentRegistrations?.length) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.op_empty")}</p>
            ) : (
              <div className="space-y-0 divide-y divide-border">
                {opCenter.recentRegistrations.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 py-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate" translate="no">{u.email}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize shrink-0",
                      u.role === "seller" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    )}>{u.role}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Cancellations */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              {t("admin.op_cancellations")}
            </h3>
            {!(opCenter?.recentCancellations?.length) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.op_empty")}</p>
            ) : (
              <div className="divide-y divide-border">
                {opCenter.recentCancellations.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium"><span translate="no">#{o.id}</span> <span className="text-muted-foreground font-normal">{o.customerName}</span></p>
                      <p className="text-xs font-bold text-red-600 dark:text-red-400" translate="no">{formatCurrency(o.total)}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap ms-3">
                      {formatDistanceToNow(new Date(o.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Data Quality Section ── */}
        {(productQuality || storeQuality) && (
          <div className="mt-6 bg-card border border-border rounded-xl p-5">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
              {t("admin.quality.section_title")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* Flagged products card */}
              {productQuality && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="text-2xl font-black text-yellow-600 dark:text-yellow-400" translate="no">
                        {productQuality.flagged_count}
                      </span>
                      <span className="text-sm text-muted-foreground ms-2">
                        {t("admin.quality.flagged_products")}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap" translate="no">
                      {productQuality.flagged_percentage}%
                    </span>
                  </div>
                  <Link href="/admin/products" className="text-xs text-primary hover:underline">
                    {t("admin.quality.view_all")} →
                  </Link>
                </div>
              )}

              {/* Flagged stores card */}
              {storeQuality && (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="text-2xl font-black text-orange-600 dark:text-orange-400" translate="no">
                        {storeQuality.flagged_count}
                      </span>
                      <span className="text-sm text-muted-foreground ms-2">
                        {t("admin.quality.flagged_stores")}
                      </span>
                    </div>
                  </div>
                  <Link href="/admin/sellers" className="text-xs text-primary hover:underline">
                    {t("admin.quality.view_all")} →
                  </Link>
                </div>
              )}
            </div>

            {/* Breakdown list */}
            {productQuality && productQuality.flagged_count > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {t("admin.quality.breakdown_title")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(
                    [
                      ["missing_images",      "missing_images"],
                      ["short_description",   "short_description"],
                      ["short_description_ar","short_description_ar"],
                      ["missing_name_ar",     "missing_name_ar"],
                      ["zero_price",          "zero_price"],
                      ["out_of_stock",        "out_of_stock"],
                      ["not_embedded",        "not_embedded"],
                    ] as const
                  ).map(([key, label]) => {
                    const count = productQuality.breakdown[key];
                    if (count === 0) return null;
                    return (
                      <div key={key} className="flex items-center justify-between gap-1 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                        <span className="text-xs text-muted-foreground truncate">{t(`admin.quality.${label}`)}</span>
                        <span className="text-xs font-bold text-foreground shrink-0 ms-1" translate="no">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
