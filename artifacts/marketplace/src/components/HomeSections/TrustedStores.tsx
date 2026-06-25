import { Star, ArrowLeft, ShoppingBag, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

const STATIC_STORES = [
  { id: 1, name: "تك ستور سوريا", taglineAr: "أحدث الإلكترونيات والأجهزة الذكية", categoryKey: "home.categories.electronics", rating: 4.9, reviews: 1840, productCount: 3240, coverImg: "https://images.unsplash.com/photo-1684395882817-030e24c0322a?w=700&h=220&fit=crop&auto=format&q=80", logoColor: "#3b82f6", logoInitial: "ت", verified: true, slug: null },
  { id: 2, name: "دار الأناقة", taglineAr: "أزياء فاخرة وموضة معاصرة للجميع", categoryKey: "home.categories.fashion", rating: 4.8, reviews: 2210, productCount: 1890, coverImg: "https://images.unsplash.com/photo-1768745294179-693a07a3f054?w=700&h=220&fit=crop&auto=format&q=80", logoColor: "#ec4899", logoInitial: "د", verified: true, slug: null },
  { id: 3, name: "بيت الديكور", taglineAr: "أثاث عصري وإكسسوارات منزلية راقية", categoryKey: "home.categories.home_decor", rating: 4.7, reviews: 956, productCount: 2140, coverImg: "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?w=700&h=220&fit=crop&auto=format&q=80", logoColor: "#8b5cf6", logoInitial: "ب", verified: true, slug: null },
];

interface FeaturedStore {
  sellerId: number;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string | null;
  storeBanner: string | null;
  accentColor: string | null;
  categories: string[];
  isVerified: boolean;
  productsCount: number;
  averageRating: number;
  reviewsCount: number;
}

interface StoreData {
  id: number;
  name: string;
  tagline: string;
  categoryLabel: string;
  rating: number;
  reviews: number;
  productCount: number;
  coverImg: string;
  logoColor: string;
  logoInitial: string;
  verified: boolean;
  slug: string | null;
}

function StoreCard({ store, i }: { store: StoreData; i: number }) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: i * 0.1, ease }}
      className="group bg-card border border-border hover:border-border/80 rounded-2xl overflow-hidden transition-all duration-300 sy-card-elevated"
    >
      <div className="relative h-[10rem] overflow-hidden bg-muted">
        <img src={store.coverImg} alt={store.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" style={{ filter: "brightness(var(--img-dim-store)) contrast(1.1)" }} />
        <div className="absolute inset-0 sy-overlay-heavy" />
        {store.verified && (
          <div className="absolute top-3 start-3">
            <div style={{ fontWeight: 600, fontSize: "11px" }} className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {t("home.stores.verified")}
            </div>
          </div>
        )}
      </div>

      <div className="p-6 -mt-8 relative">
        <div className="flex items-end justify-between mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl" style={{ backgroundColor: `${store.logoColor}18`, border: `2px solid ${store.logoColor}30` }}>
            <span style={{ fontWeight: 900, fontSize: "1.5rem", color: store.logoColor }}>{store.logoInitial}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span style={{ fontWeight: 700, fontSize: "0.875rem" }} className="text-foreground/80">{store.rating}</span>
            <span style={{ fontWeight: 400, fontSize: "12px" }} className="text-muted-foreground">({store.reviews.toLocaleString()})</span>
          </div>
        </div>
        <h3 style={{ fontWeight: 800, fontSize: "1.1875rem" }} className="text-foreground mb-1">{store.name}</h3>
        <p style={{ fontWeight: 400, fontSize: "0.8125rem" }} className="text-muted-foreground mb-4 leading-relaxed">{store.tagline}</p>
        <div className="flex items-center gap-4 py-4 border-y border-border mb-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span style={{ fontWeight: 600, fontSize: "0.8125rem" }} className="text-foreground/60">
              {t("home.stores.products_count", { count: store.productCount.toLocaleString() })}
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-border" />
          <span style={{ fontWeight: 400, fontSize: "0.8125rem" }} className="text-muted-foreground">{store.categoryLabel}</span>
        </div>
        <Link
          href={store.slug ? `/store/${store.slug}` : "/sellers/directory"}
          style={{ fontWeight: 700, fontSize: "0.875rem" }}
          className="w-full flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/80 border border-border hover:border-border text-foreground/70 hover:text-foreground py-3 rounded-xl transition-all duration-200"
        >
          <ExternalLink className="w-3.5 h-3.5" /> {t("home.stores.visit")}
        </Link>
      </div>
    </motion.div>
  );
}

export function TrustedStores() {
  const { t, i18n } = useTranslation();
  const [stores, setStores] = useState<StoreData[]>(() =>
    STATIC_STORES.map(s => ({
      id: s.id,
      name: s.name,
      tagline: s.taglineAr,
      categoryLabel: s.categoryKey,
      rating: s.rating,
      reviews: s.reviews,
      productCount: s.productCount,
      coverImg: s.coverImg,
      logoColor: s.logoColor,
      logoInitial: s.logoInitial,
      verified: s.verified,
      slug: s.slug,
    }))
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/sellers/featured`)
      .then(r => r.ok ? r.json() : null)
      .then((data: FeaturedStore[] | null) => {
        if (!data || !Array.isArray(data) || data.length === 0) return;
        const mapped: StoreData[] = data.slice(0, 3).map((s, i) => ({
          id: s.sellerId,
          name: s.storeName,
          tagline: (s.categories ?? []).join(" · ") || t("home.stores.fallback_tagline"),
          categoryLabel: (s.categories ?? [])[0] || "",
          rating: Math.round((s.averageRating || 4.5) * 10) / 10,
          reviews: s.reviewsCount,
          productCount: s.productsCount ?? 0,
          coverImg: s.storeBanner ?? s.storeLogo ?? STATIC_STORES[i % 3].coverImg,
          logoColor: s.accentColor ?? STATIC_STORES[i % 3].logoColor,
          logoInitial: s.storeName.charAt(0),
          verified: s.isVerified,
          slug: s.storeSlug,
        }));
        setStores(mapped);
      })
      .catch(() => {});
  }, []);

  const displayStores = stores.map(s => ({
    ...s,
    categoryLabel: STATIC_STORES.find(st => st.id === s.id)
      ? t(STATIC_STORES.find(st => st.id === s.id)!.categoryKey)
      : s.categoryLabel,
  }));

  return (
    <section dir={i18n.dir()} style={{ fontFamily: "'Cairo', sans-serif" }} className="sy-section-alt py-12 md:py-20 lg:py-28 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 md:mb-10 lg:mb-14">
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.12em" }} className="text-emerald-400 uppercase mb-3">{t("home.stores.eyebrow")}</p>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(24px, 3vw, 38px)", letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-foreground">{t("home.stores.title")}</h2>
          </div>
          <Link href="/sellers/directory" style={{ fontWeight: 600, fontSize: "0.875rem" }} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors pb-1">
            {t("home.stores.see_all")} <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayStores.map((store, i) => <StoreCard key={store.id} store={store} i={i} />)}
        </div>
      </div>
    </section>
  );
}
