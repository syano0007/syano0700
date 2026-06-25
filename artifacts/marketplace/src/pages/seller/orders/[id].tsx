// @refresh reset
import { useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  useGetOrder,
  useUpdateOrderStatus,
  useGetOrderHistory,
  getListOrdersQueryKey,
  getGetSellerDashboardQueryKey,
  getGetOrderQueryKey,
  getGetOrderHistoryQueryKey,
} from "@workspace/api-client-react";
import type { OrderHistoryEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import { format as dateFns } from "date-fns";
import {
  ArrowLeft, Phone, MapPin, StickyNote, Package, Truck,
  CheckCircle2, XCircle, Clock, User, DollarSign, ReceiptText,
  ClipboardList, ExternalLink, AlertCircle, RefreshCw,
} from "lucide-react";
import { OrderStatusTimeline } from "@/components/OrderStatusTimeline";

/* ─── Status styles ──────────────────────────────────────────────────────── */
const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  pending:          { pill: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",    dot: "bg-amber-500" },
  confirmed:        { pill: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800",                dot: "bg-sky-500" },
  preparing:        { pill: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800",          dot: "bg-cyan-500" },
  ready_for_pickup: { pill: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", dot: "bg-emerald-400" },
  courier_assigned: { pill: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800",         dot: "bg-teal-500" },
  picked_up:        { pill: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800", dot: "bg-violet-500" },
  in_transit:       { pill: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800", dot: "bg-purple-500" },
  out_for_delivery: { pill: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800", dot: "bg-indigo-500" },
  delivered:        { pill: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", dot: "bg-emerald-500" },
  cancelled:        { pill: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",               dot: "bg-red-500" },
  delivery_failed:  { pill: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800", dot: "bg-orange-500" },
  returned:         { pill: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",    dot: "bg-amber-500" },
  refunded:         { pill: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800", dot: "bg-violet-500" },
  shipped:          { pill: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800", dot: "bg-indigo-500" },
};

function StatusBadge({ status, t }: { status: string; t: (k: string, d?: Record<string, unknown>) => string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border", s?.pill ?? "bg-muted text-muted-foreground border-border")}>
      <span className={cn("h-2 w-2 rounded-full", s?.dot ?? "bg-muted-foreground")} />
      {t(`seller_orders.${status}`, { defaultValue: status })}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/20">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="font-bold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className={cn("text-sm font-semibold", mono && "font-mono")}>{value}</div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { format: formatCurrency } = useCurrency();
  const isRtl = i18n.dir() === "rtl";

  const { data: order, isLoading: orderLoading, isError: orderError, refetch: refetchOrder } = useGetOrder(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderQueryKey(orderId), refetchInterval: 30000 },
  });

  const { data: history = [] } = useGetOrderHistory(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderHistoryQueryKey(orderId), refetchInterval: 30000 },
  });

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: t("seller_orders.updated") });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: getGetOrderHistoryQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["seller-metrics"] });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? t("seller_orders.update_failed");
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const handleForward = (newStatus: string) => {
    updateStatus.mutate({ id: orderId, data: { status: newStatus as any } });
  };

  // Financial calculations
  const subtotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  }, [order]);

  // Seller revenue = subtotal (delivery fee goes to courier)
  const sellerRevenue = subtotal;
  const platformFee = 0; // V1: no platform fee in current system

  // Get timestamps from history
  const getHistoryTime = (toStatus: string): string | null => {
    const entry = history.find((h: OrderHistoryEntry) => h.toStatus === toStatus);
    return entry ? dateFns(new Date(entry.createdAt), "MMM d, yyyy h:mm a") : null;
  };

  if (orderLoading) {
    return (
      <Layout>
        <SellerNav />
        <div className="container py-8 max-w-5xl">
          <div className="h-8 w-48 bg-muted rounded-xl animate-pulse mb-6" />
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (orderError) {
    return (
      <Layout>
        <SellerNav />
        <div className="container py-20 max-w-2xl flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">{t("common.error_title")}</p>
          <p className="text-sm text-muted-foreground">{t("common.error_subtitle")}</p>
          <button
            onClick={() => refetchOrder()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />{t("common.retry")}
          </button>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout>
        <SellerNav />
        <div className="container py-20 max-w-5xl text-center">
          <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Order not found</h2>
          <Link href="/seller/orders">
            <Button variant="outline" className="mt-4">{t("seller_orders.detail_back")}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isCourierManaged = ["courier_assigned","picked_up","in_transit","out_for_delivery"].includes(order.status);
  const isTerminal = ["delivered","cancelled","delivery_failed","returned","refunded"].includes(order.status);

  return (
    <Layout>
      <SellerNav />
      <div className="container py-6 md:py-8 max-w-5xl">

        {/* Back + header */}
        <div className="flex items-start gap-4 mb-6 flex-wrap">
          <Link href="/seller/orders">
            <Button variant="ghost" size="sm" className="gap-1.5 -ms-2">
              <ArrowLeft className={cn("h-4 w-4", isRtl && "rotate-180")} />
              {t("seller_orders.detail_back")}
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold" translate="no">
                {t("seller_orders.detail_title")} #{order.id}
              </h1>
              <StatusBadge status={order.status} t={t} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5" translate="no">
              {dateFns(new Date(order.createdAt), "EEEE, MMMM d, yyyy · h:mm a")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column — 2/3 */}
          <div className="lg:col-span-2 space-y-4">

            {/* Customer */}
            <SectionCard title={t("seller_orders.section_customer")} icon={User}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label={t("seller_orders.customer")} value={
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(order.customerName || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span>{order.customerName}</span>
                  </div>
                } />
                {order.customerPhone && (
                  <InfoRow label={t("seller_orders.customer_phone")} value={
                    <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline" translate="no">
                      <Phone className="h-3.5 w-3.5" />{order.customerPhone}
                    </a>
                  } />
                )}
                <InfoRow label={t("seller_orders.address")} value={
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    {order.shippingAddress}
                    {order.city ? `, ${order.city}` : ""}
                  </span>
                } />
                {order.zoneNameEn && (
                  <InfoRow label={t("seller_orders.zone")} value={
                    <span>{isRtl ? (order as any).zoneNameAr : order.zoneNameEn}</span>
                  } />
                )}
                <InfoRow label={t("seller_orders.delivery_notes")} value={
                  order.deliveryNotes
                    ? <span className="inline-flex items-start gap-1.5"><StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />{order.deliveryNotes}</span>
                    : <span className="text-muted-foreground">{t("seller_orders.no_notes")}</span>
                } />
              </div>
            </SectionCard>

            {/* Products */}
            <SectionCard title={t("seller_orders.section_products")} icon={Package}>
              <div className="space-y-3">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs font-semibold text-muted-foreground border-b pb-2">
                  <span>{t("seller_orders.items")}</span>
                  <span className="text-end">{t("seller_orders.unit_price")}</span>
                  <span className="text-center">{t("seller_orders.quantity_col")}</span>
                  <span className="text-end">{t("seller_orders.line_total")}</span>
                </div>
                {order.items.map((item, idx) => {
                  let variantDetails: { name: string; value: string }[] | null = null;
                  if (item.variantDetails) {
                    try { variantDetails = JSON.parse(item.variantDetails as unknown as string); } catch {}
                  }
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-2 border-b last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {(item as any).imageUrl ? (
                          <img src={(item as any).imageUrl} alt={item.productName}
                            className="h-10 w-10 rounded-lg object-cover shrink-0 border" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{item.productName}</p>
                          {variantDetails && variantDetails.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {variantDetails.map(v => `${v.name}: ${v.value}`).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-end" translate="no">{formatCurrency(item.unitPrice)}</span>
                      <span className="text-sm text-center font-semibold" translate="no">×{item.quantity}</span>
                      <span className="text-sm font-bold text-end" translate="no">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Financial Summary */}
            <SectionCard title={t("seller_orders.section_financial")} icon={ReceiptText}>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("seller_orders.subtotal")}</span>
                  <span className="font-semibold" translate="no">{formatCurrency(subtotal)}</span>
                </div>
                {order.deliveryFee ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("seller_orders.delivery_fee")}</span>
                    <span className="font-semibold" translate="no">{formatCurrency(order.deliveryFee)}</span>
                  </div>
                ) : null}
                {platformFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("seller_orders.platform_fee")}</span>
                    <span className="font-semibold text-red-600" translate="no">−{formatCurrency(platformFee)}</span>
                  </div>
                )}
                <div className="border-t pt-2.5 flex items-center justify-between">
                  <span className="font-bold">{t("seller_orders.total")}</span>
                  <span className="font-black text-lg" translate="no">{formatCurrency(order.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-3 py-2.5 border border-emerald-200 dark:border-emerald-800">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("seller_orders.seller_revenue")}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400" translate="no">{formatCurrency(sellerRevenue)}</span>
                </div>
              </div>
            </SectionCard>

            {/* Timeline */}
            <SectionCard title={t("seller_orders.section_timeline")} icon={ClipboardList}>
              <OrderStatusTimeline
                orderId={order.id}
                status={order.status as any}
                createdAt={order.createdAt}
                updatedAt={order.updatedAt}
                deliveryFee={order.deliveryFee ?? null}
              />
            </SectionCard>
          </div>

          {/* Right column — 1/3 */}
          <div className="space-y-4">

            {/* Action Center */}
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b bg-muted/20">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="font-bold text-sm">{t("seller_orders.section_actions")}</h2>
              </div>
              <div className="p-5 space-y-3">
                {order.status === "pending" && (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">Awaiting your confirmation to start processing.</p>
                    <Button className="w-full bg-sky-500 hover:bg-sky-600 text-white border-0"
                      disabled={updateStatus.isPending}
                      onClick={() => handleForward("confirmed")}>
                      <CheckCircle2 className="h-4 w-4 me-2" />
                      {t("seller_orders.mark_confirmed")}
                    </Button>
                    <Button variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                      disabled={updateStatus.isPending}
                      onClick={() => handleForward("cancelled")}>
                      <XCircle className="h-4 w-4 me-2" />
                      {t("seller_orders.cancel_order")}
                    </Button>
                  </>
                )}

                {order.status === "confirmed" && (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">Order confirmed. Start preparing when ready.</p>
                    <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white border-0"
                      disabled={updateStatus.isPending}
                      onClick={() => handleForward("preparing")}>
                      <Package className="h-4 w-4 me-2" />
                      {t("seller_orders.mark_preparing")}
                    </Button>
                  </>
                )}

                {order.status === "preparing" && (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">Mark ready when the order is packed and waiting for pickup.</p>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                      disabled={updateStatus.isPending}
                      onClick={() => handleForward("ready_for_pickup")}>
                      <CheckCircle2 className="h-4 w-4 me-2" />
                      {t("seller_orders.mark_ready")}
                    </Button>
                  </>
                )}

                {order.status === "ready_for_pickup" && (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">{t("seller_orders.awaiting_courier")}</p>
                    <p className="text-xs text-muted-foreground">{t("seller_orders.ready_for_pickup_desc")}</p>
                  </div>
                )}

                {isCourierManaged && (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <div className="h-12 w-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <p className="font-semibold text-sm text-teal-700 dark:text-teal-400">{t("seller_orders.courier_handling")}</p>
                    <p className="text-xs text-muted-foreground">The courier is managing this delivery.</p>
                  </div>
                )}

                {isTerminal && (
                  <div className={cn("flex flex-col items-center gap-2 py-2 text-center")}>
                    <div className={cn("h-12 w-12 rounded-full flex items-center justify-center",
                      order.status === "delivered"
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-muted")}>
                      {order.status === "delivered"
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        : <XCircle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <p className="font-semibold text-sm">
                      {t(`seller_orders.${order.status}_readonly`, {
                        defaultValue: t(`seller_orders.${order.status}`, { defaultValue: order.status }),
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Courier Info */}
            {(order.courierName || order.courierPhone) && (
              <SectionCard title={t("seller_orders.section_courier")} icon={Truck}>
                <div className="space-y-3">
                  {order.courierName && (
                    <InfoRow label={t("seller_orders.courier")} value={
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {order.courierName}
                      </span>
                    } />
                  )}
                  {order.courierPhone && (
                    <InfoRow label={t("seller_orders.courier_phone")} value={
                      <a href={`tel:${order.courierPhone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline" translate="no">
                        <Phone className="h-3.5 w-3.5" />{order.courierPhone}
                      </a>
                    } />
                  )}
                  {order.courierStatus && (
                    <InfoRow label={t("seller_orders.courier_status")} value={
                      <span className="capitalize">{order.courierStatus.replace(/_/g, " ")}</span>
                    } />
                  )}
                  {getHistoryTime("courier_assigned") && (
                    <InfoRow label={t("seller_orders.assignment_time")} value={getHistoryTime("courier_assigned")} />
                  )}
                  {getHistoryTime("picked_up") && (
                    <InfoRow label={t("seller_orders.pickup_time")} value={getHistoryTime("picked_up")} />
                  )}
                  {getHistoryTime("delivered") && (
                    <InfoRow label={t("seller_orders.delivery_time")} value={getHistoryTime("delivered")} />
                  )}
                </div>
              </SectionCard>
            )}

            {/* Quick links */}
            <div className="bg-card border rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Links</p>
              <Link href="/seller/orders">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <ArrowLeft className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                  {t("seller_orders.detail_back")}
                </Button>
              </Link>
              <Link href={`/seller/products`}>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <Package className="h-3.5 w-3.5" />
                  My Products
                </Button>
              </Link>
              {/* Track Courier — shown when mission is actively tracked */}
              {(order as any).missionId &&
               ["courier_assigned","picked_up","in_transit","out_for_delivery"].includes(order.status) && (
                <Link href={`/tracking/${(order as any).missionId}`}>
                  <Button size="sm" className="w-full justify-start gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    <Truck className="h-3.5 w-3.5" />
                    {t("tracking.track_courier")}
                    <span className="ms-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
