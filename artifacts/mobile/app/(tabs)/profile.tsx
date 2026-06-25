import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useGetCustomerDashboard,
  useGetSellerDashboard,
  useGetFollowingStores,
  getGetCustomerDashboardQueryKey,
  getGetSellerDashboardQueryKey,
  getFollowingStoresQueryKey,
  type FollowingStore,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

export default function ProfileScreen() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { user, logout, isSeller, isCustomer, isCourier, isAdmin } = useAuth();

  const customerDash = useGetCustomerDashboard({ query: { enabled: isCustomer, queryKey: getGetCustomerDashboardQueryKey() } });
  const sellerDash = useGetSellerDashboard({ query: { enabled: isSeller, queryKey: getGetSellerDashboardQueryKey() } });
  const followingStores = useGetFollowingStores({ query: { enabled: isCustomer, queryKey: getFollowingStoresQueryKey() } });

  async function handleLogout() {
    Alert.alert(t("profile.sign_out_title"), t("profile.sign_out_msg"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.sign_out_btn"),
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const stats = isSeller
    ? [
        { label: t("profile.stat_products"), value: sellerDash.data?.totalProducts ?? "-", icon: "cube-outline" as const },
        { label: t("profile.stat_orders"), value: sellerDash.data?.totalOrders ?? "-", icon: "receipt-outline" as const },
        { label: t("profile.stat_revenue"), value: sellerDash.data ? `$${sellerDash.data.totalRevenue.toFixed(0)}` : "-", icon: "cash-outline" as const },
      ]
    : isCustomer
    ? [
        { label: t("profile.stat_orders"), value: customerDash.data?.totalOrders ?? "-", icon: "receipt-outline" as const },
        { label: t("profile.stat_delivered"), value: customerDash.data?.deliveredOrders ?? "-", icon: "checkmark-circle-outline" as const },
        { label: t("profile.stat_spent"), value: customerDash.data ? `$${customerDash.data.totalSpent.toFixed(0)}` : "-", icon: "cash-outline" as const },
      ]
    : [];

  const stores = followingStores.data ?? [];

  const roleLabel = isSeller
    ? t("profile.role_seller")
    : isCourier
    ? t("courier_dash.courier_profile")
    : isAdmin
    ? t("admin_dash.title")
    : t("profile.role_customer");

  const roleColor = isSeller ? "#10B981" : isCourier ? "#3B82F6" : isAdmin ? "#F59E0B" : "#6366F1";
  const roleIcon = isSeller
    ? "storefront-outline"
    : isCourier
    ? "bicycle-outline"
    : isAdmin
    ? "shield-outline"
    : "person-outline";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: tabBarHeight + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar card ──────────────────────────────────── */}
      <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + "22" }]}>
            <Ionicons name={roleIcon as keyof typeof Ionicons.glyphMap} size={12} color={roleColor} />
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </View>
      </View>

      {/* ── Stats ────────────────────────────────────────── */}
      {stats.length > 0 && (
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={s.icon} size={20} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{String(s.value)}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Following Stores ─────────────────────────────── */}
      {isCustomer && stores.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("profile.following_stores")}
          </Text>
          <View style={styles.storesList}>
            {stores.map((store: FollowingStore) => (
              <StoreFollowItem key={store.sellerId} store={store} colors={colors} />
            ))}
          </View>
        </View>
      )}

      {/* ── Common Menu ───────────────────────────────────── */}
      <View style={styles.menuSection}>
        <MenuItem icon="receipt-outline" label={t("profile.menu_orders")} onPress={() => router.push("/(tabs)/orders")} colors={colors} />
        {isCustomer && (
          <MenuItem icon="grid-outline" label={t("customer_dashboard.title")} onPress={() => router.push("/customer-dashboard" as never)} colors={colors} />
        )}
        {isCustomer && (
          <MenuItem icon="cart-outline" label={t("profile.menu_cart")} onPress={() => router.push("/(tabs)/cart")} colors={colors} />
        )}
        <MenuItem icon="layers-outline" label={t("categories.title")} onPress={() => router.push("/categories" as never)} colors={colors} />
        <MenuItem icon="storefront-outline" label={t("store_directory.title") || "Stores"} onPress={() => router.push("/stores" as never)} colors={colors} />
        <MenuItem icon="chatbubbles-outline" label={t("profile.menu_messages")} onPress={() => router.push("/(tabs)/messages")} colors={colors} />
        <MenuItem icon="notifications-outline" label={t("notifications.title")} onPress={() => router.push("/(tabs)/notifications")} colors={colors} />
        <MenuItem icon="settings-outline" label={t("settings_screen.title")} onPress={() => router.push("/settings")} colors={colors} />
        <MenuItem icon="help-circle-outline" label={t("support.title")} onPress={() => router.push("/support")} colors={colors} />
      </View>

      {/* ── Seller Menu ───────────────────────────────────── */}
      {isSeller && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("seller_dash.title")}</Text>
          <View style={styles.menuSection}>
            <MenuItem icon="cube-outline" label={t("seller_dash.my_products")} onPress={() => router.push("/seller/products")} colors={colors} />
            <MenuItem icon="receipt-outline" label={t("seller_dash.orders")} onPress={() => router.push("/seller/orders")} colors={colors} />
            <MenuItem icon="bar-chart-outline" label={t("seller_dash.analytics")} onPress={() => router.push("/seller/analytics")} colors={colors} />
            <MenuItem icon="star-outline" label={t("seller_dash.reviews")} onPress={() => router.push("/seller/reviews")} colors={colors} />
            <MenuItem icon="storefront-outline" label={t("seller_dash.store_settings")} onPress={() => router.push("/seller/store-settings")} colors={colors} />
            <MenuItem icon="shield-checkmark-outline" label={t("seller_trust.title")} onPress={() => router.push("/seller/trust" as never)} colors={colors} />
          </View>
        </>
      )}

      {/* ── Customer Onboarding ───────────────────────────── */}
      {isCustomer && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Opportunities</Text>
          <View style={styles.menuSection}>
            <MenuItem icon="storefront-outline" label={t("seller_apply.title")} onPress={() => router.push("/seller-apply")} colors={colors} />
            <MenuItem icon="bicycle-outline" label={t("courier_apply.title")} onPress={() => router.push("/courier-apply")} colors={colors} />
          </View>
        </>
      )}

      {/* ── Courier Menu ──────────────────────────────────── */}
      {isCourier && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("courier_dash.title")}</Text>
          <View style={styles.menuSection}>
            <MenuItem icon="map-outline" label="Mission Workspace" onPress={() => router.replace("/(courier-tabs)/workspace")} colors={colors} />
          </View>
        </>
      )}

      {/* ── Admin Menu ────────────────────────────────────── */}
      {isAdmin && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("admin_dash.title")}</Text>
          <View style={styles.menuSection}>
            <MenuItem icon="stats-chart-outline" label={t("admin_dash.dashboard")} onPress={() => router.push("/admin" as never)} colors={colors} />
            <MenuItem icon="people-outline" label={t("admin_dash.users")} onPress={() => router.push("/admin/users")} colors={colors} />
            <MenuItem icon="receipt-outline" label={t("admin_dash.orders")} onPress={() => router.push("/admin/orders")} colors={colors} />
            <MenuItem icon="storefront-outline" label={t("admin_dash.sellers")} onPress={() => router.push("/admin/sellers")} colors={colors} />
            <MenuItem icon="car-outline" label={t("courier_applications.page_title")} onPress={() => router.push("/admin/courier-applications" as never)} colors={colors} />
            <MenuItem icon="shield-outline" label={t("seller_verification.page_title")} onPress={() => router.push("/admin/verification" as never)} colors={colors} />
            <MenuItem icon="ticket-outline" label={t("admin_support.page_title")} onPress={() => router.push("/admin/support" as never)} colors={colors} />
          </View>
        </>
      )}

      {/* ── About & Legal ─────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
      <View style={styles.menuSection}>
        <MenuItem icon="information-circle-outline" label={t("about.badge")} onPress={() => router.push("/about" as never)} colors={colors} />
        <MenuItem icon="mail-outline" label={t("contact.hero_title")} onPress={() => router.push("/contact" as never)} colors={colors} />
        <MenuItem icon="help-circle-outline" label={t("help.title")} onPress={() => router.push("/help" as never)} colors={colors} />
        <MenuItem icon="document-text-outline" label={t("privacy.title")} onPress={() => router.push("/privacy-policy" as never)} colors={colors} />
        <MenuItem icon="document-outline" label={t("terms.title")} onPress={() => router.push("/terms" as never)} colors={colors} />
        <MenuItem icon="refresh-outline" label={t("returns.title")} onPress={() => router.push("/returns" as never)} colors={colors} />
        <MenuItem icon="pie-chart-outline" label={t("cookies.title")} onPress={() => router.push("/cookies" as never)} colors={colors} />
      </View>

      {/* ── Sign out ──────────────────────────────────────── */}
      <Pressable
        testID="logout-btn"
        style={({ pressed }) => [
          styles.logoutBtn,
          { backgroundColor: colors.card, borderColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>{t("profile.sign_out")}</Text>
      </Pressable>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>Syano · v1.0.0</Text>
    </ScrollView>
  );
}

function StoreFollowItem({ store, colors }: { store: FollowingStore; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const initial = store.storeName?.charAt(0)?.toUpperCase() ?? "S";
  const trustColor = store.trustLevel === "trusted" ? "#10B981" : store.trustLevel === "verified" ? "#3B82F6" : colors.mutedForeground;
  return (
    <View style={[styles.storeItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.storeAvatar, { backgroundColor: colors.muted }]}>
        {store.storeLogo ? (
          <Image source={{ uri: store.storeLogo }} style={styles.storeLogoImg} resizeMode="cover" />
        ) : (
          <Text style={[styles.storeInitial, { color: colors.primary }]}>{initial}</Text>
        )}
      </View>
      <View style={styles.storeMeta}>
        <Text style={[styles.storeName, { color: colors.foreground }]} numberOfLines={1}>
          {store.storeName ?? t("profile.unknown_store")}
        </Text>
        {store.trustLevel && store.trustLevel !== "new" && (
          <View style={styles.trustRow}>
            <Ionicons name={store.trustLevel === "trusted" ? "shield-checkmark" : "checkmark-circle"} size={11} color={trustColor} />
            <Text style={[styles.trustLabel, { color: trustColor }]}>
              {store.trustLevel.charAt(0).toUpperCase() + store.trustLevel.slice(1)}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.foreground }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontSize: 24, fontWeight: "700" as const },
  userInfo: { flex: 1, gap: 3 },
  userName: { fontSize: 18, fontWeight: "700" as const },
  userEmail: { fontSize: 13 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 3 },
  roleText: { fontSize: 11, fontWeight: "600" as const },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "700" as const },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const, marginBottom: -4 },
  storesList: { gap: 8 },
  storeItem: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  storeAvatar: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  storeLogoImg: { width: 40, height: 40 },
  storeInitial: { fontSize: 16, fontWeight: "700" as const },
  storeMeta: { flex: 1, gap: 2 },
  storeName: { fontSize: 14, fontWeight: "600" as const },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  trustLabel: { fontSize: 11, fontWeight: "500" as const },
  menuSection: { gap: 6 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" as const },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 14 },
  logoutText: { fontSize: 15, fontWeight: "600" as const },
  version: { fontSize: 12, textAlign: "center" },
});
