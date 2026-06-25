import React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useWishlist } from "@/contexts/WishlistContext";
import { useGuestCart } from "@/contexts/GuestCartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Heart, ShoppingCart, ShoppingBag, LogIn, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { addToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/contexts/CurrencyContext";
import { calculateDiscountPercent } from "@/lib/pricing";

const BASE = import.meta.env.BASE_URL ?? "/";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Skeleton ──────────────────────────────────────────────────────── */
function WishlistSkeleton() {
  return (
    <div className="store-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ── WishlistItemCard ───────────────────────────────────────────────── */
interface WishlistItemCardProps {
  product: any;
  isAr: boolean;
  onMoveToCart: (product: any) => Promise<void>;
  onRemove: (product: any) => Promise<void>;
  movingId: number | null;
  removingId: number | null;
}

function WishlistItemCard({
  product, isAr, onMoveToCart, onRemove, movingId, removingId,
}: WishlistItemCardProps) {
  const { format: formatPrice } = useCurrency();
  const isMoving = movingId === product.id;
  const isRemoving = removingId === product.id;
  const isBusy = isMoving || isRemoving;
  const outOfStock = product.stock <= 0;

  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? calculateDiscountPercent(product.compareAtPrice, product.price)
    : 0;
  const imageUrl = Array.isArray(product.imageUrls)
    ? product.imageUrls[0]
    : product.imageUrl;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 ${
        isBusy ? "opacity-50 pointer-events-none scale-[0.99]" : "hover:shadow-md hover:shadow-black/[0.06]"
      }`}
    >
      {/* Discount badge */}
      {hasDiscount && discountPct > 0 && (
        <div className="absolute top-2 start-2 z-10 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          -{discountPct}%
        </div>
      )}

      {/* Quick-remove X — desktop hover */}
      <button
        onClick={() => onRemove(product)}
        disabled={isBusy}
        className="absolute top-2 end-2 z-10 h-7 w-7 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 flex items-center justify-center rounded-full bg-background/90 hover:bg-background border border-border text-muted-foreground hover:text-rose-500 transition-all shadow-sm"
        aria-label={isAr ? "إزالة" : "Remove"}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Image */}
      <Link href={`/products/${product.id}`}>
        <div className="aspect-square w-full bg-muted overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Link>

      {/* Info + actions */}
      <div className="flex flex-col gap-2 p-3">
        <Link href={`/products/${product.id}`}>
          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug hover:text-primary transition-colors">
            {product.name}
          </p>
        </Link>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-foreground" translate="no">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span
              className="text-xs text-muted-foreground line-through"
              translate="no"
            >
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Move to Cart */}
        <button
          onClick={() => onMoveToCart(product)}
          disabled={isBusy || outOfStock}
          className={`w-full flex items-center justify-center gap-2 h-9 rounded-lg text-[0.8125rem] transition-all duration-150 ${
            outOfStock
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-white"
          }`}
          style={{ fontWeight: 700 }}
        >
          {isMoving ? (
            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          {outOfStock
            ? isAr ? "نفذ المخزون" : "Out of Stock"
            : isAr ? "أضف للسلة" : "Move to Cart"}
        </button>

        {/* Remove — always visible on mobile, hover on desktop */}
        <button
          onClick={() => onRemove(product)}
          disabled={isBusy}
          className="w-full flex items-center justify-center gap-1.5 h-7 text-[12px] text-muted-foreground hover:text-rose-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
        >
          {isRemoving ? (
            <div className="h-3 w-3 rounded-full border-2 border-rose-500/40 border-t-rose-500 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          {isAr ? "إزالة من المفضلة" : "Remove"}
        </button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function WishlistPage() {
  const { ids, toggle: toggleWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const { addGuestItem } = useGuestCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [movingId, setMovingId] = React.useState<number | null>(null);
  const [removingId, setRemovingId] = React.useState<number | null>(null);
  const [movingAll, setMovingAll] = React.useState(false);

  /* ── Fetch products ───────────────────────────────────────────────── */
  React.useEffect(() => {
    if (ids.length === 0) { setProducts([]); return; }

    setLoading(true);

    if (isAuthenticated) {
      fetch(`${BASE}api/wishlist`, {
        credentials: "include",
        headers: authHeaders(),
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setProducts(Array.isArray(data) ? data : []))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    } else {
      Promise.all(
        ids.map((id) =>
          fetch(`${BASE}api/products/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      )
        .then((results) => setProducts(results.filter(Boolean)))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, ids.length]);

  /* ── Cart helper ─────────────────────────────────────────────────── */
  const addProductToCart = React.useCallback(
    async (productId: number) => {
      if (isAuthenticated) {
        await addToCart({ productId, quantity: 1 });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      } else {
        addGuestItem(productId, null, 1);
      }
    },
    [isAuthenticated, addGuestItem, queryClient]
  );

  /* ── Move single item ────────────────────────────────────────────── */
  const moveToCart = React.useCallback(
    async (product: any) => {
      if (product.stock <= 0) return;
      setMovingId(product.id);
      try {
        await addProductToCart(product.id);
        await toggleWishlist(product.id);
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        toast({
          title: isAr ? "تم النقل إلى السلة ✓" : "Moved to cart ✓",
          description: product.name,
        });
      } catch {
        toast({
          title: isAr ? "حدث خطأ" : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setMovingId(null);
      }
    },
    [addProductToCart, toggleWishlist, toast, isAr]
  );

  /* ── Remove single item ──────────────────────────────────────────── */
  const removeItem = React.useCallback(
    async (product: any) => {
      setRemovingId(product.id);
      try {
        await toggleWishlist(product.id);
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } finally {
        setRemovingId(null);
      }
    },
    [toggleWishlist]
  );

  /* ── Move ALL to cart ────────────────────────────────────────────── */
  const moveAllToCart = React.useCallback(async () => {
    const available = products.filter((p) => p.stock > 0);
    if (available.length === 0) return;
    setMovingAll(true);
    try {
      await Promise.all(available.map((p) => addProductToCart(p.id)));
      await Promise.all(available.map((p) => toggleWishlist(p.id)));
      setProducts((prev) => prev.filter((p) => p.stock <= 0));
      toast({
        title: isAr
          ? `تم نقل ${available.length} منتج إلى السلة ✓`
          : `${available.length} item${available.length !== 1 ? "s" : ""} moved to cart ✓`,
      });
    } catch {
      toast({
        title: isAr ? "حدث خطأ" : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setMovingAll(false);
    }
  }, [products, addProductToCart, toggleWishlist, toast, isAr]);

  const isEmpty = !loading && products.length === 0;
  const hasAvailable = products.some((p) => p.stock > 0);

  return (
    <Layout>
      <div
        className="container py-8 max-w-6xl mx-auto"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isAr ? "قائمة المفضلة" : "My Wishlist"}
              </h1>
              {products.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? `${products.length} منتج محفوظ`
                    : `${products.length} saved product${products.length !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
          </div>

          {products.length > 0 && (
            <div className="flex items-center gap-2">
              {hasAvailable && (
                <Button
                  onClick={moveAllToCart}
                  disabled={movingAll}
                  size="sm"
                  className="gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-white transition-all"
                  style={{ fontWeight: 700 }}
                >
                  {movingAll ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  )}
                  {isAr ? "نقل الكل إلى السلة" : "Move All to Cart"}
                </Button>
              )}
              <Link href="/shop">
                <Button variant="outline" size="sm" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {isAr ? "تسوق المزيد" : "Shop More"}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* ── Guest login banner ──────────────────────────────────── */}
        {!isAuthenticated && products.length > 0 && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
            <p className="text-sm font-medium text-foreground/80">
              {isAr
                ? "سجّل دخولك لحفظ قائمتك بشكل دائم على جميع أجهزتك"
                : "Sign in to save your wishlist permanently across all devices"}
            </p>
            <Link href="/login" className="shrink-0">
              <Button size="sm" className="gap-2 h-8 text-xs">
                <LogIn className="h-3.5 w-3.5" />
                {isAr ? "تسجيل الدخول" : "Sign In"}
              </Button>
            </Link>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && <WishlistSkeleton />}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <Heart className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground mb-2">
                {isAr ? "قائمة المفضلة فارغة" : "Your wishlist is empty"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "انقر على قلب أي منتج لحفظه هنا"
                  : "Tap the heart on any product to save it here"}
              </p>
            </div>
            <Link href="/shop">
              <Button className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                {isAr ? "تصفح المنتجات" : "Browse Products"}
              </Button>
            </Link>
          </div>
        )}

        {/* ── Product grid ────────────────────────────────────────── */}
        {!loading && products.length > 0 && (
          <div className="store-grid">
            {products.map((p) => (
              <WishlistItemCard
                key={p.id}
                product={p}
                isAr={isAr}
                onMoveToCart={moveToCart}
                onRemove={removeItem}
                movingId={movingId}
                removingId={removingId}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
