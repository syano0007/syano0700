import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  useGetFollowStatus,
  useFollowStore,
  useUnfollowStore,
  getFollowStatusQueryKey,
  getBaseUrl,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

interface StoreData {
  sellerId: number;
  storeName: string;
  storeSlug: string;
  storeDescription: string | null;
  storeLogo: string | null;
  storeBanner: string | null;
  sellerName: string;
  trustLevel: string;
  trustScore: number | null;
  verificationLevel: "none" | "basic" | "verified" | "business";
  isVerified?: boolean;
  verifiedAt?: string | null;
  memberSince: string;
  totalProducts: number;
  totalOrders: number;
  followerCount: number;
  orderCompletionRate: number;
  avgRating: number | null;
  reviewCount: number;
}

interface StoreProduct {
  id: number;
  name: string;
  nameAr?: string;
  price: number;
  compareAtPrice?: number;
  imageUrls?: string[];
  imageUrl?: string;
  category: string;
}

function VerificationBadge({ level }: { level: string }) {
  if (!level || level === "none") return null;
  const configs = {
    basic:    { label: t("trust.level_basic"),    bg: "#EFF6FF", text: "#2563EB", icon: "shield-outline" as const },
    verified: { label: t("trust.level_verified"),  bg: "#ECFDF5", text: "#059669", icon: "shield-checkmark-outline" as const },
    business: { label: t("trust.level_business"),  bg: "#F5F3FF", text: "#7C3AED", icon: "ribbon-outline" as const },
  };
  const cfg = configs[level as keyof typeof configs];
  if (!cfg) return null;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.text} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function TrustBar({ score }: { score: number }) {
  const band =
    score >= 75 ? "#10B981" :
    score >= 50 ? "#3B82F6" :
    score >= 25 ? "#F59E0B" :
    "#9CA3AF";
  return (
    <View style={styles.trustBarContainer}>
      <View style={styles.trustBarTrack}>
        <View style={[styles.trustBarFill, { width: `${score}%` as any, backgroundColor: band }]} />
      </View>
      <Text style={styles.trustBarLabel}>{score}/100</Text>
    </View>
  );
}

function StoreProductCard({ product, colors, onPress }: { product: StoreProduct; colors: any; onPress: () => void }) {
  const imageUri = product.imageUrls?.[0] ?? product.imageUrl ?? null;
  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;
  return (
    <Pressable style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
      <View style={[styles.productImageWrapper, { backgroundColor: colors.muted }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={32} color={colors.mutedForeground} />
        )}
        {discount != null && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={2}>{product.name}</Text>
        <Text style={[styles.productPrice, { color: colors.foreground }]}>${product.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
}

function FollowButton({ sellerId, colors }: { sellerId: number; colors: any }) {
  const { isAuthenticated, isCustomer } = useAuth();
  const { data: followStatus, isLoading: statusLoading } = useGetFollowStatus(sellerId, {
    query: {
      enabled: isAuthenticated && isCustomer && sellerId > 0,
      queryKey: getFollowStatusQueryKey(sellerId),
    },
  });
  const followMutation = useFollowStore();
  const unfollowMutation = useUnfollowStore();

  const isFollowing = followStatus?.following ?? false;
  const isPending = followMutation.isPending || unfollowMutation.isPending || statusLoading;

  if (!isAuthenticated || !isCustomer || sellerId <= 0) return null;

  function handlePress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFollowing) {
      unfollowMutation.mutate(sellerId);
    } else {
      followMutation.mutate(sellerId);
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.followBtn,
        {
          backgroundColor: isFollowing ? colors.muted : colors.primary,
          borderColor: isFollowing ? colors.border : colors.primary,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={handlePress}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={isFollowing ? colors.foreground : "#fff"} />
      ) : (
        <>
          <Ionicons
            name={isFollowing ? "person-remove-outline" : "person-add-outline"}
            size={15}
            color={isFollowing ? colors.foreground : "#fff"}
          />
          <Text style={[styles.followBtnText, { color: isFollowing ? colors.foreground : "#fff" }]}>
            {isFollowing ? t("store.unfollow", "Unfollow") : t("store.follow", "Follow")}
          </Text>
        </>
      )}
    </Pressable>
  );
}

interface StoreReview {
  id: number;
  customerId: number;
  customerName?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  sellerReply?: string | null;
}

function ReviewCard({ review, colors }: { review: StoreReview; colors: any }) {
  const initial = (review.customerName ?? "?").charAt(0).toUpperCase();
  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.reviewTop}>
        <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>{initial}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={[styles.reviewName, { color: colors.foreground }]}>{review.customerName ?? "Customer"}</Text>
          <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons key={i} name={i < review.rating ? "star" : "star-outline"} size={11} color="#F59E0B" />
            ))}
          </View>
        </View>
        <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
          {new Date(review.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
      </View>
      {review.comment ? (
        <Text style={[styles.reviewComment, { color: colors.mutedForeground }]}>{review.comment}</Text>
      ) : null}
      {review.sellerReply ? (
        <View style={[styles.replyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="storefront-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.replyText, { color: colors.mutedForeground }]}>{review.sellerReply}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tabBarHeight } = useScreenLayout();
  const [tab, setTab] = useState<"products" | "about" | "reviews">("products");

  const { data: storeData, isLoading: storeLoading } = useQuery<StoreData>({
    queryKey: ["store-by-slug", slug],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/sellers/store/${slug}`);
      if (!res.ok) throw new Error("Store not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: productsData } = useQuery<{ data: StoreProduct[] } | StoreProduct[]>({
    queryKey: ["store-products", storeData?.sellerId],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/products?sellerId=${storeData!.sellerId}&limit=100`);
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    enabled: !!storeData?.sellerId,
  });

  const { data: reviewsData } = useQuery<{ reviews: StoreReview[] }>({
    queryKey: ["store-reviews-slug", slug],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/sellers/store/${slug}/reviews`);
      if (!res.ok) return { reviews: [] };
      return res.json();
    },
    enabled: !!slug && tab === "reviews",
  });

  const products: StoreProduct[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.data ?? [];

  const reviews: StoreReview[] = reviewsData?.reviews ?? [];

  if (storeLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!storeData) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Store not found</Text>
      </View>
    );
  }

  const level = storeData.verificationLevel ?? "none";
  const trustScore = storeData.trustScore;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back button */}
      <View style={[styles.backRow, { paddingTop: insets.top + 8, backgroundColor: "transparent" }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: "rgba(0,0,0,0.25)" }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.bannerWrapper, { backgroundColor: colors.muted }]}>
          {storeData.storeBanner ? (
            <Image source={{ uri: storeData.storeBanner }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View style={[styles.banner, { backgroundColor: colors.primary + "33" }]} />
          )}
        </View>

        {/* Store header */}
        <View style={[styles.headerCard, { backgroundColor: colors.background }]}>
          {/* Logo + actions row */}
          <View style={styles.logoActionsRow}>
            <View style={[styles.logoWrapper, { backgroundColor: colors.primary + "18", borderColor: colors.background }]}>
              {storeData.storeLogo ? (
                <Image source={{ uri: storeData.storeLogo }} style={styles.logo} resizeMode="cover" />
              ) : (
                <Text style={[styles.logoInitial, { color: colors.primary }]}>
                  {storeData.storeName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <FollowButton sellerId={storeData.sellerId} colors={colors} />
          </View>

          {/* Name + badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.storeName, { color: colors.foreground }]}>{storeData.storeName}</Text>
            {level !== "none" && <VerificationBadge level={level} />}
          </View>
          <Text style={[styles.sellerName, { color: colors.mutedForeground }]}>{storeData.sellerName}</Text>

          {/* Rating */}
          {storeData.avgRating != null && storeData.reviewCount > 0 && (
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < Math.round(storeData.avgRating!) ? "star" : "star-outline"}
                  size={13}
                  color="#F59E0B"
                />
              ))}
              <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
                {storeData.avgRating.toFixed(1)} ({storeData.reviewCount})
              </Text>
            </View>
          )}

          {/* Trust score bar */}
          {trustScore != null && (
            <View style={styles.trustSection}>
              <Text style={[styles.trustLabel, { color: colors.mutedForeground }]}>{t("trust.trust_score")}</Text>
              <TrustBar score={trustScore} />
            </View>
          )}

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            {[
              { label: t("store.followers", "Followers"), value: storeData.followerCount ?? 0 },
              { label: t("store.products", "Products"), value: storeData.totalProducts ?? 0 },
              { label: t("store.completion", "Completion"), value: `${storeData.orderCompletionRate ?? 0}%` },
            ].map(({ label, value }) => (
              <View key={label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(["products", "reviews", "about"] as const).map((tabKey) => (
            <Pressable
              key={tabKey}
              style={[styles.tabBtn, tab === tabKey && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(tabKey)}
            >
              <Text style={[styles.tabLabel, { color: tab === tabKey ? colors.primary : colors.mutedForeground }]}>
                {tabKey === "products" ? t("store.tab_products", "Products")
                  : tabKey === "reviews" ? t("store.tab_reviews", "Reviews")
                  : t("store.tab_about", "About")}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "products" ? (
          products.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("store.no_products", "No products yet")}
              </Text>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {products.map((product) => (
                <StoreProductCard
                  key={product.id}
                  product={product}
                  colors={colors}
                  onPress={() => router.push(`/product/${product.id}` as any)}
                />
              ))}
            </View>
          )
        ) : tab === "reviews" ? (
          reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {t("store.no_reviews", "No reviews yet")}
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} colors={colors} />
              ))}
            </View>
          )
        ) : (
          <View style={styles.aboutSection}>
            {storeData.storeDescription ? (
              <Text style={[styles.aboutText, { color: colors.foreground }]}>{storeData.storeDescription}</Text>
            ) : (
              <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
                {t("store.no_description", "No description provided.")}
              </Text>
            )}
            <View style={[styles.aboutInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: t("store.member_since", "Member since"), value: new Date(storeData.memberSince).getFullYear().toString() },
                ...(storeData.verifiedAt ? [{ label: t("store.verified_since", "Verified since"), value: new Date(storeData.verifiedAt ?? "").getFullYear().toString() }] : []),
              ].map(({ label, value }) => (
                <View key={label} style={[styles.aboutRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.aboutRowLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.aboutRowValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  loading:         { flex: 1, alignItems: "center", justifyContent: "center" },
  backRow:         { position: "absolute", top: 0, start: 0, end: 0, zIndex: 10, paddingHorizontal: 16, paddingBottom: 8 },
  backBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bannerWrapper:   { height: 160, overflow: "hidden" },
  banner:          { width: "100%", height: 160 },
  headerCard:      { paddingHorizontal: 16, paddingBottom: 16, marginTop: -24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  logoActionsRow:  { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 },
  logoWrapper:     { width: 72, height: 72, borderRadius: 20, borderWidth: 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo:            { width: "100%", height: "100%" },
  logoInitial:     { fontSize: 28, fontWeight: "900" as const },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  followBtnText:   { fontSize: 13, fontWeight: "700" as const },
  nameRow:         { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  storeName:       { fontSize: 20, fontWeight: "900" as const },
  sellerName:      { fontSize: 13, marginTop: 2 },
  ratingRow:       { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  ratingText:      { fontSize: 12, marginStart: 4 },
  badge:           { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:       { fontSize: 11, fontWeight: "700" as const },
  trustSection:    { marginTop: 12 },
  trustLabel:      { fontSize: 11, fontWeight: "600" as const, marginBottom: 4 },
  trustBarContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  trustBarTrack:   { flex: 1, height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  trustBarFill:    { height: "100%", borderRadius: 3 },
  trustBarLabel:   { fontSize: 11, fontWeight: "700" as const, color: "#6B7280", width: 36, textAlign: "right" },
  statsRow:        { flexDirection: "row", justifyContent: "space-around", paddingTop: 16, marginTop: 16, borderTopWidth: 1 },
  statItem:        { alignItems: "center" },
  statValue:       { fontSize: 18, fontWeight: "900" as const },
  statLabel:       { fontSize: 11, marginTop: 2 },
  tabs:            { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginTop: 8 },
  tabBtn:          { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabLabel:        { fontSize: 14, fontWeight: "700" as const },
  productsGrid:    { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 8, gap: 0 },
  productCard:     { width: "50%", padding: 6 },
  productImageWrapper: { height: 140, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 },
  productImage:    { width: "100%", height: "100%" },
  discountBadge:   { position: "absolute", top: 6, end: 6, backgroundColor: "#EF4444", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountText:    { color: "#fff", fontSize: 10, fontWeight: "700" as const },
  productInfo:     { paddingHorizontal: 2 },
  productName:     { fontSize: 12, fontWeight: "600" as const, marginBottom: 4, lineHeight: 16 },
  productPrice:    { fontSize: 14, fontWeight: "900" as const },
  emptyState:      { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:       { fontSize: 14 },
  aboutSection:    { padding: 16 },
  aboutText:       { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  aboutInfo:       { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  aboutRow:        { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  aboutRowLabel:   { fontSize: 13 },
  aboutRowValue:   { fontSize: 13, fontWeight: "700" as const },
  reviewsList:     { padding: 16, gap: 12 },
  reviewCard:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  reviewTop:       { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar:    { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 15, fontWeight: "800" as const },
  reviewMeta:      { flex: 1 },
  reviewName:      { fontSize: 13, fontWeight: "600" as const },
  reviewDate:      { fontSize: 11 },
  reviewComment:   { fontSize: 13, lineHeight: 18 },
  replyBox:        { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  replyText:       { fontSize: 12, lineHeight: 16, flex: 1 },
});
