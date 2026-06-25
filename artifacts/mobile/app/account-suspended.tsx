import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../src/i18n";

export default function AccountSuspendedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const handleSupport = () => {
    router.push("/support");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: "#FEF2F2" }]}>
        <Ionicons name="lock-closed" size={48} color={colors.destructive} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t("auth.suspended_title")}
      </Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>
        {t("auth.suspended_desc")}
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.supportBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSupport}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.primaryForeground} />
          <Text style={[styles.supportBtnText, { color: colors.primaryForeground }]}>
            {t("support.title")}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { borderColor: colors.destructive, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={[styles.logoutBtnText, { color: colors.destructive }]}>
            {t("profile.sign_out")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  desc: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  actions: { width: "100%", gap: 12, marginTop: 8 },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  supportBtnText: { fontSize: 15, fontWeight: "600" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  logoutBtnText: { fontSize: 15, fontWeight: "600" },
});
