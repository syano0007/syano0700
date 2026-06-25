import { ArrowLeft, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { Product } from "@workspace/api-client-react";
import { TrendingCard, type TrendingProductData } from "@/components/TrendingCard";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function TrendingProducts({ products }: { products?: Product[] }) {
  const { t, i18n } = useTranslation();

  const displayProducts: TrendingProductData[] = (products && products.length > 0
    ? products.slice(0, 6).map((p, i) => {
        const imgs = (p as any).imageUrls as string[] | undefined;
        const storeName = (p as any).storeName ?? (p as any).sellerName ?? "";
        const finalPrice = (p as any).finalPrice ? Number((p as any).finalPrice) : Number(p.price);
        const compareAt = (p as any).compareAtPrice ? Number((p as any).compareAtPrice) : undefined;
        const discPct = (p as any).discountPercent ? Number((p as any).discountPercent) : undefined;
        return {
          id: p.id,
          name: p.name,
          categoryLabel: p.category ?? "",
          store: storeName,
          price: finalPrice,
          originalPrice: compareAt,
          discountPercent: discPct,
          rating: 0,
          reviews: 0,
          img: imgs?.[0] ?? "",
          trending: i % 3 !== 2,
          stock: (p as any).stock,
          hasVariants: (p as any).hasVariants ?? false,
        };
      })
    : []
  );

  if (displayProducts.length === 0) return null;

  return (
    <section dir={i18n.dir()} style={{ fontFamily: "'Cairo', sans-serif" }} className="bg-background py-12 md:py-20 lg:py-28 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 md:mb-10 lg:mb-14">
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.12em" }} className="text-emerald-400 uppercase mb-3">{t("home.trending.eyebrow")}</p>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(24px, 3vw, 38px)", letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-foreground">{t("home.trending.title")}</h2>
          </div>
          <Link href="/shop" style={{ fontWeight: 600, fontSize: "0.875rem" }} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors pb-1">
            {t("home.trending.see_all")} <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {displayProducts.map((product, i) => (
            <TrendingCard key={`${product.id}-${i}`} product={product} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
