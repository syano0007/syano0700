// @refresh reset
/**
 * HeroBanner — Flagship commerce-first hero section (V3)
 *
 * Layout:
 *   Desktop: [carousel 65%] | [deals panel 35%]  — split marketplace layout
 *   Mobile:  full-width carousel → category strip
 *
 * Features:
 *   - Ken Burns effect (CSS, GPU, per-slide reset)
 *   - Framer Motion crossfade + staggered text reveals
 *   - Flash sale countdown ribbon (isolated re-renders)
 *   - Right-side deals panel with best-sellers (desktop only)
 *   - Category shortcut strip (8 quick-access categories)
 *   - Animated progress bars via CSS animation-play-state
 *   - Touch swipe + keyboard navigation
 *   - Autoplay with reliable restart (resetKey pattern)
 *   - Full RTL + ARIA + impression/click analytics
 *   - 0 TypeScript errors, no layout shift
 */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useId,
  useMemo,
  memo,
} from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowRight,
  Timer,
  Cpu,
  Shirt,
  Sparkles as BeautyIcon,
  Home as HomeIcon,
  ShoppingBasket,
  Dumbbell,
  Car,
  Gamepad2,
  ShoppingCart,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCountdown } from "@/hooks/use-countdown";
import { useGetBestSellers, getGetBestSellersQueryKey } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Banner {
  id: number;
  titleAr: string;
  titleEn: string;
  subtitleAr: string | null;
  subtitleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  desktopImage: string;
  mobileImage: string | null;
  ctaLabelAr: string | null;
  ctaLabelEn: string | null;
  ctaUrl: string | null;
  ctaLabelArSecondary: string | null;
  ctaLabelEnSecondary: string | null;
  ctaUrlSecondary: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  sortOrder: number;
  impressions: number;
  clicks: number;
  endDate: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL ?? "/";
const AUTOPLAY_MS = 7000;

// Top 8 categories for the shortcut strip
const QUICK_CATEGORIES = [
  { slug: "Electronics",           en: "Electronics",   ar: "الإلكترونيات",   Icon: Cpu,           bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400" },
  { slug: "Fashion",               en: "Fashion",        ar: "الأزياء",         Icon: Shirt,         bg: "bg-pink-500/10",    text: "text-pink-600 dark:text-pink-400" },
  { slug: "Home & Kitchen",        en: "Home",           ar: "المنزل",          Icon: HomeIcon,      bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400" },
  { slug: "Beauty & Personal Care",en: "Beauty",         ar: "الجمال",          Icon: BeautyIcon,    bg: "bg-rose-500/10",    text: "text-rose-600 dark:text-rose-400" },
  { slug: "Sports & Fitness",      en: "Sports",         ar: "الرياضة",         Icon: Dumbbell,      bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400" },
  { slug: "Automotive",            en: "Automotive",     ar: "السيارات",        Icon: Car,           bg: "bg-slate-500/10",   text: "text-slate-600 dark:text-slate-400" },
  { slug: "Gaming & Entertainment",en: "Gaming",         ar: "الألعاب",         Icon: Gamepad2,      bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400" },
  { slug: "Supermarket & Grocery", en: "Grocery",        ar: "البقالة",         Icon: ShoppingBasket,bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
] as const;

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackImpression(id: number) {
  fetch(`${BASE}api/banners/${id}/impression`, { method: "POST" }).catch(() => {});
}
function trackClick(id: number) {
  fetch(`${BASE}api/banners/${id}/click`, { method: "POST" }).catch(() => {});
}

// ─── Flash sale detection ─────────────────────────────────────────────────────

function getFlashSaleEnd(banner: Banner): Date | null {
  if (!banner.endDate) return null;
  const end = new Date(banner.endDate);
  const now = new Date();
  const hoursLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft > 0 && hoursLeft <= 24) return end;
  return null;
}

// ─── Static fallback ─────────────────────────────────────────────────────────

const FALLBACK =
  "https://images.pexels.com/photos/7317590/pexels-photo-7317590.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080";
const FALLBACK_SM =
  "https://images.pexels.com/photos/7317590/pexels-photo-7317590.jpeg?auto=compress&cs=tinysrgb&w=768&h=600";

function StaticHero() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";
  return (
    <section className="relative overflow-hidden border-b">
      <div className="relative min-h-[60vh] sm:min-h-[65vh] md:min-h-[72vh] flex items-center">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={FALLBACK}
            alt=""
            fetchPriority="high"
            decoding="async"
            sizes="100vw"
            srcSet={`${FALLBACK_SM} 768w, ${FALLBACK} 1920w`}
            className="absolute inset-0 h-full w-full object-cover hero-kenburns"
            style={{ objectPosition: "center 40%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/65" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
        <div className="container px-5 sm:px-8 relative z-10 w-full">
          <div className="max-w-2xl lg:max-w-3xl space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide">
              <Zap className="h-3.5 w-3.5 text-primary" />
              {t("home.hero.badge")}
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-white drop-shadow-2xl">
              {t("home.hero.line1")} {t("home.hero.line2")} {t("home.hero.line3")}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/80 leading-relaxed max-w-xl drop-shadow">
              {t("home.hero.subtext")}
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3 pt-1">
              <Link href="/shop">
                <Button size="lg" className="h-12 px-8 text-base font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40 transition-all duration-200">
                  {t("home.hero.shop_now")}
                  <ArrowRight className={cn("h-5 w-5 shrink-0", isRTL ? "me-2 rotate-180" : "ms-2")} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <CategoryStrip />
    </section>
  );
}

// ─── Flash Sale Ribbon (isolated — ticks every second without re-rendering parent) ──

const FlashSaleRibbon = memo(function FlashSaleRibbon({ endDate }: { endDate: string }) {
  const { t } = useTranslation();
  const getEnd = useCallback(() => new Date(endDate), [endDate]);
  const { formatted, expired } = useCountdown(getEnd);
  if (expired) return null;
  return (
    <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
      <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 text-white text-xs sm:text-sm font-bold py-2 px-4">
        <Zap className="h-3.5 w-3.5 animate-pulse shrink-0" />
        <span>{t("home.deals.eyebrow")}</span>
        <span className="opacity-80 font-normal hidden sm:inline">—</span>
        <span className="inline-flex items-center gap-1 hidden sm:inline-flex">
          <Timer className="h-3.5 w-3.5 shrink-0" />
          <span>{t("home.deals.ends_in")}</span>
        </span>
        <span dir="ltr" className="tabular-nums bg-black/20 rounded px-1.5 py-0.5 text-xs font-mono tracking-wider">
          {formatted}
        </span>
      </div>
    </div>
  );
});

// ─── Category Strip ───────────────────────────────────────────────────────────

const CategoryStrip = memo(function CategoryStrip() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm">
      <div className="container px-4">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-2.5 sm:py-3">
          {QUICK_CATEGORIES.map(({ slug, en, ar, Icon, bg, text }) => (
            <Link
              key={slug}
              href={`/shop?category=${encodeURIComponent(slug)}`}
              className="shrink-0"
            >
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
                "bg-background hover:bg-muted",
                "border-border hover:border-primary/40",
                "transition-all duration-150 hover:shadow-sm",
                "text-xs sm:text-sm font-medium whitespace-nowrap",
                "group"
              )}>
                <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0", bg)}>
                  <Icon className={cn("h-3 w-3", text)} />
                </div>
                <span className="text-foreground/80 group-hover:text-foreground transition-colors">
                  {lang === "ar" ? ar : en}
                </span>
              </div>
            </Link>
          ))}
          <Link href="/shop" className="shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border hover:border-primary/40 bg-background hover:bg-muted transition-all duration-150 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
});

// ─── Deal Card (in the right panel) ──────────────────────────────────────────

interface DealProduct {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrls?: string[];
  isOnSale?: boolean;
  discountPercent?: number | null;
  averageRating?: number | null;
}

const DealCard = memo(function DealCard({ product }: { product: DealProduct }) {
  const { i18n } = useTranslation();
  const img = product.imageUrls?.[0];
  const hasDiscount = product.isOnSale && product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : null;

  return (
    <Link href={`/products/${product.id}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/60 transition-colors cursor-pointer group border-b border-border/40 last:border-0">
        {/* Thumbnail */}
        <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/40">
          {img ? (
            <img
              src={img}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <ShoppingCart className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-foreground">
              ${product.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                ${product.compareAtPrice!.toFixed(2)}
              </span>
            )}
            {discountPct && (
              <span className="text-[10px] font-bold bg-rose-500/10 text-rose-600 px-1 py-0.5 rounded">
                -{discountPct}%
              </span>
            )}
          </div>
          {product.averageRating && product.averageRating > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-muted-foreground">{product.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
});

// ─── Deals Panel (desktop right column) ──────────────────────────────────────

const DealsPanel = memo(function DealsPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: deals, isLoading } = useGetBestSellers(4, {
    query: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      queryKey: getGetBestSellersQueryKey(4),
    },
  });

  const hasDeals = !isLoading && deals && deals.length > 0;

  return (
    <div className="hidden lg:flex flex-col border-s border-border/60 bg-card/80 backdrop-blur-sm h-full">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">
              {t("home.deals.title")}
            </span>
          </div>
          <Link
            href="/shop?sortBy=best_selling"
            className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5"
          >
            {t("home.deals.see_all")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Deal cards */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-0 py-2 animate-pulse">
                <div className="h-14 w-14 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-2.5 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : hasDeals ? (
          <div>
            {deals!.map((p) => (
              <DealCard key={p.id} product={p as unknown as DealProduct} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">
              {lang === "ar" ? "جاري إضافة المنتجات…" : "Products coming soon…"}
            </p>
          </div>
        )}
      </div>

      {/* Trust signals at bottom */}
      <div className="border-t border-border/60 px-4 py-3 shrink-0 space-y-2">
        {[
          { icon: ShieldCheck, textEn: "Buyer Protection", textAr: "حماية المشتري", color: "text-emerald-500" },
          { icon: Zap, textEn: "Fast Delivery in Aleppo", textAr: "توصيل سريع في حلب", color: "text-primary" },
        ].map(({ icon: Icon, textEn, textAr, color }) => (
          <div key={textEn} className="flex items-center gap-2">
            <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
            <span className="text-[11px] text-muted-foreground">
              {lang === "ar" ? textAr : textEn}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Animation variants ───────────────────────────────────────────────────────

type BezierEase = [number, number, number, number];
const EASE: BezierEase = [0.25, 0.46, 0.45, 0.94];
const EASE_OUT: BezierEase = [0.0, 0.0, 0.2, 1.0];

const slideVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.85, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

const contentVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.28 } },
  exit: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, y: -14, filter: "blur(2px)", transition: { duration: 0.3, ease: "easeIn" } },
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  active,
  paused,
  durationMs,
  onClick,
  label,
}: {
  active: boolean;
  paused: boolean;
  durationMs: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex-1 h-[3px] rounded-full overflow-hidden",
        "transition-opacity duration-300",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
        active ? "opacity-100" : "opacity-30 hover:opacity-55"
      )}
    >
      <div className="w-full h-full bg-white/22 relative overflow-hidden rounded-full">
        {active && (
          <div
            className="absolute inset-y-0 start-0 w-full bg-white rounded-full origin-left"
            style={{
              animation: `hero-progress ${durationMs}ms linear forwards`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        )}
      </div>
    </button>
  );
}

// ─── Arrow Button ─────────────────────────────────────────────────────────────

function ArrowBtn({
  onClick,
  label,
  children,
  side,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  side: "start" | "end";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-30",
        "h-10 w-10 md:h-12 md:w-12 rounded-full",
        "flex items-center justify-center",
        "bg-black/20 backdrop-blur-md border border-white/15",
        "text-white hover:bg-black/40 hover:border-white/30",
        "shadow-xl shadow-black/30",
        "transition-all duration-200 hover:scale-110 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        "hidden sm:flex",
        side === "start" ? "start-3 lg:start-5" : "end-3 lg:end-5"
      )}
    >
      {children}
    </button>
  );
}

// ─── Slide ────────────────────────────────────────────────────────────────────

function Slide({
  banner,
  lang,
  isRTL,
  slideIndex,
  hasFlashSale,
  onCtaClick,
  reducedMotion,
}: {
  banner: Banner;
  lang: string;
  isRTL: boolean;
  slideIndex: number;
  hasFlashSale: boolean;
  onCtaClick: (id: number) => void;
  reducedMotion: boolean | null;
}) {
  const { t } = useTranslation();

  const title = lang === "ar" ? banner.titleAr : banner.titleEn;
  const subtitle = lang === "ar" ? banner.subtitleAr : banner.subtitleEn;
  const description = lang === "ar" ? banner.descriptionAr : banner.descriptionEn;
  const ctaLabel = lang === "ar" ? banner.ctaLabelAr : banner.ctaLabelEn;
  const ctaLabelSec = lang === "ar" ? banner.ctaLabelArSecondary : banner.ctaLabelEnSecondary;
  const textColor = banner.textColor ?? "#ffffff";
  const bgColor = banner.backgroundColor ?? "#0f172a";

  return (
    <motion.div
      className="absolute inset-0"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      aria-roledescription="slide"
      aria-label={`${slideIndex + 1}`}
    >
      {/* Background with Ken Burns */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <img
          key={`kb-${banner.id}`}
          src={banner.desktopImage}
          alt=""
          loading={slideIndex === 0 ? "eager" : "lazy"}
          fetchPriority={slideIndex === 0 ? "high" : "auto"}
          decoding="async"
          sizes="100vw"
          className={cn("absolute inset-0 h-full w-full object-cover", !reducedMotion && "hero-kenburns")}
        />

        {/* Layer 1: vertical readability gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/65" />
        {/* Layer 2: brand diagonal from content side */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${isRTL ? "to left" : "to right"}, ${bgColor}cc 0%, ${bgColor}60 28%, transparent 58%)`,
          }}
        />
        {/* Layer 3: horizontal depth */}
        <div className={cn("absolute inset-0", isRTL ? "bg-gradient-to-l from-black/55 via-black/15 to-transparent" : "bg-gradient-to-r from-black/55 via-black/15 to-transparent")} />
        {/* Layer 4: bottom vignette for controls */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Layer 5: top edge */}
        {!hasFlashSale && <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" />}
      </div>

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 -end-32 h-[500px] w-[500px] rounded-full blur-3xl opacity-15" style={{ backgroundColor: bgColor }} aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 -start-20 h-80 w-80 rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center" style={{ color: textColor }}>
        <div className="container px-5 sm:px-8 lg:px-10 relative z-10 w-full">
          <motion.div
            className="max-w-xl lg:max-w-2xl space-y-3 sm:space-y-4 md:space-y-5"
            variants={contentVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Subtitle badge */}
            {subtitle && (
              <motion.div variants={itemVariants}>
                <span className="inline-flex items-center gap-2 bg-white/12 backdrop-blur-md border border-white/18 px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wider uppercase" style={{ color: textColor }}>
                  <Zap className="h-3 w-3 text-primary shrink-0" />
                  {subtitle}
                </span>
              </motion.div>
            )}

            {/* Main title */}
            <motion.h2
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-[1.0] tracking-tight drop-shadow-2xl"
              style={{ color: textColor }}
            >
              {title}
            </motion.h2>

            {/* Description */}
            {description && (
              <motion.p
                variants={itemVariants}
                className="text-sm sm:text-base md:text-lg leading-relaxed max-w-lg opacity-85 drop-shadow-lg"
                style={{ color: textColor }}
              >
                {description}
              </motion.p>
            )}

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 pt-0.5"
            >
              {ctaLabel && banner.ctaUrl ? (
                <Link href={banner.ctaUrl} onClick={() => onCtaClick(banner.id)}>
                  <Button size="lg" className="h-11 sm:h-12 px-7 text-sm sm:text-base font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/55 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/45 transition-all duration-200">
                    {ctaLabel}
                    <ArrowRight className={cn("h-4 w-4 shrink-0", isRTL ? "me-2 rotate-180" : "ms-2")} />
                  </Button>
                </Link>
              ) : (
                <Link href="/shop">
                  <Button size="lg" className="h-11 sm:h-12 px-7 text-sm sm:text-base font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/55 hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/45 transition-all duration-200">
                    {t("home.hero.shop_now")}
                    <ArrowRight className={cn("h-4 w-4 shrink-0", isRTL ? "me-2 rotate-180" : "ms-2")} />
                  </Button>
                </Link>
              )}
              {ctaLabelSec && banner.ctaUrlSecondary && (
                <Link href={banner.ctaUrlSecondary} onClick={() => onCtaClick(banner.id)}>
                  <Button size="lg" variant="outline" className="h-11 sm:h-12 px-6 text-sm sm:text-base font-semibold bg-white/10 backdrop-blur-md border-white/25 hover:bg-white/20 hover:border-white/40 text-white transition-all duration-200">
                    {ctaLabelSec}
                  </Button>
                </Link>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main HeroBanner ──────────────────────────────────────────────────────────

export function HeroBanner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = i18n.dir() === "rtl";
  const reducedMotion = useReducedMotion();
  const regionId = useId();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const impressionTracked = useRef<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch banners ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}api/banners`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Banner[]) => setBanners(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Impression tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!banners.length) return;
    const b = banners[currentIndex];
    if (!b || impressionTracked.current.has(b.id)) return;
    impressionTracked.current.add(b.id);
    trackImpression(b.id);
  }, [currentIndex, banners]);

  // ── Autoplay — resetKey restarts interval after manual navigation ─────────
  useEffect(() => {
    if (banners.length <= 1 || paused || reducedMotion) return;
    const id = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % banners.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [banners.length, paused, reducedMotion, resetKey]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goTo = useCallback(
    (idx: number) => {
      const n = banners.length;
      if (!n) return;
      setCurrentIndex(((idx % n) + n) % n);
      setResetKey((k) => k + 1);
    },
    [banners.length]
  );

  const goPrev = useCallback(() => goTo(currentIndex - (isRTL ? -1 : 1)), [currentIndex, goTo, isRTL]);
  const goNext = useCallback(() => goTo(currentIndex + (isRTL ? -1 : 1)), [currentIndex, goTo, isRTL]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); isRTL ? goNext() : goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); isRTL ? goPrev() : goNext(); }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [goPrev, goNext, isRTL]);

  // ── Touch drag ────────────────────────────────────────────────────────────
  const touchStart = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current;
    if (start === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) > 40) (isRTL ? dx > 0 : dx < 0) ? goNext() : goPrev();
    setTimeout(() => setPaused(false), 800);
    touchStart.current = null;
  }, [goNext, goPrev, isRTL]);

  // ── CTA click ─────────────────────────────────────────────────────────────
  const handleCta = useCallback((id: number) => trackClick(id), []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const current = banners[currentIndex] ?? null;
  const multi = banners.length > 1;
  const flashSaleEnd = current ? getFlashSaleEnd(current) : null;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="border-b">
        <div className="lg:grid lg:grid-cols-[1fr_20rem]">
          <div className="min-h-[60vh] sm:min-h-[65vh] lg:min-h-[32.5rem] bg-muted animate-pulse" />
          <div className="hidden lg:block bg-card border-s animate-pulse" />
        </div>
        <div className="border-t bg-background h-12 animate-pulse" />
      </section>
    );
  }

  // ── No banners → static fallback ─────────────────────────────────────────
  if (!banners.length) return <StaticHero />;

  return (
    <section className="relative border-b overflow-hidden">
      {/* ─── Main grid: carousel + deals panel ─── */}
      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:h-[32.5rem]">

        {/* LEFT: Carousel */}
        <div
          ref={containerRef}
          aria-roledescription="carousel"
          aria-label={t("hero_banner.region_label")}
          id={regionId}
          tabIndex={0}
          className="relative overflow-hidden min-h-[60vh] sm:min-h-[65vh] lg:min-h-0 lg:h-full select-none focus-visible:outline-none"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Slide stack */}
          <AnimatePresence mode="sync">
            {current && (
              <Slide
                key={currentIndex}
                banner={current}
                lang={lang}
                isRTL={isRTL}
                slideIndex={currentIndex}
                hasFlashSale={!!flashSaleEnd}
                onCtaClick={handleCta}
                reducedMotion={reducedMotion}
              />
            )}
          </AnimatePresence>

          {/* Flash sale ribbon */}
          {flashSaleEnd && current && (
            <FlashSaleRibbon endDate={current.endDate!} />
          )}

          {/* Navigation arrows */}
          {multi && (
            <>
              <ArrowBtn side="start" onClick={goPrev} label={t("hero_banner.prev")}>
                {isRTL ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </ArrowBtn>
              <ArrowBtn side="end" onClick={goNext} label={t("hero_banner.next")}>
                {isRTL ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </ArrowBtn>
            </>
          )}

          {/* Bottom controls: progress bars + counter */}
          {multi && (
            <div className="absolute bottom-0 inset-x-0 z-20 px-5 sm:px-7 pb-4 pt-8">
              <div className="flex items-center gap-3 max-w-sm">
                <div className="flex items-center gap-1.5 flex-1">
                  {banners.map((b, i) => (
                    <ProgressBar
                      key={b.id}
                      active={i === currentIndex}
                      paused={paused}
                      durationMs={AUTOPLAY_MS}
                      onClick={() => goTo(i)}
                      label={`${t("hero_banner.go_to_slide")} ${i + 1}`}
                    />
                  ))}
                </div>
                <span className="text-white/60 text-xs tabular-nums shrink-0 font-medium">
                  {currentIndex + 1}&thinsp;/&thinsp;{banners.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Deals panel (desktop only) */}
        <DealsPanel />
      </div>

      {/* ─── Category strip (full width) ─── */}
      <CategoryStrip />
    </section>
  );
}

export default HeroBanner;
