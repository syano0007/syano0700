import { useRef, useState, useCallback, useEffect } from "react";

const SLIDES = [
  {
    img: "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop",
    titleAr: "اكتشف آلاف المنتجات",
    subtitleAr: "خصومات حصرية",
    descriptionAr: "منتجات متنوعة من أفضل المتاجر السورية في مكان واحد.",
    ctaAr: "تسوق الآن",
    cta2Ar: "استكشف المتاجر",
    badge: "خصم ٨٠٪",
  },
  {
    img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop",
    titleAr: "أزياء راقية بأسعار مناسبة",
    subtitleAr: "موضة السيزن",
    descriptionAr: "أحدث صيحات الموضة من أبرز المصمّمين السوريين.",
    ctaAr: "تسوق الآن",
    cta2Ar: "عروض الموسم",
    badge: "خصم ٣٥٪",
  },
  {
    img: "https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop",
    titleAr: "ديكور منزلي فاخر",
    subtitleAr: "جمال المنزل",
    descriptionAr: "اصنع بيئة منزلية رائعة مع أفضل منتجات الديكور.",
    ctaAr: "اكتشف الآن",
    cta2Ar: "عروض الديكور",
    badge: "ديكور راقي",
  },
  {
    img: "https://images.pexels.com/photos/3059609/pexels-photo-3059609.jpeg?auto=compress&cs=tinysrgb&w=1280&h=800&fit=crop",
    titleAr: "عطور حصرية فاخرة",
    subtitleAr: "عطور العالم",
    descriptionAr: "أفخر العطور العالمية والمحلية بأسعار تنافسية.",
    ctaAr: "تسوق العطور",
    cta2Ar: "العروض الخاصة",
    badge: "عطور حصرية",
  },
];

const FLOAT_PRODUCTS = [
  { name: "حذاء رياضي فاخر", price: "12,500", stars: 5, img: "https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop" },
  { name: "ساعة كلاسيكية", price: "85,000", img: "https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop" },
  { name: "عطر فاخر", price: "45,000", avail: "● متوفر الآن", img: "https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop" },
];

const CARD_STYLES: React.CSSProperties[] = [
  { top: 28, left: 24, width: 196 },
  { top: 190, left: 14, width: 170 },
  { bottom: 48, left: 28, width: 204 },
];

const AUTO_MS = 6000;

function FloatCard({ product, style, floatOffset }: {
  product: typeof FLOAT_PRODUCTS[number];
  style: React.CSSProperties;
  floatOffset: number;
}) {
  const [y, setY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setY(Math.sin(Date.now() / 1000 + floatOffset) * 8);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [floatOffset]);

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 15,
        background: "rgba(6,6,6,0.92)",
        backdropFilter: "blur(28px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 15,
        padding: "11px 14px",
        display: "flex",
        gap: 11,
        alignItems: "center",
        boxShadow: "0 18px 52px rgba(0,0,0,0.80), 0 4px 16px rgba(0,0,0,0.55)",
        direction: "rtl",
        pointerEvents: "none",
        transform: `translateY(${y}px)`,
        transition: "transform 0.1s linear",
        ...style,
      }}
    >
      <div style={{ flex: 1, textAlign: "right", minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: "#5a626e", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {product.name}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#f3f3f3", marginBottom: 3, whiteSpace: "nowrap" }}>
          {product.price} <span style={{ color: "#276221", fontSize: 10, fontWeight: 500 }}>ل.س</span>
        </div>
        {"stars" in product && product.stars && (
          <div style={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
            {Array.from({ length: product.stars }).map((_, i) => (
              <span key={i} style={{ fontSize: 9.5, color: "#f59e0b" }}>★</span>
            ))}
          </div>
        )}
        {"avail" in product && product.avail && (
          <div style={{ fontSize: 9.5, color: "#276221", justifyContent: "flex-end", display: "flex" }}>
            {product.avail}
          </div>
        )}
      </div>
      <img src={product.img} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    </div>
  );
}

export function Desktop() {
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = SLIDES.length;

  const goTo = useCallback((n: number) => setIdx(((n % total) + total) % total), [total]);
  const goNext = useCallback(() => goTo(idx + 1), [idx, goTo]);
  const goPrev = useCallback(() => goTo(idx - 1), [idx, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx(i => (i + 1) % total), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, total]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null || !dragging) return;
    const diff = dragStart.current - e.clientX;
    if (Math.abs(diff) > 44) diff > 0 ? goPrev() : goNext();
    dragStart.current = null;
    setDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 44) diff > 0 ? goPrev() : goNext();
    dragStart.current = null;
  };

  const slide = SLIDES[idx]!;

  return (
    <div
      style={{ minHeight: "100vh", background: "#f0f0f0", padding: "0", fontFamily: "system-ui, sans-serif" }}
    >
      {/* Simulated Navbar (60px, fixed-position equivalent in the prototype) */}
      <div style={{
        width: "100%", height: 60, background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", paddingInline: 24,
        justifyContent: "space-between", boxSizing: "border-box",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#276221", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14 }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>SYANO</span>
        </div>
        <div style={{ flex: 1, maxWidth: 480, margin: "0 24px" }}>
          <div style={{ height: 36, background: "#f5f5f5", borderRadius: 10, border: "1px solid #e5e7eb", display: "flex", alignItems: "center", paddingInline: 12, gap: 8 }}>
            <svg width="14" height="14" fill="none" stroke="#9ca3af" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>ابحث عن منتجات، متاجر...</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" fill="none" stroke="#374151" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-10 2a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#276221", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>

      {/* Hero container — matches max-w-7xl with px-6 pt-4 */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 0" }}>
        {/* ── HERO BANNER (proposed: 380px height, no arrows, drag-swipe) ── */}
        <section
          ref={containerRef}
          style={{ position: "relative", width: "100%", cursor: dragging ? "grabbing" : "grab" }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => { setPaused(false); setDragging(false); }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragStart.current = null; setDragging(false); }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 16,
              /* ── KEY CHANGE: 380px desktop height (was 580px) ── */
              height: 380,
              background: "#0a150a",
              userSelect: "none",
            }}
          >
            {/* Background image */}
            <img
              key={`bg-${idx}`}
              src={slide.img}
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                animation: "fadeIn 0.7s ease-out",
              }}
            />
            {/* Gradient overlays */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.20) 100%)", pointerEvents: "none" }} />
            {/* RTL: text on RIGHT → darken right side */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(0,0,0,0.68) 0%, transparent 55%)", pointerEvents: "none" }} />

            {/* Floating product cards — left side (opposite of text) */}
            <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }}>
              {FLOAT_PRODUCTS.map((p, i) => (
                <FloatCard key={i} product={p} style={CARD_STYLES[i]!} floatOffset={i * 2} />
              ))}
              {/* Discount badge */}
              <div style={{
                position: "absolute", top: 108, left: 238, zIndex: 20,
                background: "#276221", color: "#fff", fontSize: 12.5, fontWeight: 800,
                padding: "5px 14px", borderRadius: 100,
                boxShadow: "0 4px 20px rgba(39,98,33,0.55)",
              }}>{slide.badge}</div>
            </div>

            {/* Content block — RIGHT side (RTL) */}
            <div
              key={`txt-${idx}`}
              style={{
                position: "absolute", inset: 0, zIndex: 20,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                animation: "fadeIn 0.5s ease-out",
              }}
            >
              <div style={{
                display: "flex", flexDirection: "column", gap: 14,
                alignItems: "flex-end", textAlign: "right",
                paddingInlineEnd: 56, maxWidth: "min(52%, 520px)",
              }}>
                {/* Badge/eyebrow */}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 14px", borderRadius: 100,
                  border: "1px solid rgba(39,98,33,0.40)", color: "#4ade80",
                  fontSize: 11, fontWeight: 700, background: "rgba(39,98,33,0.12)",
                  whiteSpace: "nowrap",
                }}>✦ {slide.subtitleAr}</span>

                {/* Title */}
                <h1 style={{
                  margin: 0, color: "#ffffff", fontWeight: 900,
                  lineHeight: 1.05, letterSpacing: "-0.02em",
                  fontSize: "clamp(1.5rem, 3.5vw, 2.75rem)",
                }}>{slide.titleAr}</h1>

                {/* Description */}
                <p style={{
                  margin: 0, color: "rgba(255,255,255,0.72)",
                  fontSize: "clamp(0.78rem, 1.5vw, 0.92rem)", lineHeight: 1.7,
                  maxWidth: 440,
                }}>{slide.descriptionAr}</p>

                {/* CTA buttons */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <a href="#" style={{
                    background: "#276221", color: "#fff",
                    padding: "11px 26px", borderRadius: 9, fontWeight: 800,
                    fontSize: "0.875rem", textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    boxShadow: "0 4px 24px rgba(39,98,33,0.45)",
                  }}>
                    {slide.ctaAr}
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </a>
                  <a href="#" style={{
                    background: "rgba(255,255,255,0.10)", color: "#fff",
                    padding: "11px 26px", borderRadius: 9, fontWeight: 600,
                    fontSize: "0.875rem", textDecoration: "none",
                    border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
                  }}>{slide.cta2Ar}</a>
                </div>
              </div>
            </div>

            {/* ── NO ARROWS (removed per spec) ── */}

            {/* ── Drag hint label — shows on first hover ── */}
            <div style={{
              position: "absolute", top: 12, right: 12, zIndex: 25,
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
              borderRadius: 100, padding: "4px 10px",
              color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 5, pointerEvents: "none",
              border: "1px solid rgba(255,255,255,0.10)",
            }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              اسحب للتنقل
            </div>

            {/* ── Dot indicators (kept, centered bottom) ── */}
            <div style={{
              position: "absolute", bottom: 14, left: 0, right: 0,
              zIndex: 30, display: "flex", justifyContent: "center", gap: 8,
            }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  onPointerDown={e => e.stopPropagation()}
                  style={{
                    border: "none", cursor: "pointer", padding: 0, borderRadius: 100,
                    transition: "all 0.3s",
                    background: i === idx ? "#fff" : "rgba(255,255,255,0.30)",
                    width: i === idx ? 28 : 6, height: 6,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stats bar (retained) */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { n: "12,000+", label: "عميل راضٍ" },
              { n: "25,000+", label: "منتج نشط" },
              { n: "500+",    label: "متجر موثوق" },
            ].map(s => (
              <div key={s.n} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "8px 4px", borderRadius: 12,
                background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
              }}>
                <span style={{ fontWeight: 900, color: "#111827", fontSize: "clamp(0.9rem, 2vw, 1.15rem)" }}>{s.n}</span>
                <span style={{ color: "#6b7280", fontSize: "0.68rem" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Annotation callouts */}
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[
            { color: "#276221", label: "✓ ارتفاع مخفض", detail: "380px بدلاً من 580px" },
            { color: "#2563eb", label: "✓ بدون أسهم", detail: "الزر يشتت الانتباه — حُذف" },
            { color: "#7c3aed", label: "✓ سحب بالماوس", detail: "pointer drag + touch swipe" },
            { color: "#d97706", label: "✓ نص عربي يمين", detail: "RTL: النص على اليمين دائماً" },
            { color: "#dc2626", label: "✓ لا تداخل navbar", detail: "pt-4 فوق البانر" },
          ].map(a => (
            <div key={a.label} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: `2px solid ${a.color}`,
              borderRadius: 10, padding: "6px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <span style={{ color: a.color, fontWeight: 700, fontSize: 12 }}>{a.label}</span>
              <span style={{ color: "#6b7280", fontSize: 11 }}>{a.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
