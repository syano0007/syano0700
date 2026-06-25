import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
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

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  activeSellers: number;
  pendingApplications: number;
  newUsersToday: number;
  ordersToday: number;
}

interface RecentOrder {
  id: number;
  total: number;
  status: string;
  createdAt: string;
  buyerName?: string;
}

const MENU_ITEMS = [
  { key: "users",             icon: "people-outline"       as const, label: "admin_dash.users",             route: "/admin/users"             },
  { key: "orders",            icon: "receipt-outline"      as const, label: "admin_dash.orders",            route: "/admin/orders"            },
  { key: "sellers",           icon: "storefront-outline"   as const, label: "admin_dash.sellers",           route: "/admin/sellers"           },
  { key: "couriers",          icon: "bicycle-outline"      as const, label: "admin_dash.couriers",          route: "/admin/courier-applications" },
  { key: "delivery_missions", icon: "navigate-outline"     as const, label: "admin_dash.delivery_missions", route: "/admin/delivery-missions" },
  { key: "hero_banners",      icon: "images-outline"       as const, label: "admin_dash.hero_banners",      route: "/admin/hero-banners"      },
  { key: "verification",      icon: "shield-checkmark-outline" as const, label: "admin_dash.verification", route: "/admin/verification"      },
  { key: "support",           icon: "chatbubbles-outline"  as const, label: "admin_dash.support",          route: "/admin/support"           },
];

function StatCard({ icon, label, value, color, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[sc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[sc.icon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[sc.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[sc.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4, alignItems: "center" },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 11, textAlign: "center" },
});

export default function AdminDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch(`${getBaseUrl()}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getBaseUrl()}/api/admin/orders?limit=5`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statsRes.ok) setStats((await statsRes.json()) as AdminStats);
      if (ordersRes.ok) {
        const data = (await ordersRes.json()) as { orders?: RecentOrder[] } | RecentOrder[];
        setRecentOrders(Array.isArray(data) ? data.slice(0, 5) : (data.orders ?? []).slice(0, 5));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const STATUS_COLOR: Record<string, string> = {
    pending: "#F59E0B", confirmed: "#3B82F6", delivered: "#10B981", cancelled: "#EF4444",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("admin_dash.dashboard")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard icon="people-outline" label={t("admin_dash.total_users")} value={String(stats?.totalUsers ?? 0)} color="#3B82F6" colors={colors} />
            <StatCard icon="receipt-outline" label={t("admin_dash.total_orders")} value={String(stats?.totalOrders ?? 0)} color="#8B5CF6" colors={colors} />
          </View>
          <View style={styles.statsGrid}>
            <StatCard icon="cash-outline" label={t("admin_dash.total_revenue")} value={formatPrice(stats?.totalRevenue ?? 0)} color="#10B981" colors={colors} />
            <StatCard icon="storefront-outline" label={t("admin_dash.active_sellers")} value={String(stats?.activeSellers ?? 0)} color="#F59E0B" colors={colors} />
          </View>

          {/* Navigation Menu */}
          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                onPress={() => router.push(item.route as never)}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.accent }]}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>{t(item.label as never)}</Text>
                {item.key === "sellers" && (stats?.pendingApplications ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
                    <Text style={styles.badgeText}>{stats?.pendingApplications}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>

          {/* Recent Orders */}
          {recentOrders.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Orders</Text>
                <Pressable onPress={() => router.push("/admin/orders")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.recentList}>
                {recentOrders.map((order) => {
                  const sc = STATUS_COLOR[order.status] ?? "#64748B";
                  return (
                    <View key={order.id} style={[styles.orderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.orderId, { color: colors.foreground }]}>#{order.id}</Text>
                      <Text style={[styles.orderAmount, { color: colors.primary }]}>{formatPrice(order.total)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc + "22" }]}>
                        <Text style={[styles.statusText, { color: sc }]}>{order.status}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", gap: 10 },
  menuSection: { gap: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  seeAll: { fontSize: 14 },
  recentList: { gap: 8 },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  orderId: { flex: 1, fontSize: 14, fontWeight: "600" },
  orderAmount: { fontSize: 14, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "600" },
});
