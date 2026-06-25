import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  useAdminListOrders,
  useAdminUpdateOrderStatus,
  getAdminListOrdersQueryKey,
  getAdminGetStatsQueryKey,
  type AdminOrder,
  type OrderStatusUpdateStatus,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Search, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  confirmed:        "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  processing:       "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  preparing:        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  ready_for_pickup: "bg-primary/10 text-primary dark:text-primary",
  courier_assigned: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  picked_up:        "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  out_for_delivery: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  in_transit:       "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  shipped:          "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  delivered:        "bg-primary/10 text-primary dark:text-primary",
  cancelled:        "bg-red-500/10 text-red-600 dark:text-red-400",
  delivery_failed:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  returned:         "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  refunded:         "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const STATUSES = [
  "pending", "confirmed", "processing", "preparing",
  "ready_for_pickup", "courier_assigned", "picked_up", "out_for_delivery",
  "in_transit", "shipped", "delivered", "cancelled", "delivery_failed", "returned", "refunded",
];
const PAGE_SIZE = 20;

export default function AdminOrders() {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminListOrders({ page, limit: PAGE_SIZE });

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const updateStatus = useAdminUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: t("admin.order_updated") });
        queryClient.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
      },
      onError: (err: Error) =>
        toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
    },
  });

  const filtered = orders.filter((o: AdminOrder) => {
    const matchesSearch =
      !search ||
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" /> {t("admin.nav_orders")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("admin.orders_desc")}</p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {total} {t("admin.total_count")}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("admin.search_orders")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("admin.filter_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.all_statuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`orders.status_${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_order")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_customer")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_items")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_total")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_date")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{order.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{order.items.length}</td>
                    <td className="px-4 py-3 font-semibold">{format(order.total)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={order.status}
                        onValueChange={(status) =>
                          updateStatus.mutate({ id: order.id, data: { status: status as OrderStatusUpdateStatus } })
                        }
                      >
                        <SelectTrigger className={`min-h-[44px] h-auto text-xs w-36 font-semibold border-0 ${STATUS_COLORS[order.status] ?? ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{t(`orders.status_${s}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
                {!isLoading && !filtered.length && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">{t("admin.no_results")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-sm text-muted-foreground">{t("admin.page_of", { page, totalPages })}</span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
