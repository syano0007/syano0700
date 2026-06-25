import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
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

interface DeliveryRecord {
  id: number;
  orderId: number;
  status: string;
  yourCut: number;
  deliveryAddress: string;
  completedAt: string | null;
  createdAt: string;
}

export default function CourierHistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [history, setHistory] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setHistory((await r.json()) as DeliveryRecord[]);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const totalEarnings = history.reduce((sum, d) => sum + (d.yourCut ?? 0), 0);
  const delivered = history.filter((d) => d.status === "delivered").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("courier_dash.history")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary */}
      {history.length > 0 && (
        <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatPrice(totalEarnings)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t("courier_dash.earnings")}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{delivered}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t("courier_dash.history")}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {delivered > 0 ? `${((delivered / history.length) * 100).toFixed(0)}%` : "—"}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{t("courier_dash.success_rate")}</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("courier_dash.no_history")}</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(d) => String(d.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const isDelivered = item.status === "delivered";
            const statusColor = isDelivered ? "#10B981" : "#EF4444";
            return (
              <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.historyTop}>
                  <Text style={[styles.historyId, { color: colors.foreground }]}>
                    {t("courier_dash.order_ref").replace("{{id}}", String(item.orderId))}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {isDelivered ? "Delivered" : "Failed"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.historyAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.deliveryAddress}
                </Text>
                <View style={styles.historyBottom}>
                  <Text style={[styles.historyEarnings, { color: colors.primary }]}>
                    {formatPrice(item.yourCut)}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {new Date(item.completedAt ?? item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
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
  summaryRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryDivider: { width: 1, marginVertical: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700" },
  summaryLabel: { fontSize: 11 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  historyCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  historyTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyId: { fontSize: 14, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  historyAddr: { fontSize: 13 },
  historyBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyEarnings: { fontSize: 16, fontWeight: "700" },
  historyDate: { fontSize: 12 },
});
