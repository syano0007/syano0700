/**
 * ProductCard — adapter layer for the Products page.
 *
 * Maps the Product API shape → TrendingProductData and renders
 * the canonical <TrendingCard> component.
 *
 * This is intentionally a thin wrapper — ALL visual logic lives in TrendingCard.
 */

import React from "react";
import { Product, getProduct, getGetProductQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { calculateDiscountPercent } from "@/lib/pricing";
import { TrendingCard, type TrendingProductData } from "@/components/TrendingCard";

interface ProductCardProps {
  product: Product;
  flashSaleEndsIn?: string;
  index?: number;
  highlightQuery?: string;
}

function toTrendingData(product: Product, flashSaleEndsIn?: string): TrendingProductData {
  const imgs = (product as any).imageUrls as string[] | undefined;
  const rawPrice = Number(product.price);
  const rawFinal = Number(product.finalPrice ?? product.price);
  const discPct = calculateDiscountPercent(rawPrice, rawFinal);
  const hasDiscount = discPct > 0;

  return {
    id: product.id,
    name: product.name,
    categoryLabel: product.category ?? "",
    store: product.sellerName ?? "",
    price: hasDiscount ? rawFinal : rawPrice,
    originalPrice: hasDiscount ? rawPrice : undefined,
    discountPercent: hasDiscount ? discPct : undefined,
    rating: product.averageRating ?? 0,
    reviews: product.reviewCount ?? 0,
    img: imgs?.[0] ?? product.imageUrl ?? "",
    trending: (product as any).isTrending === true,
    stock: product.stock,
    hasVariants: (product as any).hasVariants === true,
    flashSaleEndsIn,
  };
}

export const ProductCard = React.memo(function ProductCard({
  product,
  flashSaleEndsIn,
  index = 0,
  highlightQuery,
}: ProductCardProps) {
  const queryClient = useQueryClient();
  const prefetchedRef = React.useRef(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Viewport-based prefetch (works on mobile too)
  React.useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !prefetchedRef.current) {
          prefetchedRef.current = true;
          queryClient.prefetchQuery({
            queryKey: getGetProductQueryKey(product.id),
            queryFn: () => getProduct(product.id),
            staleTime: 2 * 60 * 1000,
          });
        }
      },
      { threshold: 0.1, rootMargin: "100px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product.id, queryClient]);

  const handleMouseEnter = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    queryClient.prefetchQuery({
      queryKey: getGetProductQueryKey(product.id),
      queryFn: () => getProduct(product.id),
      staleTime: 2 * 60 * 1000,
    });
  };

  const cardData = toTrendingData(product, flashSaleEndsIn);

  return (
    <div ref={cardRef} onMouseEnter={handleMouseEnter}>
      <TrendingCard product={cardData} i={index} highlightQuery={highlightQuery} />
    </div>
  );
});
