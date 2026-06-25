import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useListOrders, useUpdateOrderStatus } from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { OrderCard } from "@/components/OrderCard";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

type FilterGroup = "all" | "active" | "delivered" | "cancelled";

const ACTIVE_STATUSES = new Set([
  "pending", "confirmed", "processing", "preparing",
  "ready_for_pickup", "courier_assigned", "picked_up", "out_for_delivery", "shipped",
]);
const CANCELLED_STATUSES = new Set(["cancelled", "delivery_failed", "returned", "refunded"]);

// Seller-facing advance transitions (not used in customer tab, kept for seller view)
const STATUS_NEXT: Record<string, string | null> = {
  pending:    "confirmed",
  confirmed:  "preparing",
  preparing:  "ready_for_pickup",
  delivered:  null,
  cancelled:  null,
  refunded:   null,
};

const STATUS_COLOR: Record<string, string> = {
  pending:          "#F59E0B",
  confirmed:        "#0EA5E9",
  processing:       "#3B82F6",
  preparing:        "#06B6D4",
  ready_for_pickup: "#10B981",
  courier_assigned: "#14B8A6",
  picked_up:        "#8B5CF6",
  out_for_delivery: "#6366F1",
  shipped:          "#8B5CF6",
  in_transit:       "#A855F7",
  delivered:        "#10B981",
  cancelled:        "#EF4444",
  delivery_failed:  "#F97316",
  returned:         "#F59E0B",
  refunded:         "#8B5CF6",
};

const FILTER_TABS: Array<{ key: FilterGroup; labelKey: string }> = [
  { key: "all",       labelKey: "orders.tab_all" },
  { key: "active",    labelKey: "orders.tab_active" },
  { key: "delivered", labelKey: "orders.tab_delivered" },
  { key: "cancelled", labelKey: "orders.tab_cancelled" },
];

export default function OrdersScreen() {
  const { isSeller } = useAuth();
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const [filter, setFilter] = useState<FilterGroup>("all");
  const { data: orders = [], isLoading, refetch, isRefetching } = useListOrders();
  const updateStatus = useUpdateOrderStatus();

  const filtered =
    filter === "all"       ? orders :
    filter === "active"    ? orders.filter((o: any) => ACTIVE_STATUSES.has(o.status)) :
    filter === "delivered" ? orders.filter((o: any) => o.status === "delivered") :
    orders.filter((o: any) => CANCELLED_STATUSES.has(o.status));

  const handleAdvanceStatus = useCallback((order: Order) => {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    updateStatus.mutate({ id: order.id, data: { status: next as any } });
  }, [updateStatus]);

  const renderOrderItem = useCallback(({ item }: { item: Order }) => (
    <Pressable onPress={() => router.push({ pathname: "/order/[id]", params: { id: String(item.id) } } as Href)}>
      <OrderCard order={item}>
        {isSeller && STATUS_NEXT[item.status] && (
          <Pressable
            testID={`advance-order-${item.id}`}
            style={({ pressed }) => [
              styles.advanceBtn,
              {
                backgroundColor: STATUS_COLOR[STATUS_NEXT[item.status]!] ?? colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => handleAdvanceStatus(item)}
            disabled={updateStatus.isPending}
          >
            <Ionicons name="arrow-forward-circle-outline" size={16} color="#fff" />
            <Text style={styles.advanceBtnText}>
              {t("orders.mark_as", { status: STATUS_NEXT[item.status] ?? "" })}
            </Text>
          </Pressable>
        )}
        {isSeller && item.status === "pending" && (
          <Pressable
            testID={`cancel-order-${item.id}`}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                borderColor: colors.destructive,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() =>
              updateStatus.mutate({ id: item.id, data: { status: "cancelled" } })
            }
            disabled={updateStatus.isPending}
          >
            <Text style={[styles.cancelText, { color: colors.destructive }]}>
              {t("orders.cancel_order")}
            </Text>
          </Pressable>
        )}
        {isSeller && (
          <Text style={[styles.customerInfo, { color: colors.mutedForeground }]}>
            <Ionicons name="person-outline" size={12} /> {item.customerName} · {item.shippingAddress}
          </Text>
        )}
      </OrderCard>
    </Pressable>
  ), [isSeller, colors, updateStatus.isPending, handleAdvanceStatus]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>{t("orders.title")}</Text>
      </View>

      <View style={[styles.filterRow]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTER_TABS.map(({ key, labelKey }) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: filter === key ? colors.primary : colors.secondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, { color: filter === key ? colors.primaryForeground : colors.foreground }]}>
                {t(labelKey as any, key.charAt(0).toUpperCase() + key.slice(1))}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {filter === "all" ? t("orders.empty") : t("orders.empty_filter", { status: filter })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: tabBarHeight },
          ]}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={16}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={renderOrderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: "700" as const },
  filterRow: { paddingVertical: 10 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: { fontSize: 13, fontWeight: "500" as const },
  list: { padding: 16, gap: 10 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 15 },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  advanceBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  cancelText: { fontSize: 13, fontWeight: "500" as const },
  customerInfo: { fontSize: 12, marginTop: 4 },
});
