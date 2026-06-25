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

interface CourierRow {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
  notes: string | null;
  createdAt: string;
}

type TabKey = "pending" | "approved" | "rejected" | "suspended";

const TAB_COLORS: Record<TabKey, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  suspended: "#F97316",
};

const TABS: TabKey[] = ["pending", "approved", "rejected", "suspended"];

export default function AdminCourierApplicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("pending");
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: couriers = [], isLoading, refetch } = useQuery<CourierRow[]>({
    queryKey: ["admin-couriers"],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/admin/couriers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const filtered = couriers.filter((c) => c.status === tab);
  const counts: Record<TabKey, number> = {
    pending: couriers.filter((c) => c.status === "pending").length,
    approved: couriers.filter((c) => c.status === "approved").length,
    rejected: couriers.filter((c) => c.status === "rejected").length,
    suspended: couriers.filter((c) => c.status === "suspended").length,
  };

  async function updateCourier(courierId: number, status: string) {
    setActingId(courierId);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/couriers/${courierId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-couriers"] });
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  function confirmAction(courierId: number, status: string, label: string) {
    Alert.alert(t("admin_dash.confirm_action"), t("admin_dash.confirm_desc"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: label, style: status === "rejected" || status === "suspended" ? "destructive" : "default", onPress: () => updateCourier(courierId, status) },
    ]);
  }

  const tabLabel: Record<TabKey, string> = {
    pending: t("courier_applications.tab_pending"),
    approved: t("courier_applications.tab_approved"),
    rejected: t("courier_applications.tab_rejected"),
    suspended: t("courier_applications.tab_suspended"),
  };

  const emptyLabel: Record<TabKey, string> = {
    pending: t("courier_applications.empty_pending"),
    approved: t("courier_applications.empty_approved"),
    rejected: t("courier_applications.empty_rejected"),
    suspended: t("courier_applications.empty_suspended"),
  };

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
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t("courier_applications.page_title")}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {t("courier_applications.page_subtitle")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        {TABS.map((key) => {
          const active = tab === key;
          const color = TAB_COLORS[key];
          return (
            <Pressable
              key={key}
              style={[
                styles.tabBtn,
                { backgroundColor: active ? color + "22" : "transparent", borderColor: active ? color : colors.border },
              ]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, { color: active ? color : colors.mutedForeground }]}>
                {tabLabel[key]}
              </Text>
              {counts[key] > 0 && (
                <View style={[styles.badge, { backgroundColor: active ? color : colors.muted }]}>
                  <Text style={[styles.badgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {counts[key]}
                  </Text>
                </View>
              )}
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
              <Ionicons name="car-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{emptyLabel[tab]}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const color = TAB_COLORS[item.status];
            const isActing = actingId === item.id;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={styles.avatarWrap}>
                    <Ionicons name="person-circle-outline" size={40} color={colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.foreground }]}>{item.userName}</Text>
                    <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{item.userEmail}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                    <Text style={[styles.statusText, { color }]}>{item.status}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={[styles.details, { borderTopColor: colors.border }]}>
                  <View style={styles.detailRow}>
                    <Ionicons name="car-sport-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{t("courier_applications.vehicle")}:</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.vehicleType}</Text>
                  </View>
                  {item.district && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{t("courier_applications.district")}:</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.district}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{t("courier_applications.deliveries")}:</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.completedDeliveries}</Text>
                  </View>
                  {item.rating !== null && (
                    <View style={styles.detailRow}>
                      <Ionicons name="star-outline" size={14} color="#F59E0B" />
                      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{t("courier_applications.rating")}:</Text>
                      <Text style={[styles.detailValue, { color: colors.foreground }]}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {item.status === "pending" && (
                    <>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B98144" }]}
                        onPress={() => confirmAction(item.id, "approved", t("courier_applications.approve_btn"))}
                        disabled={isActing}
                      >
                        <Text style={[styles.actionText, { color: "#10B981" }]}>{t("courier_applications.approve_btn")}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}
                        onPress={() => confirmAction(item.id, "rejected", t("courier_applications.reject_btn"))}
                        disabled={isActing}
                      >
                        <Text style={[styles.actionText, { color: "#EF4444" }]}>{t("courier_applications.reject_btn")}</Text>
                      </Pressable>
                    </>
                  )}
                  {item.status === "approved" && (
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#F9731622", borderColor: "#F9731644" }]}
                      onPress={() => confirmAction(item.id, "suspended", t("courier_applications.suspend_btn"))}
                      disabled={isActing}
                    >
                      <Text style={[styles.actionText, { color: "#F97316" }]}>{t("courier_applications.suspend_btn")}</Text>
                    </Pressable>
                  )}
                  {(item.status === "rejected" || item.status === "suspended") && (
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B98144" }]}
                      onPress={() => confirmAction(item.id, "approved", t("courier_applications.reactivate_btn"))}
                      disabled={isActing}
                    >
                      <Text style={[styles.actionText, { color: "#10B981" }]}>{t("courier_applications.reactivate_btn")}</Text>
                    </Pressable>
                  )}
                  {isActing && <ActivityIndicator size="small" color={colors.primary} />}
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
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  badge: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatarWrap: {},
  userName: { fontSize: 15, fontWeight: "700" },
  userEmail: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 13, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
    alignItems: "center",
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: "700" },
});
