// @refresh reset
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const BASE            = import.meta.env.BASE_URL ?? "/";
const AUTO_MS         = 5_500;   // ms per slide
const DRAG_THRESHOLD  = 45;      // px – min drag distance to commit a slide change
const VELOCITY_THRESH = 0.3;     // px/ms – flick velocity threshold
const EDGE_RESISTANCE = 0.18;    // rubber-band factor past first/last slide

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

interface HeroBanner {
  id: number;
  desktopImage: string;
  mobileImage: string | null;
}

interface BuiltinSlide {
  img:    string;
  titleAr: string;
  titleEn: string;
  href:    string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FALLBACK SLIDES  (used when the DB has no active banner records)

   All 10 URLs verified HTTP 200 before inclusion.
   Categories: Electronics · Fashion · Home · Beauty · Grocery ·
               Sports · Automotive · Baby & Kids · Local Market · Seasonal
───────────────────────────────────────────────────────────────────────────── */

const FALLBACK_SLIDES: BuiltinSlide[] = [
  // 1. Electronics & Smartphones — verified 200
  {
    img:     "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "أحدث الإلكترونيات",
    titleEn: "Latest Electronics",
    href:    "/shop?category=Electronics",
  },
  // 2. Fashion & Clothing — verified 200
  {
    img:     "https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "أزياء العصر",
    titleEn: "Fashion & Style",
    href:    "/shop?category=Fashion",
  },
  // 3. Home & Kitchen — verified 200
  {
    img:     "https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "المنزل والمطبخ",
    titleEn: "Home & Kitchen",
    href:    "/shop?category=Home+%26+Kitchen",
  },
  // 4. Beauty & Personal Care — different image from side panel FALLBACK_B (3059609)
  {
    img:     "https://images.pexels.com/photos/3762875/pexels-photo-3762875.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "جمال وعناية",
    titleEn: "Beauty & Care",
    href:    "/shop?category=Beauty+%26+Personal+Care",
  },
  // 5. Grocery & Fresh Food — verified 200
  {
    img:     "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "طازج يومياً",
    titleEn: "Fresh Daily",
    href:    "/shop?category=Grocery",
  },
  // 6. Sports & Fitness — different image from side panel FALLBACK_C (1552252)
  {
    img:     "https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "رياضة ولياقة",
    titleEn: "Sports & Fitness",
    href:    "/shop?category=Sports+%26+Fitness",
  },
  // 7. Automotive Accessories — verified 200
  {
    img:     "https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "قطع السيارات",
    titleEn: "Auto Accessories",
    href:    "/shop?category=Automotive",
  },
  // 8. Baby & Kids — verified 200
  {
    img:     "https://images.pexels.com/photos/3662667/pexels-photo-3662667.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "عالم الأطفال",
    titleEn: "World of Kids",
    href:    "/shop?category=Baby+%26+Kids",
  },
  // 9. Local Market & Crafts — verified 200
  {
    img:     "https://images.pexels.com/photos/5560698/pexels-photo-5560698.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "السوق المحلي",
    titleEn: "Local Market",
    href:    "/shop?category=Local+Market",
  },
  // 10. Seasonal Deals — verified 200
  {
    img:     "https://images.pexels.com/photos/5632370/pexels-photo-5632370.jpeg?auto=compress&cs=tinysrgb&w=1600&h=900&fit=crop",
    titleAr: "أحدث العروض",
    titleEn: "Latest Deals",
    href:    "/shop?hasDiscount=true",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   DOT INDICATORS
───────────────────────────────────────────────────────────────────────────── */

function Dots({
  count, active, onGo, label,
}: {
  count: number; active: number; onGo: (i: number) => void; label: string;
}) {
  return (
    <div
      className="absolute bottom-4 left-0 right-0 z-30 flex justify-center gap-2"
      // direction:ltr keeps dot 0 at the left and dot N at the right,
      // matching the LTR slide order of the track — same in Arabic and English.
      style={{ direction: "ltr" }}
      onPointerDown={e => e.stopPropagation()}
    >
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          aria-label={`${label} ${i + 1}`}
          style={{
            border: "none",
            cursor: "pointer",
            padding: 0,
            borderRadius: 100,
            transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            background: i === active ? "#276221" : "rgba(255,255,255,0.45)",
            width: i === active ? 28 : 7,
            height: 7,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROPS
───────────────────────────────────────────────────────────────────────────── */

interface CarouselProps {
  /**
   * Tailwind height class(es) applied to the outer overflow-hidden shell.
   * Accepts responsive variants e.g. "h-[240px]" or "h-full".
   * Defaults to the standalone full-width banner heights.
   */
  heightClass?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN CAROUSEL
───────────────────────────────────────────────────────────────────────────── */

export function HeroBannerCarousel({
  heightClass = "h-[260px] sm:h-[360px] md:h-[480px]",
}: CarouselProps = {}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [banners,    setBanners]    = useState<HeroBanner[]>([]);
  const [loaded,     setLoaded]     = useState(false);
  const [idx,        setIdx]        = useState(0);
  const [paused,     setPaused]     = useState(false);

  /* drag state */
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX  = useRef<number | null>(null);
  const lastX       = useRef(0);
  const lastTime    = useRef(0);
  const velRef      = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Fetch banners from DB ─────────────────────────────────────────────── */
  useEffect(() => {
    fetch(`${BASE}api/banners`)
      .then(r => r.ok ? r.json() : [])
      .then((d: unknown) => setBanners(Array.isArray(d) ? (d as HeroBanner[]) : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /* ── Impression tracking ───────────────────────────────────────────────── */
  const trackImpression = useCallback((id: number) => {
    fetch(`${BASE}api/banners/${id}/impression`, { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length > 0 && banners[0]) trackImpression(banners[0].id);
  }, [banners, trackImpression]);

  /* ── Derived ───────────────────────────────────────────────────────────── */
  const slides = banners.length > 0 ? banners : FALLBACK_SLIDES;
  const total  = slides.length;

  const slideImage = (i: number): string => {
    if (banners.length > 0 && banners[i]) return banners[i]!.desktopImage;
    return (FALLBACK_SLIDES[i] as BuiltinSlide).img;
  };

  /* ── Navigation ────────────────────────────────────────────────────────── */
  const goTo = useCallback((n: number) => {
    const next = ((n % total) + total) % total;
    setIdx(next);
    if (banners.length > 0 && banners[next]) trackImpression(banners[next]!.id);
  }, [total, banners, trackImpression]);

  const goPrev = useCallback(() => goTo(idx - 1), [idx, goTo]);
  const goNext = useCallback(() => goTo(idx + 1), [idx, goTo]);

  /* ── Auto-rotate ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (total <= 1 || paused) return;
    const id = setInterval(() => setIdx(i => (i + 1) % total), AUTO_MS);
    return () => clearInterval(id);
  }, [total, paused]);

  /* ── Keyboard navigation ───────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.matches(":hover")) return;
      // Track is always LTR (direction:ltr on track element), so ArrowLeft =
      // previous and ArrowRight = next in both Arabic and English — no RTL flip.
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  /* ── Drag helpers ──────────────────────────────────────────────────────── */
  const startDrag = (clientX: number) => {
    dragStartX.current = clientX;
    lastX.current      = clientX;
    lastTime.current   = Date.now();
    velRef.current     = 0;
    setIsDragging(true);
    setPaused(true);
  };

  const moveDrag = (clientX: number) => {
    if (dragStartX.current === null) return;
    const now = Date.now();
    const dt  = now - lastTime.current;
    if (dt > 0) velRef.current = (clientX - lastX.current) / dt;
    lastX.current    = clientX;
    lastTime.current = now;

    // Slides stack LTR in the DOM regardless of locale.
    // The track always follows the finger directly — no RTL inversion.
    const raw = clientX - dragStartX.current;

    // Rubber-band: dampen drag past the first/last slide boundary
    const atStart = idx === 0 && raw > 0;
    const atEnd   = idx === total - 1 && raw < 0;
    const offset  = (atStart || atEnd) ? raw * EDGE_RESISTANCE : raw;

    setDragOffset(offset);
  };

  const endDrag = (clientX: number) => {
    if (dragStartX.current === null) return;
    const raw = clientX - dragStartX.current;
    const vel = velRef.current;

    // Swipe/drag left  → next slide  (natural for both LTR and RTL users)
    // Swipe/drag right → prev slide
    if (raw < -DRAG_THRESHOLD || vel < -VELOCITY_THRESH) goNext();
    else if (raw > DRAG_THRESHOLD || vel > VELOCITY_THRESH) goPrev();

    dragStartX.current = null;
    setDragOffset(0);
    setIsDragging(false);
    setTimeout(() => setPaused(false), 350);
  };

  const cancelDrag = () => {
    dragStartX.current = null;
    setDragOffset(0);
    setIsDragging(false);
    setPaused(false);
  };

  /* ── Pointer events (mouse drag on desktop) ─────────────────────────────── */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startDrag(e.clientX);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove   = (e: React.PointerEvent<HTMLDivElement>) => moveDrag(e.clientX);
  const onPointerUp     = (e: React.PointerEvent<HTMLDivElement>) => endDrag(e.clientX);
  const onPointerCancel = () => cancelDrag();

  /* ── Touch events (mobile swipe) ────────────────────────────────────────── */
  const onTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0]!.clientX);
  const onTouchMove  = (e: React.TouchEvent) => {
    if (dragStartX.current !== null) moveDrag(e.touches[0]!.clientX);
  };
  const onTouchEnd   = (e: React.TouchEvent) => endDrag(e.changedTouches[0]!.clientX);

  /* ── Skeleton (shown while fetch resolves) ──────────────────────────────── */
  if (!loaded) {
    return <div className="w-full h-[260px] sm:h-[360px] md:h-[480px] bg-muted animate-pulse" />;
  }

  /*
   * ── Track transform ─────────────────────────────────────────────────────
   *
   * CRITICAL: translateX(N%) is relative to the ELEMENT'S OWN width, not its
   * parent. The track is (total × container_width) wide, so translateX(-100%)
   * moves it by (total × container_width) — 10 slides-worth instead of 1.
   *
   * Wrong:  -${idx * 100}%          (for idx=1, total=10 → moves 10 slides)
   * Right:  -${(idx * 100) / total}% (for idx=1, total=10 → moves 1 slide)
   *
   * This was the root cause of all slides after slide 0 appearing black.
   */
  const pct = (idx * 100) / total;
  const trackTransform = isDragging
    ? `translateX(calc(-${pct}% + ${dragOffset}px))`
    : `translateX(-${pct}%)`;

  /* ────────────────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────────────────── */
  return (
    <section
      role="region"
      aria-label={t("hero_banner.region_label")}
      ref={containerRef}
      // Apply heightClass to the section too so that when heightClass="h-full"
      // inside a CSS Grid cell, the section fills the cell height and the inner
      // div's own h-full resolves correctly (otherwise section height = auto = 0).
      className={`relative w-full ${heightClass}`}
      onMouseEnter={() => { if (!isDragging) setPaused(true); }}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Outer shell: clips the track, sets height ────────────────────── */}
      <div
        className={`relative overflow-hidden select-none ${heightClass}`}
        style={{
          // direction:ltr on the overflow container is critical.
          // Without it, dir="rtl" on <html> causes CSS to anchor the
          // wider-than-parent track at the RIGHT edge instead of the left,
          // making only slide N-1 visible and all others clipped (black).
          direction: "ltr",
          background: "#111",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Track: all slides laid out side-by-side, single translateX ── */}
        <div
          style={{
            display: "flex",
            // CRITICAL: force LTR layout on the track regardless of document
            // direction. When dir="rtl" is set on <html> (Arabic mode), CSS
            // direction:rtl propagates into flex containers and reverses the
            // main axis — slides stack right-to-left, breaking translateX math,
            // indicators, and swipe direction. Pinning direction:ltr here makes
            // slide order, transform calculations, and swipe behavior identical
            // in both Arabic and English. Text inside each slide is unaffected
            // because they inherit direction from their own content elements.
            direction: "ltr",
            width: `${total * 100}%`,
            height: "100%",
            transform: trackTransform,
            // easeOutQuint: fast deceleration, graceful tail — premium feel
            transition: isDragging
              ? "none"
              : "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: `${100 / total}%`,
                height: "100%",
                position: "relative",
                flexShrink: 0,
                // overflow hidden on slide so images fill their cell exactly
                overflow: "hidden",
              }}
            >
              {/*
                CRITICAL: no transform/transition on the <img> itself.
                The track element owns all motion — applying a secondary
                CSS transform on the img causes blank frames when slide
                transitions compose with the still-animating image transform.
              */}
              <img
                src={slideImage(i)}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  pointerEvents: "none",
                  display: "block",
                }}
              />
            </div>
          ))}
        </div>

        {/* ── Dot indicators ────────────────────────────────────────────── */}
        {total > 1 && (
          <Dots
            count={total}
            active={idx}
            onGo={goTo}
            label={t("hero_banner.go_to_slide")}
          />
        )}
      </div>
    </section>
  );
}
