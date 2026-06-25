import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getListNotificationsQueryKey,
  getGetNotificationCountQueryKey,
} from "@workspace/api-client-react";
import type { AppNotification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const NOTIFICATION_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  order_placed:      { name: "receipt-outline",         color: "#3B82F6" },
  order_confirmed:   { name: "checkmark-circle-outline", color: "#10B981" },
  order_delivered:   { name: "cube-outline",            color: "#10B981" },
  order_cancelled:   { name: "close-circle-outline",    color: "#EF4444" },
  new_message:       { name: "chatbubble-outline",       color: "#8B5CF6" },
  seller_approved:   { name: "storefront-outline",       color: "#10B981" },
  seller_rejected:   { name: "storefront-outline",       color: "#EF4444" },
  courier_approved:  { name: "bicycle-outline",          color: "#10B981" },
  low_stock:         { name: "warning-outline",          color: "#F59E0B" },
  review_received:   { name: "star-outline",             color: "#F59E0B" },
  mission_offer:     { name: "car-outline",              color: "#3B82F6" },
};

function NotifIcon({ type }: { type: string }) {
  const conf = NOTIFICATION_ICONS[type] ?? { name: "notifications-outline" as const, color: "#64748B" };
  return (
    <View style={[styles.iconWrap, { backgroundColor: conf.color + "22" }]}>
      <Ionicons name={conf.name} size={20} color={conf.color} />
    </View>
  );
}

function NotifItem({
  item,
  colors,
  onPress,
}: {
  item: AppNotification;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onPress: (n: AppNotification) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.notifItem,
        {
          backgroundColor: item.isRead ? colors.card : colors.accent,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={() => onPress(item)}
    >
      <NotifIcon type={item.type} />
      <View style={styles.notifBody}>
        <View style={styles.notifTitleRow}>
          <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>
        <Text style={[styles.notifText, { color: colors.mutedForeground }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { isAuthenticated, token } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useListNotifications({
    query: { enabled: isAuthenticated, refetchInterval: 30_000 },
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetNotificationCountQueryKey() });
  }, [queryClient]);

  const handlePress = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) {
        markRead.mutate({ id: n.id }, { onSuccess: invalidate });
      }
      if (n.link) {
        router.push(n.link as never);
      }
    },
    [markRead, invalidate]
  );

  const handleMarkAll = useCallback(() => {
    markAllRead.mutate(undefined, { onSuccess: invalidate });
  }, [markAllRead, invalidate]);

  const unreadCount = notifications.filter((n: AppNotification) => !n.isRead).length;

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Ionicons name="notifications-outline" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          {t("notifications.empty")}
        </Text>
        <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
          Sign in to see your notifications
        </Text>
        <Pressable
          style={[styles.signInBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={[styles.signInBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("notifications.title")}
        </Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll} style={styles.markAllBtn}>
            <Text style={[styles.markAllText, { color: colors.primary }]}>
              {t("notifications.mark_all_read")}
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t("notifications.empty")}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            {t("notifications.empty_desc")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <NotifItem item={item} colors={colors} onPress={handlePress} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, fontWeight: "600" },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  signInBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  signInBtnText: { fontSize: 15, fontWeight: "600" },
  notifItem: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 3 },
  notifTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  notifText: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11 },
});
