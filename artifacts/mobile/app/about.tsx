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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../src/i18n";

const STATS = [
  { number: "500+", key: "about.stat_sellers" as const },
  { number: "10K+", key: "about.stat_products" as const },
  { number: "50K+", key: "about.stat_customers" as const },
  { number: "4.8★", key: "about.stat_rating" as const },
];

const VALUES = [
  { icon: "shield-checkmark-outline" as const, titleKey: "about.value_trust_title" as const, descKey: "about.value_trust_desc" as const },
  { icon: "car-outline" as const, titleKey: "about.value_delivery_title" as const, descKey: "about.value_delivery_desc" as const },
  { icon: "star-outline" as const, titleKey: "about.value_quality_title" as const, descKey: "about.value_quality_desc" as const },
  { icon: "people-outline" as const, titleKey: "about.value_community_title" as const, descKey: "about.value_community_desc" as const },
  { icon: "flash-outline" as const, titleKey: "about.value_speed_title" as const, descKey: "about.value_speed_desc" as const },
];

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("about.badge")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.heroBadge, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "40" }]}>
            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>{t("about.badge")}</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{t("about.hero_title")}</Text>
          <Text style={[styles.heroDesc, { color: colors.mutedForeground }]}>{t("about.hero_desc")}</Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsSection, { borderBottomColor: colors.border }]}>
          <View style={styles.statsGrid}>
            {STATS.map(({ number, key }) => (
              <View key={key} style={styles.statCell}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{number}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t(key)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Values */}
        <View style={styles.valuesSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Our Values</Text>
          {VALUES.map(({ icon, titleKey, descKey }) => (
            <View key={titleKey} style={[styles.valueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.valueIcon, { backgroundColor: colors.primary + "22" }]}>
                <Ionicons name={icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.valueTitle, { color: colors.foreground }]}>{t(titleKey)}</Text>
                <Text style={[styles.valueDesc, { color: colors.mutedForeground }]}>{t(descKey)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  hero: {
    padding: 24,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "600" },
  heroTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", lineHeight: 30 },
  heroDesc: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  statsSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-around",
  },
  statCell: { alignItems: "center", minWidth: 80 },
  statNumber: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 11, textAlign: "center", marginTop: 2 },
  valuesSection: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  valueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  valueIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  valueTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  valueDesc: { fontSize: 13, lineHeight: 19 },
});
