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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

interface SellerRow {
  userId: number;
  name: string;
  email: string;
  isVerified: boolean;
  verificationLevel: string;
  verifiedAt: string | null;
  trustScore: number | null;
  trustLevel: string;
  storeName: string | null;
  storeSlug: string | null;
}

type VerificationLevel = "basic" | "verified" | "business";
type FilterKey = "all" | "verified" | "unverified";

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  none: { color: "#6B7280", label: "None" },
  basic: { color: "#3B82F6", label: "Basic" },
  verified: { color: "#10B981", label: "ID Verified" },
  business: { color: "#8B5CF6", label: "Business" },
};

export default function AdminVerificationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actingId, setActingId] = useState<number | null>(null);

  const { data: sellers = [], isLoading, refetch } = useQuery<SellerRow[]>({
    queryKey: ["admin-verification-list"],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/admin/sellers/verification`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const filtered = sellers.filter((s) => {
    if (filter === "verified" && !s.isVerified) return false;
    if (filter === "unverified" && s.isVerified) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (s.name?.toLowerCase() ?? "").includes(q) || (s.email?.toLowerCase() ?? "").includes(q) || (s.storeName?.toLowerCase() ?? "").includes(q);
    }
    return true;
  });

  async function verifySeller(userId: number, level: VerificationLevel) {
    setActingId(userId);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/sellers/${userId}/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", level }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["admin-verification-list"] });
      await refetch();
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  async function unverifySeller(userId: number) {
    setActingId(userId);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/sellers/${userId}/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unverify" }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["admin-verification-list"] });
      await refetch();
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  function showVerifyPicker(seller: SellerRow) {
    Alert.alert(
      t("seller_verification.verify_btn"),
      seller.name,
      [
        { text: "Basic",       onPress: () => verifySeller(seller.userId, "basic") },
        { text: "ID Verified", onPress: () => verifySeller(seller.userId, "verified") },
        { text: "Business",    onPress: () => verifySeller(seller.userId, "business") },
        { text: t("common.cancel"), style: "cancel" },
      ]
    );
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",        label: t("seller_verification.filter_all") },
    { key: "verified",   label: t("seller_verification.filter_verified") },
    { key: "unverified", label: t("seller_verification.filter_unverified") },
  ];

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
            {t("seller_verification.page_title")}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {t("seller_verification.page_subtitle")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("admin_dash.search")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={[styles.filtersRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={[
              styles.filterChip,
              { backgroundColor: filter === key ? colors.primary + "22" : colors.card, borderColor: filter === key ? colors.primary : colors.border },
            ]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterText, { color: filter === key ? colors.primary : colors.mutedForeground }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.userId)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Ionicons name="shield-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("seller_verification.no_sellers")}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const tier = TIER_CONFIG[item.verificationLevel] ?? TIER_CONFIG.none;
            const isActing = actingId === item.userId;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.sellerName, { color: colors.foreground }]}>{item.name}</Text>
                      {item.isVerified && (
                        <Ionicons name="checkmark-circle" size={16} color={tier.color} />
                      )}
                    </View>
                    {item.storeName && (
                      <Text style={[styles.storeName, { color: colors.primary }]}>{item.storeName}</Text>
                    )}
                    <Text style={[styles.email, { color: colors.mutedForeground }]}>{item.email}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.tierBadge, { backgroundColor: tier.color + "22", borderColor: tier.color + "44" }]}>
                      <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
                    </View>
                    {item.trustScore !== null && (
                      <Text style={[styles.trustScore, { color: colors.mutedForeground }]}>
                        {t("seller_verification.trust_score")}: {item.trustScore}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {!item.isVerified ? (
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B98144" }]}
                      onPress={() => showVerifyPicker(item)}
                      disabled={isActing}
                    >
                      <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
                      <Text style={[styles.actionText, { color: "#10B981" }]}>{t("seller_verification.verify_btn")}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      onPress={() =>
                        Alert.alert(t("seller_verification.unverify_btn"), item.name, [
                          { text: t("common.cancel"), style: "cancel" },
                          { text: t("seller_verification.unverify_btn"), style: "destructive", onPress: () => unverifySeller(item.userId) },
                        ])
                      }
                      disabled={isActing}
                    >
                      <Ionicons name="shield-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.actionText, { color: colors.mutedForeground }]}>{t("seller_verification.unverify_btn")}</Text>
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: "600" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sellerName: { fontSize: 15, fontWeight: "700" },
  storeName: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  email: { fontSize: 12, marginTop: 2 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  tierText: { fontSize: 11, fontWeight: "600" },
  trustScore: { fontSize: 11 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: "600" },
});
