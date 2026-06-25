import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

interface SellerApp {
  id: number;
  storeName: string;
  status: string;
  city: string | null;
  description: string | null;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

const STATUS_TABS = [
  { key: "all",         label: "All"         },
  { key: "pending",     label: "Pending"     },
  { key: "under_review",label: "In Review"   },
  { key: "approved",    label: "Approved"    },
  { key: "rejected",    label: "Rejected"    },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", under_review: "#3B82F6", approved: "#10B981",
  rejected: "#EF4444", suspended: "#EF4444",
};

export default function AdminSellersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [apps, setApps] = useState<SellerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const q = activeTab !== "all" ? `?status=${activeTab}` : "";
      const r = await fetch(`${getBaseUrl()}/api/admin/seller-applications${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as SellerApp[] | { applications: SellerApp[] };
        setApps(Array.isArray(data) ? data : (data.applications ?? []));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, activeTab]);

  useEffect(() => { void load(); }, [load]);

  const handleAction = (app: SellerApp, action: "approve" | "reject") => {
    Alert.alert(
      t("admin_dash.confirm_action"),
      `${action === "approve" ? t("admin_dash.approve") : t("admin_dash.reject")} "${app.storeName}"?`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: action === "approve" ? t("admin_dash.approve") : t("admin_dash.reject"),
          style: action === "reject" ? "destructive" : "default",
          onPress: async () => {
            setActionLoading(app.id);
            try {
              const r = await fetch(`${getBaseUrl()}/api/admin/seller-applications/${app.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: action === "approve" ? "approved" : "rejected" }),
              });
              if (r.ok) void load(true);
              else Alert.alert("Action failed");
            } catch { Alert.alert("Action failed"); }
            finally { setActionLoading(null); }
          },
        },
      ]
    );
  };

  const filtered = apps.filter((a) => activeTab === "all" || a.status === activeTab);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("admin_dash.sellers")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
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
          <Ionicons name="storefront-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("admin_dash.no_sellers")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => String(a.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const sc = STATUS_COLORS[item.status] ?? "#64748B";
            const isPending = item.status === "pending" || item.status === "under_review";

            return (
              <View style={[styles.appCard, { backgroundColor: colors.card, borderColor: isPending ? colors.primary + "44" : colors.border }]}>
                <View style={styles.appHeader}>
                  <View style={[styles.storeIcon, { backgroundColor: colors.accent }]}>
                    <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.storeName, { color: colors.foreground }]} numberOfLines={1}>{item.storeName}</Text>
                    {item.userEmail && (
                      <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>{item.userEmail}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: sc + "22" }]}>
                    <Text style={[styles.statusText, { color: sc }]}>{item.status.replace(/_/g, " ")}</Text>
                  </View>
                </View>

                {item.city && (
                  <Text style={[styles.city, { color: colors.mutedForeground }]}>
                    <Ionicons name="location-outline" size={12} /> {item.city}
                  </Text>
                )}
                {item.description && (
                  <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
                )}

                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  Applied {new Date(item.createdAt).toLocaleDateString()}
                </Text>

                {isPending && (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.rejectBtn, { borderColor: colors.destructive }]}
                      onPress={() => handleAction(item, "reject")}
                      disabled={actionLoading === item.id}
                    >
                      {actionLoading === item.id ? (
                        <ActivityIndicator size="small" color={colors.destructive} />
                      ) : (
                        <Text style={[styles.rejectText, { color: colors.destructive }]}>{t("admin_dash.reject")}</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.approveBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleAction(item, "approve")}
                      disabled={actionLoading === item.id}
                    >
                      {actionLoading === item.id ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Text style={[styles.approveText, { color: colors.primaryForeground }]}>{t("admin_dash.approve")}</Text>
                      )}
                    </Pressable>
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
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  appCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  appHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  storeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storeName: { fontSize: 15, fontWeight: "700" },
  userEmail: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: "600" },
  city: { fontSize: 13 },
  desc: { fontSize: 13, lineHeight: 18 },
  date: { fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  rejectText: { fontSize: 14, fontWeight: "600" },
  approveBtn: { flex: 2, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  approveText: { fontSize: 14, fontWeight: "700" },
});
