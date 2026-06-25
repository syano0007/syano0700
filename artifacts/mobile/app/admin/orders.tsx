import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

interface AdminOrder {
  id: number;
  total: number;
  status: string;
  createdAt: string;
  buyerName?: string;
  itemCount?: number;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6", processing: "#8B5CF6",
  ready_for_pickup: "#14B8A6", shipped: "#0EA5E9",
  delivered: "#10B981", cancelled: "#EF4444", delivery_failed: "#EF4444",
};

const STATUS_TABS = [
  { key: "all",       label: "All" },
  { key: "pending",   label: "Pending" },
  { key: "active",    label: "Active" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const status = activeTab !== "all" && activeTab !== "active" ? `?status=${activeTab}` : "";
      const r = await fetch(`${getBaseUrl()}/api/admin/orders${status}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as AdminOrder[] | { orders: AdminOrder[] };
        setOrders(Array.isArray(data) ? data : (data.orders ?? []));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, activeTab]);

  useEffect(() => { void load(); }, [load]);

  const filtered = orders.filter((o) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return !["pending", "delivered", "cancelled", "delivery_failed"].includes(o.status);
    return o.status === activeTab;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("admin_dash.orders")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Status Tabs */}
      <View style={{ height: 44 }}>
        <FlatList
          horizontal
          data={STATUS_TABS}
          keyExtractor={(t) => t.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.tab, activeTab === item.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text style={[styles.tabText, { color: activeTab === item.key ? colors.primary : colors.mutedForeground }]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("admin_dash.no_orders")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => String(o.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const sc = STATUS_COLOR[item.status] ?? "#64748B";
            return (
              <Pressable
                style={({ pressed }) => [styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push(`/order/${item.id}` as never)}
              >
                <View style={styles.orderTop}>
                  <Text style={[styles.orderId, { color: colors.foreground }]}>#{item.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "22" }]}>
                    <Text style={[styles.statusText, { color: sc }]}>{item.status.replace(/_/g, " ")}</Text>
                  </View>
                </View>
                {item.buyerName && (
                  <Text style={[styles.buyerName, { color: colors.mutedForeground }]}>
                    <Ionicons name="person-outline" size={12} /> {item.buyerName}
                  </Text>
                )}
                <View style={styles.orderBottom}>
                  <Text style={[styles.orderTotal, { color: colors.primary }]}>{formatPrice(item.total)}</Text>
                  <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </Pressable>
            );
          }}
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
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  orderCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  orderTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderId: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  buyerName: { fontSize: 13 },
  orderBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderTotal: { fontSize: 16, fontWeight: "700" },
  orderDate: { fontSize: 13 },
});
