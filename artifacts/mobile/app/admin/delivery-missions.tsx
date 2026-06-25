import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

type MissionStatus = "pending" | "active_pickup" | "in_transit" | "delivered" | "failed";

interface Mission {
  id: number;
  orderId: number;
  status: MissionStatus;
  sellerName: string | null;
  storeName: string | null;
  customerName: string | null;
  courierName: string | null;
  courierPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MissionStats {
  pending?: number;
  active_pickup?: number;
  in_transit?: number;
  delivered?: number;
  failed?: number;
  dispatchAlerts?: number;
}

const TAB_OPTIONS: Array<{ key: MissionStatus | "all"; label: string }> = [
  { key: "all",          label: "All" },
  { key: "pending",      label: "Pending" },
  { key: "active_pickup", label: "Pickup" },
  { key: "in_transit",   label: "In Transit" },
  { key: "delivered",    label: "Delivered" },
  { key: "failed",       label: "Failed" },
];

const STATUS_COLORS: Record<string, string> = {
  pending:       "#F59E0B",
  active_pickup: "#3B82F6",
  in_transit:    "#8B5CF6",
  delivered:     "#10B981",
  failed:        "#EF4444",
};

export default function AdminDeliveryMissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [missions, setMissions] = useState<Mission[]>([]);
  const [stats, setStats] = useState<MissionStats>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MissionStatus | "all">("all");
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  const authHeaders = { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab !== "all" ? `?status=${activeTab}` : "";
      const [missionsRes, statsRes] = await Promise.all([
        fetch(`${getBaseUrl()}/api/admin/delivery-missions${statusParam}`, { headers: authHeaders }),
        fetch(`${getBaseUrl()}/api/admin/delivery-missions/stats`, { headers: authHeaders }),
      ]);
      if (missionsRes.ok) {
        const data = await missionsRes.json() as { data: Mission[] };
        setMissions(data.data ?? []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json() as MissionStats);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [activeTab, token]);

  useEffect(() => { void load(); }, [load]);

  async function triggerAssignment(missionId: number) {
    setTriggeringId(missionId);
    try {
      await fetch(`${getBaseUrl()}/api/admin/delivery-missions/${missionId}/trigger-assignment`, {
        method: "POST",
        headers: authHeaders,
      });
      await load();
    } catch { /* silent */ }
    setTriggeringId(null);
  }

  const totalMissions =
    (stats.pending ?? 0) +
    (stats.active_pickup ?? 0) +
    (stats.in_transit ?? 0) +
    (stats.delivered ?? 0) +
    (stats.failed ?? 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("admin_dash.delivery_missions")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.statsRow, { backgroundColor: colors.card }]}
      >
        <StatChip label={t("admin_dash.pending")} value={stats.pending ?? 0} color="#F59E0B" colors={colors} />
        <StatChip label="Pickup" value={stats.active_pickup ?? 0} color="#3B82F6" colors={colors} />
        <StatChip label="In Transit" value={stats.in_transit ?? 0} color="#8B5CF6" colors={colors} />
        <StatChip label="Delivered" value={stats.delivered ?? 0} color="#10B981" colors={colors} />
        <StatChip label="Failed" value={stats.failed ?? 0} color="#EF4444" colors={colors} />
        {(stats.dispatchAlerts ?? 0) > 0 && (
          <StatChip label={t("admin_dash.alerts")} value={stats.dispatchAlerts ?? 0} color="#F97316" colors={colors} />
        )}
      </ScrollView>

      {/* Tab filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {TAB_OPTIONS.map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.tabChip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={missions}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="bicycle-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("admin_dash.no_missions")}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const statusColor = STATUS_COLORS[item.status] ?? colors.mutedForeground;
          const isPending = item.status === "pending";
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Top row */}
              <View style={styles.cardTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.missionId, { color: colors.foreground }]}>
                    {t("admin_dash.mission_id", { id: String(item.id) })}
                  </Text>
                  <Text style={[styles.orderId, { color: colors.mutedForeground }]}>
                    Order #{item.orderId}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor + "55" }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{item.status.replace(/_/g, " ")}</Text>
                </View>
              </View>

              {/* Parties */}
              <View style={styles.partiesRow}>
                {item.storeName && (
                  <View style={styles.partyItem}>
                    <Ionicons name="storefront-outline" size={13} color={colors.primary} />
                    <Text style={[styles.partyText, { color: colors.foreground }]} numberOfLines={1}>{item.storeName}</Text>
                  </View>
                )}
                {item.customerName && (
                  <View style={styles.partyItem}>
                    <Ionicons name="person-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.partyText, { color: colors.mutedForeground }]} numberOfLines={1}>{item.customerName}</Text>
                  </View>
                )}
                {item.courierName && (
                  <View style={styles.partyItem}>
                    <Ionicons name="bicycle-outline" size={13} color="#8B5CF6" />
                    <Text style={[styles.partyText, { color: colors.foreground }]} numberOfLines={1}>{item.courierName}</Text>
                  </View>
                )}
                {!item.courierName && (
                  <View style={styles.partyItem}>
                    <Ionicons name="bicycle-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.partyText, { color: colors.mutedForeground }]}>No courier assigned</Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                {isPending && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.triggerBtn,
                      { backgroundColor: colors.primary, opacity: pressed || triggeringId === item.id ? 0.75 : 1 },
                    ]}
                    onPress={() => triggerAssignment(item.id)}
                    disabled={triggeringId === item.id}
                  >
                    {triggeringId === item.id ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <>
                        <Ionicons name="flash-outline" size={14} color={colors.primaryForeground} />
                        <Text style={[styles.triggerBtnText, { color: colors.primaryForeground }]}>
                          {t("admin_dash.trigger_assignment")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function StatChip({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  return (
    <View style={[sc.chip, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      <Text style={[sc.val, { color }]}>{value}</Text>
      <Text style={[sc.lbl, { color }]}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", borderRightWidth: 1 },
  val: { fontSize: 18, fontWeight: "700" as const },
  lbl: { fontSize: 10, fontWeight: "500" as const, marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" as const },
  statsRow: { paddingVertical: 0 },
  tabRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tabChipText: { fontSize: 13, fontWeight: "600" as const },
  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 15 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  missionId: { fontSize: 15, fontWeight: "700" as const },
  orderId: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: "600" as const, textTransform: "capitalize" },
  partiesRow: { gap: 5 },
  partyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyText: { fontSize: 13, flex: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  dateText: { fontSize: 11 },
  triggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  triggerBtnText: { fontSize: 13, fontWeight: "600" as const },
});
