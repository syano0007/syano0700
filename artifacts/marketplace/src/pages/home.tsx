// @refresh reset
import {
  useListProducts,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useSEO } from "@/hooks/useSEO";
import { Navbar } from "@/components/Navbar";
import { HeroShowcase } from "@/components/HomeSections/HeroShowcase";
import HomeHeroV2 from "@/components/home/HomeHeroV2";
import { PopularCategories } from "@/components/HomeSections/PopularCategories";
import { FeaturedDeals } from "@/components/HomeSections/FeaturedDeals";
import { TrustedStores } from "@/components/HomeSections/TrustedStores";
import { TrendingProducts } from "@/components/HomeSections/TrendingProducts";
import { NewArrivals } from "@/components/HomeSections/NewArrivals";
import { JoinSection } from "@/components/HomeSections/JoinSection";
import { HomeFooter } from "@/components/HomeSections/HomeFooter";

// ── Feature toggle — flip to false to restore HeroShowcase ──────────────────
const USE_HOME_HERO_V2 = true;

export default function Home() {
  const { t } = useTranslation();

  const { data: products } = useListProducts(
    {},
    {
      query: {
        staleTime: 3 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        queryKey: getListProductsQueryKey({}),
      },
    },
  );

  useSEO({
    title: t("seo.home.title"),
    description: t("seo.home.description"),
    canonical: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "SYANO — سوق سوريا",
      url: "https://syanomarket.online",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate:
            "https://syanomarket.online/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
  });

  const hotDeals    = products?.filter((p) => p.isBestDeal) ?? [];
  const newArrivals = products?.slice(0, 4) ?? [];
  const trending    = products?.slice(0, 6) ?? [];

  return (
    <div
      className="min-h-screen bg-background"
      style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
    >
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.3); }
      `}</style>

      <Navbar />

      {/* pt-[3.75rem] = 60 px fixed navbar offset */}
      <main className="pt-[3.75rem]">
        {/* ── Hero — toggle between V2 and legacy HeroShowcase ── */}
        {USE_HOME_HERO_V2 ? <HomeHeroV2 /> : <HeroShowcase />}

        <PopularCategories />
        <FeaturedDeals hotDeals={hotDeals} />
        <TrustedStores />
        <TrendingProducts products={trending} />
        <NewArrivals newArrivals={newArrivals} />
        <JoinSection />
      </main>

      <HomeFooter />
    </div>
  );
}
