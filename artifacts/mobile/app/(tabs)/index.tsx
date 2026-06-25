import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import {
  useAddToCart,
  useGetSellerDashboard,
  useGetBestSellers,
  useListCategories,
  useListProducts,
  useGetCart,
  useGetUnreadCount,
  useGetNotificationCount,
  getBaseUrl,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";

import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../../src/i18n";
import { T } from "@/src/tokens";

interface SuggestionItem { text: string; textAr: string | null }
interface CategorySuggestion { slug: string; labelEn: string; labelAr: string }
interface MobileSuggestions { suggestions: SuggestionItem[]; categories: CategorySuggestion[] }

function recordMobileSearchClick(searchLogId: number): void {
  fetch(`${getBaseUrl()}/api/search/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ searchLogId }),
  }).catch(() => {});
}

export default function HomeScreen() {
  const { isSeller } = useAuth();
  return isSeller ? <SellerDashboard /> : <CustomerShop />;
}

type MobileSortOption = "newest" | "price_asc" | "price_desc" | "highest_rated";

const MOBILE_SORT_LABELS: Record<MobileSortOption, { en: string; ar: string }> = {
  newest:        { en: "Newest", ar: "الأحدث" },
  price_asc:     { en: "Price ↑", ar: "السعر ↑" },
  price_desc:    { en: "Price ↓", ar: "السعر ↓" },
  highest_rated: { en: "Top Rated", ar: "الأعلى تقييماً" },
};

// ─── Shared Section Header ───────────────────────────────────────────────────
interface SectionHeaderProps {
  label: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  colors: ReturnType<typeof useColors>;
}
function SectionHeader({ label, onSeeAll, seeAllLabel, colors }: SectionHeaderProps) {
  return (
    <View style={sectionStyles.row}>
      <Text style={[sectionStyles.label, { color: colors.foreground }]}>{label}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={[sectionStyles.seeAll, { color: colors.primary }]}>
            {seeAllLabel ?? t("home.categories_see_all")} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Rich Section Header (eyebrow + h2 + see-all, matches web pattern) ───────
interface RichSectionHeaderProps {
  eyebrow: string;
  title: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  colors: ReturnType<typeof useColors>;
}
function RichSectionHeader({ eyebrow, title, onSeeAll, seeAllLabel, colors }: RichSectionHeaderProps) {
  return (
    <View style={richHeaderStyles.container}>
      <Text style={[richHeaderStyles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
      <View style={richHeaderStyles.titleRow}>
        <Text style={[richHeaderStyles.title, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll}>
            <Text style={[richHeaderStyles.seeAll, { color: colors.primary }]}>
              {seeAllLabel ?? t("home.categories_see_all")} →
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Hero Banner Section (Phase 2 — Stacked layout matching web mobile) ──────
const HERO_IMAGES = [
  "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/3059609/pexels-photo-3059609.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
  "https://images.pexels.com/photos/1407305/pexels-photo-1407305.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop",
];

const HERO_FALLBACK_CARDS = [
  { name: "Tom Ford Tobacco Vanille EDP", price: 375000, img: "https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop" },
  { name: "Rolex Submariner Style Watch", price: 142000, img: "https://images.pexels.com/photos/1407305/pexels-photo-1407305.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop" },
  { name: "Floral Maxi Dress — Summer 2025", price: 65000, img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop" },
];

function HeroBannerSection({ colors, products }: { colors: ReturnType<typeof useColors>; products?: Product[] }) {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [slideIdx, setSlideIdx] = useState(0);
  const [activeCard, setActiveCard] = useState(0);

  const floatCards = useMemo(() => {
    if (products && products.length >= 3) {
      return products.slice(0, 3).map((p) => ({
        name: p.name,
        price: (p as any).finalPrice ? Number((p as any).finalPrice) : Number(p.price),
        img: ((p as any).imageUrls as string[] | undefined)?.[0] ?? HERO_FALLBACK_CARDS[0].img,
      }));
    }
    return HERO_FALLBACK_CARDS;
  }, [products]);

  useEffect(() => {
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setActiveCard((c) => (c + 1) % floatCards.length), 3200);
    return () => clearInterval(id);
  }, [floatCards.length]);

  const card = floatCards[activeCard] ?? HERO_FALLBACK_CARDS[0];

  return (
    <View style={{ backgroundColor: colors.background }}>
      {/* ── TEXT PANEL (top — web flex-col order: text first at 390px) ── */}
      <View style={heroV2.textPanel}>
        {/* Badge — emerald border + bg */}
        <View style={heroV2.badge}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={[heroV2.badgeText, { color: colors.primary }]}>{t("home.hero_badge")}</Text>
        </View>

        {/* 3-line headline — line1+2 in foreground, line3 in primary */}
        <Text style={[heroV2.headline, { textAlign: isAr ? "right" : "left" }]}>
          <Text style={{ color: colors.foreground }}>{t("home.hero_line1")}{"\n"}</Text>
          <Text style={{ color: colors.foreground }}>{t("home.hero_line2")}{"\n"}</Text>
          <Text style={{ color: colors.primary }}>{t("home.hero_line3")}</Text>
        </Text>

        {/* Subtitle */}
        <Text style={[heroV2.subtitle, { color: colors.mutedForeground, textAlign: isAr ? "right" : "left" }]}>
          {t("home.hero_subtitle")}
        </Text>

        {/* CTAs */}
        <View style={[heroV2.ctaRow, { flexDirection: isAr ? "row-reverse" : "row" }]}>
          <Pressable
            style={({ pressed }) => [heroV2.ctaPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Text style={heroV2.ctaPrimaryText}>{t("home.shop_now")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [heroV2.ctaGhost, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/store-directory" as any)}
          >
            <Text style={[heroV2.ctaGhostText, { color: colors.mutedForeground }]}>{t("home.explore_stores")}</Text>
          </Pressable>
        </View>

        {/* Stats row — foreground values, border-top matches web */}
        <View style={[heroV2.statsRow, { borderTopColor: colors.border }]}>
          {[
            { value: t("home.stats_sellers"),   label: t("home.hero_stat_stores") },
            { value: t("home.stats_products"),  label: t("home.hero_stat_products") },
            { value: t("home.stats_customers"), label: t("home.hero_stat_customers") },
          ].map((stat, i, arr) => (
            <React.Fragment key={i}>
              <View style={heroV2.statItem}>
                <Text style={[heroV2.statValue, { color: colors.foreground }]}>{stat.value}</Text>
                <Text style={[heroV2.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={[heroV2.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ── IMAGE CAROUSEL CARD (bottom — web flex-col order: image second at 390px) ── */}
      <View style={heroV2.imageCardWrap}>
        <View style={[heroV2.imageCard, { borderColor: colors.border }]}>
          <Image source={{ uri: HERO_IMAGES[slideIdx] }} style={heroV2.fillImg} resizeMode="cover" />
          <View style={[heroV2.overlay]} />

          {/* Discount badge — top start */}
          <View style={[heroV2.discBadge, isAr ? { top: 24, right: 24 } : { top: 24, left: 24 }, { backgroundColor: colors.primary }]}>
            <Text style={heroV2.discBadgeText}>{isAr ? "خصم لغاية 50%" : "Up to 50% Off"}</Text>
          </View>

          {/* Floating product card — top end */}
          <View style={[heroV2.floatCard, isAr ? { top: 24, left: 24 } : { top: 24, right: 24 }, { backgroundColor: colors.card + "D0", borderColor: colors.border }]}>
            <View style={heroV2.floatCardRow}>
              <Image source={{ uri: card.img }} style={[heroV2.floatCardImg, { borderColor: colors.border }]} resizeMode="cover" />
              <View style={heroV2.floatCardInfo}>
                <Text style={[heroV2.floatCardName, { color: colors.foreground }]} numberOfLines={2}>{card.name}</Text>
                <Text style={[heroV2.floatCardPrice, { color: colors.primary }]}>{card.price.toLocaleString()} ل.س</Text>
              </View>
            </View>
            <View style={heroV2.miniDots}>
              {floatCards.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setActiveCard(i)}
                  style={[heroV2.miniDot, { width: i === activeCard ? 16 : 5, backgroundColor: i === activeCard ? colors.primary : colors.foreground + "33" }]}
                />
              ))}
            </View>
          </View>

          {/* Carousel progress dots — bottom center */}
          <View style={heroV2.carouselDots}>
            {HERO_IMAGES.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => setSlideIdx(i)}
                style={[heroV2.carouselDot, { width: i === slideIdx ? 20 : 6, backgroundColor: i === slideIdx ? colors.primary : "rgba(255,255,255,0.4)" }]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Category Grid Section ───────────────────────────────────────────────────
const CATEGORY_DEFS = [
  { nameEn: "Electronics",          nameAr: "الإلكترونيات",    img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop&auto=format&q=80", color: "#3b82f6", slug: "Electronics",          countKey: "home.categories_count_electronics" as const },
  { nameEn: "Fashion",              nameAr: "الأزياء",          img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop&auto=format&q=80", color: "#ec4899", slug: "Fashion",               countKey: "home.categories_count_fashion"      as const },
  { nameEn: "Beauty",               nameAr: "التجميل",          img: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop&auto=format&q=80", color: "#f59e0b", slug: "Beauty & Personal Care", countKey: "home.categories_count_beauty"       as const },
  { nameEn: "Home & Kitchen",       nameAr: "المنزل والمطبخ",  img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop&auto=format&q=80", color: "#8b5cf6", slug: "Home & Kitchen",         countKey: "home.categories_count_home"         as const },
  { nameEn: "Sports",               nameAr: "الرياضة",          img: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400&h=300&fit=crop&auto=format&q=80", color: "#10b981", slug: "Sports & Fitness",       countKey: "home.categories_count_sports"       as const },
  { nameEn: "Accessories",          nameAr: "الإكسسوارات",     img: "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=400&h=300&fit=crop&auto=format&q=80", color: "#f97316", slug: "Accessories",            countKey: "home.categories_count_accessories"  as const },
  { nameEn: "Phones",               nameAr: "الهواتف",          img: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop&auto=format&q=80", color: "#06b6d4", slug: "Electronics",          countKey: "home.categories_count_phones"       as const },
  { nameEn: "Computers",            nameAr: "الحواسيب",         img: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop&auto=format&q=80", color: "#a855f7", slug: "Electronics",          countKey: "home.categories_count_computers"    as const },
];

interface CategoryGridProps {
  colors: ReturnType<typeof useColors>;
  onSelectCategory: (slug: string) => void;
}

function CategoryGridSection({ colors, onSelectCategory }: CategoryGridProps) {
  const locale = getLocale();
  const isAr = locale === "ar";

  return (
    <View style={[catGridStyles.container, { backgroundColor: colors.background }]}>
      <RichSectionHeader
        eyebrow={t("home.categories_eyebrow")}
        title={t("home.categories_title")}
        onSeeAll={() => router.push("/categories")}
        seeAllLabel={t("home.categories_see_all")}
        colors={colors}
      />
      <View style={catGridStyles.grid}>
        {CATEGORY_DEFS.map((cat, i) => (
          <Pressable
            key={`${cat.slug}-${i}`}
            style={({ pressed }) => [catGridStyles.cell, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => { onSelectCategory(cat.slug); void Haptics.selectionAsync(); }}
          >
            <Image source={{ uri: cat.img }} style={catGridStyles.img} resizeMode="cover" />
            <View style={catGridStyles.overlay} />
            <View style={[catGridStyles.colorBar, { backgroundColor: cat.color }]} />
            <View style={catGridStyles.textWrap}>
              <Text style={catGridStyles.catName} numberOfLines={1}>
                {isAr ? cat.nameAr : cat.nameEn}
              </Text>
              <Text style={catGridStyles.catCount} numberOfLines={1}>
                {t(cat.countKey)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
function CountdownTimer({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [time, setTime] = useState({ h: 8, m: 24, s: 37 });
  useEffect(() => {
    const id = setInterval(() => {
      setTime((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={dealStyles.timerRow}>
      <Ionicons name="timer-outline" size={T.icon.sm} color={colors.primary} />
      <Text style={[dealStyles.timerLabel, { color: colors.mutedForeground }]}>{t("home.deals_ends_in")}</Text>
      {[pad(time.h), pad(time.m), pad(time.s)].map((v, i) => (
        <React.Fragment key={i}>
          <View style={[dealStyles.timerChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[dealStyles.timerVal, { color: colors.foreground }]}>{v}</Text>
          </View>
          {i < 2 && <Text style={[dealStyles.timerColon, { color: colors.mutedForeground }]}>:</Text>}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── SYP Price Formatter ─────────────────────────────────────────────────────
/** Formats a SYP amount for display. Matches web useCurrency() output for SYP mode. */
function fmtSYP(syp: number): string {
  return Number(syp).toLocaleString() + " ل.س";
}

// ─── Deal Mini Card (Phase 5 — matches web TrendingCard exactly) ──────────────
interface DealMiniCardProps {
  product: Product;
  colors: ReturnType<typeof useColors>;
  onAddToCart: (id: number) => void;
  gridMode?: boolean;
}
function DealMiniCard({ product, colors, onAddToCart, gridMode = false }: DealMiniCardProps) {
  const img = (product.imageUrls as string[] | null)?.[0] ?? "";
  const price = Number((product as any).finalPrice ?? product.price ?? 0);
  const original = (product as any).originalPrice ? Number((product as any).originalPrice) : null;
  const disc = (product as any).discountPercent ?? null;
  const hasDisc = disc != null && disc > 0;
  const isTrending = (product as any).trending ?? false;
  const stock = (product as any).stock ?? null;
  const outOfStock = stock !== null && stock <= 0;
  const lowStock = stock !== null && stock > 0 && stock <= 5;
  const rating = Number((product as any).averageRating ?? (product as any).rating ?? 0);
  const reviewCount = Number((product as any).reviewCount ?? (product as any).reviews ?? 0);
  const hasRating = rating > 0;
  const locale = getLocale();
  const isAr = locale === "ar";
  const name = isAr && (product as any).nameAr ? (product as any).nameAr : product.name;
  const category = isAr && (product as any).categoryAr ? (product as any).categoryAr : ((product as any).category ?? "");
  const storeName = (product as any).storeName ?? "";
  const { toggle: toggleWishlist, isInWishlist } = useWishlist();
  const wishlisted = isInWishlist(product.id);

  return (
    <Pressable
      style={[pcStyles.card, gridMode ? { width: "48%" as any } : {}, { backgroundColor: colors.card, borderColor: colors.border }, outOfStock && { opacity: 0.7 }]}
      onPress={() => router.push(`/product/${product.id}` as any)}
    >
      {/* ── Image (aspect-square) ── */}
      <View style={pcStyles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={pcStyles.img} resizeMode="cover" />
        ) : (
          <View style={[pcStyles.img, { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="image-outline" size={24} color={colors.mutedForeground} />
          </View>
        )}
        <View style={pcStyles.imgOverlay} />

        {/* Badge — discount > trending > none */}
        {hasDisc ? (
          <View style={[pcStyles.badgeEnd, { backgroundColor: colors.primary }]}>
            <Text style={pcStyles.badgeEndText}>-{Math.round(disc)}%</Text>
          </View>
        ) : isTrending ? (
          <View style={[pcStyles.badgeTrend, { backgroundColor: colors.primary + "25", borderColor: colors.primary + "50" }]}>
            <Ionicons name="trending-up-outline" size={10} color={colors.primary} />
            <Text style={[pcStyles.badgeTrendText, { color: colors.primary }]}>{t("home.trending_badge")}</Text>
          </View>
        ) : null}

        {/* Wishlist — top start */}
        <Pressable
          style={[pcStyles.wishBtn, wishlisted ? { backgroundColor: "#FD637140", borderColor: "#FD637160" } : { backgroundColor: "rgba(0,0,0,0.4)", borderColor: "rgba(255,255,255,0.1)" }]}
          onPress={(e) => { e.stopPropagation?.(); toggleWishlist(product.id); void Haptics.selectionAsync(); }}
          hitSlop={8}
        >
          <Ionicons name={wishlisted ? "heart" : "heart-outline"} size={13} color={wishlisted ? "#FD6371" : "rgba(255,255,255,0.6)"} />
        </Pressable>
      </View>

      {/* ── Card body (p-5 = 20px) ── */}
      <View style={pcStyles.body}>
        {/* Category · Store (11px muted-foreground) */}
        <View style={pcStyles.metaRow}>
          <Text style={[pcStyles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{category}</Text>
          {storeName ? <Text style={[pcStyles.metaStore, { color: colors.mutedForeground }]} numberOfLines={1}>{storeName}</Text> : null}
        </View>

        {/* Title (700, 16px, minHeight 44 for grid alignment) */}
        <Text style={[pcStyles.title, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>

        {/* Rating (only when real data exists, else 18px spacer) */}
        {hasRating ? (
          <View style={pcStyles.ratingRow}>
            {[...Array(5)].map((_, j) => (
              <Ionicons key={j} name={j < Math.floor(rating) ? "star" : "star-outline"} size={11} color={j < Math.floor(rating) ? "#F59E0B" : colors.foreground + "1A"} />
            ))}
            <Text style={[pcStyles.ratingText, { color: colors.foreground + "80" }]}>{rating.toFixed(1)}{reviewCount > 0 ? ` (${reviewCount})` : ""}</Text>
          </View>
        ) : (
          <View style={{ height: 18 }} />
        )}

        {/* Price + Cart — mt-auto */}
        <View style={pcStyles.priceCartRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {hasDisc && original != null && (
              <Text style={[pcStyles.originalPrice, { color: colors.mutedForeground }]}>{fmtSYP(original)}</Text>
            )}
            <Text style={[pcStyles.mainPrice, { color: colors.primary }]}>{fmtSYP(price)}</Text>
          </View>
          {!outOfStock && (
            <Pressable
              style={({ pressed }) => [pcStyles.cartBtn, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "33", opacity: pressed ? 0.75 : 1 }]}
              onPress={(e) => { e.stopPropagation?.(); onAddToCart(product.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              hitSlop={4}
            >
              <Ionicons name="cart-outline" size={13} color={colors.primary} />
              <Text style={[pcStyles.cartBtnText, { color: colors.primary }]}>{t("cart.add_to_cart")}</Text>
            </Pressable>
          )}
        </View>

        {/* Stock warnings */}
        {lowStock ? (
          <Text style={[pcStyles.stockWarn, { color: "#EF4444" }]}>{t("product.in_stock", { count: stock })}</Text>
        ) : outOfStock ? (
          <Text style={[pcStyles.stockWarn, { color: colors.mutedForeground }]}>{t("product.out_of_stock")}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Featured Deals Section ───────────────────────────────────────────────────
interface FeaturedDealsSectionProps {
  products: Product[];
  colors: ReturnType<typeof useColors>;
  onAddToCart: (id: number) => void;
}
function FeaturedDealsSection({ products, colors, onAddToCart }: FeaturedDealsSectionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const deals = products.filter((p) => (p as any).discountPercent > 0).slice(0, 6);
  if (deals.length === 0) return null;

  return (
    <View style={[dealStyles.section, { backgroundColor: isDark ? "#1F1F1F" : "#F0F1F7", borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={dealStyles.header}>
        <RichSectionHeader
          eyebrow={t("home.deals_eyebrow")}
          title={t("home.deals_title")}
          onSeeAll={() => router.push("/(tabs)/index" as any)}
          seeAllLabel={t("home.deals_see_all")}
          colors={colors}
        />
        <CountdownTimer colors={colors} />
      </View>
      <View style={dealStyles.grid}>
        {deals.map((p) => (
          <DealMiniCard key={p.id} product={p} colors={colors} onAddToCart={onAddToCart} gridMode />
        ))}
      </View>
    </View>
  );
}

// ─── Featured Stores Section ──────────────────────────────────────────────────
const STATIC_STORES = [
  { id: 1, name: "تك ستور سوريا", nameEn: "Tech Store Syria", taglineAr: "أحدث الإلكترونيات والأجهزة الذكية", taglineEn: "Latest electronics & smart devices", categoryAr: "إلكترونيات", categoryEn: "Electronics", rating: 4.9, reviews: 1840, productCount: 3240, coverImg: "https://images.unsplash.com/photo-1684395882817-030e24c0322a?w=600&h=200&fit=crop&auto=format&q=80", logoColor: "#3b82f6", logoInitial: "ت", verified: true },
  { id: 2, name: "دار الأناقة", nameEn: "Elegance House",     taglineAr: "أزياء فاخرة وموضة معاصرة للجميع",  taglineEn: "Luxury fashion & contemporary style", categoryAr: "أزياء",       categoryEn: "Fashion",     rating: 4.8, reviews: 2210, productCount: 1890, coverImg: "https://images.unsplash.com/photo-1768745294179-693a07a3f054?w=600&h=200&fit=crop&auto=format&q=80", logoColor: "#ec4899", logoInitial: "د", verified: true },
  { id: 3, name: "بيت الديكور",   nameEn: "Décor Home",        taglineAr: "أثاث عصري وإكسسوارات منزلية راقية", taglineEn: "Modern furniture & premium home décor", categoryAr: "ديكور منزلي", categoryEn: "Home Decor",  rating: 4.7, reviews: 956,  productCount: 2140, coverImg: "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?w=600&h=200&fit=crop&auto=format&q=80", logoColor: "#8b5cf6", logoInitial: "ب", verified: true },
];

function FeaturedStoresSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = getLocale();
  const isAr = locale === "ar";

  return (
    <View style={[storeStyles.section, { backgroundColor: isDark ? "#1F1F1F" : "#F0F1F7", borderTopWidth: 1, borderTopColor: colors.border }]}>
      <RichSectionHeader
        eyebrow={t("home.stores_eyebrow")}
        title={t("home.stores_title")}
        onSeeAll={() => router.push("/store-directory" as any)}
        seeAllLabel={t("home.stores_see_all")}
        colors={colors}
      />
      <View style={storeStyles.list}>
        {STATIC_STORES.map((store) => (
          <Pressable
            key={store.id}
            style={({ pressed }) => [storeStyles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.push("/store-directory" as any)}
          >
            <View style={storeStyles.coverWrap}>
              <Image source={{ uri: store.coverImg }} style={storeStyles.cover} resizeMode="cover" />
              <View style={storeStyles.coverOverlay} />
              {store.verified && (
                <View style={[storeStyles.verifiedBadge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
                  <View style={[storeStyles.verifiedDot, { backgroundColor: colors.primary }]} />
                  <Text style={[storeStyles.verifiedText, { color: colors.primary }]}>{t("home.stores_verified")}</Text>
                </View>
              )}
            </View>
            <View style={storeStyles.cardBody}>
              <View style={storeStyles.logoRow}>
                <View style={[storeStyles.logoCircle, { backgroundColor: store.logoColor + "22", borderColor: store.logoColor + "44" }]}>
                  <Text style={[storeStyles.logoInitial, { color: store.logoColor }]}>{store.logoInitial}</Text>
                </View>
                <View style={storeStyles.ratingWrap}>
                  <Ionicons name="star" size={T.icon.xs} color="#f59e0b" />
                  <Text style={[storeStyles.rating, { color: colors.foreground }]}>{store.rating}</Text>
                  <Text style={[storeStyles.reviewCount, { color: colors.mutedForeground }]}>({store.reviews.toLocaleString()})</Text>
                </View>
              </View>
              <Text style={[storeStyles.storeName, { color: colors.foreground }]} numberOfLines={1}>
                {isAr ? store.name : store.nameEn}
              </Text>
              <Text style={[storeStyles.storeTagline, { color: colors.mutedForeground }]} numberOfLines={2}>
                {isAr ? store.taglineAr : store.taglineEn}
              </Text>
              <View style={[storeStyles.divider, { borderTopColor: colors.border }]} />
              <View style={storeStyles.statsRow}>
                <Ionicons name="cube-outline" size={T.icon.xs} color={colors.mutedForeground} />
                <Text style={[storeStyles.statsText, { color: colors.mutedForeground }]}>
                  {store.productCount.toLocaleString()} {t("home.stores_products")}
                </Text>
              </View>
              <Pressable
                style={[storeStyles.visitBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                onPress={() => router.push("/store-directory" as any)}
              >
                <Text style={[storeStyles.visitBtnText, { color: colors.primary }]}>{t("home.stores_visit")}</Text>
                <Ionicons name={isAr ? "arrow-back-outline" : "arrow-forward-outline"} size={T.icon.sm} color={colors.primary} />
              </Pressable>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Join CTA Section ─────────────────────────────────────────────────────────
function JoinCTASection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { isAuthenticated } = useAuth();
  const locale = getLocale();
  const isAr = locale === "ar";

  return (
    <View style={[joinStyles.section, { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={[joinStyles.outerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[joinStyles.glow, { backgroundColor: colors.primary + "06" }]} pointerEvents="none" />
        <View style={joinStyles.header}>
          <View style={[joinStyles.badge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
            <Ionicons name="sparkles" size={T.icon.xs} color={colors.primary} />
            <Text style={[joinStyles.badgeText, { color: colors.primary }]}>{t("home.join_badge")}</Text>
          </View>
          <Text style={[joinStyles.title, { color: colors.foreground, textAlign: "center" }]}>{t("home.join_title")}</Text>
          <Text style={[joinStyles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>{t("home.join_subtitle")}</Text>
        </View>
        <View style={joinStyles.cardsRow}>
          <Pressable
            style={({ pressed }) => [joinStyles.card, joinStyles.sellerCard, { borderColor: colors.primary + "33", opacity: pressed ? 0.88 : 1 }]}
            onPress={() => router.push(isAuthenticated ? "/seller-apply" : "/login")}
          >
            <View style={[joinStyles.iconWrap, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "25" }]}>
              <Ionicons name="storefront-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[joinStyles.cardTitle, { color: colors.foreground }]}>{t("home.join_seller_title")}</Text>
            <Text style={[joinStyles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={3}>{t("home.join_seller_desc")}</Text>
            <View style={joinStyles.ctaRow}>
              <Text style={[joinStyles.ctaText, { color: colors.primary }]}>{t("home.join_seller_cta")}</Text>
              <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={T.icon.sm} color={colors.primary} />
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [joinStyles.card, { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
            onPress={() => router.push(isAuthenticated ? "/courier-apply" : "/login")}
          >
            <View style={[joinStyles.iconWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name="bicycle-outline" size={24} color={colors.mutedForeground} />
            </View>
            <Text style={[joinStyles.cardTitle, { color: colors.foreground }]}>{t("home.join_courier_title")}</Text>
            <Text style={[joinStyles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={3}>{t("home.join_courier_desc")}</Text>
            <View style={joinStyles.ctaRow}>
              <Text style={[joinStyles.ctaText, { color: colors.mutedForeground }]}>{t("home.join_courier_cta")}</Text>
              <Ionicons name={isAr ? "chevron-back" : "chevron-forward"} size={T.icon.sm} color={colors.mutedForeground} />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Home Footer Section (Phase 12 — matches web HomeFooter.tsx) ─────────────
function HomeFooterSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [email, setEmail] = React.useState("");
  const [subscribed, setSubscribed] = React.useState(false);

  const handleSubscribe = () => {
    if (!email.includes("@")) return;
    setSubscribed(true);
  };

  const NavLink = ({ label, route }: { label: string; route: string }) => (
    <Pressable onPress={() => router.push(route as any)} style={footerStyles.linkBtn}>
      <Text style={[footerStyles.link, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[footerStyles.root, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      {/* Brand + Tagline */}
      <View style={footerStyles.brandRow}>
        <View style={[footerStyles.logo, { backgroundColor: colors.primary }]}>
          <Text style={footerStyles.logoText}>S</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[footerStyles.brandName, { color: colors.foreground }]}>SYANO</Text>
          <Text style={[footerStyles.tagline, { color: colors.mutedForeground }]}>{t("home.footer_tagline")}</Text>
        </View>
      </View>

      {/* Newsletter */}
      <View style={[footerStyles.newsletterBox, { backgroundColor: colors.primary + "0F", borderColor: colors.primary + "22" }]}>
        <Text style={[footerStyles.newsletterTitle, { color: colors.foreground }]}>{t("home.footer_newsletter_title")}</Text>
        <Text style={[footerStyles.newsletterDesc, { color: colors.mutedForeground }]}>{t("home.footer_newsletter_desc")}</Text>
        {subscribed ? (
          <View style={[footerStyles.subscribedRow, { borderColor: colors.primary + "40" }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={[footerStyles.subscribedText, { color: colors.primary }]}>✓ Subscribed</Text>
          </View>
        ) : (
          <View style={footerStyles.inputRow}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("home.footer_newsletter_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              style={[footerStyles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign={isAr ? "right" : "left"}
            />
            <Pressable
              style={({ pressed }) => [footerStyles.subscribeBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
              onPress={handleSubscribe}
            >
              <Text style={footerStyles.subscribeBtnText}>{t("home.footer_subscribe")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 3-column link grid */}
      <View style={footerStyles.linksGrid}>
        <View style={footerStyles.linkCol}>
          <Text style={[footerStyles.colTitle, { color: colors.foreground }]}>{t("home.footer_marketplace_title")}</Text>
          <NavLink label={t("home.footer_link_all_products")} route="/(tabs)/index" />
          <NavLink label={t("home.footer_link_deals")} route="/search?onSale=true" />
          <NavLink label={t("home.footer_link_trusted_stores")} route="/stores" />
          <NavLink label={t("home.footer_link_bestsellers")} route="/search?sort=best_sellers" />
        </View>
        <View style={footerStyles.linkCol}>
          <Text style={[footerStyles.colTitle, { color: colors.foreground }]}>{t("home.footer_sellers_title")}</Text>
          <NavLink label={t("home.footer_link_open_store")} route="/seller-apply" />
          <NavLink label={t("home.footer_link_seller_dashboard")} route="/seller/products" />
          <NavLink label={t("home.footer_link_returns")} route="/returns" />
          <NavLink label={t("home.footer_link_shipping")} route="/help" />
        </View>
        <View style={footerStyles.linkCol}>
          <Text style={[footerStyles.colTitle, { color: colors.foreground }]}>{t("home.footer_company_title")}</Text>
          <NavLink label={t("home.footer_link_about")} route="/about" />
          <NavLink label={t("home.footer_link_contact")} route="/contact" />
          <NavLink label={t("home.footer_link_help")} route="/help" />
          <NavLink label={t("home.footer_link_privacy")} route="/privacy-policy" />
        </View>
      </View>

      {/* Divider + copyright + legal links */}
      <View style={[footerStyles.bottomDivider, { borderTopColor: colors.border }]} />
      <View style={footerStyles.bottomRow}>
        <Text style={[footerStyles.copyright, { color: colors.mutedForeground }]}>{t("home.footer_copyright")}</Text>
        <View style={footerStyles.legalRow}>
          <NavLink label={t("home.footer_privacy")} route="/privacy-policy" />
          <Text style={{ color: colors.border, marginHorizontal: 2 }}>·</Text>
          <NavLink label={t("home.footer_terms")} route="/terms" />
          <Text style={{ color: colors.border, marginHorizontal: 2 }}>·</Text>
          <NavLink label={t("home.footer_cookies")} route="/cookies" />
        </View>
      </View>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40, borderTopWidth: 1, marginTop: 8 },
  brandRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  logo: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#000", fontSize: 18, fontWeight: "900" as const },
  brandName: { fontSize: 16, fontWeight: "700" as const, marginBottom: 4 },
  tagline: { fontSize: 12, lineHeight: 18 },
  newsletterBox: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 24 },
  newsletterTitle: { fontSize: 14, fontWeight: "700" as const, marginBottom: 4 },
  newsletterDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  subscribeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  subscribeBtnText: { color: "#000", fontSize: 13, fontWeight: "700" as const },
  subscribedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderTopWidth: 1 },
  subscribedText: { fontSize: 13, fontWeight: "600" as const },
  linksGrid: { flexDirection: "row", gap: 4, marginBottom: 20 },
  linkCol: { flex: 1, gap: 6 },
  colTitle: { fontSize: 13, fontWeight: "700" as const, marginBottom: 4 },
  linkBtn: { paddingVertical: 2 },
  link: { fontSize: 12, lineHeight: 20 },
  bottomDivider: { borderTopWidth: 1, marginBottom: 16 },
  bottomRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  copyright: { fontSize: 11 },
  legalRow: { flexDirection: "row", alignItems: "center" },
});

// ─── Trending Products Section ───────────────────────────────────────────────
function TrendingProductsSection({ products, isLoading, colors, onAddToCart, onSeeAll }: {
  products: Product[]; isLoading: boolean; colors: ReturnType<typeof useColors>; onAddToCart: (id: number) => void; onSeeAll: () => void;
}) {
  const items = products.slice(0, 6);
  return (
    <View style={[dealStyles.section, { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }]}>
      <RichSectionHeader
        eyebrow={t("home.trending_eyebrow")}
        title={t("home.trending_title")}
        onSeeAll={onSeeAll}
        seeAllLabel={t("home.trending_see_all")}
        colors={colors}
      />
      {isLoading ? (
        <View style={{ height: 120, alignItems: "center" as const, justifyContent: "center" as const }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={dealStyles.grid}>
          {items.map((p) => (
            <DealMiniCard key={p.id} product={p} colors={colors} onAddToCart={onAddToCart} gridMode />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── New Arrival Card ─────────────────────────────────────────────────────────
function NewArrivalCard({ product, large, colors }: {
  product: Product; large?: boolean; colors: ReturnType<typeof useColors>; onAddToCart?: (id: number) => void;
}) {
  const locale = getLocale();
  const isAr = locale === "ar";
  const img = (product.imageUrls as string[] | null)?.[0] ?? "";
  const price = (product as any).finalPrice ?? product.price ?? 0;
  const name = isAr && (product as any).nameAr ? (product as any).nameAr : product.name;

  return (
    <Pressable
      style={[arriStyles.card, large ? arriStyles.cardLarge : {}, { borderColor: colors.border }]}
      onPress={() => router.push(`/product/${product.id}` as any)}
    >
      {img ? (
        <Image source={{ uri: img }} style={arriStyles.img} resizeMode="cover" />
      ) : (
        <View style={[arriStyles.img, { backgroundColor: colors.secondary }]} />
      )}
      <View style={arriStyles.overlay} />
      <View style={arriStyles.cardContent}>
        <View style={[arriStyles.newBadge, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#000", fontSize: T.font.nano, fontWeight: "800" as const, letterSpacing: 0.5 }}>NEW</Text>
        </View>
        <Text style={[arriStyles.cardName, large ? arriStyles.cardNameLarge : {}]} numberOfLines={2}>{name}</Text>
        <Text style={{ color: colors.primary, fontSize: large ? T.font.h3 : T.font.bodySm, fontWeight: "800" as const }}>{fmtSYP(Number(price))}</Text>
      </View>
    </Pressable>
  );
}

// ─── New Arrivals Section ─────────────────────────────────────────────────────
function NewArrivalsSection({ products, isLoading, colors, onAddToCart, onSeeAll }: {
  products: Product[]; isLoading: boolean; colors: ReturnType<typeof useColors>; onAddToCart: (id: number) => void; onSeeAll: () => void;
}) {
  const items = products.slice(0, 4);
  const [main, ...rest] = items;
  return (
    <View style={[dealStyles.section, { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }]}>
      <RichSectionHeader
        eyebrow={t("home.arrivals_eyebrow")}
        title={t("home.arrivals_title")}
        onSeeAll={onSeeAll}
        seeAllLabel={t("home.arrivals_see_all")}
        colors={colors}
      />
      {isLoading ? (
        <View style={{ height: 150, alignItems: "center" as const, justifyContent: "center" as const }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {main && <NewArrivalCard product={main} large colors={colors} onAddToCart={onAddToCart} />}
          {rest.map((p) => (
            <NewArrivalCard key={p.id} product={p} colors={colors} onAddToCart={onAddToCart} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Mini Product Card (existing, unchanged) ──────────────────────────────────
function MiniProductCard({ product, colors, onAddToCart, style }: { product: Product; colors: ReturnType<typeof useColors>; onAddToCart: (id: number) => void; style?: object }) {
  const locale = getLocale();
  const img = (product.imageUrls as string[] | null)?.[0] ?? "";
  const price = (product as any).finalPrice ?? product.price ?? 0;
  const disc = (product as any).discountPercent ?? null;
  const hasDisc = disc != null && disc > 0;
  const name = locale === "ar" && (product as any).nameAr ? (product as any).nameAr : product.name;

  return (
    <Pressable
      style={({ pressed }) => [miniStyles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }, style]}
      onPress={() => router.push(`/product/${product.id}` as any)}
    >
      <View style={miniStyles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={miniStyles.img} resizeMode="cover" />
        ) : (
          <View style={[miniStyles.img, { backgroundColor: colors.secondary }]} />
        )}
        {hasDisc && (
          <View style={miniStyles.badge}>
            <Text style={miniStyles.badgeText}>-{Math.round(disc)}%</Text>
          </View>
        )}
      </View>
      <View style={miniStyles.info}>
        <Text style={[miniStyles.name, { color: colors.foreground }]} numberOfLines={2}>{name}</Text>
        <Text style={[miniStyles.price, { color: colors.primary }]}>{fmtSYP(Number(price))}</Text>
      </View>
    </Pressable>
  );
}

// ─── Homepage Header (with all sections) ─────────────────────────────────────
interface HomepageHeaderProps {
  colors: ReturnType<typeof useColors>;
  bestSellers: Product[];
  newArrivals: Product[];
  isLoadingNewArrivals: boolean;
  trending: Product[];
  isLoadingTrending: boolean;
  onAddToCart: (id: number) => void;
  setActiveCategory: (v: string | null) => void;
}

function HomepageHeader({
  colors,
  bestSellers, newArrivals, isLoadingNewArrivals,
  trending, isLoadingTrending,
  onAddToCart, setActiveCategory,
}: HomepageHeaderProps) {
  return (
    <View style={{ backgroundColor: colors.background }}>
      {/* ── Hero Banner ── */}
      <HeroBannerSection colors={colors} products={bestSellers} />

      {/* ── Popular Categories ── */}
      <CategoryGridSection colors={colors} onSelectCategory={(slug) => setActiveCategory(slug)} />

      {/* ── Featured Deals ── */}
      <FeaturedDealsSection products={bestSellers} colors={colors} onAddToCart={onAddToCart} />

      {/* ── Trusted Stores ── */}
      <FeaturedStoresSection colors={colors} />

      {/* ── Trending Products ── */}
      <TrendingProductsSection
        products={trending}
        isLoading={isLoadingTrending}
        colors={colors}
        onAddToCart={onAddToCart}
        onSeeAll={() => setActiveCategory(null)}
      />

      {/* ── New Arrivals ── */}
      <NewArrivalsSection
        products={newArrivals}
        isLoading={isLoadingNewArrivals}
        colors={colors}
        onAddToCart={onAddToCart}
        onSeeAll={() => setActiveCategory(null)}
      />

      {/* ── Join CTA ── */}
      <JoinCTASection colors={colors} />

      {/* ── Footer ── */}
      <HomeFooterSection colors={colors} />
    </View>
  );
}

// ─── Navbar Icon Button ───────────────────────────────────────────────────────
function NavIconBtn({
  icon, color, onPress, badge = 0, emeraldBadge = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: ReturnType<typeof useColors>;
  onPress: () => void;
  badge?: number;
  emeraldBadge?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [navbarStyles.iconBtn, { opacity: pressed ? 0.65 : 1 }]}
      hitSlop={6}
    >
      <Ionicons name={icon} size={17} color={color.foreground} />
      {badge > 0 && (
        <View style={[navbarStyles.iconBadge, { backgroundColor: emeraldBadge ? color.primary : "#EF4444" }]}>
          <Text style={navbarStyles.iconBadgeText}>{badge > 99 ? "99+" : String(badge)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Navigation Drawer ────────────────────────────────────────────────────────
function NavDrawer({ visible, onClose, colors }: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { isAuthenticated, isCustomer, isSeller, isAdmin, isCourier, logout } = useAuth();
  const locale = getLocale();
  const isAr = locale === "ar";

  const navLinks = [
    { icon: "home-outline" as const,       labelEn: "Home",         labelAr: "الرئيسية",    href: "/(tabs)/index" as const },
    { icon: "bag-handle-outline" as const, labelEn: "Shop",         labelAr: "تسوق",       href: "/(tabs)/index" as const },
    { icon: "grid-outline" as const,       labelEn: "Categories",   labelAr: "الفئات",     href: "/categories" as const },
    { icon: "storefront-outline" as const, labelEn: "Stores",       labelAr: "المتاجر",    href: "/store-directory" as const },
  ];

  const roleLinks: { icon: keyof typeof Ionicons.glyphMap; labelEn: string; labelAr: string; href: string }[] = isAdmin
    ? [
        { icon: "stats-chart-outline", labelEn: "Admin Dashboard", labelAr: "لوحة الإدارة", href: "/admin" },
        { icon: "people-outline",      labelEn: "Users",           labelAr: "المستخدمون",   href: "/admin/users" },
        { icon: "receipt-outline",     labelEn: "Orders",          labelAr: "الطلبات",      href: "/admin/orders" },
      ]
    : isSeller
    ? [
        { icon: "bar-chart-outline",  labelEn: "Dashboard",  labelAr: "لوحة التحكم", href: "/(tabs)/index" },
        { icon: "cube-outline",       labelEn: "Products",   labelAr: "المنتجات",    href: "/seller/products" },
        { icon: "receipt-outline",    labelEn: "Orders",     labelAr: "الطلبات",     href: "/seller/orders" },
        { icon: "analytics-outline",  labelEn: "Analytics",  labelAr: "التحليلات",   href: "/seller/analytics" },
      ]
    : isCourier
    ? [
        { icon: "speedometer-outline", labelEn: "Dashboard",  labelAr: "لوحة التحكم", href: "/courier/dashboard" },
        { icon: "bicycle-outline",     labelEn: "Missions",   labelAr: "المهام",      href: "/courier/missions" },
        { icon: "time-outline",        labelEn: "History",    labelAr: "السجل",       href: "/courier/history" },
      ]
    : [
        { icon: "receipt-outline", labelEn: "My Orders",  labelAr: "طلباتي",     href: "/(tabs)/orders" },
        { icon: "heart-outline",   labelEn: "Wishlist",   labelAr: "المفضلة",    href: "/(tabs)/wishlist" },
        { icon: "person-outline",  labelEn: "Profile",    labelAr: "الملف",      href: "/(tabs)/profile" },
      ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[drawerStyles.panel, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[drawerStyles.header, { borderBottomColor: colors.border }]}>
          <View style={drawerStyles.logoRow}>
            <View style={drawerStyles.sIcon}>
              <Text style={drawerStyles.sText}>S</Text>
            </View>
            <View>
              <Text style={[drawerStyles.brand, { color: colors.foreground }]}>SYANO</Text>
              <Text style={drawerStyles.brandAr}>سوق سوريا</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={[drawerStyles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={drawerStyles.linkList} showsVerticalScrollIndicator={false}>
          {/* Main nav links */}
          {navLinks.map((link) => (
            <Pressable
              key={link.href + link.labelEn}
              style={({ pressed }) => [drawerStyles.link, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => { onClose(); router.push(link.href as any); }}
            >
              <Ionicons name={link.icon} size={20} color={colors.mutedForeground} />
              <Text style={[drawerStyles.linkText, { color: colors.foreground }]}>
                {isAr ? link.labelAr : link.labelEn}
              </Text>
            </Pressable>
          ))}

          {/* Divider */}
          <View style={[drawerStyles.divider, { backgroundColor: colors.border }]} />

          {/* Role links */}
          {roleLinks.map((link) => (
            <Pressable
              key={link.href + link.labelEn}
              style={({ pressed }) => [drawerStyles.link, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => { onClose(); router.push(link.href as any); }}
            >
              <Ionicons name={link.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
              <Text style={[drawerStyles.linkText, { color: colors.foreground }]}>
                {isAr ? link.labelAr : link.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Footer: auth */}
        <View style={[drawerStyles.footer, { borderTopColor: colors.border }]}>
          {isAuthenticated ? (
            <Pressable
              style={({ pressed }) => [drawerStyles.authBtn, { backgroundColor: "#EF444420", borderColor: "#EF4444", opacity: pressed ? 0.8 : 1 }]}
              onPress={() => { logout(); onClose(); }}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={[drawerStyles.authBtnText, { color: "#EF4444" }]}>{isAr ? "تسجيل خروج" : "Sign out"}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [drawerStyles.authBtn, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => { onClose(); router.push("/login" as any); }}
            >
              <Ionicons name="log-in-outline" size={18} color="#000" />
              <Text style={[drawerStyles.authBtnText, { color: "#000" }]}>{isAr ? "تسجيل الدخول" : "Sign in"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Home Navbar ──────────────────────────────────────────────────────────────
const NAVBAR_CONTENT_H = 60;

function HomeNavbar({
  topPad, colors, cartCount,
  searchOpen, onSearchToggle,
  search, onSearchChange, onSearchClear,
}: {
  topPad: number;
  colors: ReturnType<typeof useColors>;
  cartCount: number;
  searchOpen: boolean;
  onSearchToggle: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  onSearchClear: () => void;
}) {
  const { isAuthenticated, isCustomer, isSeller, isAdmin, isCourier } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const locale = getLocale();
  const isAr = locale === "ar";
  const isIOS = Platform.OS === "ios";

  const notifData = useGetNotificationCount({ query: { refetchInterval: 30_000 } });
  const notifCount = notifData.data?.unread ?? 0;

  const msgData = useGetUnreadCount(undefined as any);
  const msgCount = (msgData.data as any)?.count ?? 0;

  const showCart    = !isSeller && !isAdmin && !isCourier;
  const showWish    = isCustomer;
  const showMsg     = !isAdmin;

  return (
    <>
      <View style={[navbarStyles.wrapper, { paddingTop: topPad }]}>
        {/* Glassmorphism background */}
        {isIOS ? (
          <BlurView
            intensity={85}
            tint={isDark ? "dark" : "light"}
            style={[StyleSheet.absoluteFill, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(8,8,8,0.92)" : "rgba(255,255,255,0.92)", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} />
        )}

        {/* Nav row */}
        <View style={[navbarStyles.row, { height: NAVBAR_CONTENT_H }]}>
          {/* Logo */}
          <View style={navbarStyles.logoWrap}>
            <View style={navbarStyles.sCircle}>
              <Text style={navbarStyles.sLetter}>S</Text>
            </View>
            <Text style={[navbarStyles.brand, { color: colors.foreground }]}>SYANO</Text>
          </View>

          {/* Actions */}
          <View style={[navbarStyles.actions, { flexDirection: isAr ? "row-reverse" : "row" }]}>
            <NavIconBtn icon="search-outline"        color={colors} onPress={onSearchToggle} />
            <NavIconBtn icon="notifications-outline" color={colors} onPress={() => router.push("/(tabs)/notifications" as any)} badge={notifCount} />
            {showMsg  && <NavIconBtn icon="chatbubble-outline" color={colors} onPress={() => router.push("/(tabs)/messages" as any)} badge={msgCount} />}
            {showWish && <NavIconBtn icon="heart-outline"     color={colors} onPress={() => router.push("/(tabs)/wishlist" as any)}  badge={wishlistCount > 0 ? wishlistCount : 0} />}
            {showCart && <NavIconBtn icon="cart-outline"      color={colors} onPress={() => router.push("/(tabs)/cart" as any)}     badge={cartCount} emeraldBadge />}
            <NavIconBtn icon="menu-outline" color={colors} onPress={() => setMenuOpen(true)} />
          </View>
        </View>

        {/* Expandable search bar */}
        {searchOpen && (
          <View style={[navbarStyles.searchRow, { borderTopColor: colors.border }]}>
            <View style={[navbarStyles.searchWrap, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[navbarStyles.searchInput, { color: colors.foreground }]}
                placeholder={isAr ? "ابحث عن المنتجات..." : "Search products..."}
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={onSearchChange}
                autoFocus
                returnKeyType="search"
                textAlign={isAr ? "right" : "left"}
              />
              {search.length > 0 && (
                <Pressable onPress={onSearchClear} hitSlop={6}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>

      <NavDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} colors={colors} />
    </>
  );
}

// ─── Customer Shop ─────────────────────────────────────────────────────────────
function CustomerShop() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { isAuthenticated, isCustomer, isSeller, isAdmin, isCourier, token } = useAuth();
  const locale = getLocale();
  const isAr = locale === "ar";

  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory]   = useState<string | null>(null);
  const [sortBy, setSortBy]                   = useState<MobileSortOption>("newest");
  const [minRating, setMinRating]             = useState(0);
  const [inStock, setInStock]                 = useState(false);
  const [onSale, setOnSale]                   = useState(false);
  const [priceMin, setPriceMin]               = useState<number | null>(null);
  const [priceMax, setPriceMax]               = useState<number | null>(null);
  const [searchFocused, setSearchFocused]     = useState(false);
  const [mobileSuggestions, setMobileSuggestions] = useState<MobileSuggestions | null>(null);
  const [searchIntent, setSearchIntent]       = useState<string | null>(null);
  const [relatedSearches, setRelatedSearches] = useState<{ query: string }[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempMin, setTempMin]                 = useState("");
  const [tempMax, setTempMax]                 = useState("");
  const [navSearchOpen, setNavSearchOpen]     = useState(false);

  const isShopMode = debouncedSearch.length > 0 || activeCategory !== null || minRating > 0 || inStock || sortBy !== "newest" || onSale || priceMin != null || priceMax != null;

  const { data: categoriesData } = useListCategories();
  const categories = useMemo(() => (categoriesData?.map((c: any) => (isAr && c.labelAr ? c.labelAr : c.label)) ?? []), [categoriesData, isAr]);

  const { data: bestSellersData } = useGetBestSellers(8);
  const bestSellers: Product[] = useMemo(() => (bestSellersData as any)?.products ?? (Array.isArray(bestSellersData) ? bestSellersData : []), [bestSellersData]);

  const { data: newArrivalsData, isLoading: isLoadingNewArrivals } = useListProducts({ limit: 8, sortBy: "newest" });
  const newArrivals: Product[] = useMemo(() => newArrivalsData ?? [], [newArrivalsData]);

  const { data: trendingData, isLoading: isLoadingTrending } = useListProducts({ limit: 8, sortBy: "highest_rated" });
  const trending: Product[] = useMemo(() => trendingData ?? [], [trendingData]);

  const { data: cartData } = useGetCart({ query: { enabled: isAuthenticated && isCustomer } as any });
  const cartCount = useMemo(() => (cartData as any)?.items?.length ?? 0, [cartData]);

  const queryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    category: activeCategory ?? undefined,
    sortBy,
    minRating: minRating > 0 ? minRating : undefined,
    inStock: inStock || undefined,
    onSale: onSale || undefined,
    minPrice: priceMin ?? undefined,
    maxPrice: priceMax ?? undefined,
    limit: 30,
  }), [debouncedSearch, activeCategory, sortBy, minRating, inStock, onSale, priceMin, priceMax]);

  const { data: products = [], isLoading, isRefetching, refetch } = useListProducts(
    queryParams,
    { query: { enabled: isShopMode } as any },
  );

  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {},
      onError: () => {},
    },
  });

  const handleAddToCart = useCallback((productId: number) => {
    if (isSeller || isAdmin || isCourier) return;
    if (isAuthenticated && isCustomer) {
      addToCartMutation.mutate({ data: { productId, quantity: 1, variantId: null } });
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isAuthenticated, isCustomer, isSeller, isAdmin, isCourier, addToCartMutation]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setDebouncedSearch(text);
      if (text.length >= 2) {
        try {
          const url = `${getBaseUrl()}/api/search/suggestions?q=${encodeURIComponent(text)}&lang=${locale}&limit=5`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            setMobileSuggestions({
              suggestions: data.suggestions ?? [],
              categories: data.categories ?? [],
            });
            setSearchIntent(data.intent ?? null);
            setRelatedSearches(data.relatedSearches ?? []);
          }
        } catch {}
      } else {
        setMobileSuggestions(null);
        setSearchIntent(null);
      }
    }, 200);
  }, [locale]);

  const renderProductItem = useCallback(({ item }: { item: Product }) => (
    <View style={styles.cardWrapper}>
      <ProductCard product={item as any} />
    </View>
  ), []);

  const shopHeader = (
    <View style={[styles.shopHeader, { paddingTop: 12, borderBottomColor: colors.border }]}>
      <View style={styles.shopTitleRow}>
        <Text style={[styles.shopTitle, { color: colors.foreground }]}>
          {activeCategory ?? (onSale ? (isAr ? "عروض" : "On Sale") : (isAr ? "البحث" : "Search"))}
        </Text>
        <Pressable
          style={[styles.clearAllBtn, { borderColor: colors.border }]}
          onPress={() => { setSearch(""); setDebouncedSearch(""); setActiveCategory(null); setMinRating(0); setInStock(false); setSortBy("newest"); setOnSale(false); setPriceMin(null); setPriceMax(null); }}
        >
          <Ionicons name="close" size={T.icon.xs} color={colors.mutedForeground} />
          <Text style={[styles.clearAllText, { color: colors.mutedForeground }]}>{isAr ? "مسح" : "Clear"}</Text>
        </Pressable>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: searchFocused ? colors.primary : colors.border }]}>
        <Ionicons name="search-outline" size={T.icon.md} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={t("common.search_placeholder")}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          returnKeyType="search"
          textAlign={isAr ? "right" : "left"}
        />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(""); setDebouncedSearch(""); setMobileSuggestions(null); }}>
            <Ionicons name="close-circle" size={T.icon.md} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {searchFocused && (mobileSuggestions?.suggestions?.length ?? 0) > 0 && (
        <View style={[suggStyles.overlay, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(mobileSuggestions?.categories ?? []).slice(0, 2).map((c) => (
            <Pressable key={c.slug} style={[suggStyles.row, { borderBottomColor: colors.border }]}
              onPress={() => { setActiveCategory(c.slug); setSearchFocused(false); }}>
              <Ionicons name="grid-outline" size={T.icon.sm} color={colors.primary} />
              <Text style={[suggStyles.rowText, { color: colors.foreground }]} numberOfLines={1}>
                {isAr && c.labelAr ? c.labelAr : c.labelEn}
              </Text>
              <Text style={[suggStyles.catBadge, { color: colors.primary, borderColor: colors.primary + "44" }]}>
                {isAr ? "فئة" : "cat"}
              </Text>
            </Pressable>
          ))}
          {(mobileSuggestions?.suggestions ?? []).slice(0, 5).map((s, i) => (
            <Pressable key={i} style={[suggStyles.row, { borderBottomColor: colors.border }]}
              onPress={() => { const text = isAr && s.textAr ? s.textAr : s.text; setSearch(text); setDebouncedSearch(text); setSearchFocused(false); }}>
              <Ionicons name="search-outline" size={T.icon.sm} color={colors.mutedForeground} />
              <Text style={[suggStyles.rowText, { color: colors.foreground }]} numberOfLines={1}>
                {isAr && s.textAr ? s.textAr : s.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {Object.entries(MOBILE_SORT_LABELS).map(([key, labels]) => {
          const active = sortBy === key;
          return (
            <Pressable
              key={key}
              style={({ pressed }) => [styles.sortChip, { backgroundColor: active ? colors.primary + "22" : colors.secondary, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}
              onPress={() => { setSortBy(key as MobileSortOption); void Haptics.selectionAsync(); }}
            >
              <Text style={[styles.sortChipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {isAr ? labels.ar : labels.en}
              </Text>
            </Pressable>
          );
        })}
        {categoriesData?.map((c: any) => {
          const label = isAr && c.labelAr ? c.labelAr : c.label;
          const active = activeCategory === c.label;
          return (
            <Pressable
              key={c.label}
              style={({ pressed }) => [styles.categoryChip, { backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}
              onPress={() => { setActiveCategory(active ? null : c.label); void Haptics.selectionAsync(); }}
            >
              <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {searchIntent && debouncedSearch.length >= 2 && (
        <View style={[intentStyles.banner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
          <Ionicons name="sparkles-outline" size={T.icon.sm} color={colors.primary} />
          <Text style={[intentStyles.bannerText, { color: colors.primary }]}>
            {searchIntent === "on_sale"  ? t("shop.intent_on_sale")  :
             searchIntent === "cheap"   ? t("shop.intent_cheap")    :
             searchIntent === "premium" ? t("shop.intent_premium")  :
             searchIntent === "rating"  ? t("shop.intent_rating")   :
             searchIntent === "newest"  ? t("shop.intent_newest")   :
             searchIntent === "gift"    ? t("shop.intent_gift")     : null}
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryScroll, { paddingTop: 0 }]} decelerationRate="fast">
        <Pressable
          style={({ pressed }) => [styles.sortChip, { backgroundColor: onSale ? "#EF444422" : colors.secondary, borderColor: onSale ? "#EF4444" : colors.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => { setOnSale((v) => !v); void Haptics.selectionAsync(); }}
        >
          <Text style={[styles.sortChipText, { color: onSale ? "#EF4444" : colors.mutedForeground }]}>🏷 {t("shop.on_sale")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.sortChip, { backgroundColor: inStock ? "#10B98122" : colors.secondary, borderColor: inStock ? "#10B981" : colors.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => setInStock((v) => !v)}
        >
          <Text style={[styles.sortChipText, { color: inStock ? "#10B981" : colors.mutedForeground }]}>✓ {t("shop.in_stock")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.sortChip,
            { backgroundColor: (priceMin != null || priceMax != null) ? colors.primary + "22" : colors.secondary, borderColor: (priceMin != null || priceMax != null) ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
          onPress={() => { setTempMin(priceMin != null ? String(priceMin) : ""); setTempMax(priceMax != null ? String(priceMax) : ""); setShowFilterPanel(true); }}
        >
          <Ionicons name="options-outline" size={T.icon.xs} color={(priceMin != null || priceMax != null) ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.sortChipText, { color: (priceMin != null || priceMax != null) ? colors.primary : colors.mutedForeground }]}>
            {(priceMin != null || priceMax != null) ? `$${priceMin ?? 0}–${priceMax != null ? "$" + priceMax : "∞"}` : t("shop.price_range")}
          </Text>
        </Pressable>
        {[4, 3].map((star) => {
          const active = minRating === star;
          return (
            <Pressable
              key={star}
              style={({ pressed }) => [styles.sortChip, { backgroundColor: active ? "#F59E0B22" : colors.secondary, borderColor: active ? "#F59E0B" : colors.border, opacity: pressed ? 0.75 : 1 }]}
              onPress={() => setMinRating(active ? 0 : star)}
            >
              <Text style={[styles.sortChipText, { color: active ? "#F59E0B" : colors.mutedForeground }]}>★ {star}+</Text>
            </Pressable>
          );
        })}
        {(minRating > 0 || inStock || sortBy !== "newest" || onSale || priceMin != null || priceMax != null) && (
          <Pressable
            style={({ pressed }) => [styles.sortChip, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => { setMinRating(0); setInStock(false); setSortBy("newest"); setOnSale(false); setPriceMin(null); setPriceMax(null); }}
          >
            <Text style={[styles.sortChipText, { color: colors.mutedForeground }]}>✕ {t("shop.clear_filters")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );

  const homepageHeader = (
    <HomepageHeader
      colors={colors}
      bestSellers={bestSellers}
      newArrivals={newArrivals}
      isLoadingNewArrivals={isLoadingNewArrivals}
      trending={trending}
      isLoadingTrending={isLoadingTrending}
      onAddToCart={handleAddToCart}
      setActiveCategory={setActiveCategory}
    />
  );

  const relatedSearchesFooter = debouncedSearch.length >= 2 && relatedSearches.length > 0 ? (
    <View style={[relStyles.container, { borderTopColor: colors.border }]}>
      <Text style={[relStyles.title, { color: colors.mutedForeground }]}>{t("shop.related_searches")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={relStyles.chipRow}>
        {relatedSearches.map((r) => (
          <Pressable
            key={r.query}
            style={({ pressed }) => [relStyles.chip, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => { setSearch(r.query); setDebouncedSearch(r.query); setSearchFocused(false); }}
          >
            <Ionicons name="search-outline" size={T.icon.xs} color={colors.mutedForeground} style={{ marginRight: 4 }} />
            <Text style={[relStyles.chipText, { color: colors.foreground }]} numberOfLines={1}>{r.query}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;

  return (
    <View style={[styles.shopContainer, { backgroundColor: colors.background }]}>
      {/* ── Fixed Navbar ── */}
      <HomeNavbar
        topPad={topPad}
        colors={colors}
        cartCount={cartCount}
        searchOpen={navSearchOpen}
        onSearchToggle={() => {
          setNavSearchOpen((v) => {
            if (v) { setSearch(""); setDebouncedSearch(""); setMobileSuggestions(null); }
            return !v;
          });
        }}
        search={search}
        onSearchChange={handleSearchChange}
        onSearchClear={() => { setSearch(""); setDebouncedSearch(""); setMobileSuggestions(null); }}
      />

      {/* ── Scrollable content ── */}
      <FlatList
        style={{ flex: 1 }}
        data={isShopMode ? products : []}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: tabBarHeight }]}
        ListHeaderComponent={isShopMode ? shopHeader : homepageHeader}
        ListFooterComponent={relatedSearchesFooter}
        removeClippedSubviews={true}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          isShopMode ? (
            isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("shop.no_products")}</Text>
              </View>
            )
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
        }
        renderItem={renderProductItem}
      />

      {/* ── Price Filter Panel Modal ── */}
      <Modal visible={showFilterPanel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilterPanel(false)}>
        <KeyboardAvoidingView style={[styles.shopContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[styles.shopHeader, { paddingTop: 20, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 16 }]}>
            <Text style={[styles.shopTitle, { color: colors.foreground, fontSize: T.font.h2 }]}>{t("shop.price_range")}</Text>
            <Pressable onPress={() => setShowFilterPanel(false)} style={[styles.searchIconBtn, { backgroundColor: colors.card }]}>
              <Ionicons name="close" size={T.icon.lg} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clearAllText, { color: colors.mutedForeground, marginBottom: 6 }]}>{t("shop.price_min_placeholder")}</Text>
                <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground }}>$</Text>
                  <TextInput style={[styles.searchInput, { color: colors.foreground }]} value={tempMin} onChangeText={setTempMin} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.clearAllText, { color: colors.mutedForeground, marginBottom: 6 }]}>{t("shop.price_max_placeholder")}</Text>
                <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground }}>$</Text>
                  <TextInput style={[styles.searchInput, { color: colors.foreground }]} value={tempMax} onChangeText={setTempMax} keyboardType="numeric" placeholder="∞" placeholderTextColor={colors.mutedForeground} />
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable
                style={({ pressed }) => [styles.clearAllBtn, { flex: 1, justifyContent: "center", borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
                onPress={() => { setTempMin(""); setTempMax(""); setPriceMin(null); setPriceMax(null); setShowFilterPanel(false); }}
              >
                <Text style={[styles.clearAllText, { color: colors.mutedForeground }]}>{t("shop.reset_filters")}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.clearAllBtn, { flex: 2, justifyContent: "center", backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                onPress={() => {
                  const mn = parseFloat(tempMin); const mx = parseFloat(tempMax);
                  setPriceMin(!isNaN(mn) && mn > 0 ? mn : null);
                  setPriceMax(!isNaN(mx) && mx > 0 ? mx : null);
                  setShowFilterPanel(false);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.clearAllText, { color: colors.primaryForeground, fontWeight: "700" as const }]}>{t("shop.apply_filters")}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Stat Card (Seller Dashboard) ────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; accent: string }) {
  const colors = useColors();
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={T.icon.xl} color={accent} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

// ─── Seller Dashboard ─────────────────────────────────────────────────────────
function SellerDashboard() {
  const colors = useColors();
  const { topPad, tabBarHeight } = useScreenLayout();
  const { data, isLoading, refetch, isRefetching } = useGetSellerDashboard();

  return (
    <ScrollView
      style={[styles.shopContainer, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: tabBarHeight, paddingHorizontal: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
    >
      <Text style={[styles.shopTitle, { color: colors.foreground }]}>{t("profile.dashboard_title")}</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : data ? (
        <>
          <View style={dashStyles.statsGrid}>
            <StatCard label={t("profile.stat_revenue")} value={`$${data.totalRevenue.toFixed(0)}`} icon="cash-outline" accent="#10B981" />
            <StatCard label={t("profile.stat_orders")} value={String(data.totalOrders)} icon="receipt-outline" accent="#3B82F6" />
            <StatCard label={t("profile.stat_products")} value={String(data.totalProducts)} icon="cube-outline" accent="#8B5CF6" />
            <StatCard label={t("profile.stat_pending")} value={String(data.pendingOrders)} icon="hourglass-outline" accent="#F59E0B" />
          </View>
          {data.lowStockProducts > 0 && (
            <View style={[dashStyles.alert, { backgroundColor: colors.card, borderColor: "#F59E0B" }]}>
              <Ionicons name="warning-outline" size={T.icon.lg} color="#F59E0B" />
              <Text style={[dashStyles.alertText, { color: colors.foreground }]}>
                {data.lowStockProducts > 1 ? t("profile.low_stock_plural", { count: String(data.lowStockProducts) }) : t("profile.low_stock", { count: String(data.lowStockProducts) })}
              </Text>
            </View>
          )}
          {data.recentOrders.length > 0 && (
            <View>
              <Text style={[dashStyles.sectionTitle, { color: colors.foreground }]}>{t("profile.recent_orders")}</Text>
              {data.recentOrders.slice(0, 3).map((order: any) => (
                <Pressable
                  key={order.id}
                  style={({ pressed }) => [dashStyles.recentOrder, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => router.push("/(tabs)/orders")}
                >
                  <View>
                    <Text style={[dashStyles.orderId, { color: colors.foreground }]}>{t("profile.order_id", { id: String(order.id) })}</Text>
                    <Text style={[dashStyles.orderMeta, { color: colors.mutedForeground }]}>{order.customerName} · {new Date(order.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View>
                    <Text style={[dashStyles.orderTotal, { color: colors.foreground }]}>${order.total.toFixed(2)}</Text>
                    <Text style={{ color: "#F59E0B", fontSize: T.font.caption, textAlign: "right" }}>{order.status}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

// ─── StyleSheets ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shopContainer: { flex: 1 },
  shopHeader: { paddingHorizontal: T.spacing.lg, paddingBottom: T.spacing.sm, borderBottomWidth: 1, gap: 10 },
  homeTopRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  shopTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: T.font.caption, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  shopTitle: { fontSize: T.font.display, fontWeight: "700" as const },
  searchIconBtn: { width: 40, height: 40, borderRadius: T.radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  clearAllBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.md, borderWidth: 1 },
  clearAllText: { fontSize: T.font.caption, fontWeight: "500" as const },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: T.spacing.sm, paddingHorizontal: T.spacing.md, borderRadius: T.radius.md, borderWidth: 1, height: 42 },
  searchInput: { flex: 1, fontSize: T.font.body },
  categoryScroll: { gap: T.spacing.sm, paddingVertical: 2 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: T.radius.xl },
  chipText: { fontSize: T.font.bodySm, fontWeight: "500" as const },
  grid: { gap: 10 },
  row: { gap: 10, paddingHorizontal: T.spacing.md },
  cardWrapper: { flex: 1 },
  emptyContainer: { alignItems: "center", gap: T.spacing.sm, paddingTop: 60, paddingBottom: 40 },
  emptyText: { fontSize: T.font.bodyLg },
  sortChip: { paddingHorizontal: T.spacing.md, paddingVertical: 5, borderRadius: T.radius.xl, borderWidth: 1 },
  sortChipText: { fontSize: T.font.caption, fontWeight: "500" as const },
});

const sectionStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: T.spacing.md },
  label: { fontSize: T.font.h3, fontWeight: "700" as const },
  seeAll: { fontSize: T.font.bodySm, fontWeight: "600" as const },
});

const headerStyles = StyleSheet.create({
  badge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: T.spacing.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeNum: { color: "#000", fontSize: T.font.nano, fontWeight: "800" as const },
});

const heroStyles = StyleSheet.create({
  container: { borderRadius: T.radius.lg, borderWidth: 1, overflow: "hidden", position: "relative", minHeight: 360 },
  bgImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" } as any,
  darkOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.58)" },
  glowOverlay: { position: "absolute", inset: 0 } as any,
  glow1: { position: "absolute", top: -30, left: "25%", width: 200, height: 120, borderRadius: 100, backgroundColor: "#10b98110" },
  glow2: { position: "absolute", bottom: -20, right: "20%", width: 150, height: 80, borderRadius: 75, backgroundColor: "#10b9810a" },
  discountBadge: { position: "absolute", top: T.spacing.md, left: T.spacing.md, paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.xl, zIndex: 10 },
  discountBadgeText: { color: "#000", fontSize: T.font.label, fontWeight: "800" as const },
  floatingCard: { position: "absolute", zIndex: 15, flexDirection: "row", alignItems: "center", borderRadius: T.radius.md, borderWidth: 1, padding: T.spacing.sm, gap: 6, maxWidth: 130 },
  floatingCardIcon: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  floatingCardName: { color: "#fff", fontSize: T.font.micro, fontWeight: "700" as const, lineHeight: 13 },
  floatingCardAvail: { fontSize: T.font.nano, fontWeight: "600" as const },
  content: { padding: T.spacing.xl, gap: T.spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: T.radius.xl, borderWidth: 1, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: T.font.label, fontWeight: "700" as const, letterSpacing: 1 },
  tagline: { fontSize: T.font.hero, fontWeight: "800" as const, letterSpacing: -0.5, lineHeight: 34 },
  subtitle: { fontSize: T.font.bodySm, fontWeight: "400" as const, lineHeight: 18 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  ctaPrimary: { paddingHorizontal: T.spacing.xl, paddingVertical: 11, borderRadius: T.radius.pill, alignItems: "center", justifyContent: "center" },
  ctaPrimaryText: { color: "#000", fontSize: T.font.body, fontWeight: "700" as const },
  ctaSecondary: { paddingHorizontal: T.spacing.lg, paddingVertical: 10, borderRadius: T.radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ctaSecondaryText: { color: "#fff", fontSize: T.font.bodySm, fontWeight: "500" as const },
  statsRow: { flexDirection: "row", alignItems: "center", paddingTop: 14, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: T.font.body, fontWeight: "800" as const },
  statLabel: { fontSize: T.font.micro, fontWeight: "400" as const, color: "rgba(255,255,255,0.7)", textAlign: "center" as const },
  statDivider: { width: 1, height: 28 },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: T.spacing.md },
  slideDot: { height: 4, borderRadius: 2 },
});

// heroV2 — Phase 2 stacked layout styles (web-exact @ 390px)
const heroV2 = StyleSheet.create({
  imageCardWrap: { paddingHorizontal: 16 },
  imageCard: { borderRadius: 12, overflow: "hidden", borderWidth: 1, aspectRatio: 4 / 3, position: "relative" },
  fillImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" } as any,
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.30)" },
  discBadge: { position: "absolute", zIndex: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  discBadgeText: { color: "#000", fontWeight: "800" as const, fontSize: 14 },
  floatCard: { position: "absolute", zIndex: 10, borderRadius: 16, padding: 12, borderWidth: 1, width: 170 },
  floatCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  floatCardImg: { width: 40, height: 40, borderRadius: 8, borderWidth: 1 },
  floatCardInfo: { flex: 1, minWidth: 0 },
  floatCardName: { fontSize: 11, fontWeight: "600" as const, lineHeight: 14 },
  floatCardPrice: { fontSize: 12, fontWeight: "800" as const, marginTop: 2 },
  miniDots: { flexDirection: "row", gap: 3, marginTop: 8 },
  miniDot: { height: 3, borderRadius: 2 },
  carouselDots: { position: "absolute", bottom: 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  carouselDot: { height: 4, borderRadius: 2 },
  textPanel: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 32, gap: 0 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#10b98140", backgroundColor: "#10b98108", marginBottom: 32 },
  badgeText: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.72, textTransform: "uppercase" as const },
  headline: { fontSize: 40, fontWeight: "900" as const, letterSpacing: -0.4, lineHeight: 48, marginBottom: 24 },
  subtitle: { fontSize: 17, lineHeight: 30, marginBottom: 40 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  ctaPrimary: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  ctaPrimaryText: { color: "#000", fontWeight: "700" as const, fontSize: 15 },
  ctaGhost: { paddingHorizontal: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  ctaGhostText: { fontSize: 14, fontWeight: "500" as const },
  statsRow: { flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, paddingTop: 24, marginTop: 32, gap: 0 },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "800" as const, letterSpacing: -0.36 },
  statLabel: { fontSize: 13, lineHeight: 18, textAlign: "center" as const },
  statDivider: { width: 1, height: 36, alignSelf: "center" },
});

const heroStyles2 = StyleSheet.create({
  container: { paddingHorizontal: T.spacing.lg, paddingTop: T.spacing.xl, paddingBottom: 4, gap: 0 },
  loading: { height: 130, alignItems: "center", justifyContent: "center" },
  list: { gap: 10, paddingBottom: 4 },
  allProductsHeader: { paddingHorizontal: T.spacing.lg, paddingTop: T.spacing.lg, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: T.spacing.sm },
  allTitle: { fontSize: T.font.h2, fontWeight: "700" as const },
});

const catGridStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 48 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cell: { width: "48%", aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden", position: "relative" },
  img: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" } as any,
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)" },
  colorBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2 },
  textWrap: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 },
  catName: { color: "#fff", fontSize: 17, fontWeight: "700" as const },
  catCount: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "400" as const, marginTop: 2 },
});

// ─── Product Card Styles (Phase 5 — matches web TrendingCard) ─────────────────
const pcStyles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", flexDirection: "column" },
  imgWrap: { width: "100%", aspectRatio: 1, position: "relative", overflow: "hidden", backgroundColor: "transparent" },
  img: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" } as any,
  imgOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.04)" },
  badgeEnd: { position: "absolute", top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeEndText: { color: "#000", fontSize: 11, fontWeight: "700" as const },
  badgeTrend: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeTrendText: { fontSize: 10, fontWeight: "700" as const },
  wishBtn: { position: "absolute", top: 10, left: 10, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  body: { padding: 20, flex: 1, gap: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  metaText: { fontSize: 11, fontWeight: "500" as const, flex: 1 },
  metaStore: { fontSize: 11, fontWeight: "400" as const, marginStart: 6, flexShrink: 0, maxWidth: "45%" as any },
  title: { fontSize: 16, fontWeight: "700" as const, lineHeight: 22, minHeight: 44, marginBottom: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 12, height: 18 },
  ratingText: { fontSize: 12, fontWeight: "600" as const, marginStart: 4 },
  priceCartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" as any, gap: 6 },
  originalPrice: { fontSize: 11, textDecorationLine: "line-through" as const, lineHeight: 14 },
  mainPrice: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.36 },
  cartBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  cartBtnText: { fontSize: 12, fontWeight: "600" as const },
  stockWarn: { fontSize: 10, fontWeight: "500" as const, marginTop: 4 },
});

const dealStyles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 48 },
  header: { gap: T.spacing.sm, marginBottom: 4 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  timerLabel: { fontSize: T.font.label, fontWeight: "500" as const },
  timerChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: T.radius.sm, borderWidth: 1 },
  timerVal: { fontSize: T.font.caption, fontWeight: "700" as const, fontVariant: ["tabular-nums" as any] },
  timerColon: { fontSize: T.font.caption, fontWeight: "700" as const },
  list: { gap: 10, paddingBottom: 6, paddingRight: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: T.spacing.sm },
});

const storeStyles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 48 },
  list: { gap: T.spacing.md },
  card: { borderRadius: T.radius.lg, borderWidth: 1, overflow: "hidden" },
  coverWrap: { height: 160, position: "relative" },
  cover: { width: "100%", height: "100%" },
  coverOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  verifiedBadge: { position: "absolute", top: T.spacing.sm, left: T.spacing.sm, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: T.spacing.sm, paddingVertical: 3, borderRadius: T.radius.xl, borderWidth: 1 },
  verifiedDot: { width: 5, height: 5, borderRadius: 3 },
  verifiedText: { fontSize: T.font.micro, fontWeight: "600" as const },
  cardBody: { padding: 24, marginTop: -32, gap: 4 },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  logoCircle: { width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  logoInitial: { fontSize: 24, fontWeight: "900" as const },
  ratingWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  rating: { fontSize: T.font.caption, fontWeight: "700" as const },
  reviewCount: { fontSize: T.font.label },
  storeName: { fontSize: 19, fontWeight: "800" as const },
  storeCategory: { fontSize: T.font.caption },
  storeTagline: { fontSize: 13, lineHeight: 20, marginTop: 2, marginBottom: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 8 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statsText: { fontSize: T.font.label },
  visitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: T.radius.md, borderWidth: 1 },
  visitBtnText: { fontSize: 14, fontWeight: "700" as const },
});

const joinStyles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 48 },
  outerCard: { borderRadius: 24, borderWidth: 1, overflow: "hidden", paddingVertical: 32, paddingHorizontal: 24, position: "relative" },
  glow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24 },
  header: { alignItems: "center", gap: T.spacing.sm, marginBottom: T.spacing.xl },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: T.spacing.md, paddingVertical: 4, borderRadius: T.radius.xl, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.96 },
  title: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.48, textAlign: "center" },
  subtitle: { fontSize: 16, fontWeight: "400" as const, lineHeight: 27, textAlign: "center", opacity: 0.8 },
  cardsRow: { flexDirection: "row", gap: 20 },
  card: { flex: 1, borderRadius: T.radius.lg, borderWidth: 1, padding: 20, gap: T.spacing.sm },
  sellerCard: { backgroundColor: "#10b98108" },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cardTitle: { fontSize: 20, fontWeight: "800" as const },
  cardDesc: { fontSize: 14, lineHeight: 23, opacity: 0.75 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  ctaText: { fontSize: 14, fontWeight: "700" as const },
});

const miniStyles = StyleSheet.create({
  card: { width: 130, borderRadius: T.radius.lg, borderWidth: 1, overflow: "hidden" },
  imgWrap: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  badge: { position: "absolute", top: 5, start: 5, backgroundColor: "#EF4444", borderRadius: T.radius.sm, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: T.font.micro, fontWeight: "700" as const },
  info: { padding: T.spacing.sm, gap: 3 },
  name: { fontSize: T.font.caption, fontWeight: "500" as const, lineHeight: 15 },
  price: { fontSize: T.font.bodySm, fontWeight: "800" as const },
});

const suggStyles = StyleSheet.create({
  overlay: { borderWidth: 1, borderRadius: T.radius.md, overflow: "hidden", marginTop: -4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: T.spacing.md, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, fontSize: T.font.bodySm },
  catBadge: { fontSize: T.font.micro, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.4, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
});

const intentStyles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: T.spacing.md, paddingVertical: 6, borderRadius: T.radius.md, borderWidth: 1, marginTop: 4 },
  bannerText: { fontSize: T.font.caption, fontWeight: "600" as const, flex: 1 },
});

const quickStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: T.spacing.sm, marginTop: 4 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: T.spacing.md, paddingVertical: T.spacing.sm, borderRadius: T.radius.md, borderWidth: 1 },
  btnText: { flex: 1, fontSize: T.font.caption, fontWeight: "500" as const },
});

const relStyles = StyleSheet.create({
  container: { paddingHorizontal: T.spacing.md, paddingVertical: T.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontSize: T.font.label, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  chipRow: { gap: T.spacing.sm, paddingBottom: 4 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: T.spacing.md, paddingVertical: 6, borderRadius: T.radius.xl, borderWidth: 1 },
  chipText: { fontSize: T.font.bodySm, fontWeight: "500" as const },
});

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: T.radius.lg, borderWidth: 1, padding: 14, gap: 6, minHeight: 100 },
  iconWrap: { width: 38, height: 38, borderRadius: T.radius.md, alignItems: "center", justifyContent: "center" },
  value: { fontSize: T.font.h1, fontWeight: "700" as const, marginTop: 4 },
  label: { fontSize: T.font.caption },
});

const richHeaderStyles = StyleSheet.create({
  container: { marginBottom: 32 },
  eyebrow: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 1.44, textTransform: "uppercase" as const, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800" as const, letterSpacing: -0.48, flex: 1 },
  seeAll: { fontSize: 14, fontWeight: "600" as const },
});

const dashStyles = StyleSheet.create({
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  alert: { flexDirection: "row", alignItems: "center", gap: T.spacing.sm, padding: T.spacing.md, borderRadius: T.radius.md, borderWidth: 1 },
  alertText: { fontSize: T.font.bodySm, flex: 1 },
  sectionTitle: { fontSize: T.font.h3, fontWeight: "700" as const, marginBottom: 10 },
  recentOrder: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: T.spacing.md, borderRadius: T.radius.md, borderWidth: 1, marginBottom: T.spacing.sm },
  orderId: { fontSize: T.font.body, fontWeight: "600" as const },
  orderMeta: { fontSize: T.font.caption, marginTop: 2 },
  orderTotal: { fontSize: T.font.bodyLg, fontWeight: "700" as const, textAlign: "right" },
});

const arriStyles = StyleSheet.create({
  card: { borderRadius: T.radius.lg, overflow: "hidden", minHeight: 200, borderWidth: 1, position: "relative" },
  cardLarge: { minHeight: 280 },
  img: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" } as any,
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.52)" },
  cardContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: T.spacing.md, gap: 4 },
  newBadge: { alignSelf: "flex-start" as const, paddingHorizontal: 7, paddingVertical: 3, borderRadius: T.radius.sm, marginBottom: 2 },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" as const, lineHeight: 20 },
  cardNameLarge: { fontSize: 28, lineHeight: 36 },
});

// ─── Navbar Styles ────────────────────────────────────────────────────────────
const navbarStyles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    zIndex: 50,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: T.spacing.lg,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  sLetter: {
    color: "#000",
    fontWeight: "800" as const,
    fontSize: 14,
    letterSpacing: -0.5,
  },
  brand: {
    fontWeight: "800" as const,
    fontSize: 16,
    letterSpacing: 1.5,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  iconBadgeText: {
    color: "#000",
    fontSize: 9,
    fontWeight: "800" as const,
    lineHeight: 11,
  },
  searchRow: {
    paddingHorizontal: T.spacing.lg,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: T.spacing.sm,
    paddingHorizontal: T.spacing.md,
    borderRadius: T.radius.md,
    borderWidth: 1,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: T.font.body,
  },
});

// ─── Drawer Styles ────────────────────────────────────────────────────────────
const drawerStyles = StyleSheet.create({
  panel: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  sText: {
    color: "#000",
    fontWeight: "800" as const,
    fontSize: 16,
  },
  brand: {
    fontWeight: "800" as const,
    fontSize: 17,
    letterSpacing: 1.2,
  },
  brandAr: {
    color: "#10b98199",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "400" as const,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: T.radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  linkList: {
    paddingTop: T.spacing.sm,
    paddingBottom: T.spacing.xl,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: T.spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkText: {
    fontSize: T.font.body,
    fontWeight: "500" as const,
  },
  divider: {
    height: 1,
    marginVertical: T.spacing.sm,
    marginHorizontal: T.spacing.lg,
  },
  footer: {
    padding: T.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  authBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: T.radius.md,
    borderWidth: 1,
  },
  authBtnText: {
    fontSize: T.font.body,
    fontWeight: "700" as const,
  },
});
