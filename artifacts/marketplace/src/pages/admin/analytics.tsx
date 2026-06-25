import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Package, ShoppingCart, Users, Star, Eye, TrendingDown, BarChart2,
  Download, AlertCircle, CheckCircle2, Layers, Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderAnalytics {
  byStatus: { status: string; count: number; revenue: number }[];
  todayCount: number;
  weekCount: number;
  monthCount: number;
  totalCount: number;
}

interface ProductAnalytics {
  topViewed: { id: number; name: string; category: string; sellerName: string; viewCount: number; stock: number; imageUrl: string | null }[];
  topSelling: { productId: number; productName: string; category: string; salesCount: number; revenue: number; imageUrl: string | null }[];
  topRated: { productId: number; productName: string; avgRating: number; reviewCount: number; category: string; imageUrl: string | null }[];
  lowStock: { id: number; name: string; stock: number; category: string; sellerName: string; imageUrl: string | null }[];
  noSales: { id: number; name: string; stock: number; category: string; sellerName: string; imageUrl: string | null }[];
}

interface CategoryAnalytics {
  categories: { category: string; productCount: number; avgPrice: number; orderCount: number; revenue: number }[];
}

interface UserAnalytics {
  totalCustomers: number;
  totalSellers: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
  buyersWithOrders: number;
  growth: { date: string; count: number }[];
}

// ─── Status Colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  processing: "#3b82f6",
  shipped: "#8b5cf6",
  delivered: "#276221",
  cancelled: "#ef4444",
  refunded: "#6366f1",
};

// ─── Small Helpers ────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-xs font-bold tabular-nums">
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))} {rating.toFixed(1)}
    </span>
  );
}

function StockBadge({ stock }: { stock: number }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold",
      stock === 0 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        : stock <= 5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
        : "bg-primary/10 text-primary dark:bg-primary/10/20 dark:text-primary"
    )}>
      {stock}
    </span>
  );
}

function MiniKpi({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("p-2.5 rounded-lg", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className="h-10 w-10 mb-2 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({ token }: { token: string }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const { data, isLoading } = useQuery<OrderAnalytics>({
    queryKey: ["admin-analytics-orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/orders", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const handleExport = () => {
    window.open(`/api/admin/reports/export?type=orders`, "_blank");
  };

  const byStatus = data?.byStatus ?? [];
  const total = byStatus.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">{t("admin.analytics_orders_tab")}</h2>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> {t("admin.export_csv")}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi label={t("admin.kpi_orders_today")} value={isLoading ? "—" : data?.todayCount ?? 0} icon={Activity} color="bg-blue-500/10 text-blue-600" />
        <MiniKpi label={t("admin.kpi_orders_week")} value={isLoading ? "—" : data?.weekCount ?? 0} icon={BarChart2} color="bg-purple-500/10 text-purple-600" />
        <MiniKpi label={t("admin.kpi_orders_month")} value={isLoading ? "—" : data?.monthCount ?? 0} icon={ShoppingCart} color="bg-primary/10 text-primary" />
        <MiniKpi label={t("admin.total_orders")} value={isLoading ? "—" : data?.totalCount ?? 0} icon={Layers} color="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">{t("admin.analytics_orders_by_status")}</h3>
        {isLoading ? (
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        ) : byStatus.length === 0 ? (
          <EmptyState icon={ShoppingCart} message={t("admin.no_data")} />
        ) : (
          <div className="space-y-3">
            {byStatus.map((s) => {
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium capitalize text-foreground">{t(`orders.status_${s.status}`, { defaultValue: s.status })}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs" translate="no">{formatCurrency(s.revenue)}</span>
                      <span className="font-bold tabular-nums w-8 text-end">{s.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] ?? "#6b7280" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

const PROD_SUBTABS = ["topViewed", "topSelling", "topRated", "lowStock", "noSales"] as const;
type ProdSubtab = typeof PROD_SUBTABS[number];

function ProductsTab({ token }: { token: string }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const [category, setCategory] = useState("all");
  const [subTab, setSubTab] = useState<ProdSubtab>("topViewed");

  const catParam = category === "all" ? "" : `?category=${encodeURIComponent(category)}`;
  const { data, isLoading } = useQuery<ProductAnalytics>({
    queryKey: ["admin-analytics-products", category],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/products${catParam}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const subTabLabels: Record<ProdSubtab, string> = {
    topViewed: t("admin.analytics_top_viewed"),
    topSelling: t("admin.analytics_top_selling"),
    topRated: t("admin.analytics_top_rated"),
    lowStock: t("admin.analytics_low_stock"),
    noSales: t("admin.analytics_no_sales"),
  };

  const handleExport = () => window.open("/api/admin/reports/export?type=products", "_blank");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">{t("admin.analytics_products_tab")}</h2>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder={t("admin.analytics_filter_all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.analytics_filter_all")}</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-2 h-8 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> {t("admin.export_products_csv")}
          </Button>
        </div>
      </div>

      <div className="flex gap-0 border-b overflow-x-auto">
        {PROD_SUBTABS.map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            className={cn(
              "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              subTab === st ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {subTabLabels[st]}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_product")}</th>
                  <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_category")}</th>
                  {subTab === "topViewed" && <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_views")}</th>}
                  {subTab === "topSelling" && <>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_sold")}</th>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_revenue")}</th>
                  </>}
                  {subTab === "topRated" && <>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_rating")}</th>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_reviews")}</th>
                  </>}
                  {(subTab === "lowStock" || subTab === "noSales") && <>
                    <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_stock")}</th>
                    <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_seller")}</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subTab === "topViewed" && (data?.topViewed ?? []).map((p, i) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground w-5">{i+1}</span><span className="font-medium truncate max-w-[180px]">{p.name}</span></div></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{p.category.replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">{p.viewCount.toLocaleString()}</td>
                  </tr>
                ))}
                {subTab === "topViewed" && !(data?.topViewed?.length) && <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground text-sm">{t("admin.no_data")}</td></tr>}

                {subTab === "topSelling" && (data?.topSelling ?? []).map((p, i) => (
                  <tr key={p.productId} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground w-5">{i+1}</span><span className="font-medium truncate max-w-[180px]">{p.productName}</span></div></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{(p.category ?? "").replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">{p.salesCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums" translate="no">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
                {subTab === "topSelling" && !(data?.topSelling?.length) && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">{t("admin.no_data")}</td></tr>}

                {subTab === "topRated" && (data?.topRated ?? []).map((p, i) => (
                  <tr key={p.productId} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground w-5">{i+1}</span><span className="font-medium truncate max-w-[180px]">{p.productName}</span></div></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{(p.category ?? "").replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-end"><Stars rating={p.avgRating} /></td>
                    <td className="px-4 py-3 text-end text-muted-foreground text-xs">{p.reviewCount}</td>
                  </tr>
                ))}
                {subTab === "topRated" && !(data?.topRated?.length) && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">{t("admin.no_data")}</td></tr>}

                {subTab === "lowStock" && (data?.lowStock ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><span className="font-medium truncate max-w-[180px] block">{p.name}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{p.category.replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-end"><StockBadge stock={p.stock} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.sellerName}</td>
                  </tr>
                ))}
                {subTab === "lowStock" && !(data?.lowStock?.length) && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">{t("admin.no_data")}</td></tr>}

                {subTab === "noSales" && (data?.noSales ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3"><span className="font-medium truncate max-w-[180px] block">{p.name}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs capitalize">{(p.category ?? "").replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-end"><StockBadge stock={p.stock} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.sellerName}</td>
                  </tr>
                ))}
                {subTab === "noSales" && !(data?.noSales?.length) && <tr><td colSpan={4} className="px-4 py-10 text-center text-primary text-sm">{t("admin.alerts_all_clear")}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ token }: { token: string }) {
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  const { data, isLoading } = useQuery<CategoryAnalytics>({
    queryKey: ["admin-analytics-categories"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/categories", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const categories = data?.categories ?? [];
  const maxRevenue = Math.max(...categories.map((c) => c.revenue), 1);

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-foreground">{t("admin.analytics_categories_tab")}</h2>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
        ) : categories.length === 0 ? (
          <EmptyState icon={Layers} message={t("admin.no_data")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_category")}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_product")}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_orders")}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_revenue")}</th>
                  <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.analytics_col_price")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => (
                  <tr key={c.category} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium capitalize">{c.category.replace(/-/g, " ")}</span>
                        <div className="mt-1 h-1 bg-muted rounded-full w-32 overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{c.productCount}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums" translate="no">{formatCurrency(c.revenue)}</td>
                    <td className="px-4 py-3 text-end text-muted-foreground tabular-nums" translate="no">{formatCurrency(c.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ token }: { token: string }) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<UserAnalytics>({
    queryKey: ["admin-analytics-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const growth = data?.growth ?? [];
  const maxGrowth = Math.max(...growth.map((g) => g.count), 1);

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-foreground">{t("admin.analytics_users_tab")}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniKpi label={t("admin.analytics_users_customers")} value={isLoading ? "—" : (data?.totalCustomers ?? 0).toLocaleString()} icon={Users} color="bg-blue-500/10 text-blue-600" />
        <MiniKpi label={t("admin.analytics_users_sellers")} value={isLoading ? "—" : (data?.totalSellers ?? 0).toLocaleString()} icon={Activity} color="bg-purple-500/10 text-purple-600" />
        <MiniKpi label={t("admin.analytics_users_buyers")} value={isLoading ? "—" : (data?.buyersWithOrders ?? 0).toLocaleString()} icon={CheckCircle2} color="bg-primary/10 text-primary" />
        <MiniKpi label={t("admin.analytics_users_new_today")} value={isLoading ? "—" : data?.newToday ?? 0} icon={Users} color="bg-amber-500/10 text-amber-600" />
        <MiniKpi label={t("admin.analytics_users_new_week")} value={isLoading ? "—" : data?.newWeek ?? 0} icon={Users} color="bg-teal-500/10 text-teal-600" />
        <MiniKpi label={t("admin.analytics_users_new_month")} value={isLoading ? "—" : data?.newMonth ?? 0} icon={Users} color="bg-indigo-500/10 text-indigo-600" />
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">{t("admin.analytics_users_growth")}</h3>
        {isLoading ? (
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        ) : growth.every((g) => g.count === 0) ? (
          <EmptyState icon={Users} message={t("admin.no_data")} />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={growth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(d) => {
                  const [, m, day] = String(d).split("-");
                  return `${parseInt(m)}/${parseInt(day)}`;
                }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-card border border-border rounded-lg p-2.5 shadow-xl text-xs">
                      <p className="text-muted-foreground mb-1">{label}</p>
                      <p className="font-bold">{payload[0]?.value} new users</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]}>
                {growth.map((_, i) => <Cell key={i} fill={`hsl(var(--primary) / ${0.5 + (growth[i].count / maxGrowth) * 0.5})`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

const TABS = ["orders", "products", "categories", "users"] as const;
type Tab = typeof TABS[number];

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const tabLabels: Record<Tab, string> = {
    orders: t("admin.analytics_orders_tab"),
    products: t("admin.analytics_products_tab"),
    categories: t("admin.analytics_categories_tab"),
    users: t("admin.analytics_users_tab"),
  };

  const tabIcons: Record<Tab, React.ElementType> = {
    orders: ShoppingCart,
    products: Package,
    categories: Layers,
    users: Users,
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            {t("admin.analytics_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("admin.analytics_desc")}</p>
        </div>

        <div className="flex gap-0 border-b mb-6 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tabIcons[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        {activeTab === "orders"     && <OrdersTab     token={token ?? ""} />}
        {activeTab === "products"   && <ProductsTab   token={token ?? ""} />}
        {activeTab === "categories" && <CategoriesTab token={token ?? ""} />}
        {activeTab === "users"      && <UsersTab      token={token ?? ""} />}
      </div>
    </AdminLayout>
  );
}
