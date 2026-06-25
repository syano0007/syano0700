import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { useSettings, type AppTheme, type AppLanguage, type AppCurrency } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

interface CourierStats {
  status: "ONLINE" | "OFFLINE" | "BUSY";
  walletBalance: number;
  successRate: number;
  activeAssignments: number;
  totalDeliveries: number;
}

function MenuItem({
  icon,
  label,
  onPress,
  colors,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  danger?: boolean;
}) {
  const color = danger ? colors.destructive : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
    </Pressable>
  );
}

function SegmentRow<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[styles.segmentTrack, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[
              styles.segmentBtn,
              active && { backgroundColor: colors.primary },
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[
              styles.segmentTxt,
              { color: active ? colors.primaryForeground : colors.mutedForeground },
            ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrefRow({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.prefRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.prefLabel, { color: colors.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function CourierProfileTabScreen() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { user, logout, token } = useAuth();
  const { theme, setTheme, language, setLanguage, currency, setCurrency } = useSettings();
  const [stats, setStats] = useState<CourierStats | null>(null);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const handleLogout = () => {
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
  };

  const statusColor = stats?.status === "ONLINE" ? "#10b981" : stats?.status === "BUSY" ? "#f59e0b" : "#6b7280";
  const statusText  = stats?.status === "ONLINE" ? t("workspace.online") ?? "Online"
    : stats?.status === "BUSY" ? t("workspace.busy") ?? "Busy"
    : t("workspace.offline") ?? "Offline";

  const themeOptions: { value: AppTheme; label: string }[] = [
    { value: "system", label: t("settings_screen.theme_system") ?? "System" },
    { value: "light",  label: t("settings_screen.theme_light")  ?? "Light"  },
    { value: "dark",   label: t("settings_screen.theme_dark")   ?? "Dark"   },
  ];

  const langOptions: { value: AppLanguage; label: string }[] = [
    { value: "ar", label: "العربية" },
    { value: "en", label: "English" },
  ];

  const currencyOptions: { value: AppCurrency; label: string }[] = [
    { value: "SYP", label: t("settings_screen.currency_syp") ?? "SYP" },
    { value: "USD", label: t("settings_screen.currency_usd") ?? "USD" },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: tabBarHeight + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar card ─────────────────────────────── */}
      <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: "#10b981" }]}>
          <Text style={[styles.avatarText, { color: "#fff" }]}>
            {user?.name?.charAt(0)?.toUpperCase() ?? "C"}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: statusColor + "22" }]}>
            <Ionicons name="bicycle-outline" size={12} color={statusColor} />
            <Text style={[styles.roleText, { color: statusColor }]}>
              {t("courier_dash.courier_profile")} · {statusText}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Stats ───────────────────────────────────── */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="cash-outline" size={18} color="#10b981" />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              ${((stats.walletBalance ?? 0) / 650).toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("workspace.wallet") ?? "Wallet"}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#3b82f6" />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {((stats.successRate ?? 0) * 100).toFixed(0)}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("workspace.success") ?? "Success"}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="bicycle-outline" size={18} color="#f59e0b" />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.totalDeliveries ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("workspace.deliveries") ?? "Deliveries"}</Text>
          </View>
        </View>
      )}

      {/* ── Account ─────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
      <View style={styles.menuSection}>
        <MenuItem icon="chatbubbles-outline" label={t("profile.menu_messages")} onPress={() => router.push("/(tabs)/messages")} colors={colors} />
        <MenuItem icon="notifications-outline" label={t("notifications.title")} onPress={() => router.push("/(tabs)/notifications")} colors={colors} />
        <MenuItem icon="settings-outline" label={t("settings_screen.title")} onPress={() => router.push("/settings")} colors={colors} />
        <MenuItem icon="help-circle-outline" label={t("support.title")} onPress={() => router.push("/support")} colors={colors} />
      </View>

      {/* ── About & Legal ───────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About</Text>
      <View style={styles.menuSection}>
        <MenuItem icon="information-circle-outline" label={t("about.badge")} onPress={() => router.push("/about" as never)} colors={colors} />
        <MenuItem icon="document-text-outline" label={t("privacy.title")} onPress={() => router.push("/privacy-policy" as never)} colors={colors} />
        <MenuItem icon="document-outline" label={t("terms.title")} onPress={() => router.push("/terms" as never)} colors={colors} />
      </View>

      {/* ── Preferences ─────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {t("profile.preferences") ?? "Preferences"}
      </Text>
      <View style={[styles.prefSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <PrefRow label={t("settings_screen.theme") ?? "Theme"} colors={colors}>
          <SegmentRow<AppTheme>
            options={themeOptions}
            value={theme}
            onChange={setTheme}
            colors={colors}
          />
        </PrefRow>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        <PrefRow label={t("settings_screen.language") ?? "Language"} colors={colors}>
          <SegmentRow<AppLanguage>
            options={langOptions}
            value={language}
            onChange={setLanguage}
            colors={colors}
          />
        </PrefRow>

        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

        <PrefRow label={t("settings_screen.currency") ?? "Currency"} colors={colors}>
          <SegmentRow<AppCurrency>
            options={currencyOptions}
            value={currency}
            onChange={setCurrency}
            colors={colors}
          />
        </PrefRow>
      </View>

      {/* ── Home button ─────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [
          styles.homeBtn,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => router.push("/(tabs)" as never)}
      >
        <Ionicons name="home-outline" size={18} color={colors.primary} />
        <Text style={[styles.homeBtnTxt, { color: colors.primary }]}>
          {t("profile.home_btn") ?? "Back to Home"}
        </Text>
      </Pressable>

      {/* ── Sign out ────────────────────────────────── */}
      <View style={styles.menuSection}>
        <MenuItem icon="log-out-outline" label={t("profile.sign_out")} onPress={handleLogout} colors={colors} danger />
      </View>

      <Text style={[styles.version, { color: colors.mutedForeground }]}>Syano · v1.0.0 · Courier</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  content:     { paddingHorizontal: 16, gap: 16 },
  avatarCard:  { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  avatar:      { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText:  { fontSize: 24, fontWeight: "700" as const },
  userInfo:    { flex: 1, gap: 3 },
  userName:    { fontSize: 18, fontWeight: "700" as const },
  userEmail:   { fontSize: 13 },
  roleBadge:   { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginTop: 3 },
  roleText:    { fontSize: 11, fontWeight: "600" as const },
  statsRow:    { flexDirection: "row", gap: 10 },
  statCard:    { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue:   { fontSize: 18, fontWeight: "700" as const },
  statLabel:   { fontSize: 11 },
  sectionTitle:{ fontSize: 16, fontWeight: "700" as const, marginBottom: -4 },
  menuSection: { gap: 6 },
  menuItem:    { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  menuIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel:   { flex: 1, fontSize: 15, fontWeight: "500" as const },
  prefSection: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  prefRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  prefLabel:   { fontSize: 14, fontWeight: "500" as const, flex: 1 },
  prefDivider: { height: 1, marginHorizontal: 14 },
  segmentTrack:{ flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  segmentBtn:  { paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  segmentTxt:  { fontSize: 12, fontWeight: "600" as const },
  homeBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 14 },
  homeBtnTxt:  { fontSize: 15, fontWeight: "600" as const },
  version:     { fontSize: 12, textAlign: "center" },
});
