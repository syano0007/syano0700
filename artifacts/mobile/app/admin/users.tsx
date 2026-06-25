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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isSuspended: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "#F59E0B", seller: "#10B981", courier: "#3B82F6", customer: "#8B5CF6",
};

export default function AdminUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      const r = await fetch(`${getBaseUrl()}/api/admin/users${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as AdminUser[] | { users: AdminUser[] };
        setUsers(Array.isArray(data) ? data : (data.users ?? []));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, search]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleToggleSuspend = async (user: AdminUser) => {
    const action = user.isSuspended ? "unsuspend" : "suspend";
    Alert.alert(
      t("admin_dash.confirm_action"),
      t("admin_dash.confirm_desc"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: user.isSuspended ? t("admin_dash.activate") : t("admin_dash.suspend"),
          style: user.isSuspended ? "default" : "destructive",
          onPress: async () => {
            setActionLoading(user.id);
            try {
              await fetch(`${getBaseUrl()}/api/admin/users/${user.id}/${action}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              void load(true);
            } catch { Alert.alert("Action failed"); }
            finally { setActionLoading(null); }
          },
        },
      ]
    );
  };

  const filtered = users;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("admin_dash.users")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t("admin_dash.search")}
            placeholderTextColor={colors.mutedForeground}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("admin_dash.no_users")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => String(u.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const roleColor = ROLE_COLORS[item.role] ?? "#64748B";
            return (
              <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: item.isSuspended ? "#EF444444" : colors.border }]}>
                <View style={[styles.userAvatar, { backgroundColor: roleColor + "22" }]}>
                  <Text style={[styles.userInitial, { color: roleColor }]}>
                    {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor + "22" }]}>
                      <Text style={[styles.roleText, { color: roleColor }]}>{item.role}</Text>
                    </View>
                  </View>
                  <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>{item.email}</Text>
                  {item.isSuspended && (
                    <Text style={[styles.suspendedTag, { color: colors.destructive }]}>● {t("admin_dash.suspended")}</Text>
                  )}
                </View>
                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: item.isSuspended ? "#10B98122" : "#EF444422", borderColor: item.isSuspended ? "#10B981" : "#EF4444" },
                  ]}
                  onPress={() => handleToggleSuspend(item)}
                  disabled={actionLoading === item.id}
                >
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color={item.isSuspended ? "#10B981" : "#EF4444"} />
                  ) : (
                    <Text style={[styles.actionText, { color: item.isSuspended ? "#10B981" : "#EF4444" }]}>
                      {item.isSuspended ? t("admin_dash.activate") : t("admin_dash.suspend")}
                    </Text>
                  )}
                </Pressable>
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
  searchRow: { padding: 12, borderBottomWidth: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  userCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userInitial: { fontSize: 18, fontWeight: "700" },
  userInfo: { flex: 1, gap: 2, minWidth: 0 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { flex: 1, fontSize: 14, fontWeight: "600" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleText: { fontSize: 10, fontWeight: "700" },
  userEmail: { fontSize: 12 },
  suspendedTag: { fontSize: 11, fontWeight: "600" },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, minWidth: 70, alignItems: "center" },
  actionText: { fontSize: 12, fontWeight: "600" },
});
