import { ArrowLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "@workspace/api-client-react";
import { useCurrency } from "@/contexts/CurrencyContext";

/* ── Hero carousel slides ─────────────────────────────────────────────
   Built dynamically from real marketplace products (one per category).
   FALLBACK_SLIDES use the actual Pexels product images from the DB —
   they are the same images stored as product imageUrls.
──────────────────────────────────────────────────────────────────────── */
interface HeroSlide {
  id: string;
  image: string;
  category: string;
  productId: number;
}

/** Actual product image URLs from the DB — used as fallback before API loads */
const FALLBACK_SLIDES: HeroSlide[] = [
  { id: "electronics", image: "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Electronics", productId: 1 },
  { id: "fashion", image: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Fashion", productId: 10 },
  { id: "home", image: "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Home & Living", productId: 17 },
  { id: "beauty", image: "https://images.pexels.com/photos/3059609/pexels-photo-3059609.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Beauty", productId: 24 },
  { id: "sports", image: "https://images.pexels.com/photos/3775549/pexels-photo-3775549.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Sports & Fitness", productId: 31 },
  { id: "jewelry", image: "https://images.pexels.com/photos/1407305/pexels-photo-1407305.jpeg?auto=compress&cs=tinysrgb&w=900&h=900&fit=crop", category: "Jewelry", productId: 35 },
];

const CAROUSEL_CATEGORIES = ["Electronics", "Fashion", "Home & Living", "Beauty", "Sports & Fitness", "Jewelry"];
const CAROUSEL_INTERVAL = 5000;

/** Fallback cards use real product data (SYP prices, real IDs, real Pexels images) */
const FALLBACK_CARDS = [
  { id: 30, name: "Tom Ford Tobacco Vanille EDP", price: 375000, img: "https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop", available: true },
  { id: 35, name: "Rolex Submariner Style Watch", price: 142000, img: "https://images.pexels.com/photos/1407305/pexels-photo-1407305.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop", available: true },
  { id: 10, name: "Floral Maxi Dress — Summer 2025", price: 65000, img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=280&h=280&fit=crop", available: true },
];

const ease = [0.25, 0.46, 0.45, 0.94] as const;

interface CardData { id: number; name: string; price: number; img: string; available: boolean; }

export function HeroSection({ products }: { products: Product[] }) {
  const [activeCard, setActiveCard] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const { format } = useCurrency();
  const { t, i18n } = useTranslation();

  /* Build real product cards from API — first 3 products */
  const cards: CardData[] = products.length >= 3
    ? products.slice(0, 3).map(p => {
        const imgs = (p as any).imageUrls as string[] | undefined;
        return {
          id: p.id,
          name: p.name,
          price: (p as any).finalPrice ? Number((p as any).finalPrice) : Number(p.price),
          img: imgs?.[0] ?? FALLBACK_CARDS[0].img,
          available: ((p as any).stock ?? 1) > 0,
        };
      })
    : FALLBACK_CARDS;

  /* Build carousel slides from real products — one per category */
  const heroSlides: HeroSlide[] = useMemo(() => {
    if (products.length === 0) return FALLBACK_SLIDES;
    const seen = new Set<string>();
    const result: HeroSlide[] = [];
    for (const p of products) {
      const cat = (p as any).category as string ?? "";
      const imgs = (p as any).imageUrls as string[] | undefined;
      if (imgs?.[0] && CAROUSEL_CATEGORIES.includes(cat) && !seen.has(cat)) {
        seen.add(cat);
        result.push({ id: String(p.id), image: imgs[0], category: cat, productId: p.id });
      }
    }
    return result.length > 0 ? result : FALLBACK_SLIDES;
  }, [products]);

  /* Reset slide index when slide set changes */
  useEffect(() => { setSlideIndex(0); }, [heroSlides.length]);

  /* Auto-rotate floating product cards */
  useEffect(() => {
    const timer = setInterval(() => setActiveCard(c => (c + 1) % cards.length), 3200);
    return () => clearInterval(timer);
  }, [cards.length]);

  /* Auto-rotate hero background carousel */
  useEffect(() => {
    const timer = setInterval(
      () => setSlideIndex(i => (i + 1) % heroSlides.length),
      CAROUSEL_INTERVAL
    );
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const currentSlideIdx = heroSlides.length > 0 ? slideIndex % heroSlides.length : 0;
  const currentSlide = heroSlides[currentSlideIdx] ?? FALLBACK_SLIDES[0];

  return (
    <section
      dir={i18n.dir()}
      style={{ fontFamily: "'Cairo', sans-serif" }}
      className="relative md:min-h-screen w-full bg-background flex items-center overflow-hidden pt-[72px]"
    >
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.6) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/[0.07] blur-[120px] pointer-events-none" />
      <div className="absolute left-1/4 bottom-0 w-[400px] h-[400px] rounded-full bg-emerald-600/[0.05] blur-[100px] pointer-events-none" />

      {/* ── Inner container: stacked on mobile, side-by-side md+ ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 w-full flex flex-col md:flex-row items-center gap-8 md:gap-8 lg:gap-16 md:min-h-[calc(100vh-72px)] py-8 md:py-10 lg:py-0">

        {/* ── LEFT: Text panel ── */}
        <div className="w-full md:flex-1 min-w-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] mb-8">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span style={{ fontWeight: 500, fontSize: "var(--font-xs-up)", letterSpacing: "0.06em" }} className="text-emerald-400 uppercase">
                {t("home.hero.badge")}
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            style={{ fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.01em" }}
            className="text-foreground mb-6"
          >
            <span className="block" style={{ fontSize: "clamp(40px, 4.5vw, 68px)" }}>{t("home.hero.line1")}</span>
            <span className="block" style={{ fontSize: "clamp(40px, 4.5vw, 68px)" }}>{t("home.hero.line2")}</span>
            <span className="block bg-gradient-to-l from-emerald-400 to-emerald-300 bg-clip-text text-transparent" style={{ fontSize: "clamp(40px, 4.5vw, 68px)" }}>
              {t("home.hero.line3")}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease }}
            style={{ fontWeight: 400, fontSize: "1.0625rem", lineHeight: 1.75 }}
            className="text-muted-foreground mb-10 max-w-full lg:max-w-[27.5rem]"
          >
            {t("home.hero.subtext")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34, ease }}
            className="flex items-center gap-4"
          >
            <Link href="/shop"
              style={{ fontWeight: 700, fontSize: "0.9375rem" }}
              className="group flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-full transition-all duration-200 hover:shadow-2xl hover:shadow-emerald-500/30 active:scale-95"
            >
              {t("home.hero.shop_now")}
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            </Link>
            <Link href="/sellers/directory"
              style={{ fontWeight: 500, fontSize: "0.875rem" }}
              className="text-muted-foreground hover:text-foreground/80 transition-colors px-4 py-4"
            >
              {t("home.hero.explore_stores")}
            </Link>
          </motion.div>

          {/* Statistics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 md:gap-x-6 lg:gap-x-8 mt-8 lg:mt-14 pt-6 md:pt-8 lg:pt-10 border-t border-border"
          >
            {[
              { value: "+500", labelKey: "home.hero.stat_stores" },
              { value: "+25,000", labelKey: "home.hero.stat_products" },
              { value: "+12,000", labelKey: "home.hero.stat_customers" },
            ].map((stat) => (
              <div key={stat.labelKey}>
                <div style={{ fontWeight: 800, fontSize: "clamp(18px, 2vw, 26px)", letterSpacing: "-0.02em" }} className="text-foreground">{stat.value}</div>
                <div style={{ fontWeight: 400, fontSize: "0.8125rem" }} className="text-muted-foreground mt-0.5">{t(stat.labelKey)}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: Carousel + floating cards ── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease }}
          className="flex w-full md:flex-[0_0_44%] lg:flex-1 relative min-w-0 items-center justify-center pb-6 md:pb-0"
        >
          {/* ── Hero image carousel — real product images from DB ── */}
          <div
            className="relative w-full rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden border border-border shadow-lg sm:shadow-2xl shadow-black/40 aspect-[4/3] md:aspect-[500/520]"
          >

            {/* Carousel images — fade + subtle zoom transition */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentSlide.id}
                src={currentSlide.image}
                alt={currentSlide.category}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "brightness(var(--img-dim-hero)) contrast(1.1)" }}
              />
            </AnimatePresence>

            {/* Overlay — always on top of carousel */}
            <div className="absolute inset-0 sy-hero-overlay pointer-events-none" />

            {/* Discount badge */}
            <div className="absolute top-6 start-6 z-10">
              <div style={{ fontWeight: 800, fontSize: "0.875rem" }} className="bg-emerald-500 text-white px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30">
                {t("home.hero.discount_badge")}
              </div>
            </div>

            {/* Carousel progress dots */}
            <div className="absolute bottom-5 start-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1 rounded-full transition-all duration-400 ${
                    i === currentSlideIdx
                      ? "bg-emerald-400 w-5"
                      : "bg-white/30 w-1.5 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>

            {/* Floating product card — top right (synced to activeCard, all screen sizes) */}
            <div className="absolute top-6 end-6 w-[10.625rem] bg-card/80 backdrop-blur-md border border-border rounded-2xl p-3 z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCard}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center gap-2.5"
                >
                  <img src={cards[activeCard].img} alt={cards[activeCard].name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                  <div className="min-w-0">
                    <p style={{ fontWeight: 600, fontSize: "var(--font-xs)", lineHeight: 1.3 }} className="text-foreground/80 truncate">{cards[activeCard].name}</p>
                    <p style={{ fontWeight: 800, fontSize: "var(--font-xs-up)" }} className="text-emerald-400 mt-0.5" translate="no">{format(cards[activeCard].price)}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="flex gap-1 mt-2.5">
                {cards.map((_, i) => (
                  <button key={i} onClick={() => setActiveCard(i)}
                    className={`h-1 rounded-full transition-all duration-300 ${i === activeCard ? "bg-emerald-400 w-4" : "bg-foreground/20 w-2"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Floating bottom-left card — tablet + desktop only */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease }}
            className="hidden md:block absolute bottom-16 start-0 w-[10.625rem] bg-card/90 backdrop-blur-md border border-border rounded-2xl p-3 shadow-2xl shadow-black/30"
          >
            <Link href={cards[1]?.id ? `/products/${cards[1].id}` : "/products"} className="block">
              <div className="flex items-center gap-2.5">
                <img src={cards[1]?.img ?? FALLBACK_CARDS[1].img} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                <div className="min-w-0">
                  <p style={{ fontWeight: 500, fontSize: "var(--font-2xs)" }} className="text-muted-foreground truncate">{cards[1]?.name ?? FALLBACK_CARDS[1].name}</p>
                  <p style={{ fontWeight: 800, fontSize: "var(--font-xs-up)" }} className="text-emerald-400" translate="no">{format(cards[1]?.price ?? FALLBACK_CARDS[1].price)}</p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Floating bottom-right card — tablet + desktop only */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55, ease }}
            className="hidden md:block absolute bottom-4 end-6 w-[10rem] bg-card/90 backdrop-blur-md border border-border rounded-2xl p-3 shadow-2xl shadow-black/30"
          >
            <Link href={cards[2]?.id ? `/products/${cards[2].id}` : "/products"} className="block">
              <div className="flex items-center gap-2.5">
                <img src={cards[2]?.img ?? FALLBACK_CARDS[2].img} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                <div className="min-w-0">
                  <p style={{ fontWeight: 500, fontSize: "var(--font-2xs)" }} className="text-muted-foreground truncate">{cards[2]?.name ?? FALLBACK_CARDS[2].name}</p>
                  <p style={{ fontWeight: 800, fontSize: "var(--font-xs-up)" }} className="text-emerald-400" translate="no">{format(cards[2]?.price ?? FALLBACK_CARDS[2].price)}</p>
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span style={{ fontSize: "var(--font-2xs)", fontWeight: 500 }} className="text-emerald-400/70">{t("home.hero.card_available")}</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
