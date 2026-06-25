import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAddToCart,
  useGetProduct,
  useGetStorePreview,
  useListProducts,
  useListReviews,
  getStorePreviewQueryKey,
  useStartConversation,
} from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useWishlist } from "@/contexts/WishlistContext";
import { t } from "../../src/i18n";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Color swatch utilities ────────────────────────────────────────────────────
const COLOR_VALUE_MAP: Record<string, string> = {
  red: "#EF4444", blue: "#3B82F6", green: "#10B981", black: "#111111",
  white: "#F9FAFB", yellow: "#F59E0B", purple: "#8B5CF6", pink: "#EC4899",
  orange: "#F97316", gray: "#6B7280", grey: "#6B7280", brown: "#92400E",
  navy: "#1E3A8A", teal: "#14B8A6", cyan: "#06B6D4", indigo: "#6366F1",
  silver: "#C0C0C0", gold: "#D4AF37", rose: "#F43F5E", emerald: "#10B981",
  أحمر: "#EF4444", أزرق: "#3B82F6", أخضر: "#10B981", أسود: "#111111",
  أبيض: "#F9FAFB", أصفر: "#F59E0B", بنفسجي: "#8B5CF6", وردي: "#EC4899",
  برتقالي: "#F97316", رمادي: "#6B7280", بني: "#92400E", كحلي: "#1E3A8A",
};

function getColorSwatch(value: string): string | null {
  const lower = value.toLowerCase().trim();
  if (COLOR_VALUE_MAP[lower]) return COLOR_VALUE_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_VALUE_MAP)) {
    if (lower.startsWith(key) || lower === key) return hex;
  }
  return null;
}

const COLOR_GROUP_NAMES = new Set(["color", "colour", "colors", "اللون", "لون", "الألوان"]);
function isColorGroup(name: string): boolean {
  return COLOR_GROUP_NAMES.has(name.toLowerCase().trim());
}

function StarRow({ rating, count, size = 13 }: { rating: number; count?: number; size?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < full ? "star" : i === full && half ? "star-half" : "star-outline"}
          size={size}
          color="#F59E0B"
        />
      ))}
      {count != null && <Text style={{ fontSize: 11, color: "#6B7280", marginStart: 4 }}>({count})</Text>}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isCustomer, isAuthenticated } = useAuth();
  const { isInWishlist, toggle: wishlistToggle, isToggling: isWishlistToggling } = useWishlist();
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current);
    };
  }, []);
  const [footerHeight, setFooterHeight] = useState(82);
  const [messagingPending, setMessagingPending] = useState(false);

  const { data: product, isLoading } = useGetProduct(Number(id));
  const addToCart = useAddToCart();
  const startConv = useStartConversation();

  const sellerId = product?.sellerId ?? 0;
  const { data: storePreview } = useGetStorePreview(sellerId, {
    query: { enabled: !!product && sellerId > 0, queryKey: getStorePreviewQueryKey(sellerId) },
  });

  const { data: reviews } = useListReviews(Number(id), {
    query: { enabled: !!product } as any,
  });

  const { data: relatedProducts } = useListProducts(
    { category: product?.category, limit: 6 } as any,
    { query: { enabled: !!product?.category } as any }
  );

  const filteredRelated = useMemo(
    () => (relatedProducts ?? []).filter((p: any) => p.id !== Number(id)).slice(0, 5),
    [relatedProducts, id]
  );

  const specsFromDescription = useMemo(() => {
    if (!product?.description) return [];
    const specs: Array<{ key: string; value: string }> = [];
    for (const line of product.description.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && colonIdx < line.length - 1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (key.length >= 2 && key.length <= 30 && val.length >= 1 && val.length <= 120) {
          specs.push({ key, value: val });
        }
      }
    }
    return specs;
  }, [product?.description]);

  useEffect(() => {
    if (!product?.id) return;
    const STORAGE_KEY = "syano_recently_viewed";
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const ids: number[] = raw ? (JSON.parse(raw) as number[]) : [];
        const next = [product.id, ...ids.filter((i) => i !== product.id)].slice(0, 10);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      })
      .catch(() => {});
  }, [product?.id]);

  // Build image gallery (main image + variant images)
  const galleryImages = useMemo(() => {
    const imgs: string[] = [];
    if (product?.imageUrl) imgs.push(product.imageUrl);
    if ((product as any)?.imageUrls?.length) {
      for (const u of (product as any).imageUrls) {
        if (u && !imgs.includes(u)) imgs.push(u);
      }
    }
    return imgs.length > 0 ? imgs : [];
  }, [product]);

  const onViewableChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveImageIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  // ── Variant derived state ─────────────────────────────────────────────────
  const hasVariants = (product?.variantGroups?.length ?? 0) > 0;

  const resolvedVariant = useMemo(() => {
    if (!product || !hasVariants || !product.variants?.length) return null;
    const numGroups = product.variantGroups!.length;
    if (Object.keys(selectedOptions).length < numGroups) return null;
    const selectedOptionIds = new Set(Object.values(selectedOptions));
    return (
      (product.variants as any[]).find(
        (v: any) =>
          v.options.length === numGroups &&
          v.options.every((o: any) => selectedOptionIds.has(o.optionId))
      ) ?? null
    );
  }, [selectedOptions, product, hasVariants]);

  const needsVariantSelection =
    hasVariants && Object.keys(selectedOptions).length < (product?.variantGroups?.length ?? 0);

  function isOptionAvailable(groupId: number, optionId: number): boolean {
    if (!product?.variants?.length) return true;
    const test = { ...selectedOptions, [groupId]: optionId };
    const testIds = new Set(Object.values(test));
    return (product.variants as any[]).some(
      (v: any) =>
        v.active &&
        v.stock > 0 &&
        v.options.some((o: any) => o.optionId === optionId) &&
        (Object.keys(test).length < (product.variantGroups?.length ?? 0) ||
          (v.options.length === (product.variantGroups?.length ?? 0) &&
            v.options.every((o: any) => testIds.has(o.optionId))))
    );
  }

  // ── Effective price / stock / image ─────────────────────────────────────
  const effectivePrice = (() => {
    if (hasVariants && resolvedVariant) {
      const v = resolvedVariant as any;
      if (v.price != null) return parseFloat(v.price);
      return product?.finalPrice ?? 0;
    }
    return product?.finalPrice ?? 0;
  })();

  const effectiveCompareAt = (() => {
    if (hasVariants && resolvedVariant) {
      const v = resolvedVariant as any;
      if (v.compareAtPrice != null) return parseFloat(v.compareAtPrice);
      if (v.price != null) return null;
    }
    if ((product?.discountPercent ?? 0) > 0) return product?.price ?? null;
    return null;
  })();

  const effectiveStock = hasVariants
    ? ((resolvedVariant as any)?.stock ?? 0)
    : (product?.stock ?? 0);

  const isOutOfStock = hasVariants
    ? (!resolvedVariant || (resolvedVariant as any).stock === 0 || !(resolvedVariant as any).active)
    : (product?.stock ?? 0) === 0;

  const isLowStock = !isOutOfStock && effectiveStock > 0 && effectiveStock <= 5;

  const hasDiscount = effectiveCompareAt != null && effectiveCompareAt > effectivePrice;

  function handleSelectOption(groupId: number, optionId: number) {
    void Haptics.selectionAsync();
    setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }));
    setQuantity(1);
  }

  function handleAddToCart() {
    if (!product) return;
    if (needsVariantSelection || isOutOfStock) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart.mutate(
      {
        data: {
          productId: product.id,
          quantity,
          ...(resolvedVariant ? { variantId: (resolvedVariant as any).id } : {}),
        } as any,
      },
      {
        onSuccess: () => {
          setAddedFeedback(true);
          if (feedbackTimerRef.current !== null) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => setAddedFeedback(false), 2000);
        },
      }
    );
  }

  function handleMessageSeller() {
    if (!product || !isAuthenticated) {
      router.push("/(auth)/login");
      return;
    }
    setMessagingPending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startConv.mutate(
      { sellerId: product.sellerId, productId: product.id },
      {
        onSuccess: () => {
          setMessagingPending(false);
          router.push("/(tabs)/messages");
        },
        onError: () => {
          setMessagingPending(false);
          router.push("/(tabs)/messages");
        },
      }
    );
  }

  function handleBuyNow() {
    if (!product || needsVariantSelection || isOutOfStock) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToCart.mutate(
      {
        data: {
          productId: product.id,
          quantity,
          ...(resolvedVariant ? { variantId: (resolvedVariant as any).id } : {}),
        } as any,
      },
      {
        onSuccess: () => {
          router.push("/(tabs)/cart" as any);
        },
      }
    );
  }

  function handleFooterLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setFooterHeight(h);
  }

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const wishlisted = isInWishlist(Number(id));
  const wishlistToggling = isWishlistToggling(Number(id));

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.destructive }]}>Product not found</Text>
      </View>
    );
  }

  const showFooter = isCustomer && !isOutOfStock && !needsVariantSelection;
  const scrollBottomPad = showFooter ? footerHeight + bottomPad + 8 : bottomPad + 16;

  const sellerVerifLevel = (storePreview as any)?.verificationLevel ?? "none";
  const sellerIsVerified = (storePreview as any)?.isVerified ?? false;
  const sellerTrustScore = (storePreview as any)?.trustScore ?? null;

  const trustColor =
    sellerVerifLevel === "business" ? "#8B5CF6" :
    sellerVerifLevel === "verified" ? "#10B981" :
    (sellerVerifLevel === "basic" || sellerIsVerified) ? "#3B82F6" :
    colors.mutedForeground;

  const trustIcon =
    sellerVerifLevel === "business" ? "ribbon" :
    sellerVerifLevel === "verified" ? "shield-checkmark" :
    (sellerVerifLevel === "basic" || sellerIsVerified) ? "shield-outline" :
    "person-outline";

  const trustLabel =
    sellerVerifLevel === "business" ? t("trust.level_business", "Business Verified") :
    sellerVerifLevel === "verified" ? t("trust.level_verified", "ID Verified") :
    (sellerVerifLevel === "basic" || sellerIsVerified) ? t("trust.level_basic", "Verified Seller") :
    null;

  const avgRating = reviews?.length
    ? reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back button */}
      <Pressable
        style={({ pressed }) => [
          styles.backBtn,
          { top: topPad + 8, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={20} color={colors.foreground} />
      </Pressable>

      {/* Wishlist heart top-right */}
      <Pressable
        style={[styles.wishlistBtn, { top: topPad + 8, backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          void wishlistToggle(Number(id));
        }}
        disabled={wishlistToggling}
      >
        <Ionicons
          name={wishlisted ? "heart" : "heart-outline"}
          size={20}
          color={wishlisted ? "#EF4444" : colors.foreground}
        />
      </Pressable>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Image Gallery ─────────────────────────────────────── */}
        {galleryImages.length > 1 ? (
          <View style={styles.galleryContainer}>
            <FlatList
              data={galleryImages}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableChanged}
              viewabilityConfig={viewabilityConfig.current}
              renderItem={({ item }) => (
                <View style={[styles.gallerySlide, { backgroundColor: colors.muted }]}>
                  <Image source={{ uri: item }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
              )}
            />
            {/* Dot indicators */}
            <View style={styles.dotRow}>
              {galleryImages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === activeImageIndex ? colors.primary : colors.mutedForeground,
                      width: i === activeImageIndex ? 18 : 6,
                    },
                  ]}
                />
              ))}
            </View>
            {hasDiscount && (
              <View style={[styles.discountBadge, { backgroundColor: "#EF4444" }]}>
                <Text style={styles.discountText}>
                  -{product.discountPercent ?? Math.round((1 - effectivePrice / (effectiveCompareAt ?? effectivePrice)) * 100)}%
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.heroImage, { backgroundColor: colors.muted }]}>
            {galleryImages[0] ? (
              <Image source={{ uri: galleryImages[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name="cube-outline" size={80} color={colors.mutedForeground} />
            )}
            {hasDiscount && (
              <View style={[styles.discountBadge, { backgroundColor: "#EF4444" }]}>
                <Text style={styles.discountText}>
                  -{product.discountPercent ?? Math.round((1 - effectivePrice / (effectiveCompareAt ?? effectivePrice)) * 100)}%
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.details}>
          {/* Category + stock */}
          <View style={styles.metaRow}>
            <Text style={[styles.category, { color: colors.primary }]}>{product.category}</Text>
            {!needsVariantSelection && (
              <View style={[styles.stockBadge, { backgroundColor: isOutOfStock ? "#FEE2E2" : colors.accent }]}>
                <Text style={[styles.stockText, { color: isOutOfStock ? "#EF4444" : colors.accentForeground }]}>
                  {isOutOfStock ? t("product.out_of_stock") : t("product.in_stock", { count: String(effectiveStock) })}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text>

          {/* Rating summary */}
          {avgRating != null && reviews && reviews.length > 0 && (
            <View style={styles.ratingRow}>
              <StarRow rating={avgRating} count={reviews.length} />
            </View>
          )}

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.foreground }]}>${effectivePrice.toFixed(2)}</Text>
            {hasDiscount && effectiveCompareAt != null && (
              <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>${effectiveCompareAt.toFixed(2)}</Text>
            )}
          </View>

          {/* ── Variant Selector ─────────────────────────────────── */}
          {hasVariants && (product.variantGroups ?? []).length > 0 && (
            <View style={styles.variantSection}>
              {(product.variantGroups as any[]).map((group: any) => {
                const selectedOptionId = selectedOptions[group.id];
                const selectedOpt = group.options.find((o: any) => o.id === selectedOptionId);
                const colorGroup = isColorGroup(group.name);
                return (
                  <View key={group.id} style={styles.variantGroup}>
                    <View style={styles.variantLabelRow}>
                      <Text style={[styles.variantGroupLabel, { color: colors.mutedForeground }]}>{group.name}:</Text>
                      {selectedOpt ? (
                        <Text style={[styles.variantGroupValue, { color: colors.foreground }]}>{selectedOpt.value}</Text>
                      ) : (
                        <Text style={[styles.variantGroupHint, { color: colors.mutedForeground }]}>
                          {t("product.choose_option", { group: group.name })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.optionRow}>
                      {group.options.map((option: any) => {
                        const isSelected = selectedOptionId === option.id;
                        const available = isOptionAvailable(group.id, option.id);
                        const swatch = colorGroup ? getColorSwatch(option.value) : null;
                        if (swatch) {
                          const isWhite = swatch === "#F9FAFB";
                          return (
                            <Pressable
                              key={option.id}
                              onPress={() => available && handleSelectOption(group.id, option.id)}
                              style={({ pressed }) => [
                                styles.colorSwatch,
                                { borderColor: isSelected ? colors.primary : "transparent", opacity: available ? (pressed ? 0.75 : 1) : 0.3, transform: [{ scale: isSelected ? 1.12 : 1 }] },
                              ]}
                            >
                              <View style={[styles.colorSwatchInner, { backgroundColor: swatch, borderWidth: isWhite ? 1 : 0, borderColor: colors.border }]} />
                              {isSelected && (
                                <View style={styles.swatchCheck}>
                                  <Ionicons name="checkmark" size={12} color={isWhite ? "#374151" : "white"} />
                                </View>
                              )}
                              {!available && (
                                <View style={[StyleSheet.absoluteFill, styles.swatchUnavailable]}>
                                  <View style={[styles.swatchDiagonal, { backgroundColor: colors.mutedForeground }]} />
                                </View>
                              )}
                            </Pressable>
                          );
                        }
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => available && handleSelectOption(group.id, option.id)}
                            style={({ pressed }) => [
                              styles.optionChip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.card,
                                borderColor: isSelected ? colors.primary : colors.border,
                                opacity: available ? (pressed ? 0.75 : 1) : 0.35,
                              },
                            ]}
                          >
                            <Text style={[styles.optionChipText, { color: isSelected ? colors.primaryForeground : colors.foreground, textDecorationLine: available ? "none" : "line-through" }]}>
                              {option.value}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              {needsVariantSelection && (
                <View style={[styles.selectNudge, { backgroundColor: colors.accent }]}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                  <Text style={[styles.selectNudgeText, { color: colors.primary }]}>{t("product.select_options")}</Text>
                </View>
              )}
            </View>
          )}

          {/* Out of stock */}
          {isOutOfStock && !needsVariantSelection && (
            <View style={[styles.outOfStockBanner, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.outOfStockText, { color: "#EF4444" }]}>{t("product.out_of_stock")}</Text>
            </View>
          )}
          {/* Low stock warning */}
          {isLowStock && (
            <View style={[styles.outOfStockBanner, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
              <Text style={[styles.outOfStockText, { color: "#D97706" }]}>
                {t("product.low_stock", { count: String(effectiveStock) })}
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={[styles.descriptionLabel, { color: colors.foreground }]}>{t("product.about")}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{product.description}</Text>

          {/* Specs table */}
          {specsFromDescription.length >= 2 && (
            <View style={styles.specsSection}>
              <Text style={[styles.descriptionLabel, { color: colors.foreground }]}>{t("product.specs")}</Text>
              <View style={[styles.specsTable, { borderColor: colors.border }]}>
                {specsFromDescription.map((spec, i) => (
                  <View
                    key={i}
                    style={[
                      styles.specRow,
                      { borderBottomColor: colors.border, borderBottomWidth: i < specsFromDescription.length - 1 ? 1 : 0 },
                    ]}
                  >
                    <Text style={[styles.specKey, { color: colors.mutedForeground }]}>{spec.key}</Text>
                    <Text style={[styles.specValue, { color: colors.foreground }]}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Seller Card ────────────────────────────────────── */}
          <View style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sellerCardTop}>
              <View style={[styles.sellerAvatar, { backgroundColor: colors.muted }]}>
                {storePreview?.storeLogo ? (
                  <Image source={{ uri: storePreview.storeLogo }} style={styles.sellerLogoImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="storefront-outline" size={22} color={colors.mutedForeground} />
                )}
              </View>
              <View style={styles.sellerCardMeta}>
                <Text style={[styles.sellerCardName, { color: colors.foreground }]} numberOfLines={1}>
                  {storePreview?.storeName ?? product.sellerName}
                </Text>
                {trustLabel && (
                  <View style={styles.trustRow}>
                    <Ionicons name={trustIcon as any} size={13} color={trustColor} />
                    <Text style={[styles.trustLabel, { color: trustColor }]}>{trustLabel}</Text>
                    {sellerTrustScore != null && (
                      <Text style={[styles.trustLabel, { color: colors.mutedForeground, marginStart: 4 }]}>{sellerTrustScore}/100</Text>
                    )}
                  </View>
                )}
                {storePreview?.averageRating != null && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
                      {storePreview.averageRating.toFixed(1)} {t("product.reviews_count", { count: String(storePreview.reviewCount) })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.sellerActions}>
              {isCustomer && (
                <Pressable
                  style={({ pressed }) => [styles.msgBtn, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleMessageSeller}
                  disabled={messagingPending}
                >
                  {messagingPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                  )}
                  <Text style={[styles.msgBtnText, { color: colors.primary }]}>
                    {messagingPending ? t("product.opening") : t("product.message_seller")}
                  </Text>
                </Pressable>
              )}
              {storePreview?.storeSlug && (
                <Pressable
                  style={({ pressed }) => [styles.storeBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => router.push(`/store/${storePreview!.storeSlug}` as any)}
                >
                  <Ionicons name="storefront-outline" size={16} color={colors.primary} />
                  <Text style={[styles.storeBtnText, { color: colors.primary }]}>{t("product.view_store")}</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Reviews ──────────────────────────────────────────── */}
          {reviews && reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <View style={styles.reviewsHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {t("product.reviews", "Reviews")} ({reviews.length})
                </Text>
                {avgRating != null && <StarRow rating={avgRating} size={14} />}
              </View>
              {reviews.slice(0, 5).map((review: any, i: number) => (
                <View
                  key={review.id ?? i}
                  style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.reviewTop}>
                    <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
                        {(review.userName ?? review.userId ?? "?").toString().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.reviewMeta}>
                      <Text style={[styles.reviewName, { color: colors.foreground }]}>
                        {review.userName ?? `User ${review.userId}`}
                      </Text>
                      <StarRow rating={review.rating ?? 0} size={11} />
                    </View>
                    <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : ""}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* ── Related Products ─────────────────────────────────── */}
          {filteredRelated.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t("product.related", "Related Products")}
              </Text>
              <FlatList
                data={filteredRelated}
                keyExtractor={(item) => String(item.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingEnd: 4 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/product/${item.id}` as any)}
                  >
                    <View style={[styles.relatedImage, { backgroundColor: colors.muted }]}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <Ionicons name="cube-outline" size={28} color={colors.mutedForeground} />
                      )}
                    </View>
                    <View style={styles.relatedInfo}>
                      <Text style={[styles.relatedName, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[styles.relatedPrice, { color: colors.primary }]}>${item.finalPrice.toFixed(2)}</Text>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer: Add to Cart + Buy Now */}
      {showFooter && (
        <View
          onLayout={handleFooterLayout}
          style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 8 }]}
        >
          <View style={styles.qtyControl}>
            <Pressable style={[styles.qtyBtn, { borderColor: colors.border }]} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Ionicons name="remove" size={18} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.qtyText, { color: colors.foreground }]}>{quantity}</Text>
            <Pressable style={[styles.qtyBtn, { borderColor: colors.border }]} onPress={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}>
              <Ionicons name="add" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <Pressable
            testID="add-to-cart-detail-btn"
            style={({ pressed }) => [
              styles.addToCartBtn,
              { backgroundColor: addedFeedback ? "#10B981" : colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleAddToCart}
            disabled={addToCart.isPending}
          >
            {addToCart.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons name={addedFeedback ? "checkmark" : "cart-outline"} size={20} color={colors.primaryForeground} />
                <Text style={[styles.addToCartText, { color: colors.primaryForeground }]}>
                  {addedFeedback
                    ? t("product.added")
                    : t("product.add_to_cart", { price: (effectivePrice * quantity).toFixed(2) })}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.buyNowBtn,
              { borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleBuyNow}
            disabled={addToCart.isPending}
          >
            <Text style={[styles.buyNowText, { color: colors.primary }]}>{t("product.buy_now")}</Text>
          </Pressable>
        </View>
      )}

      {/* Select options nudge footer */}
      {isCustomer && needsVariantSelection && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 8 }]}>
          <View style={[styles.selectNudgeFooter, { backgroundColor: colors.accent, flex: 1 }]}>
            <Ionicons name="options-outline" size={18} color={colors.primary} />
            <Text style={[styles.selectNudgeFooterText, { color: colors.primary }]}>{t("product.select_options")}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  errorText: { fontSize: 16 },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  wishlistBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  // Gallery
  galleryContainer: { width: "100%", aspectRatio: 4 / 3, position: "relative" },
  gallerySlide: { width: SCREEN_W, aspectRatio: 4 / 3 },
  dotRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  heroImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discountBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountText: { fontSize: 14, fontWeight: "700" as const, color: "#fff" },
  details: { padding: 20, gap: 8 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  category: { fontSize: 13, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  stockBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  stockText: { fontSize: 12, fontWeight: "500" as const },
  name: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 },
  price: { fontSize: 28, fontWeight: "700" as const },
  originalPrice: { fontSize: 16, textDecorationLine: "line-through" },

  // Variants
  variantSection: { marginTop: 8, gap: 16 },
  variantGroup: { gap: 10 },
  variantLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  variantGroupLabel: { fontSize: 13, fontWeight: "600" as const },
  variantGroupValue: { fontSize: 13, fontWeight: "700" as const },
  variantGroupHint: { fontSize: 12, fontStyle: "italic" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  optionChipText: { fontSize: 13, fontWeight: "600" as const },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: "center", justifyContent: "center", overflow: "visible" },
  colorSwatchInner: { position: "absolute", inset: 2, top: 2, left: 2, right: 2, bottom: 2, borderRadius: 14 },
  swatchCheck: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", zIndex: 2 },
  swatchUnavailable: { borderRadius: 18, alignItems: "center", justifyContent: "center", zIndex: 3, backgroundColor: "transparent" },
  swatchDiagonal: { width: "100%", height: 1.5, transform: [{ rotate: "45deg" }], opacity: 0.6 },
  selectNudge: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, marginTop: 4 },
  selectNudgeText: { fontSize: 13, fontWeight: "500" as const, flex: 1 },
  outOfStockBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginTop: 4 },
  outOfStockText: { fontSize: 14, fontWeight: "600" as const },

  descriptionLabel: { fontSize: 15, fontWeight: "700" as const, marginTop: 8 },
  description: { fontSize: 14, lineHeight: 22 },

  sellerCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginTop: 8 },
  sellerCardTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  sellerAvatar: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  sellerLogoImg: { width: 48, height: 48 },
  sellerCardMeta: { flex: 1, gap: 3 },
  sellerCardName: { fontSize: 15, fontWeight: "700" as const },
  trustRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  trustLabel: { fontSize: 12, fontWeight: "500" as const },
  sellerActions: { flexDirection: "row", gap: 8 },
  msgBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5 },
  msgBtnText: { fontSize: 14, fontWeight: "600" as const },
  storeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10 },
  storeBtnText: { fontSize: 14, fontWeight: "600" as const },

  // Reviews
  reviewsSection: { marginTop: 16, gap: 10 },
  reviewsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "700" as const },
  reviewCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 15, fontWeight: "800" as const },
  reviewMeta: { flex: 1, gap: 2 },
  reviewName: { fontSize: 13, fontWeight: "600" as const },
  reviewDate: { fontSize: 11 },
  reviewComment: { fontSize: 13, lineHeight: 18 },

  // Related
  relatedSection: { marginTop: 16, gap: 12 },
  relatedCard: { width: 130, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  relatedImage: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  relatedInfo: { padding: 8, gap: 3 },
  relatedName: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
  relatedPrice: { fontSize: 13, fontWeight: "700" as const },

  // Footer
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderTopWidth: 1 },
  qtyControl: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyText: { fontSize: 17, fontWeight: "700" as const, minWidth: 24, textAlign: "center" },
  addToCartBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14 },
  addToCartText: { fontSize: 14, fontWeight: "700" as const },
  buyNowBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 14, height: 50, borderRadius: 14, borderWidth: 1.5 },
  buyNowText: { fontSize: 13, fontWeight: "700" as const },
  specsSection: { marginTop: 8, gap: 8 },
  specsTable: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  specKey: { fontSize: 13, flex: 1 },
  specValue: { fontSize: 13, fontWeight: "600" as const, flex: 1, textAlign: "right" },
  selectNudgeFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14, paddingHorizontal: 16 },
  selectNudgeFooterText: { fontSize: 14, fontWeight: "600" as const },
});
