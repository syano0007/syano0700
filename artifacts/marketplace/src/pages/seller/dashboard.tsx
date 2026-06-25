import { useGetSellerDashboard, useGetSellerAnalytics } from "@workspace/api-client-react";
import { SellerTrustBadge, TrustScoreBar, type VerificationLevel } from "@/components/SellerTrustBadge";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, DollarSign, ShoppingCart, AlertCircle, Plus, ArrowRight,
  Boxes, TrendingUp, Clock, AlertTriangle, ChevronRight, Users, Star,
  MessageCircle, Store, Settings, ShieldCheck, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Link } from "wouter";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  pending:    "#F59E0B",
  processing: "#3B82F6",
  shipped:    "#6366F1",
  delivered:  "#276221",
  cancelled:  "#EF4444",
};

const STATUS_ORDER = ["pending", "processing", "shipped", "delivered", "cancelled"];

const STAT_ACCENTS = [
  "border-s-emerald-500",
  "border-s-blue-500",
  "border-s-violet-500",
  "border-s-red-500",
];

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  subHref,
  alert,
  accent,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: string;
  subHref?: string;
  alert?: boolean;
  accent?: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-s-4 ${accent ?? "border-s-muted"} shadow-sm hover:shadow transition-shadow`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1 pt-4 px-4 sm:px-5">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight pe-2">
          {label}
        </CardTitle>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4">
        <div className={`text-stat-number leading-none mb-1 ${alert ? "text-destructive" : "text-foreground"}`} translate="no">
          {value}
        </div>
        {sub && subHref ? (
          <Link href={subHref} className="text-xs text-primary hover:underline font-medium">
            {sub}
          </Link>
        ) : sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-10 max-w-6xl space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 h-72 bg-muted rounded-2xl animate-pulse" />
          <div className="h-72 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    </Layout>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  processing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  shipped:    "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800",
  delivered:  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  cancelled:  "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
};

export default function SellerDashboard() {
  const { data: dashboard, isLoading, isError, refetch } = useGetSellerDashboard();
  const { data: analytics } = useGetSellerAnalytics(30);
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const { user } = useAuth();

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <Layout>
        <SellerNav />
        <div className="container py-20 max-w-2xl flex flex-col items-center justify-center text-center gap-3">
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
      </Layout>
    );
  }

  const chartData = STATUS_ORDER
    .map((status) => {
      const found = dashboard?.ordersByStatus.find((s) => s.status === status);
      return {
        status,
        name: t(`seller_orders.${status}`, { defaultValue: status }),
        value: found?.count ?? 0,
        fill: STATUS_COLORS[status],
      };
    })
    .filter((d) => d.value > 0);

  const totalChartOrders = chartData.reduce((acc, d) => acc + d.value, 0);
  const storeName = (user as any)?.storeName || user?.name || t("seller_dashboard.title");
  const storeSlug = (dashboard as any)?.storeSlug ?? null;
  const hasPending = (dashboard?.pendingOrders ?? 0) > 0;
  const hasLowStock = (dashboard?.lowStockProducts ?? 0) > 0;

  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-8 max-w-6xl">

        {/* Greeting + store headline */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground font-medium">{t("seller_dashboard.greeting")}</p>
          <h1 className="text-page-title text-foreground leading-tight mt-0.5">
            {storeName}
          </h1>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Row 1: View Store */}
          {storeSlug ? (
            <Link href={`/store/${storeSlug}`}>
              <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.view_store")}</p>
                  <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.view_store_desc")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-emerald-500 transition-colors rtl:rotate-180" />
              </div>
            </Link>
          ) : (
            <Link href="/seller/store-settings">
              <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-emerald-500/5 hover:border-emerald-500/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.view_store_setup")}</p>
                  <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.view_store_desc")}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-emerald-500 transition-colors rtl:rotate-180" />
              </div>
            </Link>
          )}
          {/* Row 1: Store Settings */}
          <Link href="/seller/store-settings">
            <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-violet-500/5 hover:border-violet-500/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
                <Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.store_settings")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.store_settings_desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-violet-500 transition-colors rtl:rotate-180" />
            </div>
          </Link>
          {/* Row 2: Add Product */}
          <Link href="/seller/products/new">
            <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.quick_add_product")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.add_product_desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors rtl:rotate-180" />
            </div>
          </Link>
          {/* Row 2: View Orders */}
          <Link href="/seller/orders">
            <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-blue-500/5 hover:border-blue-500/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.quick_orders")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.orders_desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-blue-500 transition-colors rtl:rotate-180" />
            </div>
          </Link>
          {/* Row 3: Inventory Management */}
          <Link href="/seller/inventory">
            <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-amber-500/5 hover:border-amber-500/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <Boxes className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.quick_inventory")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.inventory_desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-amber-500 transition-colors rtl:rotate-180" />
            </div>
          </Link>
          {/* Row 3: Customer Messages */}
          <Link href="/seller/messages">
            <div className="group bg-card border rounded-2xl p-4 flex items-center gap-3 hover:bg-teal-500/5 hover:border-teal-500/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 group-hover:bg-teal-500/20 transition-colors">
                <MessageCircle className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t("seller_dashboard.quick_messages")}</p>
                <p className="text-xs text-muted-foreground truncate">{t("seller_dashboard.messages_desc")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-teal-500 transition-colors rtl:rotate-180" />
            </div>
          </Link>
        </div>

        {/* Alerts row */}
        {(hasPending || hasLowStock) && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {hasPending && (
              <div className="flex-1 flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {t("seller_dashboard.pending_alert_title", { count: dashboard?.pendingOrders })}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {t("seller_dashboard.pending_alert_desc")}
                  </p>
                </div>
                <Link href="/seller/orders" className="shrink-0">
                  <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 gap-1 text-xs">
                    {t("seller_dashboard.view_pending")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
            {hasLowStock && (
              <div className="flex-1 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl">
                <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-300">
                    {t("seller_dashboard.low_stock_alert_title", { count: dashboard?.lowStockProducts })}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                    {t("seller_dashboard.low_stock_alert_desc")}
                  </p>
                </div>
                <Link href="/seller/inventory" className="shrink-0">
                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 gap-1 text-xs">
                    {t("seller_dashboard.view_inventory")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Trust panel */}
        {(() => {
          const trustScore = (dashboard as any)?.trustScore ?? null;
          const verificationLevel = ((dashboard as any)?.verificationLevel ?? "none") as VerificationLevel;
          const isVerified = (dashboard as any)?.isVerified ?? false;
          const hasVerification = isVerified || (verificationLevel && verificationLevel !== "none");
          return (
            <div className="mb-6 p-4 bg-card border border-border/80 rounded-2xl shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("trust_panel.title", "Store Trust Level")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasVerification
                        ? t("trust_panel.verified_desc", "Your store has been verified by SYANO.")
                        : t("trust_panel.unverified_desc", "Complete your profile to improve your score.")}
                    </p>
                  </div>
                </div>
                {hasVerification && (
                  <SellerTrustBadge level={verificationLevel} isVerified={isVerified} size="sm" />
                )}
              </div>
              {trustScore != null && (
                <div className="mt-3">
                  <TrustScoreBar score={trustScore} size="md" />
                </div>
              )}
              {!hasVerification && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  {t("trust_panel.how_to_verify", "To get verified, contact SYANO support or complete seller onboarding.")}
                </div>
              )}
            </div>
          );
        })()}

        {/* Stats grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6 md:mb-8">
          <StatCard
            icon={DollarSign}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-600"
            label={t("seller_dashboard.total_revenue")}
            value={formatCurrency(dashboard?.totalRevenue || 0)}
            accent="border-s-emerald-500"
          />
          <StatCard
            icon={ShoppingCart}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-600"
            label={t("seller_dashboard.orders")}
            value={dashboard?.totalOrders || 0}
            sub={dashboard?.pendingOrders ? `${dashboard.pendingOrders} ${t("seller_dashboard.pending")}` : undefined}
            accent="border-s-blue-500"
          />
          <StatCard
            icon={Package}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600"
            label={t("seller_dashboard.active_products")}
            value={dashboard?.totalProducts || 0}
            accent="border-s-violet-500"
          />
          <StatCard
            icon={AlertCircle}
            iconBg="bg-red-500/10"
            iconColor="text-red-500"
            label={t("seller_dashboard.low_stock")}
            value={dashboard?.lowStockProducts || 0}
            sub={dashboard?.lowStockProducts ? t("seller_dashboard.view_inventory") : undefined}
            subHref="/seller/inventory"
            alert={!!dashboard?.lowStockProducts}
            accent="border-s-red-400"
          />
          <StatCard
            icon={Users}
            iconBg="bg-pink-500/10"
            iconColor="text-pink-600"
            label={t("seller_dashboard.followers")}
            value={(dashboard as any)?.followerCount ?? 0}
            accent="border-s-pink-400"
          />
          <StatCard
            icon={Star}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-600"
            label={t("seller_dashboard.seller_score")}
            value={(dashboard as any)?.sellerScore != null ? `${(dashboard as any).sellerScore}/5` : "—"}
            sub={(dashboard as any)?.sellerReviewCount ? t("seller_dashboard.reviews", { count: (dashboard as any).sellerReviewCount }) : undefined}
            accent="border-s-amber-400"
          />
        </div>

        {/* Analytics: Revenue bar chart */}
        {analytics && analytics.revenueByDay.length > 0 && (
          <div className="bg-card border rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base">{t("seller_dashboard.revenue_chart_title")}</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.revenueByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any) => [`${Number(v).toFixed(0)} SYP`, t("seller_dashboard.revenue")]}
                  labelFormatter={(l) => new Date(l).toLocaleDateString()}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Content grid */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {/* Recent orders */}
          <div className="md:col-span-2 bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base">{t("seller_dashboard.recent_orders")}</h3>
              </div>
              <Link href="/seller/orders" className="text-xs text-primary hover:underline font-medium flex items-center gap-1 shrink-0">
                {t("seller_dashboard.manage_orders")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y">
              {!dashboard?.recentOrders || dashboard.recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t("seller_dashboard.no_orders")}</p>
                </div>
              ) : (
                dashboard.recentOrders.map((order) => {
                  const pill = STATUS_BADGE[order.status] ?? "bg-muted text-muted-foreground";
                  return (
                    <div key={order.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(order.customerName || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="font-bold text-sm">{t("seller_dashboard.order_id", { id: order.id })}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill}`}>
                            {t(`seller_orders.${order.status}`, { defaultValue: order.status })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {order.customerName} · {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="font-black text-sm sm:text-base shrink-0" translate="no">
                        {formatCurrency(order.total)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Donut chart */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base">{t("seller_dashboard.orders_by_status")}</h3>
            </div>
            {chartData.length > 0 ? (
              <div className="flex flex-col gap-4 flex-1">
                <div className="relative flex-1 min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="78%"
                        dataKey="value"
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-foreground">{totalChartOrders}</span>
                    <span className="text-xs text-muted-foreground">{t("seller_dashboard.orders")}</span>
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {chartData.map((entry) => (
                    <div key={entry.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-muted-foreground truncate">{entry.name}</span>
                      </div>
                      <span className="font-bold text-foreground ms-2 shrink-0">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-8">
                <AlertTriangle className="h-8 w-8 opacity-30" />
                <p className="text-sm">{t("seller_dashboard.no_data")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
