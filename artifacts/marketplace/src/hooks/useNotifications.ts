import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getListNotificationsQueryKey,
  getGetNotificationCountQueryKey,
} from "@workspace/api-client-react";

export type AppNotification = {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  orderId: number | null;
  priority: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function apiCall(path: string, token: string, opts?: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
}

/**
 * Provides notification list, unread count, and mark-read helpers.
 *
 * SSE real-time updates are handled exclusively by NotificationProvider —
 * this hook intentionally contains NO EventSource connection.  Having two
 * connections per user caused duplicate cache increments, double toast
 * banners, and double server-side SSE fan-out writes.
 *
 * Cache keys must match the keys used by NotificationProvider (generated
 * from @workspace/api-client-react) so that SSE-driven setQueryData calls
 * are immediately reflected here.
 */
export function useNotifications() {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? (localStorage.getItem("token") ?? "") : "";
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: getListNotificationsQueryKey(),
    queryFn: async () => {
      const r = await apiCall("/notifications", token);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    enabled: !!user && !!token,
    staleTime: 30_000,
    refetchInterval: 90_000,
  });

  const { data: countData } = useQuery<{ unread: number }>({
    queryKey: getGetNotificationCountQueryKey(),
    queryFn: async () => {
      const r = await apiCall("/notifications/count", token);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    enabled: !!user && !!token,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const markRead = async (id: number) => {
    await apiCall(`/notifications/${id}/read`, token, { method: "POST" });
    qc.setQueryData<AppNotification[]>(getListNotificationsQueryKey(), (old = []) =>
      old.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    qc.setQueryData<{ unread: number }>(getGetNotificationCountQueryKey(), (old) => ({
      unread: Math.max(0, (old?.unread ?? 1) - 1),
    }));
  };

  const markAllRead = async () => {
    await apiCall("/notifications/read-all", token, { method: "POST" });
    qc.setQueryData<AppNotification[]>(getListNotificationsQueryKey(), (old = []) =>
      old.map((n) => ({ ...n, isRead: true }))
    );
    qc.setQueryData<{ unread: number }>(getGetNotificationCountQueryKey(), () => ({ unread: 0 }));
  };

  return {
    notifications,
    unreadCount: countData?.unread ?? 0,
    markRead,
    markAllRead,
  };
}
