import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Product } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useWishlist } from "@/contexts/WishlistContext";
import { T } from "@/src/tokens";

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onCardPress?: () => void;
}

export const ProductCard = React.memo(function ProductCard({ product, onAddToCart, onCardPress }: ProductCardProps) {
  const colors = useColors();
  const { isInWishlist, toggle, isToggling } = useWishlist();

  const hasDiscount = product.discountPercent != null && product.discountPercent > 0;
  const wishlisted = isInWishlist(product.id);
  const toggling = isToggling(product.id);

  function handleWishlist() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void toggle(product.id);
  }

  return (
    <Pressable
      testID="product-card"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      onPress={() => { onCardPress?.(); router.push(`/product/${product.id}`); }}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="cube-outline" size={40} color={colors.mutedForeground} />
        )}
        {hasDiscount && (
          <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
            <Text style={styles.badgeText}>-{product.discountPercent}%</Text>
          </View>
        )}
        {product.stock === 0 && (
          <View style={[styles.outOfStock, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Text style={styles.outOfStockText}>Out of stock</Text>
          </View>
        )}
        <Pressable
          style={[styles.heartBtn, { backgroundColor: colors.background + "EE" }]}
          onPress={handleWishlist}
          disabled={toggling}
          hitSlop={6}
        >
          <Ionicons
            name={wishlisted ? "heart" : "heart-outline"}
            size={T.icon.md}
            color={wishlisted ? "#EF4444" : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.category, { color: colors.primary }]}
          numberOfLines={1}
        >
          {product.category}
        </Text>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            ${product.finalPrice.toFixed(2)}
          </Text>
          {hasDiscount && (
            <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
              ${product.price.toFixed(2)}
            </Text>
          )}
        </View>
        {(product as any).averageRating != null && (product as any).reviewCount > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={T.icon.xs} color="#F59E0B" />
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {(product as any).averageRating?.toFixed(1)} ({(product as any).reviewCount})
            </Text>
          </View>
        )}
        {onAddToCart && product.stock > 0 && (
          <Pressable
            testID="add-to-cart-btn"
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => onAddToCart(product)}
          >
            <Ionicons name="cart-outline" size={T.icon.md} color={colors.primaryForeground} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: T.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: T.spacing.sm,
    left: T.spacing.sm,
    borderRadius: T.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: T.font.label,
    fontWeight: "700" as const,
    color: "#fff",
  },
  outOfStock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: T.spacing.xs,
    alignItems: "center",
  },
  outOfStockText: {
    color: "#fff",
    fontSize: T.font.label,
    fontWeight: "600" as const,
  },
  info: {
    padding: 10,
    gap: 3,
  },
  category: {
    fontSize: T.font.label,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  name: {
    fontSize: T.font.bodySm,
    fontWeight: "500" as const,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontSize: T.font.bodyLg,
    fontWeight: "700" as const,
  },
  heartBtn: {
    position: "absolute",
    top: T.spacing.sm,
    right: T.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: T.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  ratingText: { fontSize: T.font.label },
  originalPrice: {
    fontSize: T.font.caption,
    textDecorationLine: "line-through",
  },
  addBtn: {
    marginTop: 6,
    borderRadius: T.radius.md,
    padding: 6,
    alignItems: "center",
    alignSelf: "flex-end",
  },
});
