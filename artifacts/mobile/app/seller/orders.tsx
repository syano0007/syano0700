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
import {
  useListOrders,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6", processing: "#8B5CF6",
  preparing: "#6366F1", ready_for_pickup: "#14B8A6", shipped: "#0EA5E9",
  delivered: "#10B981", cancelled: "#EF4444", delivery_failed: "#EF4444",
};

const TABS = [
  { key: "all",       label: "All" },
  { key: "pending",   label: "Pending" },
  { key: "active",    label: "Active" },
  { key: "delivered", label: "Delivered" },
];

function statusLabel(status: string) {
  const k = `orders.status_${status}` as never;
  return t(k) || status;
}

export default function SellerOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  const { data: orders = [], isLoading, refetch, isRefetching } = useListOrders({
    query: { queryKey: getListOrdersQueryKey() },
  });

  const filtered = orders.filter((o: Order) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return o.status === "pending";
    if (activeTab === "active") return !["pending", "delivered", "cancelled"].includes(o.status);
    if (activeTab === "delivered") return o.status === "delivered";
    return true;
  });

  const handleMarkReady = async (orderId: number) => {
    try {
      await fetch(`${getBaseUrl()}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "ready_for_pickup" }),
      });
      void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch {
      Alert.alert("Failed to update order status");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.orders")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab.key ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("seller_dash.no_orders")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o: Order) => String(o.id)}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }: { item: Order }) => (
            <Pressable
              style={({ pressed }) => [styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push(`/seller/orders/${item.id}` as never)}
            >
              <View style={styles.orderTop}>
                <Text style={[styles.orderId, { color: colors.foreground }]}>#{item.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[item.status] ?? "#64748B") + "22" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] ?? "#64748B" }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderBottom}>
                <Text style={[styles.orderTotal, { color: colors.primary }]}>
                  {formatPrice(item.total ?? 0)}
                </Text>
                <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {item.status === "confirmed" || item.status === "processing" ? (
                <Pressable
                  style={[styles.readyBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => { e.stopPropagation(); void handleMarkReady(item.id); }}
                >
                  <Text style={[styles.readyBtnText, { color: colors.primaryForeground }]}>{t("seller_dash.fulfill")}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  orderCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  orderTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderId: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  orderBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderTotal: { fontSize: 16, fontWeight: "700" },
  orderDate: { fontSize: 13 },
  readyBtn: { paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  readyBtnText: { fontSize: 13, fontWeight: "600" },
});
