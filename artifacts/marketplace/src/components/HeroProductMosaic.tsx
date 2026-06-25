// @refresh reset
/**
 * HeroProductMosaic — Live product grid for the V4 hero right column
 *
 * Displays 4 products from the best-sellers feed in a 2×2 grid.
 * Fallback: 4 category tiles (gradient + icon) when no products exist.
 * No stock photography. No Unsplash. No placeholder images.
 */
import React, { memo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Cpu, Shirt, Sparkles, Home as HomeIcon,
  ShoppingCart, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetBestSellers,
  getGetBestSellersQueryKey,
  type BestSellerProduct,
} from "@workspace/api-client-react";
import { useCurrency } from "@/contexts/CurrencyContext";

// ─── Category fallback tiles (no photography — gradient + icon) ───────────────

interface FallbackTile {
  slug: string;
  en: string;
  ar: string;
  fromColor: string;
  toColor: string;
  border: string;
  icon: React.ElementType;
  iconColor: string;
}

const FALLBACK_TILES: FallbackTile[] = [
  {
    slug: "Electronics",
    en: "Electronics",
    ar: "الإلكترونيات",
    fromColor: "#1d4ed8",
    toColor: "#1e3a8a",
    border: "border-blue-600/25",
    icon: Cpu,
    iconColor: "#93c5fd",
  },
  {
    slug: "Fashion",
    en: "Fashion",
    ar: "الأزياء",
    fromColor: "#e11d48",
    toColor: "#881337",
    border: "border-rose-600/25",
    icon: Shirt,
    iconColor: "#fda4af",
  },
  {
    slug: "Home & Kitchen",
    en: "Home",
    ar: "المنزل",
    fromColor: "#d97706",
    toColor: "#92400e",
    border: "border-amber-600/25",
    icon: HomeIcon,
    iconColor: "#fcd34d",
  },
  {
    slug: "Beauty & Personal Care",
    en: "Beauty",
    ar: "الجمال",
    fromColor: "#db2777",
    toColor: "#831843",
    border: "border-pink-600/25",
    icon: Sparkles,
    iconColor: "#f9a8d4",
  },
];

const CategoryTile = memo(function CategoryTile({
  tile,
  lang,
}: {
  tile: FallbackTile;
  lang: string;
}) {
  const { icon: Icon } = tile;
  return (
    <Link href={`/shop?category=${encodeURIComponent(tile.slug)}`}>
      <div
        className={cn(
          "relative flex flex-col items-center justify-center h-full",
          "rounded-xl overflow-hidden border cursor-pointer",
          "hover:brightness-110 transition-all duration-200 active:scale-[0.97]",
          "group min-h-[100px]",
          tile.border,
        )}
        style={{
          background: `linear-gradient(135deg, ${tile.fromColor} 0%, ${tile.toColor} 100%)`,
        }}
      >
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden="true"
        />
        <Icon
          className="h-7 w-7 mb-1.5 relative z-10"
          style={{ color: tile.iconColor }}
        />
        <span
          className="text-[11px] font-bold relative z-10 text-center px-2 leading-tight"
          style={{ color: tile.iconColor }}
        >
          {lang === "ar" ? tile.ar : tile.en}
        </span>
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-colors duration-200" />
      </div>
    </Link>
  );
});

// ─── Product tile ─────────────────────────────────────────────────────────────

const ProductTile = memo(function ProductTile({
  product,
  lang,
}: {
  product: BestSellerProduct;
  lang: string;
}) {
  const { format } = useCurrency();
  const img = product.imageUrls?.[0] ?? product.imageUrl;
  const displayPrice = product.finalPrice ?? product.price;
  const hasDiscount =
    product.discountPercent &&
    product.discountPercent > 0 &&
    product.price > displayPrice;
  const discountPct = hasDiscount
    ? Math.round(product.discountPercent!)
    : null;
  const name =
    lang === "ar" && product.nameAr ? product.nameAr : product.name;

  return (
    <Link href={`/products/${product.id}`}>
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-xl border border-border/60 bg-card",
          "cursor-pointer group",
          "hover:border-primary/40 hover:shadow-md transition-all duration-200 active:scale-[0.97]",
        )}
      >
        {/* Square image */}
        <div className="relative w-full aspect-square bg-muted overflow-hidden shrink-0">
          {img ? (
            <img
              src={img}
              alt={name}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <ShoppingCart className="h-7 w-7 text-muted-foreground/30" />
            </div>
          )}
          {discountPct && (
            <span className="absolute top-1.5 start-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 leading-none">
              -{discountPct}%
            </span>
          )}
        </div>

        {/* Name + price */}
        <div className="p-2">
          <p className="text-[11px] font-medium text-foreground line-clamp-1 leading-tight mb-0.5">
            {name}
          </p>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-xs font-bold text-foreground tabular-nums" translate="no">
              {format(displayPrice)}
            </span>
            {hasDiscount && (
              <span className="text-[10px] text-muted-foreground line-through tabular-nums" translate="no">
                {format(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});

// ─── Main export ──────────────────────────────────────────────────────────────

export const HeroProductMosaic = memo(function HeroProductMosaic() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: products, isLoading } = useGetBestSellers(4, {
    query: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryKey: getGetBestSellersQueryKey(4),
    },
  });

  const hasProducts = !isLoading && products && products.length > 0;
  const showFallback = !isLoading && (!products || products.length === 0);

  return (
    <div className="h-full bg-muted/25 border-s border-border/50 flex flex-col gap-2.5 p-3">
      {/* 2×2 grid — flex-1 so it fills available height */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        {isLoading
          ? Array(4)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-muted animate-pulse min-h-[100px]"
                />
              ))
          : hasProducts
            ? products!
                .slice(0, 4)
                .map((p) => (
                  <ProductTile key={p.id} product={p} lang={lang} />
                ))
            : showFallback
              ? FALLBACK_TILES.map((tile) => (
                  <CategoryTile key={tile.slug} tile={tile} lang={lang} />
                ))
              : null}
      </div>

      {/* Browse all link */}
      <Link
        href="/shop"
        className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary hover:underline py-0.5 shrink-0"
      >
        <ArrowRight className="h-3 w-3 rtl:rotate-180" />
        {t("home.footer.link_all_products")}
      </Link>
    </div>
  );
});
