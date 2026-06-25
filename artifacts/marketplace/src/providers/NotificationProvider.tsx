// @refresh reset
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getGetNotificationCountQueryKey,
  getListNotificationsQueryKey,
  getListOrdersQueryKey,
  getConversationsQueryKey,
} from "@workspace/api-client-react";
import type { AppNotification } from "@workspace/api-client-react";

/* ── Toast item type ─────────────────────────────────────────── */
export type ToastItem = AppNotification & {
  toastId: string;
  duration: number;
};

/* ── Context ─────────────────────────────────────────────────── */
type ContextValue = {
  toasts: ToastItem[];
  dismissToast: (toastId: string) => void;
};

const NotificationContext = createContext<ContextValue>({
  toasts: [],
  dismissToast: () => {},
});

export const useNotificationToasts = () => useContext(NotificationContext);

/* ── Helper: toast duration by priority ─────────────────────── */
function durationMs(priority: string): number {
  if (priority === "critical") return 8_000;
  if (priority === "important") return 5_500;
  return 3_500;
}

/* ── Provider ────────────────────────────────────────────────── */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout, refreshAuth } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    const timer = timersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(toastId);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      /* ── Logout: full teardown ──────────────────────────────── */
      esRef.current?.close();
      esRef.current = null;

      /* Clear all pending toast auto-dismiss timers */
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();

      /* Remove active toast banners — no stale toasts for the next user */
      setToasts([]);

      /* Evict notification caches so the next login gets a fresh fetch.
         Without this, User A's notifications remain in cache and are briefly
         visible to User B during the staleTime window (30 s for list). */
      queryClient.removeQueries({ queryKey: getListNotificationsQueryKey() });
      queryClient.removeQueries({ queryKey: getGetNotificationCountQueryKey() });

      return;
    }

    /* connectedUserId is set when the server sends the "connected" event.
       It is used to guard against stale-connection notification injection:
       if a notification arrives for a different userId (e.g. after a rapid
       account switch where the old SSE fires one last time), we discard it. */
    let connectedUserId: number | null = null;
    let retries = 0;
    let mounted = true;

    // Handles ROLE_CHANGED 403 from the API fetcher for offline/stale JWT case
    const handleRoleChanged = () => { refreshAuth().catch(() => {}); };
    window.addEventListener("syano:role-changed", handleRoleChanged);

    const connect = () => {
      if (!mounted || esRef.current) return;

      /* Read the token at call time — NOT at effect setup time.
         This ensures reconnect attempts after refreshAuth() always use the
         freshest token from localStorage instead of a potentially stale
         (or expired) token captured in the closure when the effect first ran.
         If the user has logged out between retries, localStorage returns null
         and we exit early as a secondary safety guard. */
      const currentToken = localStorage.getItem("token");
      if (!currentToken) return;

      const es = new EventSource(
        `/api/notifications/stream?token=${encodeURIComponent(currentToken)}`
      );
      esRef.current = es;

      /* Server sends "suspended" when an admin suspends this account.
         Immediately log the user out and redirect to the suspension page. */
      es.addEventListener("suspended", () => {
        if (!mounted) return;
        es.close();
        esRef.current = null;
        logout();
        window.location.replace("/account-suspended");
      });

      /* Server sends "connected" with the authenticated userId so the client
         can validate that this connection belongs to the current user. */
      es.addEventListener("connected", (e: MessageEvent) => {
        if (!mounted) return;
        try {
          const { userId } = JSON.parse(e.data) as { userId: number };
          connectedUserId = userId;
          retries = 0;
        } catch {}
      });

      /* Server sends "role_changed" when a seller's application is rejected
         after they were already approved. Refresh the auth token so the
         frontend immediately reflects the demoted role without a full logout. */
      es.addEventListener("role_changed", () => {
        if (!mounted) return;
        refreshAuth().catch(() => {});
      });

      es.onmessage = (e) => {
        if (!mounted) return;
        try {
          const notif: AppNotification = JSON.parse(e.data);

          /* Guard: discard events that don't belong to the connected user.
             This prevents a stale SSE connection (left over from a previous
             session) from injecting old-user notifications into a new session. */
          if (connectedUserId !== null && (notif as any).userId !== connectedUserId) {
            return;
          }

          retries = 0;

          /* Update TanStack Query cache — zero-latency UI update */
          queryClient.setQueryData<AppNotification[]>(
            getListNotificationsQueryKey(),
            (old = []) => [notif, ...old]
          );
          queryClient.setQueryData<{ unread: number }>(
            getGetNotificationCountQueryKey(),
            (old) => ({ unread: (old?.unread ?? 0) + 1 })
          );

          /* Add to toast queue — max 4 visible */
          const priority = (notif as any).priority ?? "normal";
          const duration = durationMs(priority);
          const toastId = `${notif.id}-${Date.now()}`;

          setToasts((prev) => {
            const next = [{ ...notif, toastId, duration }, ...prev];
            return next.slice(0, 4);
          });

          /* Auto-dismiss */
          const timer = setTimeout(() => dismissToast(toastId), duration);
          timersRef.current.set(toastId, timer);

          /* Invalidate related queries so pages update without a manual refresh */
          const type = (notif as any).type as string | undefined;
          if (type === "new_message") {
            queryClient.invalidateQueries({ queryKey: getConversationsQueryKey() });
            queryClient.invalidateQueries({
              predicate: (q) =>
                Array.isArray(q.queryKey) &&
                typeof q.queryKey[0] === "string" &&
                (q.queryKey[0] as string).startsWith("/api/conversations/"),
            });
          } else if (
            type === "new_order" ||
            type === "order_placed" ||
            type === "order_confirmed" ||
            type === "order_processing" ||
            type === "order_preparing" ||
            type === "order_ready" ||
            type === "order_courier_assigned" ||
            type === "order_picked_up" ||
            type === "order_shipped" ||
            type === "order_out_for_delivery" ||
            type === "order_delivered" ||
            type === "order_delivery_failed" ||
            type === "order_returned" ||
            type === "order_cancelled" ||
            type === "order_cancelled_by_customer" ||
            type === "order_refunded"
          ) {
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            queryClient.invalidateQueries({
              predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "getOrder",
            });
          }
        } catch {}
      };

      es.onerror = () => {
        if (!mounted) return;
        es.close();
        esRef.current = null;
        connectedUserId = null;
        retries = Math.min(retries + 1, 6);
        const delay = Math.min(1_000 * 2 ** retries, 30_000);
        retryRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      mounted = false;
      window.removeEventListener("syano:role-changed", handleRoleChanged);
      if (retryRef.current) clearTimeout(retryRef.current);
      esRef.current?.close();
      esRef.current = null;
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, [isAuthenticated, queryClient, dismissToast]);

  const contextValue = useMemo(
    () => ({ toasts, dismissToast }),
    [toasts, dismissToast]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}
