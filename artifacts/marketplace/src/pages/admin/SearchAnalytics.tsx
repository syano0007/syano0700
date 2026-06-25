import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Search,
  TrendingUp,
  MousePointerClick,
  Languages,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeriodStats {
  totalSearches: number;
  zeroResultCount: number;
  zeroResultRate: number;
  clickThroughRate: number;
  avgResultsCount: number;
}

interface OverviewData {
  period7: PeriodStats;
  period30: PeriodStats;
  languageBreakdown: {
    arabic: number;
    english: number;
    arabicPct: number;
    englishPct: number;
  };
  processingTimeMs: number;
}

interface TopQuery {
  query: string;
  lang: string;
  count: number;
  zeroResults: boolean;
  avgResultsCount: number;
  clickThroughRate: number;
}

interface TopQueriesData {
  queries: TopQuery[];
  processingTimeMs: number;
}

interface ZeroResultQuery {
  query: string;
  lang: string;
  count: number;
  lastSearched: string;
}

interface ZeroResultsData {
  queries: ZeroResultQuery[];
  processingTimeMs: number;
}

interface TrendPoint {
  date: string;
  totalSearches: number;
  zeroResults: number;
  uniqueQueries: number;
}

interface TrendsData {
  trends: TrendPoint[];
  processingTimeMs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function relativeTime(iso: string, lang: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (lang === "ar") {
    if (diffDays === 0) return "اليوم";
    if (diffDays === 1) return "أمس";
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
    return `منذ ${Math.floor(diffDays / 30)} أشهر`;
  }
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("p-2.5 rounded-lg shrink-0", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums leading-tight", valueColor)}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
        <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
      </div>
    </div>
  );
}

function CtrBadge({ value }: { value: number }) {
  const color =
    value >= 30
      ? "text-primary dark:text-primary"
      : value >= 10
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <span className={cn("tabular-nums font-semibold", color)}>
      {value.toFixed(1)}%
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchAnalytics() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [days, setDays] = useState<7 | 30>(7);
  const isRtl = i18n.language === "ar";

  const headers = { Authorization: `Bearer ${token}` };

  const { data: overview, isLoading: ovLoading, isError: ovError, refetch: refetchOv } = useQuery<OverviewData>({
    queryKey: ["admin", "search-analytics", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/search-analytics/overview", { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const { data: topQueries, isLoading: tqLoading, isError: tqError, refetch: refetchTq } = useQuery<TopQueriesData>({
    queryKey: ["admin", "search-analytics", "top-queries", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/search-analytics/top-queries?days=${days}&limit=20`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const { data: zeroResults, isLoading: zrLoading, isError: zrError, refetch: refetchZr } = useQuery<ZeroResultsData>({
    queryKey: ["admin", "search-analytics", "zero-results", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/search-analytics/zero-results?days=${days}&limit=20`, { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const { data: trends, isLoading: trLoading, isError: trError, refetch: refetchTr } = useQuery<TrendsData>({
    queryKey: ["admin", "search-analytics", "trends", 30],
    queryFn: async () => {
      const res = await fetch("/api/admin/search-analytics/trends?days=30", { headers });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const periodData = days === 7 ? overview?.period7 : overview?.period30;
  const lang = overview?.languageBreakdown;
  const topLang =
    !lang
      ? "—"
      : lang.arabicPct >= lang.englishPct
      ? `${t("admin.searchAnalytics.arabic")} ${lang.arabicPct.toFixed(0)}%`
      : `${t("admin.searchAnalytics.english")} ${lang.englishPct.toFixed(0)}%`;

  const zeroRateColor =
    !periodData
      ? undefined
      : periodData.zeroResultRate > 20
      ? "text-red-600 dark:text-red-400"
      : periodData.zeroResultRate > 10
      ? "text-amber-600 dark:text-amber-400"
      : undefined;

  const ctrColor =
    !periodData
      ? undefined
      : periodData.clickThroughRate >= 30
      ? "text-primary dark:text-primary"
      : undefined;

  const periodSubtitle = days === 7 ? t("admin.searchAnalytics.last7days") : t("admin.searchAnalytics.last30days");

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("admin.searchAnalytics.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("admin.searchAnalytics.subtitle")}</p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
            {([7, 30] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant="ghost"
                onClick={() => setDays(d)}
                className={cn(
                  "h-8 px-3 text-sm font-medium transition-colors",
                  days === d
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d === 7 ? t("admin.searchAnalytics.period7") : t("admin.searchAnalytics.period30")}
              </Button>
            ))}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ovLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : ovError ? (
            <div className="col-span-4 flex flex-col items-center justify-center py-10 gap-3 text-center bg-card border rounded-xl">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold text-foreground">{t("common.error_title")}</p>
              <button onClick={() => refetchOv()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <>
              <MetricCard
                label={t("admin.searchAnalytics.totalSearches")}
                value={(periodData?.totalSearches ?? 0).toLocaleString()}
                subtitle={periodSubtitle}
                icon={Search}
                iconColor="bg-blue-500/10 text-blue-600"
              />
              <MetricCard
                label={t("admin.searchAnalytics.zeroResultRate")}
                value={`${periodData?.zeroResultRate.toFixed(1) ?? "0"}%`}
                subtitle={periodSubtitle}
                icon={AlertCircle}
                iconColor="bg-red-500/10 text-red-600"
                valueColor={zeroRateColor}
              />
              <MetricCard
                label={t("admin.searchAnalytics.ctr")}
                value={`${periodData?.clickThroughRate.toFixed(1) ?? "0"}%`}
                subtitle={periodSubtitle}
                icon={MousePointerClick}
                iconColor="bg-primary/10 text-primary"
                valueColor={ctrColor}
              />
              <MetricCard
                label={t("admin.searchAnalytics.topLanguage")}
                value={topLang}
                icon={Languages}
                iconColor="bg-purple-500/10 text-purple-600"
              />
            </>
          )}
        </div>

        {/* Daily Volume Chart */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {t("admin.searchAnalytics.chartTitle")}
          </h2>
          {trLoading ? (
            <div className="h-52 bg-muted animate-pulse rounded-lg" />
          ) : trError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold text-foreground">{t("common.error_title")}</p>
              <button onClick={() => refetchTr()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                {t("common.retry")}
              </button>
            </div>
          ) : !trends?.trends.length ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-10 w-10 mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t("admin.searchAnalytics.noData")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={trends.trends.map((p) => ({ ...p, date: formatDate(p.date) }))}
                margin={{ top: 4, right: 16, left: -8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  reversed={isRtl}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                  orientation={isRtl ? "right" : "left"}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalSearches"
                  name={t("admin.searchAnalytics.chartTotal")}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="zeroResults"
                  name={t("admin.searchAnalytics.chartZero")}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Two Tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Top Queries Table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-foreground">{t("admin.searchAnalytics.topQueries")}</h2>
            </div>
            {tqLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : tqError ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
                <p className="text-xs font-semibold text-foreground">{t("common.error_title")}</p>
                <button onClick={() => refetchTq()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                  {t("common.retry")}
                </button>
              </div>
            ) : !topQueries?.queries.length ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Search className="h-10 w-10 mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("admin.searchAnalytics.noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground w-8">{t("admin.searchAnalytics.colRank")}</th>
                      <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colQuery")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colCount")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colCtr")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colLang")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topQueries.queries.map((q, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-2.5 max-w-[160px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium truncate">{q.query}</span>
                            {q.zeroResults && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 whitespace-nowrap shrink-0">
                                {t("admin.searchAnalytics.zeroResultsBadge")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-end tabular-nums font-semibold">{q.count.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-end"><CtrBadge value={q.clickThroughRate} /></td>
                        <td className="px-4 py-2.5 text-end">
                          <span className="text-xs text-muted-foreground uppercase">{q.lang}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Zero-Result Queries Table */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-foreground">{t("admin.searchAnalytics.zeroResultQueries")}</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("admin.searchAnalytics.zeroResultHint")}</p>
            </div>
            {zrLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : zrError ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
                <p className="text-xs font-semibold text-foreground">{t("common.error_title")}</p>
                <button onClick={() => refetchZr()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors">
                  {t("common.retry")}
                </button>
              </div>
            ) : !zeroResults?.queries.length ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <CheckCircle2 className="h-10 w-10 mb-2 text-primary/50" />
                <p className="text-sm text-muted-foreground">{t("admin.searchAnalytics.noZeroResults")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colQuery")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colCount")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colLastSearched")}</th>
                      <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t("admin.searchAnalytics.colLang")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroResults.queries.map((q, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{q.query}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums font-semibold text-red-600 dark:text-red-400">
                          {q.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-end text-xs text-muted-foreground whitespace-nowrap">
                          {relativeTime(q.lastSearched, i18n.language)}
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <span className="text-xs text-muted-foreground uppercase">{q.lang}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </AdminLayout>
  );
}
