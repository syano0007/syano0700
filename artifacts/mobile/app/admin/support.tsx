import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

interface SupportTicket {
  id: number;
  status: "open" | "pending" | "resolved" | "closed";
  category: string;
  priority: "normal" | "high" | "urgent";
  subject: string | null;
  conversation_id: number | null;
  created_at: string;
  user_name: string;
  user_email: string;
  assigned_admin_name: string | null;
}

type TabKey = "open" | "pending" | "resolved" | "closed";

const STATUS_COLORS: Record<TabKey, string> = {
  open: "#3B82F6",
  pending: "#F59E0B",
  resolved: "#10B981",
  closed: "#6B7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  normal: "#6B7280",
};

export default function AdminSupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("open");
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: tickets = [], isLoading, refetch } = useQuery<SupportTicket[]>({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/admin/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const filtered = tickets.filter((t) => t.status === tab);
  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const TABS: TabKey[] = ["open", "pending", "resolved", "closed"];
  const tabLabels: Record<TabKey, string> = {
    open: t("admin_support.tab_open"),
    pending: t("admin_support.tab_pending"),
    resolved: t("admin_support.tab_resolved"),
    closed: t("admin_support.tab_closed"),
  };

  async function updateTicket(ticketId: number, status: string) {
    setActingId(ticketId);
    try {
      await fetch(`${getBaseUrl()}/api/admin/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      await refetch();
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("admin_support.page_title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stat row */}
      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        {TABS.map((key) => {
          const color = STATUS_COLORS[key];
          return (
            <Pressable
              key={key}
              style={[
                styles.statCell,
                { backgroundColor: tab === key ? color + "22" : "transparent", borderColor: tab === key ? color : colors.border },
              ]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.statCount, { color: tab === key ? color : colors.foreground }]}>
                {counts[key]}
              </Text>
              <Text style={[styles.statLabel, { color: tab === key ? color : colors.mutedForeground }]}>
                {tabLabels[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Ionicons name="ticket-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("admin_support.no_tickets")}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status];
            const priorityColor = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.normal;
            const isActing = actingId === item.id;
            const date = new Date(item.created_at).toLocaleDateString();
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.badgesRow}>
                      <View style={[styles.badge, { backgroundColor: statusColor + "22", borderColor: statusColor + "44" }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: priorityColor + "22", borderColor: priorityColor + "44" }]}>
                        <Text style={[styles.badgeText, { color: priorityColor }]}>{item.priority}</Text>
                      </View>
                    </View>
                    <Text style={[styles.subject, { color: colors.foreground }]} numberOfLines={1}>
                      {item.subject ?? item.category}
                    </Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      {item.user_name} · {date}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {(item.status === "open" || item.status === "pending") && (
                  <View style={[styles.actions, { borderTopColor: colors.border }]}>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B98144" }]}
                      onPress={() => updateTicket(item.id, "resolved")}
                      disabled={isActing}
                    >
                      <Text style={[styles.actionText, { color: "#10B981" }]}>{t("admin_support.resolve_btn")}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      onPress={() => updateTicket(item.id, "closed")}
                      disabled={isActing}
                    >
                      <Text style={[styles.actionText, { color: colors.mutedForeground }]}>{t("admin_support.close_btn")}</Text>
                    </Pressable>
                    {isActing && <ActivityIndicator size="small" color={colors.primary} />}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  statCount: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { padding: 14 },
  badgesRow: { flexDirection: "row", gap: 6, marginBottom: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  subject: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: "600" },
});
