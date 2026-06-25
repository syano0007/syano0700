import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { calculateDiscountPercent } from "@/lib/pricing";
import { Link, useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { useGetProduct, useAddToCart, getGetCartQueryKey, useStartConversation, getGetProductQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useGuestCart } from "@/contexts/GuestCartContext";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import { ReviewSection } from "@/components/ReviewSection";
import { RelatedProducts } from "@/components/RelatedProducts";
import { useSEO } from "@/hooks/useSEO";
import { FEATURES } from "@/lib/features";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import {
  ChevronLeft, Minus, Plus, ShoppingCart, Truck, ShieldCheck, RefreshCw,
  ZoomIn, X, AlertTriangle, ChevronRight, Package, MessageCircle, Check,
  Package2
} from "lucide-react";
import { SellerTrustBadge, TrustScoreBar, type VerificationLevel } from "@/components/SellerTrustBadge";

// ── Module-level helpers ──────────────────────────────────────────────────────

const COLOR_VALUE_MAP: Record<string, string> = {
  red: "#EF4444", blue: "#3B82F6", green: "#10B981", black: "#111111",
  white: "#F9FAFB", yellow: "#F59E0B", purple: "#8B5CF6", pink: "#EC4899",
  orange: "#F97316", gray: "#6B7280", grey: "#6B7280", brown: "#92400E",
  navy: "#1E3A8A", teal: "#14B8A6", cyan: "#06B6D4", indigo: "#6366F1",
  silver: "#C0C0C0", gold: "#D4AF37", beige: "#F5F5DC", cream: "#FFFDD0",
  maroon: "#800000", olive: "#808000", lime: "#84CC16", violet: "#7C3AED",
  rose: "#F43F5E", sky: "#0EA5E9", emerald: "#10B981", amber: "#F59E0B",
  أحمر: "#EF4444", أزرق: "#3B82F6", أخضر: "#10B981", أسود: "#111111",
  أبيض: "#F9FAFB", أصفر: "#F59E0B", بنفسجي: "#8B5CF6", وردي: "#EC4899",
  برتقالي: "#F97316", رمادي: "#6B7280", بني: "#92400E", كحلي: "#1E3A8A",
  فيروزي: "#14B8A6", ذهبي: "#D4AF37", فضي: "#C0C0C0",
};

function getColorSwatch(value: string): string | null {
  const lower = value.toLowerCase().trim();
  if (COLOR_VALUE_MAP[lower]) return COLOR_VALUE_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_VALUE_MAP)) {
    if (lower.startsWith(key) || lower.endsWith(key) || lower === key) return hex;
  }
  return null;
}

const COLOR_GROUP_NAMES = new Set(["color", "colour", "colors", "colours", "اللون", "لون", "الألوان"]);
function isColorGroup(name: string): boolean {
  return COLOR_GROUP_NAMES.has(name.toLowerCase().trim());
}

function parseSpecsFromDescription(description: string): { specs: { label: string; value: string }[]; remainder: string } {
  if (!description) return { specs: [], remainder: "" };
  const lines = description.split("\n");
  const specs: { label: string; value: string }[] = [];
  const remainderLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^([^:\n]{1,40}):\s*(.{1,120})$/);
    if (match && match[1].trim() && match[2].trim()) {
      specs.push({ label: match[1].trim(), value: match[2].trim() });
    } else {
      remainderLines.push(line);
    }
  }
  if (specs.length < 2) {
    return { specs: [], remainder: description };
  }
  return { specs, remainder: remainderLines.join("\n").trim() };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContactSellerButton({ sellerId, className }: { sellerId: number; className?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const startConv = useStartConversation();
  const handleContact = () => {
    startConv.mutate(
      { sellerId },
      {
        onSuccess: () => navigate("/messages"),
        onError: () =>
          toast({ title: t("common.error"), description: t("product.contact_error"), variant: "destructive" }),
      }
    );
  };
  return (
    <button
      onClick={handleContact}
      disabled={startConv.isPending}
      className={`w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-foreground transition-colors disabled:opacity-60 ${className ?? ""}`}
    >
      <MessageCircle className="h-4 w-4 text-primary" />
      {t("messages.contact_seller", "Contact Seller")}
    </button>
  );
}

function ProductSkeleton() {
  return (
    <Layout>
      <div className="container py-5 md:py-10">
        <div className="h-4 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16">
          <div className="space-y-3">
            <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-52 bg-muted rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-4 pt-2">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-9 bg-muted rounded w-4/5 animate-pulse" />
            <div className="h-9 bg-muted rounded w-3/5 animate-pulse" />
            <div className="h-5 w-28 bg-muted rounded animate-pulse" />
            <div className="h-14 w-40 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded-xl animate-pulse" />
            <div className="h-28 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { isCustomer, isAuthenticated } = useAuth();
  const { addGuestItem } = useGuestCart();
  const { format } = useCurrency();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { trackView } = useRecentlyViewed();

  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeImageOverride, setActiveImage] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [purchaseSheetOpen, setPurchaseSheetOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxOpen]);

  const { data: product, isLoading, error } = useGetProduct(id, {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id) },
  });

  const hasVariants = (product?.variantGroups?.length ?? 0) > 0;

  function isOptionAvailableWith(test: Record<number, number>, optionId: number): boolean {
    if (!product?.variants?.length) return true;
    const testIds = new Set(Object.values(test));
    return product.variants.some(
      (v) =>
        v.active &&
        v.stock > 0 &&
        v.options.some((o) => o.optionId === optionId) &&
        (Object.keys(test).length < (product.variantGroups?.length ?? 0) ||
          (v.options.length === (product.variantGroups?.length ?? 0) &&
            v.options.every((o) => testIds.has(o.optionId))))
    );
  }

  function isOptionAvailable(groupId: number, optionId: number): boolean {
    return isOptionAvailableWith({ ...selectedOptions, [groupId]: optionId }, optionId);
  }

  useEffect(() => {
    if (!product?.variantGroups?.length || !product.variants?.length) return;
    if (Object.keys(selectedOptions).length > 0) return;
    const auto: Record<number, number> = {};
    for (const group of product.variantGroups as any[]) {
      for (const option of group.options as any[]) {
        const test = { ...auto, [group.id]: option.id };
        const testIds = new Set(Object.values(test));
        const valid = (product.variants as any[]).some((v) =>
          v.active && v.stock > 0 &&
          v.options.some((o: any) => o.optionId === option.id) &&
          (Object.keys(test).length < product.variantGroups!.length ||
            (v.options.length === product.variantGroups!.length &&
              v.options.every((o: any) => testIds.has(o.optionId))))
        );
        if (valid) { auto[group.id] = option.id; break; }
      }
    }
    if (Object.keys(auto).length === (product.variantGroups?.length ?? 0)) {
      setSelectedOptions(auto);
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = useAddToCart({
    mutation: {
      onSuccess: () => {
        setPurchaseSheetOpen(false);
        toast({
          title: t("product_detail.added_to_cart"),
          description: t("product_detail.added_desc", { qty: quantity, name: product?.name }),
        });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
      onError: () => {
        toast({ title: t("common.error"), description: t("product_detail.error_add"), variant: "destructive" });
      },
    },
  });

  const resolvedVariant = useMemo(() => {
    if (!product || !hasVariants || !product.variants?.length) return null;
    const numGroups = product.variantGroups!.length;
    if (Object.keys(selectedOptions).length < numGroups) return null;
    const selectedOptionIds = new Set(Object.values(selectedOptions));
    return (
      product.variants.find(
        (v) => v.options.length === numGroups && v.options.every((o) => selectedOptionIds.has(o.optionId))
      ) ?? null
    );
  }, [selectedOptions, product, hasVariants]);

  const firstGroup = product?.variantGroups?.[0];
  const selectedFirstOptionId = firstGroup ? (selectedOptions[firstGroup.id] ?? null) : null;

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const productImgs = [...new Set(
      [product.imageUrl, ...(product.imageUrls ?? [])].filter(Boolean) as string[]
    )];
    if (!hasVariants || !product.variants?.length) return productImgs;
    if (selectedFirstOptionId != null) {
      const seen = new Set<string>();
      const imgs: string[] = [];
      for (const v of product.variants as any[]) {
        if (!v.options?.some((o: any) => o.optionId === selectedFirstOptionId)) continue;
        for (const img of (v.images ?? [])) {
          const url = (typeof img === "string" ? img : img?.url) as string | undefined;
          if (url && !seen.has(url)) { seen.add(url); imgs.push(url); }
        }
        if (v.imageUrl && !seen.has(v.imageUrl)) { seen.add(v.imageUrl); imgs.push(v.imageUrl); }
      }
      if (imgs.length > 0) return imgs;
    }
    if (resolvedVariant) {
      const vImgs = ((resolvedVariant as any).images ?? [])
        .map((i: any) => (typeof i === "string" ? i : i?.url))
        .filter(Boolean) as string[];
      if (vImgs.length > 0) return vImgs;
      if ((resolvedVariant as any).imageUrl) return [(resolvedVariant as any).imageUrl, ...productImgs];
    }
    return productImgs;
  }, [product, hasVariants, selectedFirstOptionId, resolvedVariant]);

  const activeImage = activeImageOverride ?? galleryImages[0] ?? null;

  useEffect(() => {
    setActiveImage(null);
    setImgLoaded(false);
  }, [selectedFirstOptionId]);

  useEffect(() => {
    if (product) trackView(product);
  }, [product?.id]);

  useSEO(
    product
      ? {
          title: product.name,
          description: (product.description || "").slice(0, 160) ||
            `Buy ${product.name} on Syano — ${product.category}. Trusted Syrian sellers, fast delivery, secure checkout.`,
          canonical: `/products/${product.id}`,
          image: product.imageUrl || undefined,
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description || undefined,
            image: product.imageUrl || undefined,
            category: product.category,
            brand: product.sellerName ? { "@type": "Brand", name: product.sellerName } : undefined,
            aggregateRating:
              product.reviewCount && product.reviewCount > 0
                ? { "@type": "AggregateRating", ratingValue: product.averageRating ?? 0, reviewCount: product.reviewCount }
                : undefined,
            offers: {
              "@type": "Offer",
              url: `https://syano.online/products/${product.id}`,
              price: product.finalPrice ?? product.price,
              priceCurrency: "USD",
              availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            },
          },
        }
      : { title: "Loading product", canonical: `/products/${id}` }
  );

  const handleAddToCart = () => {
    if (!product || (hasVariants && !resolvedVariant)) return;
    addToCart.mutate({
      data: { productId: product.id, quantity, ...(resolvedVariant ? { variantId: resolvedVariant.id } : {}) } as any,
    });
  };

  const handleBuyNow = () => {
    if (!product || (hasVariants && !resolvedVariant)) return;
    addToCart.mutate(
      { data: { productId: product.id, quantity, ...(resolvedVariant ? { variantId: resolvedVariant.id } : {}) } as any },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }); navigate("/cart"); } }
    );
  };

  const handleGuestAddToCart = () => {
    if (!product || (hasVariants && !resolvedVariant)) return;
    addGuestItem(product.id, resolvedVariant?.id ?? null, quantity);
    toast({
      title: t("product_detail.added_to_cart"),
      description: t("product_detail.added_desc", { qty: quantity, name: product.name }),
    });
  };

  const handleGuestBuyNow = () => {
    if (!product || (hasVariants && !resolvedVariant)) return;
    addGuestItem(product.id, resolvedVariant?.id ?? null, quantity);
    navigate("/cart");
  };

  const decreaseQuantity = () => { if (quantity > 1) setQuantity(quantity - 1); };
  const increaseQuantity = () => {
    const maxStock = hasVariants ? (resolvedVariant?.stock ?? 0) : (product?.stock ?? 0);
    if (product && quantity < maxStock) setQuantity(quantity + 1);
  };

  if (isLoading) return <ProductSkeleton />;

  if (error || !product) {
    return (
      <Layout>
        <div className="container flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-3">{t("product_detail.not_found")}</h2>
          <p className="text-muted-foreground mb-8 max-w-sm">{t("product_detail.not_found_desc")}</p>
          <Link href="/products"><Button size="lg">{t("product_detail.back_to_products")}</Button></Link>
        </div>
      </Layout>
    );
  }

  // ── Derived values (after early returns) ────────────────────────────────────

  const effectiveSellPrice: number = (() => {
    if (hasVariants && resolvedVariant) {
      const v = resolvedVariant as any;
      if (v.price != null) return parseFloat(v.price);
      return parseFloat(((product.price + (v.priceAdjustment ?? 0)) * (1 - (product.discountPercent ?? 0) / 100)).toFixed(2));
    }
    return product.finalPrice ?? product.price;
  })();

  const effectiveCompareAt: number | null = (() => {
    if (hasVariants && resolvedVariant) {
      const v = resolvedVariant as any;
      if (v.compareAtPrice != null) return parseFloat(v.compareAtPrice);
      if (v.price != null) return null;
      if ((product.discountPercent ?? 0) > 0) return product.price + (v.priceAdjustment ?? 0);
      return null;
    }
    if ((product.discountPercent ?? 0) > 0) return product.price;
    return null;
  })();

  const hasDiscount = effectiveCompareAt != null && effectiveCompareAt > effectiveSellPrice;
  const savings = hasDiscount ? effectiveCompareAt! - effectiveSellPrice : 0;
  const displayDiscountPct = calculateDiscountPercent(effectiveCompareAt ?? product.price, effectiveSellPrice);
  const effectiveStock = hasVariants ? (resolvedVariant?.stock ?? 0) : product.stock;
  const isLowStock = hasVariants
    ? resolvedVariant !== null && resolvedVariant.stock > 0 && resolvedVariant.stock <= 5
    : product.stock > 0 && product.stock <= 5;
  const isOutOfStock = hasVariants
    ? !resolvedVariant || resolvedVariant.stock === 0 || !resolvedVariant.active
    : product.stock === 0;
  const needsVariantSelection = hasVariants && Object.keys(selectedOptions).length < (product.variantGroups?.length ?? 0);
  const sellerInitial = ((product as any).storeName || product.sellerName || "S").charAt(0).toUpperCase();

  const { specs, remainder: descRemainder } = parseSpecsFromDescription(product.description ?? "");
  const aboutText = descRemainder || product.description || "";
  const ABOUT_TRUNCATE = 280;
  const aboutNeedsTruncation = aboutText.length > ABOUT_TRUNCATE;
  const aboutDisplayText = aboutNeedsTruncation && !aboutExpanded
    ? aboutText.slice(0, ABOUT_TRUNCATE).trimEnd() + "…"
    : aboutText;

  // ── Purchase card JSX (shared by desktop + mobile renders) ──────────────────

  const purchaseCardJsx = (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-border border-b rtl:divide-x-reverse">
        {[
          { icon: Package2, title: t("product_detail.condition"), desc: t("product_detail.in_stock_short") },
          { icon: ShieldCheck, title: t("product_detail.warranty"), desc: t("product_detail.warranty_desc") },
          { icon: Truck, title: t("product_detail.delivery_to"), desc: t("product_detail.delivery_desc") },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex flex-col items-center text-center p-3 gap-1">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <p className="text-[10px] sm:text-[11px] font-semibold leading-tight text-muted-foreground">{title}</p>
            <p className="text-[10px] sm:text-xs font-bold leading-tight">{desc}</p>
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-muted-foreground shrink-0">{t("product_detail.quantity")}</span>
          <div className="flex items-center border rounded-xl h-11 overflow-hidden">
            <button
              className="px-4 flex items-center justify-center hover:bg-muted/50 transition-colors h-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={decreaseQuantity}
              disabled={quantity <= 1}
              aria-label="Decrease"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-4 font-bold text-base min-w-[3rem] text-center tabular-nums">{quantity}</span>
            <button
              className="px-4 flex items-center justify-center hover:bg-muted/50 transition-colors h-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              onClick={increaseQuantity}
              disabled={quantity >= effectiveStock || needsVariantSelection}
              aria-label="Increase"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isCustomer ? (
          <>
            <Button
              className="w-full h-12 text-base font-semibold shadow-sm"
              onClick={handleAddToCart}
              disabled={addToCart.isPending || isOutOfStock || needsVariantSelection}
            >
              <ShoppingCart className="me-2 h-5 w-5" />
              {addToCart.isPending
                ? t("product_detail.adding")
                : needsVariantSelection
                  ? t("product_detail.select_options")
                  : t("product_detail.add_to_cart")}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              onClick={handleBuyNow}
              disabled={addToCart.isPending || isOutOfStock || needsVariantSelection}
            >
              {t("product_detail.buy_now")}
            </Button>
          </>
        ) : !isAuthenticated ? (
          <>
            <Button
              className="w-full h-12 text-base font-semibold shadow-sm"
              onClick={handleGuestAddToCart}
              disabled={isOutOfStock || needsVariantSelection}
            >
              <ShoppingCart className="me-2 h-5 w-5" />
              {needsVariantSelection ? t("product_detail.select_options") : t("product_detail.add_to_cart")}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              onClick={handleGuestBuyNow}
              disabled={isOutOfStock || needsVariantSelection}
            >
              {t("product_detail.buy_now")}
            </Button>
          </>
        ) : (
          <Button className="w-full h-12 text-base font-semibold" disabled>
            {t("product_detail.sellers_cannot_buy")}
          </Button>
        )}

        {isOutOfStock && !needsVariantSelection && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/40">
            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">{t("product_detail.out_of_stock")}</span>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {lightboxOpen && activeImage && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 end-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <img
            src={activeImage}
            alt={product.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="container py-5 md:py-10 pb-24 md:pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 md:mb-8 flex-wrap">
          <Link href="/products" className="hover:text-foreground transition-colors flex items-center gap-0.5">
            <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t("product_detail.back")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-foreground transition-colors capitalize">
            {product.category}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14">

          {/* ── COLUMN 1: Image Gallery + Desktop Purchase Card ── */}
          <div className="flex flex-col space-y-3">
            {/* Main image */}
            <div
              className="relative aspect-square bg-card border rounded-2xl overflow-hidden shadow-sm group cursor-zoom-in select-none"
              onClick={() => activeImage && setLightboxOpen(true)}
            >
              {hasDiscount && (
                <Badge className="absolute top-3 end-3 z-10 bg-red-500 hover:bg-red-500 text-white text-xs font-bold shadow-md px-2.5 py-1">
                  -{displayDiscountPct}%
                </Badge>
              )}
              {activeImage ? (
                <>
                  {!imgLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
                  <img
                    src={activeImage}
                    alt={product.name}
                    className={`w-full h-full object-contain transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setImgLoaded(true)}
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted gap-3">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                  <span className="text-sm text-muted-foreground">{t("product_detail.no_image")}</span>
                </div>
              )}
              {activeImage && (
                <div className="absolute bottom-3 end-3 bg-black/40 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setActiveImage(img); setImgLoaded(false); }}
                    className={`h-16 w-16 rounded-xl border-2 overflow-hidden bg-card shrink-0 transition-all ${
                      activeImage === img
                        ? "border-primary shadow-sm"
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-border"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            {/* Desktop purchase card */}
            <div className="hidden md:block pt-1">
              {purchaseCardJsx}
            </div>
          </div>

          {/* ── COLUMN 2: Product Info ── */}
          <div className="flex flex-col">
            {/* Category tag */}
            <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="self-start mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                {product.category}
              </span>
            </Link>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
              <StarRating rating={product.averageRating ?? 0} size="md" />
              {product.reviewCount > 0 ? (
                <button
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <span className="font-semibold text-foreground">{(product.averageRating ?? 0).toFixed(1)}</span>
                  {" "}
                  <span className="underline underline-offset-2">
                    ({product.reviewCount === 1
                      ? t("reviews.based_on", { count: product.reviewCount })
                      : t("reviews.based_on_plural", { count: product.reviewCount })})
                  </span>
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">{t("reviews.no_reviews")}</span>
              )}
            </div>

            {/* Price */}
            <div className="mb-5">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-product-price text-foreground leading-none" translate="no">
                  {format(effectiveSellPrice)}
                </span>
                {hasDiscount && effectiveCompareAt != null && (
                  <span className="text-xl text-muted-foreground line-through pb-0.5 font-medium" translate="no">
                    {format(effectiveCompareAt)}
                  </span>
                )}
              </div>
              {hasDiscount && savings > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
                    -{displayDiscountPct}% {t("products.off")}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("product_detail.save", { amount: format(savings) })}
                  </span>
                </div>
              )}
            </div>

            {/* ── Variant Selector ── */}
            {hasVariants && product.variantGroups && product.variantGroups.length > 0 && (
              <div id="variant-selector" className="mb-5 space-y-4 bg-muted/20 border border-border/60 rounded-2xl p-4">
                {product.variantGroups.map((group) => {
                  const selectedOptionId = selectedOptions[group.id];
                  const selectedOption = group.options.find((o) => o.id === selectedOptionId);
                  const colorGroup = isColorGroup(group.name);
                  return (
                    <div key={group.id}>
                      <div className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                        <span className="text-foreground">{group.name}</span>
                        {selectedOption && (
                          <>
                            <span className="text-muted-foreground">:</span>
                            <span className="text-primary font-bold">{selectedOption.value}</span>
                          </>
                        )}
                        {!selectedOption && (
                          <span className="text-muted-foreground/70 text-xs font-normal italic">
                            — {t("product_detail.choose_option")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const isSelected = selectedOptionId === option.id;
                          const available = isOptionAvailable(group.id, option.id);
                          const swatch = colorGroup ? getColorSwatch(option.value) : null;

                          if (swatch) {
                            const isWhite = swatch === "#F9FAFB";
                            return (
                              <button
                                key={option.id}
                                type="button"
                                title={option.value}
                                disabled={!available}
                                onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.id]: option.id }))}
                                className={`relative w-10 h-10 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                  isSelected
                                    ? "ring-[3px] ring-primary ring-offset-2 scale-110 shadow-lg"
                                    : available
                                      ? "hover:scale-110 hover:shadow-sm ring-1 ring-border"
                                      : "opacity-30 cursor-not-allowed"
                                }`}
                              >
                                <span
                                  className={`absolute inset-0.5 rounded-full ${isWhite ? "border border-border" : ""}`}
                                  style={{ backgroundColor: swatch }}
                                />
                                {isSelected && (
                                  <span className="absolute inset-0 flex items-center justify-center z-10">
                                    <Check className="h-4 w-4 drop-shadow-sm" style={{ color: isWhite ? "#374151" : "white" }} />
                                  </span>
                                )}
                                {!available && (
                                  <span className="absolute inset-0 flex items-center justify-center z-10">
                                    <span className="absolute w-full h-px bg-muted-foreground/50 rotate-45" />
                                  </span>
                                )}
                              </button>
                            );
                          }

                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={!available}
                              onClick={() => {
                                if (!available) return;
                                setSelectedOptions((prev) => ({ ...prev, [group.id]: option.id }));
                              }}
                              className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                                isSelected
                                  ? "bg-primary/10 text-primary border-primary shadow-sm"
                                  : available
                                    ? "border-border hover:border-primary/50 hover:bg-primary/5 text-foreground"
                                    : "border-border/50 opacity-35 cursor-not-allowed text-muted-foreground line-through"
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 shrink-0" />}
                              {option.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SKU */}
            {resolvedVariant && (resolvedVariant as any).sku && (
              <p className="text-xs text-muted-foreground mb-3">
                SKU: <span className="font-mono text-foreground" translate="no">{(resolvedVariant as any).sku}</span>
              </p>
            )}

            {/* Stock status */}
            <div className="mb-5">
              {isOutOfStock && !needsVariantSelection ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                  {t("product_detail.out_of_stock")}
                </span>
              ) : needsVariantSelection ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  {t("product_detail.select_options")}
                </span>
              ) : isLowStock ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {t("product_detail.only_left", { count: effectiveStock })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  {t("product_detail.in_stock", { count: effectiveStock })}
                </span>
              )}
            </div>

            {/* ── Specifications ── */}
            {specs.length > 0 && (
              <div className="mb-5 bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-bold text-sm text-foreground">{t("product_detail.specifications")}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {specs.map(({ label, value }, idx) => (
                    <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground min-w-[100px] shrink-0 pt-0.5">{label}</span>
                      <span className="text-xs font-semibold text-foreground text-start">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── About This Product ── */}
            {aboutText && (
              <div className="mb-5 bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-bold text-sm text-foreground">{t("product_detail.about_product")}</h3>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{aboutDisplayText}</p>
                  {aboutNeedsTruncation && (
                    <button
                      onClick={() => setAboutExpanded((v) => !v)}
                      className="mt-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      {aboutExpanded ? t("product_detail.show_less") : t("product_detail.show_more")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Seller card */}
            {(product as any).storeSlug ? (
              <Link href={`/store/${(product as any).storeSlug}`}>
                <div className="flex items-center gap-3 mb-3 p-4 bg-muted/30 rounded-2xl border border-border/60 hover:border-primary/30 transition-colors group cursor-pointer">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors overflow-hidden">
                    {(product as any).storeLogo
                      ? <img src={(product as any).storeLogo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-base font-black text-primary">{sellerInitial}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-foreground">{(product as any).storeName || product.sellerName}</span>
                      {((product as any).sellerVerificationLevel && (product as any).sellerVerificationLevel !== "none") || (product as any).sellerIsVerified ? (
                        <SellerTrustBadge
                          level={((product as any).sellerVerificationLevel ?? "none") as VerificationLevel}
                          isVerified={(product as any).sellerIsVerified ?? false}
                          size="xs"
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("product_detail.sold_by")} {product.sellerName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3 mb-3 p-4 bg-muted/30 rounded-2xl border border-border/60">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-base font-black text-primary">{sellerInitial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground">{(product as any).storeName || product.sellerName}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("product_detail.sold_by")} {product.sellerName}</p>
                </div>
              </div>
            )}

            {isCustomer && (product as any).sellerId && (
              <ContactSellerButton sellerId={(product as any).sellerId} className="mb-3" />
            )}

            {/* Trust score bar */}
            {(product as any).sellerTrustScore != null && (
              <div className="mb-5">
                <TrustScoreBar score={(product as any).sellerTrustScore} size="sm" />
              </div>
            )}

            {/* Desktop trust badges */}
            <div className="hidden md:grid grid-cols-2 gap-2 sm:gap-3 border-t pt-5">
              {[
                { icon: Truck, title: t("product_detail.fast_shipping"), desc: t("product_detail.fast_shipping_desc") },
                { icon: ShieldCheck, title: t("product_detail.secure_payment"), desc: t("product_detail.secure_payment_desc") },
                ...(FEATURES.RETURNS_ENABLED ? [{ icon: RefreshCw, title: t("product_detail.easy_returns"), desc: t("product_detail.easy_returns_desc") }] : []),
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex flex-col items-center text-center p-3 sm:p-4 bg-muted/30 rounded-2xl gap-2 hover:bg-muted/50 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] sm:text-xs font-bold leading-tight">{title}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-snug hidden sm:block">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Reviews */}
        <div id="reviews-section">
          <ReviewSection
            productId={product.id}
            averageRating={product.averageRating}
            reviewCount={product.reviewCount}
          />
        </div>

        {/* You May Also Like */}
        <RelatedProducts currentId={product.id} category={product.category} />
      </div>

      {/* ── Mobile Sticky Purchase Bar ── always visible on mobile ────────── */}
      <div
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        className="fixed bottom-0 inset-x-0 z-50 md:hidden"
      >
        <div className="mx-3 mb-3 flex items-center gap-3 bg-card border border-border/70 shadow-2xl rounded-2xl px-4 py-3">
          {/* Price */}
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            {hasDiscount && effectiveCompareAt != null ? (
              <>
                <span className="text-[11px] text-muted-foreground line-through leading-none" translate="no">
                  {format(effectiveCompareAt)}
                </span>
                <span className="font-bold text-base leading-tight text-foreground" translate="no">
                  {format(effectiveSellPrice)}
                </span>
                {displayDiscountPct > 0 && (
                  <span className="text-[10px] font-bold text-primary leading-none">-{displayDiscountPct}%</span>
                )}
              </>
            ) : (
              <span className="font-bold text-base leading-tight text-foreground" translate="no">
                {format(effectiveSellPrice)}
              </span>
            )}
          </div>
          {/* CTA */}
          {isOutOfStock && !needsVariantSelection ? (
            <Button className="h-11 px-5 shrink-0 font-semibold text-sm" disabled>
              {t("products.out_of_stock")}
            </Button>
          ) : (isCustomer || !isAuthenticated) ? (
            <Button
              className="h-11 px-5 shrink-0 font-semibold text-sm"
              onClick={() => {
                if (needsVariantSelection) {
                  document.getElementById("variant-selector")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  return;
                }
                setPurchaseSheetOpen(true);
              }}
            >
              <ShoppingCart className="me-1.5 h-4 w-4 shrink-0" />
              {needsVariantSelection ? t("product_detail.select_options") : t("product_detail.add_to_cart")}
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Mobile Purchase Bottom Sheet ────────────────────────────────────── */}
      <Sheet open={purchaseSheetOpen} onOpenChange={setPurchaseSheetOpen}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="rounded-t-3xl p-0 max-h-[88dvh] overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{product.name}</SheetTitle>
          </SheetHeader>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Product summary */}
          <div className="flex items-center gap-3 px-5 py-3 border-b">
            {activeImage ? (
              <img src={activeImage} alt="" className="h-16 w-16 rounded-xl object-contain border bg-card shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-xl border bg-muted shrink-0 flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-snug line-clamp-2 text-foreground">{product.name}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="font-extrabold text-lg leading-tight text-foreground" translate="no">
                  {format(effectiveSellPrice)}
                </span>
                {hasDiscount && effectiveCompareAt && (
                  <span className="text-sm text-muted-foreground line-through font-medium" translate="no">
                    {format(effectiveCompareAt)}
                  </span>
                )}
                {hasDiscount && displayDiscountPct > 0 && (
                  <span className="inline-flex items-center text-[11px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                    -{displayDiscountPct}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Condition / Warranty / Delivery */}
          <div className="grid grid-cols-3 divide-x divide-border border-b rtl:divide-x-reverse">
            {[
              { icon: Package2, title: t("product_detail.condition"), desc: t("product_detail.in_stock_short") },
              { icon: ShieldCheck, title: t("product_detail.warranty"), desc: t("product_detail.warranty_desc") },
              { icon: Truck, title: t("product_detail.delivery_to"), desc: t("product_detail.delivery_desc") },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center p-3 gap-1">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <p className="text-[10px] font-semibold leading-tight text-muted-foreground">{title}</p>
                <p className="text-[10px] font-bold leading-tight text-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {/* Stock status */}
          <div className="px-5 pt-4 pb-2">
            {isOutOfStock && !needsVariantSelection ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-500">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                {t("product_detail.out_of_stock")}
              </span>
            ) : needsVariantSelection ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("product_detail.select_options")}
              </span>
            ) : isLowStock ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("product_detail.only_left", { count: effectiveStock })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                {t("product_detail.in_stock", { count: effectiveStock })}
              </span>
            )}
          </div>

          {/* Quantity selector */}
          <div className="px-5 py-4 flex items-center justify-between border-t border-border/40 mt-3">
            <span className="text-sm font-medium text-muted-foreground">{t("product_detail.quantity")}</span>
            <div className="flex items-center border rounded-xl h-11 overflow-hidden">
              <button
                className="px-4 flex items-center justify-center hover:bg-muted/50 transition-colors h-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 font-bold text-base min-w-[3rem] text-center tabular-nums">{quantity}</span>
              <button
                className="px-4 flex items-center justify-center hover:bg-muted/50 transition-colors h-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                onClick={increaseQuantity}
                disabled={quantity >= effectiveStock || needsVariantSelection}
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="px-5 pb-7 space-y-3">
            {isCustomer ? (
              <>
                <Button
                  className="w-full h-12 text-base font-semibold shadow-sm"
                  onClick={handleAddToCart}
                  disabled={addToCart.isPending || isOutOfStock || needsVariantSelection}
                >
                  <ShoppingCart className="me-2 h-5 w-5" />
                  {addToCart.isPending
                    ? t("product_detail.adding")
                    : needsVariantSelection
                      ? t("product_detail.select_options")
                      : t("product_detail.add_to_cart")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleBuyNow}
                  disabled={addToCart.isPending || isOutOfStock || needsVariantSelection}
                >
                  {t("product_detail.buy_now")}
                </Button>
              </>
            ) : !isAuthenticated ? (
              <>
                <Button
                  className="w-full h-12 text-base font-semibold shadow-sm"
                  onClick={() => { handleGuestAddToCart(); setPurchaseSheetOpen(false); }}
                  disabled={isOutOfStock || needsVariantSelection}
                >
                  <ShoppingCart className="me-2 h-5 w-5" />
                  {needsVariantSelection ? t("product_detail.select_options") : t("product_detail.add_to_cart")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-semibold"
                  onClick={handleGuestBuyNow}
                  disabled={isOutOfStock || needsVariantSelection}
                >
                  {t("product_detail.buy_now")}
                </Button>
              </>
            ) : (
              <Button className="w-full h-12 text-base font-semibold" disabled>
                {t("product_detail.sellers_cannot_buy")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
}
