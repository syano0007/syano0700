import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { useSettings, type AppTheme, type AppLanguage, type AppCurrency } from "@/contexts/SettingsContext";
import { t } from "../src/i18n";

function SectionHeader({ label, colors }: { label: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function OptionRow<T extends string>({
  label,
  value,
  current,
  onPress,
  colors,
}: {
  label: string;
  value: T;
  current: T;
  onPress: (v: T) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const selected = value === current;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionRow,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.optionLabel, { color: colors.foreground }]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const { topPad } = useScreenLayout();
  const { theme, setTheme, language, setLanguage, currency, setCurrency } = useSettings();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("settings_screen.title")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Appearance */}
      <SectionHeader label={t("settings_screen.appearance")} colors={colors} />
      <View style={styles.group}>
        <Text style={[styles.groupTitle, { color: colors.foreground }]}>
          {t("settings_screen.theme")}
        </Text>
        <View style={styles.optionGroup}>
          {(
            [["theme_light", "light"], ["theme_dark", "dark"], ["theme_system", "system"]] as [string, AppTheme][]
          ).map(([key, val]) => (
              <OptionRow<AppTheme>
                key={val}
                label={t(`settings_screen.${key}` as never)}
                value={val}
                current={theme}
                onPress={setTheme}
                colors={colors}
              />
            ))}
        </View>
      </View>

      {/* Language */}
      <SectionHeader label={t("settings_screen.language")} colors={colors} />
      <View style={styles.optionGroup}>
        <OptionRow<AppLanguage>
          label={t("settings_screen.lang_en")}
          value="en"
          current={language}
          onPress={setLanguage}
          colors={colors}
        />
        <OptionRow<AppLanguage>
          label={t("settings_screen.lang_ar")}
          value="ar"
          current={language}
          onPress={setLanguage}
          colors={colors}
        />
      </View>

      {/* Currency */}
      <SectionHeader label={t("settings_screen.currency")} colors={colors} />
      <View style={styles.optionGroup}>
        <OptionRow<AppCurrency>
          label={t("settings_screen.currency_syp")}
          value="SYP"
          current={currency}
          onPress={setCurrency}
          colors={colors}
        />
        <OptionRow<AppCurrency>
          label={t("settings_screen.currency_usd")}
          value="USD"
          current={currency}
          onPress={setCurrency}
          colors={colors}
        />
      </View>

      {/* About */}
      <SectionHeader label={t("settings_screen.about")} colors={colors} />
      <View style={[styles.optionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.optionLabel, { color: colors.foreground }]}>
          {t("settings_screen.version")}
        </Text>
        <Text style={[styles.optionValue, { color: colors.mutedForeground }]}>1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  group: { gap: 8 },
  groupTitle: { fontSize: 14, fontWeight: "500", paddingHorizontal: 4 },
  optionGroup: { gap: 6 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionLabel: { fontSize: 15 },
  optionValue: { fontSize: 14 },
});
