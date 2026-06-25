import React from "react";
import { useTranslation } from "react-i18next";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ProductCard";
import { Separator } from "@/components/ui/separator";

interface RelatedProductsProps {
  currentId: number;
  category: string;
}

export function RelatedProducts({ currentId, category }: RelatedProductsProps) {
  const { t } = useTranslation();

  // Use the canonical generated query key so this request shares the TanStack
  // Query cache with the products listing page. Without this, navigating from
  // /products?category=X to a product detail page fired a duplicate API call
  // even though the same data was already cached under the generated key.
  const { data: products = [], isLoading } = useListProducts(
    { category },
    { query: { staleTime: 5 * 60 * 1000, queryKey: getListProductsQueryKey({ category }) } }
  );

  const related = products.filter((p) => p.id !== currentId).slice(0, 8);

  if (!isLoading && related.length === 0) return null;

  return (
    <div className="mt-12 mb-2">
      <Separator className="mb-8" />
      <div className="flex items-center justify-between mb-5 gap-4">
        <h2 className="text-xl font-bold text-foreground">{t("product_detail.you_may_like")}</h2>
        <Link href={`/shop?category=${encodeURIComponent(category)}`}>
          <Button variant="ghost" size="sm" className="text-primary shrink-0 gap-1 hover:text-primary/80">
            <span className="text-sm font-medium capitalize">{category}</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="shrink-0 w-[calc(50vw-24px)] sm:w-48 md:w-auto space-y-2"
            >
              <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
              <div className="h-4 bg-muted rounded w-4/5 animate-pulse" />
              <div className="h-4 bg-muted rounded w-2/5 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-5 md:overflow-visible md:snap-none">
          {related.map((product) => (
            <div
              key={product.id}
              className="snap-start shrink-0 w-[calc(50vw-24px)] sm:w-48 md:w-auto"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
