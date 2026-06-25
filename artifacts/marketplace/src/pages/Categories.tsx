import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useTranslation } from "react-i18next";
import { useSEO } from "@/hooks/useSEO";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface CategoryOption {
  slug: string;
  nameEn: string;
  nameAr: string;
  productCount: number;
}

interface FilterOptionsResponse {
  categories: CategoryOption[];
  priceRange: { min: number; max: number };
}

const PALETTE = [
  "#276221", "#3B82F6", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#F97316",
  "#84CC16", "#14B8A6", "#6366F1", "#D946EF",
  "#0EA5E9", "#22C55E", "#A855F7", "#FB923C",
  "#E11D48", "#0D9488",
];

function colorForSlug(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function CategoriesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRtl = lang === "ar";
  const [, navigate] = useLocation();

  useSEO({
    title: lang === "ar" ? "تصفح الفئات — سيانو" : "Browse Categories — Syano",
    description: lang === "ar"
      ? "اكتشف منتجاتنا حسب الفئة في سوق سيانو"
      : "Discover our products by category on Syano marketplace",
  });

  const { data, isLoading } = useQuery<FilterOptionsResponse>({
    queryKey: ["search", "filter-options", "all"],
    queryFn: async () => {
      const res = await fetch("/api/search/filter-options");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json() as Promise<FilterOptionsResponse>;
    },
    staleTime: 60 * 1000,
  });

  const categories = (data?.categories ?? []).filter((c) => c.productCount > 0);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container px-4 py-10" dir={isRtl ? "rtl" : "ltr"}>
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              {t("categories.title")}
            </h1>
            <p className="text-muted-foreground">{t("categories.subtitle")}</p>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-32" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-lg font-semibold text-foreground">{t("categories.empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => {
                const accent = colorForSlug(cat.slug);
                const label = lang === "ar" ? cat.nameAr : cat.nameEn;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => navigate(`/shop?category=${encodeURIComponent(cat.slug)}&lang=${lang}`)}
                    className={cn(
                      "group relative flex flex-col items-start gap-3 p-5 rounded-2xl border border-border/60",
                      "bg-card hover:shadow-md transition-all duration-200 text-start",
                      "hover:border-opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    style={{ "--accent": accent } as React.CSSProperties}
                  >
                    {/* Color accent dot */}
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${accent}22`, border: `1.5px solid ${accent}44` }}
                    >
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground leading-snug group-hover:text-[var(--accent)] transition-colors">
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t("categories.productCount", { count: cat.productCount })}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
