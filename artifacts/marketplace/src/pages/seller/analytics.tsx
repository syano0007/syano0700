// @refresh reset
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useGetSellerReviews, getSellerReviewsQueryKey } from "@workspace/api-client-react";
import {
  TrendingUp, TrendingDown, Minus,
  DollarSign, ShoppingBag, Users, Star, Package,
  Truck, UserCheck, Heart, BarChart2,
  Download, ChevronDown, RefreshCw, Lightbulb,
  CheckCircle, XCircle, Clock, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Types ──────────────────────────────────────────────────── */
interface KPIData { value: number; prev: number; change: number | null; }
interface AnalyticsSummary {
  period: { from: string; to: string };
  kpis: {
    totalOrders: KPIData; completedOrders: KPIData; cancelledOrders: KPIData;
    refundedOrders: KPIData; grossRevenue: KPIData; avgOrderValue: KPIData;
    followers: KPIData; storeRating: KPIData;
  };
  orderStatusBreakdown: { status: string; count: number }[];
  topProducts: { productId: number; productName: string; imageUrl: string | null; viewCount: number; unitsSold: number; revenue: number }[];
  customers: { unique: number; returning: number; new: number; repeatRate: number; avgOrdersPerCustomer: number; prevUnique: number; change: number | null };
  delivery: { totalDelivered: number; totalFailed: number; successRate: number; avgDeliveryHours: number; cancellationRate: number };
  growth: { totalFollowers: number; newFollowers: number; prevFollowers: number; followerChange: number | null; totalReviews: number; avgRating: number; newReviews: number; prevReviews: number; reviewChange: number | null };
}
interface RevenuePoint { date: string; revenue: number; orders: number; aov: number; }
interface RevenueChartData { granularity: string; points: RevenuePoint[]; }
type DatePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "this_year";
type Granularity = "day" | "week" | "month";

/* ─── Date helpers ───────────────────────────────────────────── */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
function getPresetRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":      return { from: today, to: now };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const ye = new Date(y); ye.setHours(23, 59, 59, 999);
      return { from: y, to: ye };
    }
    case "7d": {
      const f = new Date(today); f.setDate(f.getDate() - 6);
      return { from: f, to: now };
    }
    case "30d": {
      const f = new Date(today); f.setDate(f.getDate() - 29);
      return { from: f, to: now };
    }
    case "90d": {
      const f = new Date(today); f.setDate(f.getDate() - 89);
      return { from: f, to: now };
    }
    case "this_month": {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: f, to: now };
    }
    case "last_month": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: f, to: t };
    }
    case "this_year": {
      const f = new Date(now.getFullYear(), 0, 1);
      return { from: f, to: now };
    }
  }
}
function formatChartDate(dateStr: string, gran: Granularity, lang: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const locale = lang === "ar" ? "ar-SY" : "en-US";
  if (gran === "month") return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
function formatDateLabel(dateStr: string, lang: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString(lang === "ar" ? "ar-SY" : "en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── CSV export ─────────────────────────────────────────────── */
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── STATUS colors ──────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  delivered:        "#276221",
  pending:          "#f59e0b",
  confirmed:        "#3b82f6",
  preparing:        "#06b6d4",
  ready_for_pickup: "#0891b2",
  courier_assigned: "#6366f1",
  out_for_delivery: "#8b5cf6",
  cancelled:        "#ef4444",
  delivery_failed:  "#f97316",
  returned:         "#ec4899",
  refunded:         "#a855f7",
};
const PIE_FALLBACK = "#94a3b8";

/* ─── Trend badge ────────────────────────────────────────────── */
function TrendBadge({ change, t }: { change: number | null; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (change === null) return <span className="text-xs text-muted-foreground">{t("seller_analytics.no_prev")}</span>;
  if (change === 0)    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  const up = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{change}%
    </span>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
interface KPICardProps {
  label: string; value: string; kpi: KPIData; icon: React.ReactNode;
  sub?: string;
  iconBg: string;
  iconColor: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}
function KPICard({ label, value, kpi, icon, sub, iconBg, iconColor, t }: KPICardProps) {
  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-all duration-200 hover:border-border/80">
      <div className="flex items-start justify-between gap-2">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <TrendBadge change={kpi.change} t={t} />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums text-foreground tracking-tight">{value}</div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
      <div className="text-xs text-muted-foreground/60">{t("seller_analytics.vs_prev")}</div>
    </div>
  );
}

/* ─── Date preset picker ─────────────────────────────────────── */
interface DatePickerProps {
  preset: DatePreset; from: Date; to: Date;
  onPreset: (p: DatePreset) => void;
  onCustom: (from: Date, to: Date) => void;
  t: (k: string) => string; lang: string;
}
function DatePicker({ preset, from, to, onPreset, onCustom, t, lang }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(toDateStr(from));
  const [customTo, setCustomTo] = useState(toDateStr(to));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const dropW = Math.min(288, vw - 32);
      let left = rect.left;
      if (left + dropW > vw - 16) left = vw - dropW - 16;
      if (left < 16) left = 16;
      setDropPos({ position: "fixed", top: rect.bottom + 8, left, width: dropW, zIndex: 9999 });
    }
  }, [open]);

  const presets: { key: DatePreset; label: string }[] = [
    { key: "today",      label: t("seller_analytics.preset_today") },
    { key: "yesterday",  label: t("seller_analytics.preset_yesterday") },
    { key: "7d",         label: t("seller_analytics.preset_7d") },
    { key: "30d",        label: t("seller_analytics.preset_30d") },
    { key: "90d",        label: t("seller_analytics.preset_90d") },
    { key: "this_month", label: t("seller_analytics.preset_this_month") },
    { key: "last_month", label: t("seller_analytics.preset_last_month") },
    { key: "this_year",  label: t("seller_analytics.preset_this_year") },
  ];
  const selectedLabel = presets.find(p => p.key === preset)?.label ?? `${formatDateLabel(customFrom, lang)} — ${formatDateLabel(customTo, lang)}`;

  const dropdown = (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
      <div
        className="bg-popover border rounded-xl shadow-xl p-3 max-h-[80vh] overflow-y-auto"
        style={dropPos}
      >
        <div className="grid grid-cols-2 gap-1 mb-3">
          {presets.map(p => (
            <button key={p.key} onClick={() => { onPreset(p.key); setOpen(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-medium text-start transition-colors ${preset === p.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("seller_analytics.custom_range")}</p>
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="flex-1 h-8 rounded-lg border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
            <span className="text-muted-foreground text-xs shrink-0">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="flex-1 h-8 rounded-lg border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <Button size="sm" className="w-full" onClick={() => {
            if (customFrom && customTo) { onCustom(new Date(customFrom), new Date(customTo)); setOpen(false); }
          }}>{t("seller_analytics.apply")}</Button>
        </div>
      </div>
    </>
  );

  return (
    <div>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        className="gap-2 font-medium h-9"
        onClick={() => setOpen(v => !v)}
      >
        <BarChart2 className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[160px] truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ─── Granularity toggle ─────────────────────────────────────── */
function GranularityToggle({ value, onChange, t }: { value: Granularity; onChange: (g: Granularity) => void; t: (k: string) => string }) {
  const opts: { key: Granularity; label: string }[] = [
    { key: "day",   label: t("seller_analytics.gran_day") },
    { key: "week",  label: t("seller_analytics.gran_week") },
    { key: "month", label: t("seller_analytics.gran_month") },
  ];
  return (
    <div className="flex items-center rounded-lg border p-0.5 bg-muted/40">
      {opts.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${value === o.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Custom Chart Tooltip ───────────────────────────────────── */
function ChartTooltip({ active, payload, label, formatCurrency, t }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-xl shadow-lg px-3 py-2.5 text-sm min-w-[150px]">
      <p className="font-semibold text-foreground mb-2 text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums text-xs" style={{ color: p.color }}>
            {p.dataKey === "revenue" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Section card ───────────────────────────────────────────── */
function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b">
        <div>
          <h3 className="font-semibold text-foreground text-sm sm:text-base">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* ─── Stat row ───────────────────────────────────────────────── */
function StatRow({ icon, label, value, accent = "", bar, barColor }: { icon: React.ReactNode; label: string; value: string; accent?: string; bar?: number; barColor?: string }) {
  return (
    <div className="py-2.5 border-b last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center bg-muted/60 ${accent}`}>{icon}</div>
          {label}
        </div>
        <span className="font-semibold text-sm tabular-nums text-foreground">{value}</span>
      </div>
      {bar !== undefined && bar > 0 && (
        <div className="ms-9 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(bar, 100)}%`, background: barColor || "#6366f1" }} />
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-[220px]">{description}</p>}
    </div>
  );
}

/* ─── Insights generator ─────────────────────────────────────── */
function generateInsights(summary: AnalyticsSummary, format: (n: number) => string, t: (k: string, o?: Record<string, unknown>) => string): string[] {
  const insights: string[] = [];
  const { kpis, topProducts, customers, delivery, growth } = summary;
  if (kpis.grossRevenue.change !== null && kpis.grossRevenue.change !== 0) {
    const dir = kpis.grossRevenue.change > 0 ? t("seller_analytics.insight_up") : t("seller_analytics.insight_down");
    insights.push(t("seller_analytics.insight_revenue", { dir, pct: Math.abs(kpis.grossRevenue.change) }));
  }
  if (topProducts.length > 0 && kpis.grossRevenue.value > 0) {
    const top = topProducts[0];
    const share = ((top.revenue / kpis.grossRevenue.value) * 100).toFixed(0);
    insights.push(t("seller_analytics.insight_top_product", { name: top.productName, share, revenue: format(top.revenue) }));
  }
  if (delivery.cancellationRate > 10) {
    insights.push(t("seller_analytics.insight_cancellation_high", { rate: delivery.cancellationRate }));
  } else if (kpis.cancelledOrders.value === 0 && kpis.totalOrders.value > 0) {
    insights.push(t("seller_analytics.insight_no_cancellations"));
  }
  if (delivery.totalDelivered > 0) {
    insights.push(t("seller_analytics.insight_delivery_rate", { rate: delivery.successRate }));
  }
  if (growth.newFollowers > 0) {
    insights.push(t("seller_analytics.insight_followers", { count: growth.newFollowers }));
  }
  if (customers.repeatRate > 0) {
    insights.push(t("seller_analytics.insight_repeat", { rate: customers.repeatRate }));
  }
  if (kpis.avgOrderValue.change !== null && kpis.avgOrderValue.change > 5) {
    insights.push(t("seller_analytics.insight_aov_up", { pct: kpis.avgOrderValue.change }));
  }
  return insights;
}

/* ─── Custom Pie Legend ──────────────────────────────────────── */
function PieLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
      {data.slice(0, 8).map((d, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
          <span className="truncate text-muted-foreground">{d.name}</span>
          <span className="font-semibold text-foreground ms-auto shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function SellerAnalytics() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dir = i18n.dir();
  const { format: formatCurrency } = useCurrency();
  const { token, user } = useAuth();

  const [preset, setPreset] = useState<DatePreset>("30d");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => getPresetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");

  const fromStr = useMemo(() => toDateStr(dateRange.from), [dateRange.from]);
  const toStr   = useMemo(() => toDateStr(dateRange.to),   [dateRange.to]);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const handlePreset = useCallback((p: DatePreset) => {
    setPreset(p);
    setDateRange(getPresetRange(p));
  }, []);
  const handleCustom = useCallback((from: Date, to: Date) => {
    setPreset("30d");
    setDateRange({ from, to });
  }, []);

  /* ── Queries ── */
  const summaryQuery = useQuery<AnalyticsSummary>({
    queryKey: ["seller-analytics-summary", fromStr, toStr],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/seller/analytics/summary?from=${fromStr}&to=${toStr}`, { headers });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
  });

  const chartQuery = useQuery<RevenueChartData>({
    queryKey: ["seller-analytics-chart", fromStr, toStr, granularity],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/seller/analytics/revenue-chart?from=${fromStr}&to=${toStr}&granularity=${granularity}`, { headers });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
  });

  const s = summaryQuery.data;
  const chart = chartQuery.data;
  const isLoading = summaryQuery.isLoading;
  const hasData = !isLoading && s && s.kpis.totalOrders.value > 0;
  const hasNoData = !isLoading && s && s.kpis.totalOrders.value === 0;

  /* ── Chart formatters ── */
  const tickFormatter = useCallback((d: string) => formatChartDate(d, granularity, lang), [granularity, lang]);
  const statusLabel = useCallback((st: string) => t(`seller_orders.status_${st}`, st.replace(/_/g, " ")), [t]);

  /* ── Derived data ── */
  const pieData = useMemo(() => (s?.orderStatusBreakdown ?? []).filter(d => d.count > 0).map(d => ({
    name: statusLabel(d.status),
    value: d.count,
    color: STATUS_COLORS[d.status] ?? PIE_FALLBACK,
  })), [s, statusLabel]);

  const productBarData = useMemo(() => (s?.topProducts ?? []).map(p => ({
    name: p.productName.length > 20 ? p.productName.slice(0, 20) + "…" : p.productName,
    fullName: p.productName,
    revenue: p.revenue,
    unitsSold: p.unitsSold,
    imageUrl: p.imageUrl,
  })), [s]);

  const insights = useMemo(() => s ? generateInsights(s, formatCurrency, t) : [], [s, formatCurrency, t]);

  const { data: reviewsSummary } = useGetSellerReviews(user?.id ?? 0, {
    query: { enabled: !!user?.id, queryKey: getSellerReviewsQueryKey(user?.id ?? 0) },
  });

  /* ── CSV export ── */
  const handleExportRevenue = useCallback(() => {
    if (!chart?.points) return;
    downloadCSV(chart.points.map(p => ({ date: p.date, revenue: p.revenue, orders: p.orders, avg_order_value: p.aov })), `revenue-${fromStr}-${toStr}.csv`);
  }, [chart, fromStr, toStr]);
  const handleExportProducts = useCallback(() => {
    if (!s?.topProducts) return;
    downloadCSV(s.topProducts.map(p => ({ product_id: p.productId, product_name: p.productName, units_sold: p.unitsSold, revenue: p.revenue, views: p.viewCount })), `products-${fromStr}-${toStr}.csv`);
  }, [s, fromStr, toStr]);

  return (
    <Layout hideFooter>
      <SellerNav />
      <div className="container max-w-7xl px-4 sm:px-6 py-6 space-y-5">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{t("seller_analytics.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {s
                ? `${formatDateLabel(s.period.from, lang)} — ${formatDateLabel(s.period.to, lang)}`
                : t("seller_analytics.loading_period")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => { summaryQuery.refetch(); chartQuery.refetch(); }}>
              <RefreshCw className={`h-3.5 w-3.5 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("seller_analytics.refresh")}</span>
            </Button>
            <DatePicker preset={preset} from={dateRange.from} to={dateRange.to} onPreset={handlePreset} onCustom={handleCustom} t={t} lang={lang} />
          </div>
        </div>

        {/* ── Error banner ── */}
        {summaryQuery.isError && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {t("seller_analytics.error_load")}
          </div>
        )}

        {/* ── No-data banner for selected period ── */}
        {hasNoData && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl p-5 text-sm text-muted-foreground">
            <BarChart2 className="h-5 w-5 shrink-0 mt-0.5 text-primary/60" />
            <div>
              <p className="font-semibold text-foreground text-sm">{t("seller_analytics.no_data")}</p>
              <p className="text-xs mt-0.5">{t("seller_analytics.loading_period")}</p>
            </div>
          </div>
        )}

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          )) : s ? (<>
            <KPICard label={t("seller_analytics.kpi_revenue")}   value={formatCurrency(s.kpis.grossRevenue.value)}   kpi={s.kpis.grossRevenue}   icon={<DollarSign   className="h-5 w-5" />} iconBg="bg-emerald-100 dark:bg-emerald-950/50" iconColor="text-emerald-600 dark:text-emerald-400" t={t} />
            <KPICard label={t("seller_analytics.kpi_orders")}    value={String(s.kpis.totalOrders.value)}             kpi={s.kpis.totalOrders}    icon={<ShoppingBag  className="h-5 w-5" />} iconBg="bg-blue-100 dark:bg-blue-950/50"    iconColor="text-blue-600 dark:text-blue-400"    t={t} />
            <KPICard label={t("seller_analytics.kpi_aov")}       value={formatCurrency(s.kpis.avgOrderValue.value)}  kpi={s.kpis.avgOrderValue}  icon={<BarChart2    className="h-5 w-5" />} iconBg="bg-violet-100 dark:bg-violet-950/50" iconColor="text-violet-600 dark:text-violet-400" t={t} />
            <KPICard label={t("seller_analytics.kpi_completed")} value={String(s.kpis.completedOrders.value)}        kpi={s.kpis.completedOrders} icon={<CheckCircle className="h-5 w-5" />} iconBg="bg-emerald-100 dark:bg-emerald-950/50" iconColor="text-emerald-600 dark:text-emerald-400" t={t} />
            <KPICard label={t("seller_analytics.kpi_cancelled")} value={String(s.kpis.cancelledOrders.value)}        kpi={s.kpis.cancelledOrders} icon={<XCircle     className="h-5 w-5" />} iconBg="bg-red-100 dark:bg-red-950/50"      iconColor="text-red-500 dark:text-red-400"      t={t} />
            <KPICard label={t("seller_analytics.kpi_followers")} value={String(s.kpis.followers.value)}              kpi={s.kpis.followers}       icon={<Heart       className="h-5 w-5" />} iconBg="bg-pink-100 dark:bg-pink-950/50"    iconColor="text-pink-500 dark:text-pink-400"    t={t} />
            <KPICard label={t("seller_analytics.kpi_customers")} value={String(s.customers.unique)}                  kpi={{ value: s.customers.unique, prev: s.customers.prevUnique, change: s.customers.change }} icon={<Users className="h-5 w-5" />} iconBg="bg-cyan-100 dark:bg-cyan-950/50" iconColor="text-cyan-600 dark:text-cyan-400" t={t} />
            <KPICard label={t("seller_analytics.kpi_rating")}    value={s.growth.avgRating > 0 ? `${s.growth.avgRating} ★` : "—"} kpi={s.kpis.storeRating} icon={<Star className="h-5 w-5" />} iconBg="bg-amber-100 dark:bg-amber-950/50" iconColor="text-amber-500 dark:text-amber-400" t={t} sub={s.growth.totalReviews > 0 ? t("seller_analytics.review_count", { count: s.growth.totalReviews }) : undefined} />
          </>) : null}
        </div>

        {/* ── Revenue Chart + Order Status Pie ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue + Orders area chart — spans 2/3 */}
          <SectionCard
            title={t("seller_analytics.chart_revenue_title")}
            subtitle={t("seller_analytics.chart_revenue_sub")}
            action={
              <div className="flex items-center gap-2">
                <GranularityToggle value={granularity} onChange={setGranularity} t={t} />
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={handleExportRevenue} title={t("seller_analytics.export_csv")} disabled={!chart?.points?.length}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            }
          >
            {chartQuery.isLoading ? <Skeleton className="h-56 w-full" /> :
             !chart?.points?.length ? (
               <EmptyState icon={<BarChart2 className="h-5 w-5" />} title={t("seller_analytics.no_data")} />
             ) : (
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chart.points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#276221" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#276221" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v)} width={dir === "rtl" ? 60 : 55} axisLine={false} tickLine={false} orientation={dir === "rtl" ? "right" : "left"} />
                    <YAxis yAxisId="ord" orientation={dir === "rtl" ? "left" : "right"} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={28} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip formatCurrency={formatCurrency} t={t} />} />
                    <Area yAxisId="rev" type="monotone" dataKey="revenue" name={t("seller_analytics.chart_revenue")} stroke="#276221" strokeWidth={2} fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area yAxisId="ord" type="monotone" dataKey="orders"  name={t("seller_analytics.chart_orders")}  stroke="#6366f1" strokeWidth={1.5} fill="url(#gradOrders)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Chart legend */}
                <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {t("seller_analytics.chart_revenue")}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    {t("seller_analytics.chart_orders")}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Order status pie */}
          <SectionCard title={t("seller_analytics.chart_status_title")} subtitle={t("seller_analytics.chart_status_sub")}>
            {isLoading ? <Skeleton className="h-56 w-full" /> :
             pieData.length === 0 ? (
               <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={t("seller_analytics.no_data")} />
             ) : (
              <div>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend data={pieData} />
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Top Products + Customer Analytics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Top products */}
          <SectionCard
            title={t("seller_analytics.products_title")}
            subtitle={t("seller_analytics.products_sub")}
            action={
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={handleExportProducts} title={t("seller_analytics.export_csv")} disabled={!s?.topProducts?.length}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            }
          >
            {isLoading ? <Skeleton className="h-64 w-full" /> :
             productBarData.length === 0 ? (
               <EmptyState icon={<Package className="h-5 w-5" />} title={t("seller_analytics.no_data")} />
             ) : (
              <div className="space-y-3">
                {productBarData.slice(0, 5).map((p, i) => {
                  const maxRev = productBarData[0].revenue || 1;
                  const pct = Math.max(4, (p.revenue / maxRev) * 100);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover border shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate" title={p.fullName}>{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.unitsSold} {t("seller_analytics.units")}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(p.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}

                {/* Recharts bar for 6-10 */}
                {productBarData.length > 5 && (
                  <div className="mt-4 pt-4 border-t">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={productBarData.slice(5, 10)} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v)} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="revenue" name={t("seller_analytics.chart_revenue")} fill="#276221" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Customer analytics */}
          <SectionCard title={t("seller_analytics.customers_title")} subtitle={t("seller_analytics.customers_sub")}>
            {isLoading ? <Skeleton className="h-64 w-full" /> :
             !s || s.customers.unique === 0 ? (
               <EmptyState icon={<Users className="h-5 w-5" />} title={t("seller_analytics.no_data")} />
             ) : (
              <div className="space-y-0">
                <StatRow icon={<Users className="h-3.5 w-3.5" />}       label={t("seller_analytics.cust_unique")}      value={String(s.customers.unique)}    accent="text-cyan-600" bar={(s.customers.unique / (s.customers.unique || 1)) * 100} barColor="#06b6d4" />
                <StatRow icon={<UserCheck className="h-3.5 w-3.5" />}   label={t("seller_analytics.cust_returning")}   value={String(s.customers.returning)} accent="text-emerald-600" bar={(s.customers.returning / (s.customers.unique || 1)) * 100} barColor="#276221" />
                <StatRow icon={<Users className="h-3.5 w-3.5" />}       label={t("seller_analytics.cust_new")}         value={String(s.customers.new)}       accent="text-blue-600" bar={(s.customers.new / (s.customers.unique || 1)) * 100} barColor="#3b82f6" />
                <StatRow icon={<BarChart2 className="h-3.5 w-3.5" />}   label={t("seller_analytics.cust_repeat_rate")} value={`${s.customers.repeatRate}%`}  accent="text-violet-600" />
                <StatRow icon={<ShoppingBag className="h-3.5 w-3.5" />} label={t("seller_analytics.cust_avg_orders")}  value={String(s.customers.avgOrdersPerCustomer)} />
                <div className="pt-4 mt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("seller_analytics.cust_breakdown")}</p>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{s.customers.new}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t("seller_analytics.cust_new")}</div>
                    </div>
                    <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{s.customers.returning}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t("seller_analytics.cust_returning")}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Delivery Analytics + Store Growth ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Delivery analytics */}
          <SectionCard title={t("seller_analytics.delivery_title")} subtitle={t("seller_analytics.delivery_sub")}>
            {isLoading ? <Skeleton className="h-52 w-full" /> :
             !s || (s.delivery.totalDelivered === 0 && s.delivery.totalFailed === 0) ? (
               <EmptyState icon={<Truck className="h-5 w-5" />} title={t("seller_analytics.no_data")} />
             ) : (
              <div className="space-y-0">
                <StatRow icon={<CheckCircle className="h-3.5 w-3.5" />} label={t("seller_analytics.dlv_delivered")}    value={String(s.delivery.totalDelivered)}  accent="text-emerald-600" bar={s.delivery.successRate} barColor="#276221" />
                <StatRow icon={<XCircle className="h-3.5 w-3.5" />}     label={t("seller_analytics.dlv_failed")}       value={String(s.delivery.totalFailed)}     accent="text-red-500"     bar={100 - s.delivery.successRate} barColor="#ef4444" />
                <StatRow icon={<Truck className="h-3.5 w-3.5" />}       label={t("seller_analytics.dlv_success_rate")} value={`${s.delivery.successRate}%`}       accent="text-blue-600" />
                <StatRow icon={<Clock className="h-3.5 w-3.5" />}       label={t("seller_analytics.dlv_avg_hours")}    value={s.delivery.avgDeliveryHours > 0 ? t("seller_analytics.hours", { n: s.delivery.avgDeliveryHours }) : "—"} />
                <StatRow icon={<XCircle className="h-3.5 w-3.5" />}     label={t("seller_analytics.dlv_cancel_rate")}  value={`${s.delivery.cancellationRate}%`}  accent="text-orange-500" />
                {s.delivery.totalDelivered + s.delivery.totalFailed > 0 && (
                  <div className="pt-3 mt-2 border-t">
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${s.delivery.successRate}%` }} />
                      <div className="h-full bg-red-400 transition-all duration-700" style={{ width: `${100 - s.delivery.successRate}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />{t("seller_analytics.dlv_success_rate")}: {s.delivery.successRate}%</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />{t("seller_analytics.dlv_failed")}: {100 - s.delivery.successRate}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Store growth */}
          <SectionCard title={t("seller_analytics.growth_title")} subtitle={t("seller_analytics.growth_sub")}>
            {isLoading ? <Skeleton className="h-52 w-full" /> : s ? (
              <div className="space-y-0">
                <StatRow icon={<Heart className="h-3.5 w-3.5" />}     label={t("seller_analytics.growth_total_followers")} value={String(s.growth.totalFollowers)} accent="text-pink-500" />
                <StatRow icon={<TrendingUp className="h-3.5 w-3.5" />} label={t("seller_analytics.growth_new_followers")}  value={String(s.growth.newFollowers)}   accent="text-emerald-600" />
                <StatRow icon={<Star className="h-3.5 w-3.5" />}       label={t("seller_analytics.growth_total_reviews")} value={String(s.growth.totalReviews)} accent="text-amber-500" />
                <StatRow icon={<Star className="h-3.5 w-3.5" />}       label={t("seller_analytics.growth_new_reviews")}   value={String(s.growth.newReviews)} />
                <StatRow icon={<Star className="h-3.5 w-3.5" />}       label={t("seller_analytics.growth_avg_rating")}    value={s.growth.avgRating > 0 ? `${s.growth.avgRating} / 5` : "—"} accent="text-amber-500" />
                <div className="pt-3 mt-2 border-t grid grid-cols-2 gap-3">
                  <div className="bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 tabular-nums">{s.growth.newFollowers}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("seller_analytics.growth_new_followers")}</div>
                    {s.growth.followerChange !== null && (
                      <div className="mt-1 flex justify-center"><TrendBadge change={s.growth.followerChange} t={t} /></div>
                    )}
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{s.growth.newReviews}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("seller_analytics.growth_new_reviews")}</div>
                    {s.growth.reviewChange !== null && (
                      <div className="mt-1 flex justify-center"><TrendBadge change={s.growth.reviewChange} t={t} /></div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>

        {/* ── Store Reputation ── */}
        {reviewsSummary && (
          <SectionCard title={t("seller_analytics.rep_title")} subtitle={t("seller_analytics.rep_sub")}>
            {(reviewsSummary.summary?.total ?? 0) === 0 ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
                <Star className="h-4 w-4 opacity-40" />
                {t("seller_analytics.rep_no_reviews")}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="text-center shrink-0">
                  <div className="text-4xl font-black text-foreground tabular-nums leading-none">
                    {reviewsSummary.summary?.overallScore?.toFixed(1) ?? "—"}
                  </div>
                  <div className="flex justify-center mt-1 gap-0.5">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(reviewsSummary.summary?.overallScore ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("seller_analytics.rep_total")}: {reviewsSummary.summary?.total}
                  </p>
                </div>
                <div className="flex-1 w-full space-y-3">
                  {[
                    { label: t("seller_analytics.rep_comm"), score: reviewsSummary.summary?.avgCommunication, max: 5 },
                    { label: t("seller_analytics.rep_ship"), score: reviewsSummary.summary?.avgShipping, max: 5 },
                    { label: t("seller_analytics.rep_prof"), score: reviewsSummary.summary?.avgProfessionalism, max: 5 },
                  ].map(({ label, score, max }) => {
                    const pct = score != null ? Math.round((score / max) * 100) : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-end tabular-nums">{score?.toFixed(1) ?? "—"}</span>
                      </div>
                    );
                  })}
                  {/* Response rate strip */}
                  {(reviewsSummary.summary?.total ?? 0) > 0 && (
                    <div className="pt-2 border-t flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {t("seller_analytics.rep_response_rate")}:{" "}
                        <strong className="text-foreground tabular-nums">
                          {reviewsSummary.summary?.responseRate ?? 0}%
                        </strong>
                      </span>
                      <span>
                        {t("seller_analytics.rep_replied")}:{" "}
                        <strong className="text-foreground tabular-nums">
                          {reviewsSummary.summary?.repliedCount ?? 0}/{reviewsSummary.summary?.total}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Financial Summary ── */}
        {s && (
          <SectionCard title={t("seller_analytics.financial_title")} subtitle={t("seller_analytics.financial_sub")}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: t("seller_analytics.fin_gross_revenue"),   value: formatCurrency(s.kpis.grossRevenue.value),   bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30", color: "text-emerald-700 dark:text-emerald-400" },
                { label: t("seller_analytics.fin_total_orders"),    value: String(s.kpis.totalOrders.value),            bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30",       color: "text-blue-700 dark:text-blue-400" },
                { label: t("seller_analytics.fin_aov"),             value: formatCurrency(s.kpis.avgOrderValue.value),  bg: "bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30", color: "text-violet-700 dark:text-violet-400" },
                { label: t("seller_analytics.fin_cancelled_value"), value: `${s.kpis.cancelledOrders.value} ${t("seller_analytics.orders_unit")}`, bg: "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30",         color: "text-red-600 dark:text-red-400" },
                { label: t("seller_analytics.fin_refunded"),        value: `${s.kpis.refundedOrders.value} ${t("seller_analytics.orders_unit")}`,  bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30", color: "text-orange-600 dark:text-orange-400" },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} border rounded-xl p-4 text-center`}>
                  <div className={`text-xl font-bold tabular-nums ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Insights Panel ── */}
        {insights.length > 0 && (
          <SectionCard title={t("seller_analytics.insights_title")} subtitle={t("seller_analytics.insights_sub")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-xl p-3.5">
                  <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Export section ── */}
        <SectionCard title={t("seller_analytics.export_title")} subtitle={t("seller_analytics.export_sub")}>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={handleExportRevenue} disabled={!chart?.points?.length}>
              <Download className="h-4 w-4" />
              {t("seller_analytics.export_revenue")}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportProducts} disabled={!s?.topProducts?.length}>
              <Download className="h-4 w-4" />
              {t("seller_analytics.export_products")}
            </Button>
          </div>
        </SectionCard>

      </div>
    </Layout>
  );
}
