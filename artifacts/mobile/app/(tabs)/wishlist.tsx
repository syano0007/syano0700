import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAddToCart, getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

interface WishlistProduct {
  id: number;
  name: string;
  price: number;
  finalPrice: number;
  discountPercent?: number | null;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  stock: number;
  category: string;
}

function WishlistCard({
  product,
  colors,
  onMoveToCart,
  onRemove,
  movingId,
  removingId,
}: {
  product: WishlistProduct;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onMoveToCart: (product: WishlistProduct) => void;
  onRemove: (id: number) => void;
  movingId: number | null;
  removingId: number | null;
}) {
  const isMoving = movingId === product.id;
  const isRemoving = removingId === product.id;
  const isBusy = isMoving || isRemoving;
  const outOfStock = product.stock <= 0;
  const hasDiscount = product.discountPercent != null && product.discountPercent > 0;
  const imageUri = product.imageUrls?.[0] ?? product.imageUrl ?? null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: isBusy ? 0.5 : pressed ? 0.93 : 1,
        },
      ]}
      onPress={() => router.push(`/product/${product.id}` as any)}
      disabled={isBusy}
    >
      <View style={[styles.imageWrap, { backgroundColor: colors.muted }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={36} color={colors.mutedForeground} />
        )}
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discountPercent}%</Text>
          </View>
        )}
        <Pressable
          style={[styles.removeBtn, { backgroundColor: colors.background + "EE", borderColor: colors.border }]}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRemove(product.id); }}
          disabled={isBusy}
          hitSlop={8}
        >
          <Ionicons name="close" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={styles.info}>
        <Text style={[styles.category, { color: colors.primary }]} numberOfLines={1}>
          {product.category}
        </Text>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            ${(product.finalPrice ?? product.price).toFixed(2)}
          </Text>
          {hasDiscount && (
            <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
              ${product.price.toFixed(2)}
            </Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.cartBtn,
            {
              backgroundColor: outOfStock ? colors.muted : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onMoveToCart(product); }}
          disabled={isBusy || outOfStock}
        >
          {isMoving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="cart-outline" size={14} color={outOfStock ? colors.mutedForeground : "#fff"} />
          )}
          <Text style={[styles.cartBtnText, { color: outOfStock ? colors.mutedForeground : "#fff" }]}>
            {outOfStock ? t("product.out_of_stock") : t("cart.add_to_cart")}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function WishlistScreen() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { ids, toggle } = useWishlist();
  const { isAuthenticated, token } = useAuth() as any;
  const addToCart = useAddToCart();

  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  function authHeaders(): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
  }

  const loadProducts = useCallback(() => {
    if (ids.length === 0) { setProducts([]); return; }
    setLoading(true);
    if (isAuthenticated) {
      fetch(`${getBaseUrl()}/api/wishlist`, { headers: authHeaders(), credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: WishlistProduct[]) => setProducts(Array.isArray(data) ? data : []))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    } else {
      Promise.all(
        ids.map((id) =>
          fetch(`${getBaseUrl()}/api/products/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      )
        .then((results) => setProducts((results as (WishlistProduct | null)[]).filter(Boolean) as WishlistProduct[]))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, ids.length]);

  useEffect(() => { loadProducts(); }, [isAuthenticated, ids.length]);

  const moveToCart = useCallback(async (product: WishlistProduct) => {
    if (product.stock <= 0) return;
    setMovingId(product.id);
    try {
      addToCart.mutate({ data: { productId: product.id, quantity: 1 } });
      await toggle(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } finally {
      setMovingId(null);
    }
  }, [addToCart, toggle]);

  const removeItem = useCallback(async (id: number) => {
    setRemovingId(id);
    try {
      await toggle(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setRemovingId(null);
    }
  }, [toggle]);

  const isEmpty = !loading && products.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="heart" size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("wishlist.title")}</Text>
          {products.length > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {products.length} {t("wishlist.saved_count")}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="heart-outline" size={48} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("wishlist.empty_title")}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{t("wishlist.empty_desc")}</Text>
          <Pressable
            style={({ pressed }) => [styles.browseBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => router.push("/")}
          >
            <Ionicons name="bag-outline" size={16} color="#fff" />
            <Text style={styles.browseBtnText}>{t("wishlist.browse")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: tabBarHeight + 16 }]}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadProducts} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <WishlistCard
                product={item}
                colors={colors}
                onMoveToCart={moveToCart}
                onRemove={removeItem}
                movingId={movingId}
                removingId={removingId}
              />
            </View>
          )}
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
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800" as const },
  headerSub: { fontSize: 13, marginTop: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const },
  emptyDesc: { fontSize: 13, textAlign: "center", maxWidth: 260 },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  browseBtnText: { color: "#fff", fontWeight: "700" as const, fontSize: 14 },
  grid: { paddingHorizontal: 12, paddingTop: 12, gap: 10 },
  row: { gap: 10 },
  cardWrapper: { flex: 1 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  imageWrap: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  discountBadge: {
    position: "absolute",
    top: 6,
    start: 6,
    backgroundColor: "#EF4444",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: { color: "#fff", fontSize: 10, fontWeight: "700" as const },
  removeBtn: {
    position: "absolute",
    top: 6,
    end: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { padding: 10, gap: 3 },
  category: { fontSize: 10, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "800" as const },
  oldPrice: { fontSize: 11, textDecorationLine: "line-through" },
  cartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 6,
    borderRadius: 8,
    paddingVertical: 7,
  },
  cartBtnText: { fontSize: 11, fontWeight: "700" as const },
});
