import { useGetCustomerDashboard } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Clock, CheckCircle2, DollarSign, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function CustomerDashboard() {
  const { data: dashboard, isLoading, isError, refetch } = useGetCustomerDashboard();
  const { t } = useTranslation();
  const { format: formatCurrency } = useCurrency();

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-8 md:py-12 max-w-6xl">
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-7 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-5 w-36 bg-muted rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout>
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800 shrink-0">{t("orders.status_pending")}</Badge>;
      case "processing": return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 shrink-0">{t("orders.status_processing")}</Badge>;
      case "shipped":    return <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 shrink-0">{t("orders.status_shipped")}</Badge>;
      case "delivered":  return <Badge className="bg-primary hover:bg-primary text-primary-foreground shrink-0">{t("orders.status_delivered")}</Badge>;
      case "cancelled":  return <Badge variant="destructive" className="shrink-0">{t("orders.status_cancelled")}</Badge>;
      default:           return <Badge variant="secondary" className="shrink-0">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-6xl">
        <div className="flex items-center gap-3 mb-5 sm:mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("customer_dashboard.title")}
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-5 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("customer_dashboard.total_orders")}</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-card-metric">{dashboard?.totalOrders || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("customer_dashboard.total_spent")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-card-metric" translate="no">{formatCurrency(dashboard?.totalSpent || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("customer_dashboard.pending_orders")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-card-metric">{dashboard?.pendingOrders || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("customer_dashboard.delivered")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-card-metric">{dashboard?.deliveredOrders || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center bg-muted/30">
            <h3 className="font-semibold text-base">{t("customer_dashboard.recent_orders")}</h3>
            <Link href="/orders" className="text-sm text-primary hover:underline font-medium">
              {t("customer_dashboard.view_all")}
            </Link>
          </div>
          <div className="divide-y">
            {!dashboard?.recentOrders || dashboard.recentOrders.length === 0 ? (
              <div className="px-4 sm:px-6 py-10 text-center text-muted-foreground">
                {t("customer_dashboard.no_orders")}
              </div>
            ) : (
              dashboard.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-muted/10 transition-colors"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold hover:text-primary transition-colors text-sm"
                      >
                        {t("customer_dashboard.order_id", { id: order.id })}
                      </Link>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                      {t("customer_dashboard.items_count", { count: order.items.length })}
                    </div>
                  </div>
                  <div className="font-bold text-base shrink-0" translate="no">
                    {formatCurrency(order.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
