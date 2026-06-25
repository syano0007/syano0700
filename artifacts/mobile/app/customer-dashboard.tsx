import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetCustomerDashboard,
  getGetCustomerDashboardQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../src/i18n";

function StatCard({
  label,
  value,
  icon,
  colors,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: colors.primary + "22" }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#F59E0B",
  processing: "#3B82F6",
  shipped: "#6366F1",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

export default function CustomerDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();

  const { data, isLoading, isError, refetch } = useGetCustomerDashboard({
    query: { queryKey: getGetCustomerDashboardQueryKey() },
  });

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
          {t("customer_dashboard.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            {t("common.error")}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>
              {t("common.loading")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label={t("customer_dashboard.total_orders")}
              value={data?.totalOrders ?? 0}
              icon="receipt-outline"
              colors={colors}
            />
            <StatCard
              label={t("customer_dashboard.total_spent")}
              value={`$${((data?.totalSpent ?? 0) / 45000).toFixed(2)}`}
              icon="cash-outline"
              colors={colors}
            />
            <StatCard
              label={t("customer_dashboard.pending_orders")}
              value={data?.pendingOrders ?? 0}
              icon="time-outline"
              colors={colors}
            />
            <StatCard
              label={t("customer_dashboard.delivered")}
              value={data?.deliveredOrders ?? 0}
              icon="checkmark-circle-outline"
              colors={colors}
            />
          </View>

          {/* Recent Orders */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t("customer_dashboard.recent_orders")}
              </Text>
              <Pressable onPress={() => router.push("/(tabs)/orders")}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>
                  {t("customer_dashboard.view_all")}
                </Text>
              </Pressable>
            </View>

            {!data?.recentOrders || data.recentOrders.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bag-outline" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t("customer_dashboard.no_orders")}
                </Text>
              </View>
            ) : (
              data.recentOrders.map((order: any) => {
                const statusColor = STATUS_COLOR[order.status] ?? colors.mutedForeground;
                const date = new Date(order.createdAt).toLocaleDateString();
                return (
                  <Pressable
                    key={order.id}
                    style={[styles.orderRow, { borderBottomColor: colors.border }]}
                    onPress={() => router.push(`/order/${order.id}` as any)}
                  >
                    <View style={styles.orderLeft}>
                      <View style={styles.orderTitleRow}>
                        <Text style={[styles.orderId, { color: colors.foreground }]}>
                          {t("customer_dashboard.order_id", { id: String(order.id) })}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor + "44" }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {order.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.orderMeta, { color: colors.mutedForeground }]}>
                        {date} · {t("customer_dashboard.items_count", { count: String(order.items?.length ?? 0) })}
                      </Text>
                    </View>
                    <Text style={[styles.orderTotal, { color: colors.foreground }]}>
                      ${((order.total ?? 0) / 45000).toFixed(2)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 8,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500" },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  viewAll: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderLeft: { flex: 1, marginEnd: 12, gap: 4 },
  orderTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  orderId: { fontSize: 14, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  orderMeta: { fontSize: 12 },
  orderTotal: { fontSize: 15, fontWeight: "800" },
});
