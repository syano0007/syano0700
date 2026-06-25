import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Bell, ShoppingBag, ShoppingCart, Zap, Truck, CheckCircle2, XCircle, AlertTriangle, Store, UserCheck, UserX, Package, PackageCheck, PackageX } from "lucide-react";
import { useLocation } from "wouter";
import { cn, localizeNotif } from "@/lib/utils";
import { useNotificationToasts, type ToastItem } from "@/providers/NotificationProvider";
import { useMarkNotificationRead, getGetNotificationCountQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AppNotification } from "@workspace/api-client-react";

/* ── Icon / colour maps ──────────────────────────────────────── */
const TYPE_ICON: Record<string, React.ElementType> = {
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
};

const TYPE_COLOR: Record<string, string> = {
  new_order:         "text-emerald-600 dark:text-emerald-400",
  order_placed:      "text-emerald-600 dark:text-emerald-400",
  order_processing:  "text-amber-600 dark:text-amber-400",
  order_shipped:     "text-emerald-600 dark:text-emerald-400",
  order_delivered:   "text-emerald-600 dark:text-emerald-400",
  order_cancelled:   "text-red-600 dark:text-red-400",
  low_stock:         "text-orange-600 dark:text-orange-400",
  seller_applied:    "text-emerald-600 dark:text-emerald-400",
  seller_approved:   "text-emerald-600 dark:text-emerald-400",
  seller_rejected:   "text-red-600 dark:text-red-400",
  product_submitted: "text-emerald-600 dark:text-emerald-400",
  product_approved:  "text-emerald-600 dark:text-emerald-400",
  product_rejected:  "text-red-600 dark:text-red-400",
};

const TYPE_BG: Record<string, string> = {
  new_order:         "bg-emerald-100 dark:bg-emerald-900/40",
  order_placed:      "bg-emerald-100 dark:bg-emerald-900/40",
  order_processing:  "bg-amber-100 dark:bg-amber-900/40",
  order_shipped:     "bg-emerald-100 dark:bg-emerald-900/40",
  order_delivered:   "bg-emerald-100 dark:bg-emerald-900/40",
  order_cancelled:   "bg-red-100 dark:bg-red-900/40",
  low_stock:         "bg-orange-100 dark:bg-orange-900/40",
  seller_applied:    "bg-emerald-100 dark:bg-emerald-900/40",
  seller_approved:   "bg-emerald-100 dark:bg-emerald-900/40",
  seller_rejected:   "bg-red-100 dark:bg-red-900/40",
  product_submitted: "bg-emerald-100 dark:bg-emerald-900/40",
  product_approved:  "bg-emerald-100 dark:bg-emerald-900/40",
  product_rejected:  "bg-red-100 dark:bg-red-900/40",
};

const PRIORITY_BAR: Record<string, string> = {
  critical:  "bg-red-500",
  important: "bg-primary",
  normal:    "bg-muted-foreground/30",
};

/* ── Single toast card ───────────────────────────────────────── */
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const priority = (toast as any).priority ?? "normal";
  const link = (toast as any).link as string | null | undefined;
  const Icon = TYPE_ICON[toast.type] ?? Bell;
  const iconColor = TYPE_COLOR[toast.type] ?? "text-foreground";
  const iconBg = TYPE_BG[toast.type] ?? "bg-muted";

  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationCountQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    },
  });

  const handleClick = useCallback(() => {
    markRead.mutate({ id: toast.id });
    onDismiss(toast.toastId);
    if (link) navigate(link);
  }, [toast.id, toast.toastId, link, onDismiss, navigate, markRead]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "relative w-full overflow-hidden rounded-xl shadow-xl border",
        "bg-background/95 backdrop-blur-md",
        priority === "critical" && "border-red-200 dark:border-red-900",
        priority === "important" && "border-primary/20",
        priority === "normal" && "border-border"
      )}
    >
      {/* Priority accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-0.5", PRIORITY_BAR[priority] ?? "bg-muted-foreground/20")} />

      <button
        onClick={handleClick}
        className="w-full text-start p-3.5 flex items-start gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
      >
        {/* Icon */}
        <div className={cn("mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("h-4.5 w-4.5 h-4 w-4", iconColor)} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pe-6">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
            {localizeNotif(toast.title, i18n.language)}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5">
            {localizeNotif(toast.body, i18n.language)}
          </p>
        </div>
      </button>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.toastId)}
        className="absolute top-2.5 end-2.5 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Progress bar */}
      <div className="px-3.5 pb-2.5">
        <motion.div
          className={cn("h-0.5 rounded-full", PRIORITY_BAR[priority] ?? "bg-muted-foreground/20")}
          initial={{ width: "100%", opacity: 0.6 }}
          animate={{ width: "0%", opacity: 0.4 }}
          transition={{ duration: toast.duration / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

/* ── Toast container ─────────────────────────────────────────── */
export function NotificationToasts() {
  const { toasts, dismissToast } = useNotificationToasts();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <div
      className={cn(
        "fixed top-4 z-[200] flex flex-col gap-2 pointer-events-none",
        "w-[min(calc(100vw-2rem),380px)]",
        isRtl ? "left-4" : "right-4"
      )}
      style={{ direction: isRtl ? "rtl" : "ltr" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <div key={toast.toastId} className="pointer-events-auto">
            <ToastCard toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
