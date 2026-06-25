import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../src/i18n";

interface CategoryOption {
  slug: string;
  nameEn: string;
  nameAr: string;
  productCount: number;
}

const PALETTE = [
  "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#F97316",
  "#84CC16", "#14B8A6", "#6366F1", "#D946EF",
  "#0EA5E9", "#22C55E", "#A855F7", "#FB923C",
  "#E11D48", "#0D9488",
];

function colorForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const locale = getLocale();

  const { data, isLoading } = useQuery<{ categories: CategoryOption[] }>({
    queryKey: ["search", "filter-options"],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/search/filter-options`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const categories = (data?.categories ?? []).filter((c) => c.productCount > 0);

  const numColumns = 2;

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
            {t("categories.title")}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {t("categories.subtitle")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="layers-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("categories.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.slug}
          numColumns={numColumns}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => {
            const accent = colorForSlug(item.slug);
            const label = locale === "ar" ? item.nameAr : item.nameEn;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1, flex: 1 },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/index",
                    params: { category: item.slug },
                  } as any)
                }
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: accent + "22", borderColor: accent + "44" },
                  ]}
                >
                  <View style={[styles.dotInner, { backgroundColor: accent }]} />
                </View>
                <Text style={[styles.catLabel, { color: colors.foreground }]} numberOfLines={2}>
                  {label}
                </Text>
                <Text style={[styles.catCount, { color: colors.mutedForeground }]}>
                  {t("categories.product_count", { count: String(item.productCount) })}
                </Text>
              </Pressable>
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
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: { width: 16, height: 16, borderRadius: 8 },
  catLabel: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  catCount: { fontSize: 12 },
});
