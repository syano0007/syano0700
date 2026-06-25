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
import { useGetSellerAnalytics } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

type SellerAnalytics = {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  conversionRate: number;
  topProducts?: Array<{ name: string; revenue: number; orders: number }>;
  revenueByDay?: Array<{ date: string; revenue: number }>;
  ordersByDay?: Array<{ date: string; count: number }>;
};

function StatCard({
  icon, label, value, color, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6, alignItems: "center", minWidth: 100 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 12, textAlign: "center" },
});

export default function SellerAnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { formatPrice } = useSettings();

  const { data, isLoading } = useGetSellerAnalytics();
  const analytics = data as SellerAnalytics | undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.analytics")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Summary Stats */}
          <View style={styles.statsGrid}>
            <StatCard icon="cash-outline" label={t("seller_dash.total_revenue")} value={formatPrice(analytics?.totalRevenue ?? 0)} color="#10B981" colors={colors} />
            <StatCard icon="receipt-outline" label={t("seller_dash.orders")} value={String(analytics?.totalOrders ?? 0)} color="#3B82F6" colors={colors} />
          </View>
          <View style={styles.statsGrid}>
            <StatCard icon="cube-outline" label={t("seller_dash.products")} value={String(analytics?.totalProducts ?? 0)} color="#8B5CF6" colors={colors} />
            <StatCard icon="trending-up-outline" label="Avg Order" value={formatPrice(analytics?.averageOrderValue ?? 0)} color="#F59E0B" colors={colors} />
          </View>

          {/* Revenue Chart (text-based bars) */}
          {analytics?.revenueByDay && analytics.revenueByDay.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("seller_dash.revenue_chart")}</Text>
              <View style={styles.miniChart}>
                {analytics.revenueByDay.slice(-7).map((d, i) => {
                  const max = Math.max(...analytics.revenueByDay!.map((x) => x.revenue), 1);
                  const pct = (d.revenue / max) * 100;
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                        {formatPrice(d.revenue)}
                      </Text>
                      <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                        <View style={[styles.bar, { height: `${pct}%`, backgroundColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.barDate, { color: colors.mutedForeground }]}>
                        {new Date(d.date).toLocaleDateString("en", { weekday: "short" })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Top Products */}
          {analytics?.topProducts && analytics.topProducts.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("seller_dash.top_products")}</Text>
              {analytics.topProducts.map((p, i) => (
                <View key={i} style={[styles.topProductRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.rankText, { color: colors.primary }]}>#{i + 1}</Text>
                  </View>
                  <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={[styles.productRevenue, { color: colors.primary }]}>{formatPrice(p.revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {(!analytics?.revenueByDay || analytics.revenueByDay.length === 0) && (
            <View style={styles.noData}>
              <Ionicons name="bar-chart-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>No analytics data yet</Text>
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
  statsGrid: { flexDirection: "row", gap: 12 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  miniChart: { flexDirection: "row", gap: 8, height: 120, alignItems: "flex-end" },
  barCol: { flex: 1, gap: 4, alignItems: "center", height: "100%" },
  barLabel: { fontSize: 9 },
  barBg: { flex: 1, width: "100%", borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4 },
  barDate: { fontSize: 9 },
  topProductRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  rankBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 12, fontWeight: "700" },
  productName: { flex: 1, fontSize: 14 },
  productRevenue: { fontSize: 14, fontWeight: "700" },
  noData: { alignItems: "center", paddingVertical: 48, gap: 12 },
  noDataText: { fontSize: 15 },
});
