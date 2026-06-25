import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useClearCart,
  useGetCart,
  useRemoveFromCart,
  useUpdateCartItem,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";
import { useState } from "react";

export default function CartTab() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerProductsPlaceholder /> : <CartScreen />;
}

function SellerProductsPlaceholder() {
  const colors = useColors();
  const { topPad } = useScreenLayout();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: topPad,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        },
      ]}
    >
      <Ionicons name="storefront-outline" size={56} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("cart.seller_account")}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {t("cart.seller_account_desc")}
      </Text>
    </View>
  );
}

function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const { data: cart, isLoading } = useGetCart();
  const removeItem = useRemoveFromCart();
  const updateItem = useUpdateCartItem();
  const clearCart = useClearCart();
  const [checkoutBarHeight, setCheckoutBarHeight] = useState(88);

  function handleRemove(productId: number) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeItem.mutate({ productId });
  }

  function handleQuantityChange(productId: number, newQty: number) {
    if (newQty < 1) {
      handleRemove(productId);
      return;
    }
    updateItem.mutate({ productId, data: { quantity: newQty } });
  }

  function handleCheckoutBarLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setCheckoutBarHeight(h);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const items = cart?.items ?? [];
  const total = cart?.total ?? 0;
  const subtotal = cart?.subtotal ?? total;
  const discount = cart?.discount ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>{t("cart.title")}</Text>
        {items.length > 0 && (
          <Pressable
            onPress={() =>
              Alert.alert(t("cart.clear_cart"), t("cart.clear_confirm"), [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("cart.clear_action"),
                  style: "destructive",
                  onPress: () => clearCart.mutate(undefined),
                },
              ])
            }
          >
            <Ionicons name="trash-outline" size={22} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("cart.empty")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {t("cart.empty_desc")}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.browseBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>
              {t("cart.browse")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.productId)}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: checkoutBarHeight + insets.bottom },
            ]}
            removeClippedSubviews={true}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={16}
            windowSize={10}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.cartItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.itemImage, { backgroundColor: colors.muted }]}>
                  {item.product.imageUrl ? (
                    <Image
                      source={{ uri: item.product.imageUrl }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="cube-outline" size={28} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={[styles.sellerName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.product.sellerName}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.itemPrice, { color: colors.primary }]}>
                      ${item.product.finalPrice.toFixed(2)}
                    </Text>
                    {item.product.discountPercent && item.product.discountPercent > 0 && (
                      <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                        ${item.product.price.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  {item.stockWarning && (
                    <Text style={[styles.stockWarning, { color: "#F59E0B" }]}>
                      ⚠ {t("cart.limited_stock")}
                    </Text>
                  )}
                  <View style={styles.qtyRow}>
                    <Pressable
                      style={[styles.qtyBtn, { borderColor: colors.border }]}
                      onPress={() => handleQuantityChange(item.productId, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={16} color={colors.foreground} />
                    </Pressable>
                    <Text style={[styles.qtyText, { color: colors.foreground }]}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={[styles.qtyBtn, { borderColor: colors.border }]}
                      onPress={() => handleQuantityChange(item.productId, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={16} color={colors.foreground} />
                    </Pressable>
                    <Text style={[styles.subtotal, { color: colors.mutedForeground }]}>
                      ${item.subtotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => handleRemove(item.productId)} style={styles.removeBtn}>
                  <Ionicons name="close" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}
          />

          <View
            onLayout={handleCheckoutBarLayout}
            style={[
              styles.checkoutBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom + 8,
              },
            ]}
          >
            <View style={styles.summaryRow}>
              {discount > 0 && (
                <View style={styles.discountRow}>
                  <Text style={[styles.discountLabel, { color: colors.mutedForeground }]}>{t("cart.discount")}</Text>
                  <Text style={[styles.discountAmount, { color: "#10B981" }]}>–${discount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <View>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{t("cart.total")}</Text>
                  <Text style={[styles.totalAmount, { color: colors.foreground }]}>
                    ${total.toFixed(2)}
                  </Text>
                </View>
                <Pressable
                  testID="checkout-btn"
                  style={({ pressed }) => [
                    styles.checkoutBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => router.push("/checkout" as Href)}
                >
                  <Text style={[styles.checkoutText, { color: colors.primaryForeground }]}>
                    {t("cart.checkout")}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
                </Pressable>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: "700" as const },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: "700" as const },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  browseBtnText: { fontSize: 15, fontWeight: "600" as const },
  listContent: { padding: 16, gap: 10 },
  cartItem: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    gap: 10,
    padding: 10,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 13, fontWeight: "500" as const, lineHeight: 18 },
  sellerName: { fontSize: 11 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemPrice: { fontSize: 13, fontWeight: "600" as const },
  originalPrice: { fontSize: 11, textDecorationLine: "line-through" },
  stockWarning: { fontSize: 11, fontWeight: "500" as const },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 14, fontWeight: "600" as const, minWidth: 20, textAlign: "center" },
  subtotal: { fontSize: 13, marginLeft: "auto" },
  removeBtn: { padding: 4 },
  checkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 16,
  },
  summaryRow: { gap: 6 },
  discountRow: { flexDirection: "row", justifyContent: "space-between" },
  discountLabel: { fontSize: 12 },
  discountAmount: { fontSize: 12, fontWeight: "600" as const },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 12 },
  totalAmount: { fontSize: 20, fontWeight: "700" as const },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkoutText: { fontSize: 15, fontWeight: "700" as const },
});
