import { type ElementType } from "react";
import {
  CheckCircle2, Circle, Clock, Package, Truck, Home, XCircle, MapPin, User, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useGetOrderHistory, getGetOrderHistoryQueryKey } from "@workspace/api-client-react";
import type { OrderHistoryEntry } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export type OrderStatus =
  | "pending" | "confirmed" | "processing" | "preparing"
  | "ready_for_pickup" | "courier_assigned"
  | "shipped" | "picked_up" | "in_transit" | "out_for_delivery"
  | "delivered" | "cancelled" | "delivery_failed" | "returned" | "refunded";

interface OrderStatusTimelineProps {
  orderId: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveryFee?: number | null;
}

// ── V1 Delivery flow (canonical) ───────────────────────────────────────────────
// pending → confirmed → preparing → ready_for_pickup → courier_assigned → picked_up → out_for_delivery → delivered
//
// Legacy External Shipping flow (backward compat for old orders):
// pending → processing → shipped → delivered

const V1_DELIVERY_STEPS: { key: string; icon: ElementType; i18nKey: string; descKey: string }[] = [
  { key: "pending",          icon: Clock,         i18nKey: "orders.step_pending",          descKey: "orders.step_desc_pending" },
  { key: "confirmed",        icon: CheckCircle2,  i18nKey: "orders.step_confirmed",        descKey: "orders.step_desc_confirmed" },
  { key: "preparing",        icon: Package,       i18nKey: "orders.step_preparing",        descKey: "orders.step_desc_preparing" },
  { key: "ready_for_pickup", icon: MapPin,        i18nKey: "orders.step_ready_for_pickup", descKey: "orders.step_desc_ready_for_pickup" },
  { key: "courier_assigned", icon: User,          i18nKey: "orders.step_courier_assigned", descKey: "orders.step_desc_courier_assigned" },
  { key: "picked_up",        icon: Truck,         i18nKey: "orders.step_picked_up",        descKey: "orders.step_desc_picked_up" },
  { key: "out_for_delivery", icon: Truck,         i18nKey: "orders.step_out_for_delivery", descKey: "orders.step_desc_out_for_delivery" },
  { key: "delivered",        icon: Home,          i18nKey: "orders.step_delivered",        descKey: "orders.step_desc_delivered" },
];

const SHIPPING_STEPS: { key: string; icon: ElementType; i18nKey: string; descKey: string }[] = [
  { key: "pending",    icon: Clock,   i18nKey: "orders.step_pending",    descKey: "orders.step_desc_pending" },
  { key: "processing", icon: Package, i18nKey: "orders.step_processing", descKey: "orders.step_desc_preparing" },
  { key: "shipped",    icon: Truck,   i18nKey: "orders.step_shipped",    descKey: "orders.step_desc_picked_up" },
  { key: "delivered",  icon: Home,    i18nKey: "orders.step_delivered",  descKey: "orders.step_desc_delivered" },
];

const V1_STATUS_ORDER: Record<string, number> = {
  pending:          0,
  confirmed:        1,
  preparing:        2,
  // legacy aliases that map to nearby steps
  processing:       2,
  ready_for_pickup: 3,
  courier_assigned: 4,
  picked_up:        5,
  in_transit:       6,
  out_for_delivery: 6,
  delivered:        7,
  cancelled:        -1,
  delivery_failed:  -2,
  returned:         -3,
  refunded:         -4,
};

const SHIPPING_STATUS_ORDER: Record<string, number> = {
  pending:    0,
  processing: 1,
  preparing:  1,
  shipped:    2,
  delivered:  3,
  cancelled:  -1,
  refunded:   -2,
};

/** Returns true if the order is on the V1 internal delivery flow */
function isV1DeliveryFlow(status: OrderStatus): boolean {
  return [
    "confirmed", "preparing", "ready_for_pickup", "courier_assigned",
    "picked_up", "out_for_delivery", "in_transit",
  ].includes(status);
}

export function OrderStatusTimeline({ orderId, status, createdAt, updatedAt, deliveryFee }: OrderStatusTimelineProps) {
  const { t } = useTranslation();

  const { data: history } = useGetOrderHistory(orderId, {
    query: { enabled: !!orderId, queryKey: getGetOrderHistoryQueryKey(orderId) }
  });

  const isCancelled = status === "cancelled";
  const isDeliveryFailed = status === "delivery_failed";
  const isReturned = status === "returned";
  const isRefunded = status === "refunded";

  const useV1Delivery = isV1DeliveryFlow(status) || (
    !["shipped", "processing"].includes(status) &&
    !isCancelled && !isDeliveryFailed && !isReturned && !isRefunded
  );
  const STEPS = (status === "shipped" || status === "processing") && !isV1DeliveryFlow(status)
    ? SHIPPING_STEPS
    : V1_DELIVERY_STEPS;
  const STATUS_ORDER = STEPS === SHIPPING_STEPS ? SHIPPING_STATUS_ORDER : V1_STATUS_ORDER;
  const currentIndex = STATUS_ORDER[status] ?? 0;

  function getTimestampFromHistory(stepKey: string): string | null {
    if (!history || history.length === 0) return null;
    const synonyms: Record<string, string[]> = {
      pending:          ["pending"],
      confirmed:        ["confirmed"],
      preparing:        ["preparing", "processing"],
      ready_for_pickup: ["ready_for_pickup"],
      courier_assigned: ["courier_assigned"],
      picked_up:        ["picked_up"],
      out_for_delivery: ["out_for_delivery", "in_transit"],
      delivered:        ["delivered"],
      processing:       ["processing", "confirmed", "preparing"],
      shipped:          ["shipped"],
    };
    const targets = synonyms[stepKey] ?? [stepKey];
    const entry = history.find((h: OrderHistoryEntry) => targets.includes(h.toStatus));
    if (entry) return format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a");
    return null;
  }

  function getFallbackTimestamp(stepIndex: number): string | null {
    if (isCancelled || isDeliveryFailed || isReturned || isRefunded) return null;
    if (stepIndex === 0) return format(new Date(createdAt), "MMM d, yyyy 'at' h:mm a");
    if (stepIndex <= currentIndex) return format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a");
    return null;
  }

  function getTimestamp(stepKey: string, stepIndex: number): string | null {
    const fromHistory = getTimestampFromHistory(stepKey);
    if (fromHistory) return fromHistory;
    return getFallbackTimestamp(stepIndex);
  }

  const cancelledEntry = history?.find((h: OrderHistoryEntry) => h.toStatus === "cancelled");
  const failedEntry = history?.find((h: OrderHistoryEntry) => h.toStatus === "delivery_failed");
  const returnedEntry = history?.find((h: OrderHistoryEntry) => h.toStatus === "returned");

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold text-base">{t("orders.timeline_title")}</h3>
        {deliveryFee != null && deliveryFee > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {t("orders.delivery_fee")}: ${deliveryFee.toFixed(2)}
          </span>
        )}
      </div>

      <div className="p-6">
        {isCancelled ? (
          <div className="flex items-center gap-3 text-destructive">
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{t("orders.status_cancelled")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cancelledEntry
                  ? format(new Date(cancelledEntry.createdAt), "MMM d, yyyy 'at' h:mm a")
                  : format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        ) : isDeliveryFailed ? (
          <div className="flex items-center gap-3" style={{ color: "#F59E0B" }}>
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{t("orders.status_delivery_failed")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {failedEntry
                  ? format(new Date(failedEntry.createdAt), "MMM d, yyyy 'at' h:mm a")
                  : format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                {t("orders.delivery_failed_desc")}
              </p>
            </div>
          </div>
        ) : isReturned ? (
          <div className="flex items-center gap-3" style={{ color: "#8B5CF6" }}>
            <XCircle className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{t("orders.status_returned")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {returnedEntry
                  ? format(new Date(returnedEntry.createdAt), "MMM d, yyyy 'at' h:mm a")
                  : format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        ) : isRefunded ? (
          <div className="flex items-center gap-3" style={{ color: "#8B5CF6" }}>
            <XCircle className="h-6 w-6 shrink-0" style={{ color: "#8B5CF6" }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: "#8B5CF6" }}>{t("orders.status_refunded")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>
        ) : (
          <ol className="relative">
            {STEPS.map((step, idx) => {
              const isCompleted = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const isPending = idx > currentIndex;
              const isLast = idx === STEPS.length - 1;
              const timestamp = getTimestamp(step.key, idx);
              const Icon = step.icon;

              return (
                <li key={step.key} className={cn("relative flex gap-4", !isLast && "pb-6")}>
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute start-[15px] top-7 bottom-0 w-0.5",
                        isCompleted ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}

                  <div className="shrink-0 relative z-10">
                    {isCompleted ? (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                      </div>
                    ) : isCurrent ? (
                      <div className="h-8 w-8 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full border-2 border-border bg-background flex items-center justify-center">
                        <Circle className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-1">
                    <p
                      className={cn(
                        "text-sm font-semibold leading-none",
                        isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {t(step.i18nKey)}
                    </p>
                    {timestamp && (
                      <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
                    )}
                    {isCurrent && !timestamp && (
                      <p className="text-xs text-primary mt-1 font-medium">{t("orders.step_current")}</p>
                    )}
                    {(isCompleted || isCurrent) && (
                      <p className={cn(
                        "text-xs mt-1 leading-relaxed",
                        isCurrent ? "text-primary/80 font-medium" : "text-muted-foreground/70"
                      )}>
                        {t(step.descKey)}
                      </p>
                    )}
                    {isPending && (
                      <p className="text-xs text-muted-foreground/60 mt-1">{t("orders.step_pending_label")}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
