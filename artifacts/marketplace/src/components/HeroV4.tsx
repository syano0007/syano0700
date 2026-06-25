// @refresh reset
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL ?? "/";
const BANNER_INTERVAL_MS = 6_000;
const SLIDE_INTERVAL_MS  = 5_000;

/* ── DB Banner interface ─────────────────────────────────────────── */
interface Banner {
  id: number;
  titleAr: string; titleEn: string;
  subtitleAr?: string | null; subtitleEn?: string | null;
  desktopImage: string; mobileImage?: string | null;
  backgroundColor?: string | null; ctaUrl?: string | null;
}

/* ── Floating card type ──────────────────────────────────────────── */
interface SlideCard {
  pos: React.CSSProperties;
  w: number;
  anim: string;
  label: string;
  price: string;
  stars?: number;
  avail?: string;
  img: string;
}

interface HeroSlide {
  id: string;
  img: string;
  badge: string;
  cards: [SlideCard, SlideCard, SlideCard];
}

/* ── Built-in slides — positions/widths match approved mockup ────── */
const HERO_SLIDES: HeroSlide[] = [
  {
    id: "electronics",
    img: "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop&crop=center",
    badge: "خصم ٨٠٪",
    cards: [
      { pos:{ top:36,  right:18   }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
        label:"عطر ديور سوفاج",   price:"75,000",  stars:5,
        img:"https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ top:205, left:14    }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
        label:"هودية زاهية",      price:"38,500",
        img:"https://images.pexels.com/photos/1103832/pexels-photo-1103832.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ bottom:50, left:38  }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
        label:"ساعة ذهبية فاخرة", price:"142,000", avail:"● متوفر الآن",
        img:"https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=80" },
    ],
  },
  {
    id: "fashion",
    img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop&crop=center",
    badge: "خصم ٣٥٪",
    cards: [
      { pos:{ top:36,  right:18   }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
        label:"فستان حرير شيفون", price:"95,000",  stars:5,
        img:"https://images.pexels.com/photos/1536619/pexels-photo-1536619.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ top:205, left:14    }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
        label:"حقيبة جلدية فاخرة", price:"485,000",
        img:"https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ bottom:50, left:38  }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
        label:"كعب ستيليتو مخملي", price:"185,000", avail:"● متوفر الآن",
        img:"https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=80" },
    ],
  },
  {
    id: "perfumes",
    img: "https://images.pexels.com/photos/3059609/pexels-photo-3059609.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop&crop=center",
    badge: "عطور حصرية",
    cards: [
      { pos:{ top:36,  right:18   }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
        label:"شانيل N°5",        price:"320,000", stars:5,
        img:"https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ top:205, left:14    }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
        label:"كريم لانكوم الليلي", price:"145,000",
        img:"https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ bottom:50, left:38  }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
        label:"كريد أفينتوس",     price:"780,000", avail:"● متوفر الآن",
        img:"https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=80" },
    ],
  },
  {
    id: "home",
    img: "https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop&crop=center",
    badge: "ديكور راقي",
    cards: [
      { pos:{ top:36,  right:18   }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
        label:"طقم أريكة ملكية",  price:"4,500,000", stars:4,
        img:"https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ top:205, left:14    }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
        label:"ثريا كريستال",     price:"2,800,000",
        img:"https://images.pexels.com/photos/1279107/pexels-photo-1279107.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ bottom:50, left:38  }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
        label:"سجادة بخارى حريرية", price:"3,200,000", avail:"● متوفر الآن",
        img:"https://images.pexels.com/photos/243757/pexels-photo-243757.jpeg?auto=compress&cs=tinysrgb&w=80" },
    ],
  },
  {
    id: "jewelry",
    img: "https://images.pexels.com/photos/1407305/pexels-photo-1407305.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop&crop=center",
    badge: "مجوهرات",
    cards: [
      { pos:{ top:36,  right:18   }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
        label:"خاتم ألماس 18 قيراط", price:"12,800,000", stars:5,
        img:"https://images.pexels.com/photos/248077/pexels-photo-248077.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ top:205, left:14    }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
        label:"سوار ذهب إيطالي",  price:"2,850,000",
        img:"https://images.pexels.com/photos/1413420/pexels-photo-1413420.jpeg?auto=compress&cs=tinysrgb&w=80" },
      { pos:{ bottom:50, left:38  }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
        label:"قلادة لؤلؤ طبيعي", price:"9,500,000", avail:"● متوفر الآن",
        img:"https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=80" },
    ],
  },
];

/* ── FloatCard — circular thumbnail, exact mockup values ─────────── */
function FloatCard({ card }: { card: SlideCard }) {
  return (
    <div style={{
      position:"absolute",
      ...(card.pos as object),
      zIndex:10,
      width:card.w,
      background:"rgba(6,6,6,0.93)",
      backdropFilter:"blur(28px)",
      WebkitBackdropFilter:"blur(28px)",
      border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:15,
      padding:"11px 14px",
      display:"flex",
      gap:11,
      alignItems:"center",
      boxShadow:"0 18px 52px rgba(0,0,0,0.84), 0 4px 16px rgba(0,0,0,0.60)",
      animation:card.anim,
      direction:"rtl",
    }}>
      <div style={{ flex:1, textAlign:"right" }}>
        <div style={{ fontSize:10.5, color:"#5a626e", marginBottom:3 }}>{card.label}</div>
        <div style={{
          fontSize:14, fontWeight:800, color:"#f3f3f3",
          marginBottom:(card.stars != null || card.avail) ? 4 : 0,
        }}>
          {card.price}{" "}
          <span style={{ color:"#276221", fontSize:10, fontWeight:500 }}>ل.س</span>
        </div>
        {card.stars != null && (
          <div style={{ display:"flex", gap:1.5, justifyContent:"flex-end" }}>
            {Array.from({ length:card.stars }).map((_,i) => (
              <span key={i} style={{ fontSize:9.5, color:"#f59e0b" }}>★</span>
            ))}
          </div>
        )}
        {card.avail && (
          <div style={{ fontSize:9.5, color:"#276221", display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>
            {card.avail}
          </div>
        )}
      </div>
      {/* Circular thumbnail — confirmed from approved mockup */}
      <img
        src={card.img}
        alt=""
        loading="lazy"
        style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}
      />
    </div>
  );
}

/* ── FloatingCardsLayer — AnimatePresence per slide/banner ───────── */
function FloatingCardsLayer({
  cards, badge, layerKey,
}: {
  cards: [SlideCard, SlideCard, SlideCard];
  badge: string;
  layerKey: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={layerKey}
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity:0 }}
        animate={{ opacity:1, transition:{ duration:0.55, delay:0.25 } }}
        exit={{ opacity:0, transition:{ duration:0.22 } }}
      >
        {cards.map((card, i) => <FloatCard key={i} card={card} />)}

        {/* Discount badge — position matches approved mockup */}
        <div style={{
          position:"absolute", top:120, left:28, zIndex:20,
          background:"#276221", color:"#fff",
          fontSize:12.5, fontWeight:800,
          padding:"5px 14px", borderRadius:100,
          boxShadow:"0 4px 20px rgba(39,98,33,0.55), 0 2px 8px rgba(39,98,33,0.35)",
          pointerEvents:"auto",
        }}>
          {badge}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HeroV4 — Approved mockup values applied to production.
   Desktop  : flex row, image LEFT (50%), text RIGHT (flex:1)
              Section padding: 32px top, 24px bottom, 100px left, 32px right
              Height: 552px fixed
   Mobile   : full-height image overlay with text centered
   ═══════════════════════════════════════════════════════════════════ */
export function HeroV4() {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  /* ── State ──────────────────────────────────────────────────────── */
  const [banners, setBanners]           = useState<Banner[]>([]);
  const [loaded,  setLoaded]            = useState(false);
  const [bannerIdx, setBannerIdx]       = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const [resetKey, setResetKey]         = useState(0);
  const [slideIdx,  setSlideIdx]        = useState(0);

  const touchStartX  = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Fetch DB banners ───────────────────────────────────────────── */
  useEffect(() => {
    fetch(`${BASE}api/banners`)
      .then(r => r.ok ? r.json() : [])
      .then((d: unknown) => setBanners(Array.isArray(d) ? (d as Banner[]) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /* ── Track impression ───────────────────────────────────────────── */
  const trackImpression = useCallback((idx: number) => {
    const b = banners[idx];
    if (!b) return;
    fetch(`${BASE}api/banners/${b.id}/impression`, { method:"POST" }).catch(() => {});
  }, [banners]);

  const goToBanner = useCallback((idx: number) => {
    const n    = banners.length;
    const next = ((idx % n) + n) % n;
    setBannerIdx(next);
    setResetKey(k => k + 1);
    trackImpression(next);
  }, [banners.length, trackImpression]);

  const goBannerPrev = useCallback(() => goToBanner(bannerIdx - 1), [bannerIdx, goToBanner]);
  const goBannerNext = useCallback(() => goToBanner(bannerIdx + 1), [bannerIdx, goToBanner]);

  useEffect(() => { trackImpression(0); }, [trackImpression]);

  /* ── DB banners auto-play ───────────────────────────────────────── */
  useEffect(() => {
    if (banners.length <= 1 || bannerPaused) return;
    const id = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), BANNER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [banners.length, bannerPaused, resetKey]);

  /* ── Built-in slides auto-play ──────────────────────────────────── */
  useEffect(() => {
    if (banners.length > 0 || bannerPaused) return;
    const id = setInterval(() => setSlideIdx(i => (i + 1) % HERO_SLIDES.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [banners.length, bannerPaused]);

  /* ── Keyboard navigation ────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.matches(":hover")) return;
      if (banners.length > 0) {
        if (e.key === "ArrowLeft")  isRTL ? goBannerNext() : goBannerPrev();
        if (e.key === "ArrowRight") isRTL ? goBannerPrev() : goBannerNext();
      } else {
        if (e.key === "ArrowLeft")  setSlideIdx(i => isRTL ? (i + 1) % HERO_SLIDES.length : (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
        if (e.key === "ArrowRight") setSlideIdx(i => isRTL ? (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length : (i + 1) % HERO_SLIDES.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [banners.length, goBannerPrev, goBannerNext, isRTL]);

  /* ── Touch swipe ────────────────────────────────────────────────── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) {
      if (banners.length > 0) {
        isRTL ? (diff > 0 ? goBannerPrev() : goBannerNext()) : (diff > 0 ? goBannerNext() : goBannerPrev());
      } else {
        setSlideIdx(i => diff > 0
          ? (isRTL ? (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length : (i + 1) % HERO_SLIDES.length)
          : (isRTL ? (i + 1) % HERO_SLIDES.length : (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length),
        );
      }
    }
    touchStartX.current = null;
  }, [banners.length, goBannerPrev, goBannerNext, isRTL]);

  /* ── Derived ────────────────────────────────────────────────────── */
  const hasBanners   = banners.length > 1;
  const bgImg        = loaded && banners.length > 0 ? banners[bannerIdx]?.desktopImage ?? null : null;
  const showBuiltin  = loaded && banners.length === 0;
  const currentSlide = HERO_SLIDES[slideIdx];
  const cardsKey     = bgImg ? `banner-${bannerIdx}` : `slide-${slideIdx}`;

  const activeCards: [SlideCard, SlideCard, SlideCard] = bgImg
    ? [
        { pos:{ top:36, right:18 }, w:200, anim:"heroFloatC 5.5s ease-in-out infinite",
          label:"عطر ديور سوفاج",   price:"75,000",   stars:5,
          img:"https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=80" },
        { pos:{ top:205, left:14 }, w:172, anim:"heroFloatB 7s 1.8s ease-in-out infinite",
          label:"هودية زاهية",      price:"38,500",
          img:"https://images.pexels.com/photos/1103832/pexels-photo-1103832.jpeg?auto=compress&cs=tinysrgb&w=80" },
        { pos:{ bottom:50, left:38 }, w:207, anim:"heroFloatA 6.5s 3.5s ease-in-out infinite",
          label:"ساعة ذهبية فاخرة", price:"142,000", avail:"● متوفر الآن",
          img:"https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=80" },
      ]
    : currentSlide.cards;
  const activeBadge = bgImg ? "خصم ٨٠٪" : currentSlide.badge;

  /* Stats — format matches approved mockup: "12,000+" not "+12,000" */
  const STATS = [
    { n:"12,000+", l: isRTL ? "عميل راضٍ" : "Happy Customers" },
    { n:"25,000+", l: isRTL ? "منتج نشط"  : "Active Products" },
    { n:"500+",    l: isRTL ? "متجر نشط"  : "Active Stores"   },
  ];

  /* ── Shared dot indicators renderer ────────────────────────────── */
  function DotIndicators({ count, active, onClick }: { count: number; active: number; onClick: (i: number) => void }) {
    return (
      <div style={{
        position:"absolute", bottom:14, left:0, right:0, zIndex:25,
        display:"flex", justifyContent:"center", gap:7, pointerEvents:"auto",
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onClick(i)}
            aria-label={`شريحة ${i + 1}`}
            style={{
              border:"none", cursor:"pointer", padding:0, borderRadius:100,
              transition:"all 0.3s",
              background: i === active ? "#276221" : "rgba(255,255,255,0.25)",
              width: i === active ? 26 : 4, height:4,
            }}
          />
        ))}
      </div>
    );
  }

  /* ── IMAGE PANEL contents — shared between desktop/mobile ───────── */
  function ImagePanelContents({ showCards }: { showCards: boolean }) {
    return (
      <>
        {/* DB banner image (priority) */}
        <AnimatePresence mode="sync">
          {bgImg && (
            <motion.img
              key={`banner-${bannerIdx}`}
              src={bgImg}
              alt=""
              loading="eager"
              decoding="async"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", animation:"heroKenBurns 28s ease-in-out infinite" } as React.CSSProperties}
              initial={{ opacity:0 }}
              animate={{ opacity:1, transition:{ duration:0.7, ease:"easeOut" } }}
              exit={{ opacity:0, transition:{ duration:0.4 } }}
            />
          )}
        </AnimatePresence>

        {/* Built-in carousel (fallback) */}
        {showBuiltin && (
          <AnimatePresence mode="sync">
            <motion.img
              key={`slide-${slideIdx}`}
              src={currentSlide.img}
              alt=""
              loading={slideIdx === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", animation:"heroKenBurns 28s ease-in-out infinite" } as React.CSSProperties}
              initial={{ opacity:0 }}
              animate={{ opacity:1, transition:{ duration:0.7, ease:"easeOut" } }}
              exit={{ opacity:0, transition:{ duration:0.45 } }}
            />
          </AnimatePresence>
        )}

        {/* Dark overlay */}
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.32)", pointerEvents:"none" }} />

        {/* Bottom gradient */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:"38%",
          background:"linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)",
          pointerEvents:"none",
        }} />

        {/* Floating cards (desktop only) */}
        {showCards && (bgImg || showBuiltin) && (
          <FloatingCardsLayer cards={activeCards} badge={activeBadge} layerKey={cardsKey} />
        )}

        {/* Dot indicators */}
        {hasBanners && (
          <DotIndicators count={banners.length} active={bannerIdx} onClick={goToBanner} />
        )}
        {showBuiltin && HERO_SLIDES.length > 1 && (
          <DotIndicators count={HERO_SLIDES.length} active={slideIdx} onClick={setSlideIdx} />
        )}
      </>
    );
  }

  /* ── TEXT PANEL content ─────────────────────────────────────────── */
  function TextPanelContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div style={{
        position:"relative", zIndex:1,
        display:"flex", flexDirection:"column",
        gap: mobile ? 12 : 16,
        textAlign: isRTL ? "right" : "left",
      }}>
        {/* Eyebrow badge */}
        <div>
          <span style={{
            display:"inline-flex", alignItems:"center", gap:7,
            padding:"4px 13px", borderRadius:100,
            border:"1px solid rgba(39,98,33,0.38)",
            color:"#276221", fontSize:11, fontWeight:600,
            background:"rgba(39,98,33,0.07)",
          }}>
            ✦ {isRTL ? "سوق سوريا الرقمي" : "Syria's Premier Marketplace"}
          </span>
        </div>

        {/* Headline — 3 lines (AR) / 2 lines (EN), clamp from mockup */}
        <h1 style={{
          margin:0,
          fontSize: mobile ? "clamp(26px,7vw,44px)" : "clamp(52px,6.5vw,94px)",
          fontWeight:900,
          lineHeight:1.02,
          letterSpacing:"-1.5px",
          color:"#f0f0f0",
        }}>
          {isRTL ? (
            <>
              اكتشف آلاف<br />
              المنتجات من<br />
              <span style={{ color:"#276221" }}>المتاجر السورية</span>
            </>
          ) : (
            <>
              Discover Thousands<br />
              of <span style={{ color:"#276221" }}>Syrian Products.</span>
            </>
          )}
        </h1>

        {/* Description — color #8b9aac from approved mockup */}
        <p style={{
          margin:0, fontSize: mobile ? 13 : 13.5, lineHeight:1.75,
          maxWidth:390, color:"#8b9aac",
        }}>
          {isRTL
            ? "منتجات متنوعة. متاجر موثوقة. وتجربة تسوق حديثة تجمع أفضل المتاجر السورية في مكان واحد."
            : "Diverse products, trusted sellers, and a modern shopping experience from Syrian stores."}
        </p>

        {/* CTA buttons — geometry from approved mockup */}
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <Link
            href="/shop"
            style={{
              padding:"12px 24px", borderRadius:8,
              background:"#276221",
              color:"#000000",
              fontSize:13.5, fontWeight:800,
              display:"inline-flex", alignItems:"center", gap:6,
              textDecoration:"none",
              boxShadow:"0 4px 24px rgba(39,98,33,0.40), 0 2px 8px rgba(39,98,33,0.24)",
            }}
          >
            {isRTL ? "تسوق الآن" : "Shop Now"}
            <svg style={{ width:13, height:13 }} fill="none" stroke="#000000" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d={isRTL ? "M10 19l-7-7m0 0l7-7m-7 7h18" : "M14 5l7 7m0 0l-7 7m7-7H3"} />
            </svg>
          </Link>
          <Link
            href="/stores"
            style={{
              padding:"12px 24px", borderRadius:8,
              background:"transparent",
              color:"#b0b8c4",
              fontSize:13.5, fontWeight:500,
              border:"1px solid rgba(255,255,255,0.14)",
              textDecoration:"none",
            }}
          >
            {isRTL ? "استكشف المتاجر" : "Browse Stores"}
          </Link>
        </div>

        {/* Stats bar — clamp(22px, 2.4vw, 32px) weight 700 from approved mockup */}
        {!mobile && (
          <div style={{
            borderTop:"1px solid rgba(255,255,255,0.07)",
            paddingTop:18, marginTop:2,
            display:"flex", alignItems:"flex-start",
          }}>
            {STATS.map((s, i) => (
              <div key={s.l} style={{
                flex:1, minWidth:0, textAlign:"right",
                paddingInlineEnd:  i < 2 ? 16 : 0,
                paddingInlineStart: i > 0 ? 16 : 0,
                borderInlineStartWidth: i > 0 ? 1 : 0,
                borderInlineStartStyle:"solid",
                borderInlineStartColor:"rgba(255,255,255,0.07)",
              }}>
                <div style={{
                  fontSize:"clamp(22px, 2.4vw, 32px)",
                  fontWeight:700, lineHeight:1,
                  color:"#ffffff",
                  direction:"ltr", textAlign:"right",
                }}>{s.n}</div>
                <div style={{ fontSize:12, marginTop:4, color:"#5a626e" }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden"
      style={{
        backgroundColor:"#040404",
        backgroundImage:"radial-gradient(rgba(255,255,255,0.009) 1px, transparent 1px)",
        backgroundSize:"32px 32px",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Keyframe animations */}
      <style>{`
        @keyframes heroFloatA  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)}  }
        @keyframes heroFloatB  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)}  }
        @keyframes heroFloatC  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-11px)} }
        @keyframes heroKenBurns {
          0%   { transform:scale(1)    translate(0%,   0%)   }
          50%  { transform:scale(1.04) translate(-0.8%,0.5%) }
          100% { transform:scale(1)    translate(0%,   0%)   }
        }
      `}</style>

      {/* ══ DESKTOP (≥ md): Flex row — image LEFT, text RIGHT ════════
          Padding: 32 top, 24 bottom, 100 left, 32 right (from mockup)
          Height: 552px, gap: 24px, image: 50%, text: flex:1           */}
      <div
        className="hidden md:block"
        style={{ paddingTop:32, paddingBottom:24, paddingLeft:100, paddingRight:32 }}
      >
        <div
          ref={containerRef}
          style={{
            display:"flex", gap:24, height:552,
            direction:"ltr", alignItems:"stretch",
          }}
          onMouseEnter={() => setBannerPaused(true)}
          onMouseLeave={() => setBannerPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >

          {/* ── Image panel (LEFT) — 50% width, 18px radius ────────── */}
          <div style={{
            flex:"0 0 50%",
            borderRadius:18, overflow:"hidden",
            position:"relative", background:"#030303",
            boxShadow:"0 24px 80px rgba(0,0,0,0.70), 0 4px 24px rgba(0,0,0,0.55)",
          }}>
            <ImagePanelContents showCards={true} />

            {/* Right-edge blend: 22% — merges image into dark page bg */}
            <div style={{
              position:"absolute", top:0, bottom:0, right:0,
              width:"22%", zIndex:15,
              background:"linear-gradient(to left, #040404 0%, transparent 100%)",
              pointerEvents:"none",
            }} />

            {/* Navigation arrows — DB banners only */}
            {hasBanners && (
              <>
                <button
                  onClick={goBannerPrev}
                  aria-label="Previous slide"
                  style={{
                    position:"absolute", top:"50%", transform:"translateY(-50%)",
                    right:"calc(50% + 10px)", zIndex:30,
                    width:36, height:36, borderRadius:"50%",
                    background:"rgba(0,0,0,0.50)", border:"1px solid rgba(255,255,255,0.10)",
                    color:"#fff", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}
                >
                  <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                  </svg>
                </button>
                <button
                  onClick={goBannerNext}
                  aria-label="Next slide"
                  style={{
                    position:"absolute", top:"50%", transform:"translateY(-50%)",
                    left:12, zIndex:30,
                    width:36, height:36, borderRadius:"50%",
                    background:"rgba(0,0,0,0.50)", border:"1px solid rgba(255,255,255,0.10)",
                    color:"#fff", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}
                >
                  <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* ── Text panel (RIGHT) — flex:1, direction follows locale ── */}
          <div style={{
            flex:1, overflow:"hidden",
            display:"flex", flexDirection:"column", justifyContent:"center",
            position:"relative",
            direction: isRTL ? "rtl" : "ltr",
            paddingLeft: isRTL ? 8 : 0,
            paddingRight: isRTL ? 0 : 8,
          }}>
            {/* Ambient green glow */}
            <div style={{
              position:"absolute", top:"-20%", left:"5%",
              width:360, height:360, borderRadius:"50%",
              background:"radial-gradient(circle, rgba(39,98,33,0.045) 0%, transparent 70%)",
              pointerEvents:"none",
            }} />
            <TextPanelContent mobile={false} />
          </div>

        </div>
      </div>

      {/* ══ MOBILE (< md): Full-height overlay ═══════════════════════
          Image fills the panel, dark overlay, text centered           */}
      <div
        className="md:hidden relative select-none overflow-hidden"
        style={{ height:"clamp(420px,72vh,580px)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background image */}
        {showBuiltin && (
          <AnimatePresence mode="sync">
            <motion.img
              key={`m-slide-${slideIdx}`}
              src={currentSlide.img}
              alt=""
              loading={slideIdx === 0 ? "eager" : "lazy"}
              decoding="async"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" } as React.CSSProperties}
              initial={{ opacity:0 }}
              animate={{ opacity:1, transition:{ duration:0.7 } }}
              exit={{ opacity:0, transition:{ duration:0.45 } }}
            />
          </AnimatePresence>
        )}
        {bgImg && (
          <AnimatePresence mode="sync">
            <motion.img
              key={`m-banner-${bannerIdx}`}
              src={bgImg}
              alt=""
              loading="eager"
              decoding="async"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" } as React.CSSProperties}
              initial={{ opacity:0 }}
              animate={{ opacity:1, transition:{ duration:0.7 } }}
              exit={{ opacity:0, transition:{ duration:0.4 } }}
            />
          </AnimatePresence>
        )}

        {/* Dark overlay for legibility */}
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", zIndex:2 }} />

        {/* Text content */}
        <div style={{
          position:"absolute", inset:0, zIndex:3,
          display:"flex", flexDirection:"column", justifyContent:"center",
          padding:"24px 20px", direction:"rtl",
        }}>
          <TextPanelContent mobile={true} />
        </div>

        {/* Dot indicators */}
        <div style={{ position:"absolute", bottom:20, left:0, right:0, zIndex:10, display:"flex", justifyContent:"center", gap:7 }}>
          {(hasBanners ? banners : HERO_SLIDES).map((_, i) => (
            <button
              key={i}
              onClick={() => hasBanners ? goToBanner(i) : setSlideIdx(i)}
              aria-label={`شريحة ${i + 1}`}
              style={{
                border:"none", cursor:"pointer", padding:0, borderRadius:100,
                transition:"all 0.3s",
                background: i === (hasBanners ? bannerIdx : slideIdx) ? "#276221" : "rgba(255,255,255,0.25)",
                width: i === (hasBanners ? bannerIdx : slideIdx) ? 26 : 4, height:4,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
