import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../../src/i18n";

interface StoreItem {
  id: number;
  sellerId: number;
  storeName: string;
  storeSlug: string;
  description: string | null;
  logoUrl: string | null;
  verificationLevel: string | null;
  city: string | null;
  totalProducts: number;
  averageRating: number | null;
  totalReviews: number;
}

interface DirectoryResponse {
  stores: StoreItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function StoresDirectoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tabBarHeight } = useScreenLayout();
  const locale = getLocale();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  async function fetchStores(q: string, refresh = false) {
    if (refresh) setIsRefreshing(true);
    else if (stores.length === 0) setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30", sort: "rating" });
      if (q) params.set("search", q);
      const res = await fetch(`${getBaseUrl()}/api/sellers/directory?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as DirectoryResponse;
      setStores(data.stores ?? []);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchStores(debouncedSearch);
  }, [debouncedSearch]);

  function handleSearchChange(text: string) {
    setSearch(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t2 = setTimeout(() => setDebouncedSearch(text), 400);
    setSearchTimeout(t2);
  }

  function renderVerifiedBadge(level: string | null) {
    if (!level || level === "none") return null;
    const color =
      level === "gold" ? "#F59E0B" : level === "silver" ? "#6B7280" : "#10B981";
    return (
      <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
        <Ionicons name="shield-checkmark" size={10} color={color} />
        <Text style={[styles.badgeText, { color }]}>{level}</Text>
      </View>
    );
  }

  function renderItem({ item }: { item: StoreItem }) {
    const slug = item.storeSlug ?? String(item.id);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={() => router.push(`/store/${slug}` as never)}
      >
        <View style={styles.cardLeft}>
          {item.logoUrl ? (
            <Image source={{ uri: item.logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: colors.muted }]}>
              <Ionicons name="storefront-outline" size={24} color={colors.mutedForeground} />
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.storeName, { color: colors.foreground }]} numberOfLines={1}>
              {item.storeName}
            </Text>
            {renderVerifiedBadge(item.verificationLevel)}
          </View>
          {item.description && (
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            {item.city && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.city}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {item.totalProducts} {t("store.products_count") || "products"}
              </Text>
            </View>
            {item.averageRating != null && item.totalReviews > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {item.averageRating.toFixed(1)} ({item.totalReviews})
                </Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("store_directory.title") || "Stores"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border, margin: 12 }]}>
        <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("store_directory.search_placeholder") || "Search stores..."}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {!!search && (
          <Pressable onPress={() => { setSearch(""); setDebouncedSearch(""); }}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : stores.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("store_directory.no_stores") || "No stores found"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchStores(debouncedSearch, true)}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 12, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  cardLeft: {},
  logo: { width: 56, height: 56, borderRadius: 12 },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  storeName: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  description: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12 },
});
