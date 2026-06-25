import React, { useCallback, memo } from "react";
import { Link, useLocation } from "wouter";
import { useQueries } from "@tanstack/react-query";
import {
  useGetCart, useRemoveFromCart, useUpdateCartItem, getGetCartQueryKey,
  getProduct, getGetProductQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { StarRating } from "@/components/StarRating";
import { RelatedProducts } from "@/components/RelatedProducts";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestCart, type GuestCartItem } from "@/contexts/GuestCartContext";

/* ── CartItemRow (authenticated server cart) ────────────────────── */
interface CartItemRowProps {
  item: {
    cartItemId: number;
    productId: number;
    variantId?: number | null;
    variantLabel?: string | null;
    variantDetails?: Array<{ name: string; value: string }> | null;
    variantImageUrl?: string | null;
    quantity: number;
    subtotal: number;
    stockWarning?: boolean;
    product: {
      id: number;
      name: string;
      imageUrl: string | null;
      sellerName: string;
      price: number;
      discountPercent: number | null;
      finalPrice: number;
      category: string;
      stock: number;
      averageRating?: number | null;
      reviewCount?: number;
    };
  };
  onUpdateQuantity: (cartItemId: number, quantity: number) => void;
  onRemove: (cartItemId: number) => void;
  isUpdating: boolean;
  isRemoving: boolean;
  format: (price: number) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const CartItemRow = memo(function CartItemRow({
  item, onUpdateQuantity, onRemove, isUpdating, isRemoving, format, t,
}: CartItemRowProps) {
  const avgRating = item.product.averageRating ?? 0;
  const reviewCount = item.product.reviewCount ?? 0;
  const displayImage = item.variantImageUrl || item.product.imageUrl;

  return (
    <div className="flex gap-3 sm:gap-5 p-4 sm:p-5">
      <Link href={`/products/${item.productId}`} className="shrink-0">
        <div className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 bg-muted rounded-xl overflow-hidden border">
          {displayImage ? (
            <img src={displayImage} alt={item.product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px] text-center px-1">
              {t("cart.no_image")}
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 flex flex-col justify-between gap-1.5 min-w-0">
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.productId}`}>
              <h3 className="font-semibold text-sm sm:text-base hover:text-primary transition-colors line-clamp-2 leading-snug">
                {item.product.name}
              </h3>
            </Link>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {t("cart.sold_by")} {item.product.sellerName}
            </p>
            {item.variantDetails && item.variantDetails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.variantDetails.map((d) => (
                  <span key={d.name} className="inline-flex items-center gap-0.5 text-[10px] bg-muted border border-border/50 px-1.5 py-0.5 rounded-md font-medium">
                    <span className="text-muted-foreground">{d.name}:</span>
                    <span className="text-foreground ms-0.5">{d.value}</span>
                  </span>
                ))}
              </div>
            )}
            {avgRating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <StarRating rating={avgRating} size="sm" />
                <span className="text-[10px] font-semibold text-amber-500 tabular-nums">{avgRating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">({reviewCount})</span>
                )}
              </div>
            )}
          </div>
          <div className="text-end shrink-0">
            {item.product.discountPercent && item.product.discountPercent > 0 ? (
              <>
                <div className="font-bold text-sm sm:text-base leading-tight" translate="no">{format(item.product.finalPrice)}</div>
                <div className="text-[10px] text-muted-foreground line-through mt-0.5" translate="no">{format(item.product.price)}</div>
              </>
            ) : (
              <div className="font-bold text-sm sm:text-base" translate="no">{format(item.product.price)}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center border rounded-lg h-9 overflow-hidden bg-background">
            <button
              className="px-2.5 hover:bg-muted/50 h-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
              disabled={isUpdating}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-3 font-semibold text-sm min-w-[2rem] text-center tabular-nums">{item.quantity}</span>
            <button
              className="px-2.5 hover:bg-muted/50 h-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
              disabled={isUpdating || item.quantity >= item.product.stock}
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(item.cartItemId)}
            disabled={isRemoving}
          >
            <Trash2 className="h-4 w-4 sm:me-1.5" />
            <span className="hidden sm:inline text-xs">{t("cart.remove")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ── GuestCartItemRow (unauthenticated) ─────────────────────────── */
interface GuestItemRowProps {
  item: GuestCartItem;
  product: {
    name: string;
    imageUrl: string | null;
    sellerName: string;
    price: number;
    discountPercent: number | null;
    finalPrice: number;
    stock: number;
  };
  onUpdateQty: (productId: number, variantId: number | null, quantity: number) => void;
  onRemove: (productId: number, variantId: number | null) => void;
  format: (price: number) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const GuestCartItemRow = memo(function GuestCartItemRow({
  item, product, onUpdateQty, onRemove, format, t,
}: GuestItemRowProps) {
  return (
    <div className="flex gap-3 sm:gap-5 p-4 sm:p-5">
      <Link href={`/products/${item.productId}`} className="shrink-0">
        <div className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 bg-muted rounded-xl overflow-hidden border">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[10px] text-center px-1">
              {t("cart.no_image")}
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 flex flex-col justify-between gap-1.5 min-w-0">
        <div className="flex justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.productId}`}>
              <h3 className="font-semibold text-sm sm:text-base hover:text-primary transition-colors line-clamp-2 leading-snug">
                {product.name}
              </h3>
            </Link>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {t("cart.sold_by")} {product.sellerName}
            </p>
          </div>
          <div className="text-end shrink-0">
            {product.discountPercent && product.discountPercent > 0 ? (
              <>
                <div className="font-bold text-sm sm:text-base leading-tight" translate="no">{format(product.finalPrice)}</div>
                <div className="text-[10px] text-muted-foreground line-through mt-0.5" translate="no">{format(product.price)}</div>
              </>
            ) : (
              <div className="font-bold text-sm sm:text-base" translate="no">{format(product.price)}</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center border rounded-lg h-9 overflow-hidden bg-background">
            <button
              className="px-2.5 hover:bg-muted/50 h-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity - 1)}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-3 font-semibold text-sm min-w-[2rem] text-center tabular-nums">{item.quantity}</span>
            <button
              className="px-2.5 hover:bg-muted/50 h-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              onClick={() => onUpdateQty(item.productId, item.variantId, item.quantity + 1)}
              disabled={item.quantity >= product.stock}
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(item.productId, item.variantId)}
          >
            <Trash2 className="h-4 w-4 sm:me-1.5" />
            <span className="hidden sm:inline text-xs">{t("cart.remove")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ── Guest Cart ──────────────────────────────────────────────────── */
function GuestCart() {
  const { guestItems, updateGuestQty, removeGuestItem } = useGuestCart();
  const { format } = useCurrency();
  const { t } = useTranslation();

  const productQueries = useQueries({
    queries: guestItems.map((item) => ({
      queryKey: getGetProductQueryKey(item.productId),
      queryFn: () => getProduct(item.productId),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const isLoading = guestItems.length > 0 && productQueries.some((q) => q.isPending && !q.data);

  const enrichedItems = guestItems.map((item, i) => ({
    ...item,
    product: productQueries[i]?.data ?? null,
  }));

  const subtotal = enrichedItems.reduce((sum, item) => {
    const price = item.product?.finalPrice ?? item.product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const totalQty = guestItems.reduce((s, i) => s + i.quantity, 0);
  const isEmpty = guestItems.length === 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-6 md:py-12 max-w-6xl">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-8" />
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-4">
              {[1, 2].map((i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
            </div>
            <div className="w-full lg:w-96 h-64 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-6 md:py-12 max-w-6xl">
        <h1 className="heading-section mb-6 md:mb-8">{t("cart.title")}</h1>

        {isEmpty ? (
          <div className="sy-empty-state">
            <div className="h-20 w-20 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{t("cart.empty")}</h2>
              <p className="text-muted-foreground max-w-sm leading-relaxed text-sm sm:text-base">
                {t("cart.empty_desc")}
              </p>
            </div>
            <Link href="/shop">
              <Button size="lg" className="h-12 px-8">{t("cart.start_shopping")}</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 xl:gap-12 items-start">
            <div className="flex-1 w-full">
              <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y">
                  {enrichedItems.map((item) =>
                    item.product ? (
                      <GuestCartItemRow
                        key={`${item.productId}-${item.variantId ?? "base"}`}
                        item={item}
                        product={item.product as any}
                        onUpdateQty={updateGuestQty}
                        onRemove={removeGuestItem}
                        format={format}
                        t={t}
                      />
                    ) : null
                  )}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-96 space-y-3">
              <div className="bg-card border rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-bold mb-5 hidden lg:block">{t("cart.order_summary")}</h3>
                <div className="space-y-3 mb-5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("cart.subtotal", { count: totalQty })}</span>
                    <span className="font-medium text-foreground" translate="no">{format(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("cart.shipping")}</span>
                    <span>{t("cart.shipping_calc")}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold text-base">
                    <span>{t("cart.total")}</span>
                    <span translate="no">{format(subtotal)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mb-3">
                  {t("cart.guest_login_prompt")}
                </p>

                <Link href="/login?redirect=/checkout">
                  <Button className="w-full h-12 text-base font-semibold">
                    <LogIn className="me-2 h-5 w-5" />
                    {t("cart.sign_in_checkout")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ── Server Cart (authenticated customers) ──────────────────────── */
function ServerCart() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { format } = useCurrency();

  const { data: cart, isLoading } = useGetCart({ query: { queryKey: getGetCartQueryKey() } });

  const updateItem = useUpdateCartItem({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
  });
  const removeItem = useRemoveFromCart({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
  });

  const handleUpdateQuantity = useCallback((cartItemId: number, quantity: number) => {
    if (quantity < 1) return;
    updateItem.mutate({ productId: cartItemId, data: { quantity } });
  }, [updateItem]);

  const handleRemove = useCallback((cartItemId: number) => {
    removeItem.mutate({ productId: cartItemId });
  }, [removeItem]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-6 md:py-12 max-w-6xl">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-8" />
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-4">
              {[1, 2].map(i => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}
            </div>
            <div className="w-full lg:w-96 h-64 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;
  const firstItem = cart?.items[0];
  const suggestCategory = firstItem?.product.category ?? "";
  const suggestId = firstItem?.productId ?? 0;

  return (
    <Layout>
      <div className="container py-6 md:py-12 max-w-6xl">
        <h1 className="heading-section mb-6 md:mb-8">{t("cart.title")}</h1>

        {isEmpty ? (
          <div className="sy-empty-state">
            <div className="h-20 w-20 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{t("cart.empty")}</h2>
              <p className="text-muted-foreground max-w-sm leading-relaxed text-sm sm:text-base">
                {t("cart.empty_desc")}
              </p>
            </div>
            <Link href="/shop">
              <Button size="lg" className="h-12 px-8">{t("cart.start_shopping")}</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 xl:gap-12 items-start">
              <div className="flex-1 w-full">
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y">
                    {cart.items.map((item) => (
                      <CartItemRow
                        key={item.cartItemId ?? item.productId}
                        item={item as any}
                        onUpdateQuantity={handleUpdateQuantity}
                        onRemove={handleRemove}
                        isUpdating={updateItem.isPending}
                        isRemoving={removeItem.isPending}
                        format={format}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-96 space-y-3">
                <div className="bg-card border rounded-xl p-5 shadow-sm">
                  <h3 className="text-lg font-bold mb-5 hidden lg:block">{t("cart.order_summary")}</h3>
                  <div className="space-y-3 mb-5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("cart.subtotal", { count: cart.itemCount })}</span>
                      <span className="font-medium text-foreground" translate="no">{format(cart.total)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("cart.shipping")}</span>
                      <span>{t("cart.shipping_calc")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("cart.tax")}</span>
                      <span>{t("cart.tax_calc")}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold text-base">
                      <span>{t("cart.total")}</span>
                      <span translate="no">{format(cart.total)}</span>
                    </div>
                  </div>
                  <Link href="/checkout">
                    <Button className="w-full h-12 text-base font-semibold">
                      {t("cart.checkout")}
                      <ArrowRight className="ms-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {suggestCategory && suggestId > 0 && (
              <div className="mt-8">
                <RelatedProducts currentId={suggestId} category={suggestCategory} />
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function Cart() {
  const { isAuthenticated, isCustomer } = useAuth();
  if (!isAuthenticated) return <GuestCart />;
  if (isCustomer) return <ServerCart />;
  return <GuestCart />;
}
