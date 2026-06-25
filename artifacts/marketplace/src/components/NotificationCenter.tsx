import React, { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Bell, BellRing, CheckCheck,
  ShoppingBag, ShoppingCart, Zap, Truck, CheckCircle2, XCircle,
  AlertTriangle, Store, UserCheck, UserX, Package, PackageCheck, PackageX,
  UserPlus, Bike, Star, MessageSquare,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn, localizeNotif } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetNotificationCount,
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getGetNotificationCountQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { AppNotification } from "@workspace/api-client-react";

/* ── Relative timestamp ──────────────────────────────────────── */
function useRelativeTime() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return t("time.just_now");
    const m = Math.floor(s / 60);
    if (m < 60) return t("time.minutes_ago", { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("time.hours_ago", { count: h });
    const d = Math.floor(h / 24);
    if (d === 1) return t("time.yesterday");
    if (d < 7) return t("time.days_ago", { count: d });
    return date.toLocaleDateString(lang === "ar" ? "ar-SY" : "en-US", { month: "short", day: "numeric" });
  };
}

/* ── Maps ────────────────────────────────────────────────────── */
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
  new_user:          UserPlus,
  courier_applied:   Bike,
  new_seller_review: Star,
  seller_review_reply: MessageSquare,
};

const TYPE_COLOR: Record<string, string> = {
  new_order:         "text-emerald-500",
  order_placed:      "text-green-500",
  order_processing:  "text-amber-500",
  order_shipped:     "text-indigo-500",
  order_delivered:   "text-emerald-500",
  order_cancelled:   "text-red-500",
  low_stock:         "text-orange-500",
  seller_applied:    "text-violet-500",
  seller_approved:   "text-emerald-500",
  seller_rejected:   "text-red-500",
  product_submitted: "text-emerald-500",
  product_approved:  "text-emerald-500",
  product_rejected:  "text-red-500",
  new_user:          "text-emerald-500",
  courier_applied:   "text-orange-500",
  new_seller_review: "text-amber-500",
  seller_review_reply: "text-violet-500",
};

const TYPE_BG: Record<string, string> = {
  new_order:         "bg-emerald-50 dark:bg-emerald-950/30",
  order_placed:      "bg-green-50 dark:bg-green-950/30",
  order_processing:  "bg-amber-50 dark:bg-amber-950/30",
  order_shipped:     "bg-indigo-50 dark:bg-indigo-950/30",
  order_delivered:   "bg-emerald-50 dark:bg-emerald-950/30",
  order_cancelled:   "bg-red-50 dark:bg-red-950/30",
  low_stock:         "bg-orange-50 dark:bg-orange-950/30",
  seller_applied:    "bg-violet-50 dark:bg-violet-950/30",
  seller_approved:   "bg-emerald-50 dark:bg-emerald-950/30",
  seller_rejected:   "bg-red-50 dark:bg-red-950/30",
  product_submitted: "bg-emerald-50 dark:bg-emerald-950/30",
  product_approved:  "bg-emerald-50 dark:bg-emerald-950/30",
  product_rejected:  "bg-red-50 dark:bg-red-950/30",
  new_user:          "bg-emerald-50 dark:bg-emerald-950/30",
  courier_applied:   "bg-orange-50 dark:bg-orange-950/30",
  new_seller_review: "bg-amber-50 dark:bg-amber-950/30",
  seller_review_reply: "bg-violet-50 dark:bg-violet-950/30",
};

const PRIORITY_RING: Record<string, string> = {
  critical:  "ring-2 ring-red-400/40",
  important: "ring-2 ring-primary/20",
};

/* ── Notification card ───────────────────────────────────────── */
const NotificationCard = React.memo(function NotificationCard({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (n: AppNotification) => void;
}) {
  const relativeTime = useRelativeTime();
  const { i18n } = useTranslation();
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const iconColor = TYPE_COLOR[notification.type] ?? "text-muted-foreground";
  const iconBg = TYPE_BG[notification.type] ?? "bg-muted";
  const priority = (notification as any).priority ?? "normal";

  return (
    <button
      onClick={() => onRead(notification)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3.5 text-start transition-colors",
        "hover:bg-muted/60 active:bg-muted",
        !notification.isRead
          ? "bg-primary/[0.04] border-s-[3px] border-s-primary"
          : "border-s-[3px] border-s-transparent"
      )}
    >
      <div className={cn(
        "mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0",
        !notification.isRead
          ? `${iconBg} ${PRIORITY_RING[priority] ?? ""}`
          : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", !notification.isRead ? iconColor : "text-muted-foreground")} />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={cn(
          "text-sm leading-snug",
          !notification.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"
        )}>
          {localizeNotif(notification.title, i18n.language)}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {localizeNotif(notification.body, i18n.language)}
        </p>
        <p className="text-[10px] text-muted-foreground/50 pt-0.5">
          {relativeTime(new Date(notification.createdAt))}
        </p>
      </div>

      {!notification.isRead && (
        <div className={cn(
          "mt-2 h-2 w-2 rounded-full shrink-0 animate-pulse",
          priority === "critical" ? "bg-red-500" : "bg-primary"
        )} />
      )}
    </button>
  );
});

/* ── Main component — reads from query cache updated by provider ─ */
export function NotificationCenter({ btnClassName }: { btnClassName?: string }) {
  const { isAuthenticated, isSeller } = useAuth();
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  /* Identical token to navSettingsBtn in Navbar.tsx — overridable for mobile */
  const btnCls = btnClassName ?? "bg-white/[0.92] hover:bg-white text-[#111111] rounded-lg";

  const { data: countData } = useGetNotificationCount({
    query: {
      enabled: isAuthenticated,
      refetchInterval: 60_000,
      staleTime: 30_000,
      queryKey: getGetNotificationCountQueryKey(),
    },
  });

  const { data: notifications, isLoading } = useListNotifications({
    query: {
      enabled: isAuthenticated && open,
      queryKey: getListNotificationsQueryKey(),
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetNotificationCountQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  }, [queryClient]);

  const markRead = useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  const markAll  = useMarkAllNotificationsRead({ mutation: { onSuccess: invalidate } });

  const handleClick = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) markRead.mutate({ id: n.id });
      const link = (n as any).link as string | null | undefined;
      setOpen(false);
      if (link) navigate(link);
      else if (n.orderId) navigate(isSeller ? "/seller/orders" : "/orders");
    },
    [markRead, navigate, isSeller]
  );

  const unreadCount = countData?.unread ?? 0;
  if (!isAuthenticated) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative h-9 w-9 flex items-center justify-center rounded-lg transition-all duration-200",
            btnCls
          )}
          aria-label={t("notifications.title")}
        >
          {unreadCount > 0
            ? <BellRing className="h-[1.0625rem] w-[1.0625rem]" />
            : <Bell    className="h-[1.0625rem] w-[1.0625rem]" />
          }
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-[1rem] w-[1rem] items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white pointer-events-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-1.5rem),400px)] p-0 shadow-2xl border rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">{t("notifications.title")}</h3>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {unreadCount} {t("notifications.unread")}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              {t("notifications.mark_all_read")}
            </Button>
          )}
        </div>

        <div className="max-h-[min(420px,65vh)] overflow-y-auto">
          {isLoading ? (
            <div className="divide-y">
              {[0,1,2].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-4 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-full" />
                    <div className="h-2 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : !notifications?.length ? (
            <div className="py-14 flex flex-col items-center gap-3 text-center px-6">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {t("notifications.no_notifications")}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t("notifications.no_notifications_desc")}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationCard key={n.id} notification={n} onRead={handleClick} />
              ))}
            </div>
          )}
        </div>

        {!!notifications?.length && (
          <div className="border-t px-4 py-2.5 bg-muted/20 text-center">
            <p className="text-[11px] text-muted-foreground">
              {t("notifications.showing_latest", { count: notifications.length })}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
