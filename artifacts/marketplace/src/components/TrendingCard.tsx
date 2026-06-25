/**
 * TrendingCard — canonical product card for SYANO marketplace.
 *
 * This is the single source of truth for product card UI.
 * Used by: HomeSections/TrendingProducts (homepage) and ProductCard (products page).
 *
 * Data is supplied via TrendingProductData, which covers both static homepage
 * placeholders and real API products (via the adapter in ProductCard.tsx).
 */

import { Star, Heart, TrendingUp, ShoppingCart, Timer } from "lucide-react";
import { motion } from "framer-motion";
import React, { useState, useCallback } from "react";
import { highlightMatch } from "@/utils/highlightMatch";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestCart } from "@/contexts/GuestCartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export interface TrendingProductData {
  id: number;
  name: string;
  categoryLabel: string;
  store: string;
  /** Display price — final price after discount, or regular price (SYP) */
  price: number;
  /** Original price before discount — triggers strikethrough + discount badge (SYP) */
  originalPrice?: number;
  /** Discount percent, e.g. 30 for 30% off */
  discountPercent?: number;
  /** Real average rating (null / 0 = no reviews yet, hides rating row) */
  rating: number;
  /** Real review count (0 = no reviews yet) */
  reviews: number;
  img: string;
  /** Show trending badge when true (and no discount badge is shown) */
  trending: boolean;
  /** Remaining stock — shows warning ≤5, shows out-of-stock badge ≤0 */
  stock?: number;
  /** When true, add-to-cart navigates to detail page to pick a variant */
  hasVariants?: boolean;
  /** Flash-sale countdown string, e.g. "02:14:33" — renders red bar on image */
  flashSaleEndsIn?: string;
}

export function TrendingCard({ product, i = 0, highlightQuery }: { product: TrendingProductData; i?: number; highlightQuery?: string }) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { format } = useCurrency();
  const { isAuthenticated, isCustomer, isSeller, isAdmin, isCourier } = useAuth();
  const { addGuestItem } = useGuestCart();
  const { toggle: toggleWishlist, isInWishlist } = useWishlist();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const wishlisted = product.id > 0 ? isInWishlist(product.id) : false;

  const hasDiscount = !!(product.originalPrice && product.discountPercent && product.discountPercent > 0);
  const outOfStock = typeof product.stock === "number" && product.stock <= 0;
  const lowStock = typeof product.stock === "number" && product.stock > 0 && product.stock <= 5;
  const hasRealRating = product.rating > 0;

  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: t("cart.added_title", "Added to cart ✓"), description: product.name });
      },
    },
  });

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.id === 0) { navigate("/shop"); return; }
    if (isSeller || isAdmin || isCourier) return;
    if (outOfStock) return;
    if (product.hasVariants) { navigate(`/products/${product.id}`); return; }
    setAdding(true);
    if (isAuthenticated && isCustomer) {
      addToCartMutation.mutate(
        { data: { productId: product.id, quantity: 1, variantId: null } },
        { onSettled: () => setTimeout(() => setAdding(false), 800) }
      );
    } else {
      addGuestItem(product.id, null, 1);
      toast({ title: t("cart.added_title", "Added to cart ✓"), description: product.name });
      setTimeout(() => setAdding(false), 800);
    }
  }, [product, isAuthenticated, isCustomer, isSeller, isAdmin, isCourier, outOfStock, addGuestItem, navigate, t]);

  const handleWishlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.id === 0) return;
    toggleWishlist(product.id);
  }, [product.id, toggleWishlist]);

  const href = product.id > 0 ? `/products/${product.id}` : "/products";
  const showCart = !isSeller && !isAdmin && !isCourier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: i * 0.07, ease }}
      className={cn(
        "group bg-card border border-border hover:border-border/80 rounded-2xl overflow-hidden",
        "sy-card-elevated hover:-translate-y-1 transition-all duration-300",
        "flex flex-col cursor-pointer relative",
        outOfStock && "opacity-70"
      )}
      onClick={() => navigate(href)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(href)}
      aria-label={`View ${product.name}`}
    >
      {/* ── Image ─────────────────────────────────────────── */}
      <div className="relative aspect-square bg-muted overflow-hidden shrink-0">
        {product.img ? (
          <img
            src={product.img}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            style={{ filter: "brightness(var(--img-dim-product)) contrast(1.05)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/50 text-muted-foreground">
            <span className="text-xs font-medium px-2 text-center">{t("product_detail.no_image")}</span>
          </div>
        )}

        <div className="absolute inset-0 sy-overlay-light pointer-events-none" />

        {/* Badge — discount takes priority over trending */}
        {hasDiscount ? (
          <div className="absolute top-3 end-3 z-10">
            <div
              style={{ fontWeight: 700, fontSize: "11px" }}
              className="bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full"
            >
              -{product.discountPercent}%
            </div>
          </div>
        ) : product.trending ? (
          <div className="absolute top-3 end-3 z-10">
            <div
              style={{ fontWeight: 700, fontSize: "11px" }}
              className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full backdrop-blur-sm"
            >
              <TrendingUp className="w-3 h-3" />
              {t("home.trending.trending_badge")}
            </div>
          </div>
        ) : null}

        {/* Wishlist */}
        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? t("a11y.removeFromWishlist") : t("a11y.addToWishlist")}
          className={cn(
            "absolute top-3 start-3 z-10 w-8 h-8 rounded-full flex items-center justify-center",
            "backdrop-blur-sm border transition-all duration-200",
            wishlisted
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
              : "bg-black/40 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
          )}
        >
          <Heart className={cn("w-3.5 h-3.5", wishlisted && "fill-rose-400")} />
        </button>

        {/* Flash-sale countdown bar */}
        {product.flashSaleEndsIn && (
          <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2 py-1 tabular-nums">
            <Timer className="h-2.5 w-2.5 shrink-0" />
            <span className="opacity-80">{t("home.deals.ends_in")}</span>
            <span dir="ltr">{product.flashSaleEndsIn}</span>
          </div>
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────── */}
      <div className="p-5 flex flex-col flex-1 pc-body">

        {/* Category · Store */}
        <div className="flex items-center justify-between mb-2 pc-cat-row">
          <p style={{ fontWeight: 500, fontSize: "11px" }} className="text-muted-foreground truncate">
            {product.categoryLabel}
          </p>
          {product.store && (
            <p style={{ fontWeight: 400, fontSize: "11px" }} className="text-muted-foreground/70 truncate ms-2 shrink-0 max-w-[45%]">
              {product.store}
            </p>
          )}
        </div>

        {/* Title — 2-line clamp, fixed height for grid alignment */}
        <h3
          style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.4, minHeight: "2.8em" }}
          className="text-foreground mb-3 group-hover:text-emerald-400 transition-colors duration-200 line-clamp-2 pc-title"
        >
          {highlightQuery
            ? highlightMatch(product.name, highlightQuery).map((seg, idx) =>
                seg.highlight
                  ? <mark key={idx} className="bg-primary/20 text-primary rounded-sm px-0.5 not-italic">{seg.part}</mark>
                  : <span key={idx}>{seg.part}</span>
              )
            : product.name}
        </h3>

        {/* Rating — only rendered when real review data exists; spacer preserves grid height */}
        {hasRealRating ? (
          <div className="flex items-center gap-2 mb-4 pc-rating-row" style={{ minHeight: "1.125rem" }}>
            <div
              className="flex items-center gap-0.5 pc-stars"
              role="img"
              aria-label={`${product.rating.toFixed(1)} ${t("product_detail.stars_out_of_5")}`}
            >
              {[...Array(5)].map((_, j) => (
                <Star
                  key={j}
                  aria-hidden="true"
                  className={cn(
                    "w-3 h-3",
                    j < Math.floor(product.rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-foreground/10"
                  )}
                />
              ))}
            </div>
            <span style={{ fontWeight: 600, fontSize: "12px" }} className="text-foreground/50 pc-rating-text" aria-hidden="true">
              {product.rating.toFixed(1)}{product.reviews > 0 ? ` (${product.reviews})` : ""}
            </span>
          </div>
        ) : (
          <div className="mb-4" style={{ minHeight: "1.125rem" }} />
        )}

        {/* Price + Add-to-cart */}
        <div className="flex items-center justify-between mt-auto gap-2 pc-price-row">
          <div className="min-w-0">
            {/* Strikethrough original price */}
            {hasDiscount && (
              <p className="text-[11px] text-muted-foreground line-through leading-none mb-0.5 pc-price-orig" translate="no">
                {format(product.originalPrice!)}
              </p>
            )}
            <div
              style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em" }}
              className="text-emerald-400 pc-price-main"
              translate="no"
            >
              {format(product.price)}
            </div>
          </div>

          {showCart && (
            <button
              onClick={handleAddToCart}
              disabled={adding || outOfStock}
              style={{ fontWeight: 600, fontSize: "0.8125rem" }}
              className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-4 py-2 rounded-xl transition-all duration-200 border border-emerald-500/20 hover:border-emerald-500 disabled:opacity-50 shrink-0 pc-cart-btn"
              aria-label={product.hasVariants ? t("products.choose_options") : t("product_detail.add_to_cart")}
            >
              {adding
                ? <div className="w-3.5 h-3.5 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
                : <ShoppingCart className="w-3.5 h-3.5" />
              }
              {t("home.trending.add")}
            </button>
          )}
        </div>

        {/* Stock warnings */}
        {lowStock && (
          <div className="mt-2 text-[10px] font-medium text-destructive">
            {t("products.only_left", { count: product.stock })}
          </div>
        )}
        {outOfStock && (
          <div className="mt-2 text-[10px] font-medium text-muted-foreground">
            {t("products.out_of_stock")}
          </div>
        )}
      </div>
    </motion.div>
  );
}
