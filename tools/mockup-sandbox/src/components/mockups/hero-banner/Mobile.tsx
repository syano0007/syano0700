import { useRef, useState, useCallback, useEffect } from "react";

const SLIDES = [
  {
    img: "https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=640&h=400&fit=crop",
    titleAr: "اكتشف آلاف المنتجات",
    subtitleAr: "خصومات حصرية",
    ctaAr: "تسوق الآن",
    badge: "خصم ٨٠٪",
  },
  {
    img: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=640&h=400&fit=crop",
    titleAr: "أزياء راقية بأسعار مناسبة",
    subtitleAr: "موضة السيزن",
    ctaAr: "تسوق الآن",
    badge: "خصم ٣٥٪",
  },
  {
    img: "https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg?auto=compress&cs=tinysrgb&w=640&h=400&fit=crop",
    titleAr: "ديكور منزلي فاخر",
    subtitleAr: "جمال المنزل",
    ctaAr: "اكتشف الآن",
    badge: "ديكور راقي",
  },
];

const AUTO_MS = 6000;

export function Mobile() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<number | null>(null);
  const total = SLIDES.length;

  const goTo = useCallback((n: number) => setIdx(((n % total) + total) % total), [total]);
  const goNext = useCallback(() => goTo(idx + 1), [idx, goTo]);
  const goPrev = useCallback(() => goTo(idx - 1), [idx, goTo]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx(i => (i + 1) % total), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, total]);

  const onTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? goPrev() : goNext();
    dragStart.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.clientX;
    if (Math.abs(diff) > 40) diff > 0 ? goPrev() : goNext();
    dragStart.current = null;
  };

  const slide = SLIDES[idx]!;

  return (
    <div style={{
      minHeight: "100vh", background: "#f0f0f0",
      fontFamily: "system-ui, sans-serif",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      padding: "20px 0",
    }}>
      {/* Phone frame */}
      <div style={{
        width: 390, background: "#fff",
        borderRadius: 40, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)",
      }}>
        {/* Status bar */}
        <div style={{ height: 44, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="#111"><rect x="0" y="3" width="3" height="9" rx="1"/><rect x="4.5" y="2" width="3" height="10" rx="1"/><rect x="9" y="0" width="3" height="12" rx="1"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="#111" opacity="0.3"/></svg>
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M10.71 17l.29.29.29-.29a1 1 0 0 0-1.42-.01z"/></svg>
            <div style={{ width: 25, height: 12, borderRadius: 3, border: "1.5px solid #111", display: "flex", padding: 1.5, gap: 1, alignItems: "center" }}>
              <div style={{ flex: 0.8, height: "100%", background: "#111", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>

        {/* Mobile Navbar */}
        <div style={{
          height: 52, background: "#fff", display: "flex", alignItems: "center",
          padding: "0 16px", gap: 10, borderBottom: "1px solid #f0f0f0",
        }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#276221", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>S</div>
          <div style={{ flex: 1, height: 32, background: "#f5f5f5", borderRadius: 8, border: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 10px", gap: 6 }}>
            <svg width="12" height="12" fill="none" stroke="#9ca3af" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>ابحث...</span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="#374151" viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-10 2a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>

        {/* Hero container */}
        <div style={{ padding: "10px 10px 0" }}>
          <section
            style={{ position: "relative", cursor: "grab" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <div style={{
              position: "relative", overflow: "hidden", borderRadius: 14,
              /* ── KEY CHANGE: 310px mobile height (was 420px) ── */
              height: 310,
              background: "#0a150a",
              userSelect: "none",
            }}>
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
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }} />

              {/* Content — centered bottom on mobile */}
              <div
                key={`txt-${idx}`}
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
                  padding: "0 16px 44px",
                  display: "flex", flexDirection: "column",
                  alignItems: "flex-end", textAlign: "right",
                  animation: "fadeIn 0.5s ease-out",
                }}
              >
                <span style={{
                  marginBottom: 8,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 100,
                  border: "1px solid rgba(39,98,33,0.40)", color: "#4ade80",
                  fontSize: 10, fontWeight: 700, background: "rgba(39,98,33,0.12)",
                }}>✦ {slide.subtitleAr}</span>
                <h1 style={{
                  margin: "0 0 8px", color: "#fff", fontWeight: 900,
                  fontSize: 22, lineHeight: 1.15,
                }}>{slide.titleAr}</h1>
                <a href="#" style={{
                  background: "#276221", color: "#fff",
                  padding: "9px 20px", borderRadius: 8, fontWeight: 800,
                  fontSize: 13, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>{slide.ctaAr}</a>
              </div>

              {/* Badge */}
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 25,
                background: "#276221", color: "#fff", fontSize: 11, fontWeight: 800,
                padding: "4px 10px", borderRadius: 100,
              }}>{slide.badge}</div>

              {/* ── NO ARROWS (removed) ── */}

              {/* Dots */}
              <div style={{
                position: "absolute", bottom: 12, left: 0, right: 0,
                display: "flex", justifyContent: "center", gap: 6, zIndex: 30,
              }}>
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); goTo(i); }}
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                      border: "none", cursor: "pointer", padding: 0, borderRadius: 100,
                      transition: "all 0.3s",
                      background: i === idx ? "#fff" : "rgba(255,255,255,0.35)",
                      width: i === idx ? 22 : 5, height: 5,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mobile stats */}
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[
                { n: "12K+", label: "عميل راضٍ" },
                { n: "25K+", label: "منتج نشط" },
                { n: "500+", label: "متجر موثوق" },
              ].map(s => (
                <div key={s.n} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "7px 4px", borderRadius: 10,
                  background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)",
                }}>
                  <span style={{ fontWeight: 900, color: "#111827", fontSize: 13 }}>{s.n}</span>
                  <span style={{ color: "#6b7280", fontSize: 9 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Annotation */}
          <div style={{ marginTop: 12, marginBottom: 12, padding: "10px 12px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 4 }}>✓ Mobile Refinements</div>
            <div style={{ fontSize: 10, color: "#15803d", lineHeight: 1.6 }}>
              310px height (was 420px) · بدون أسهم · touch + pointer drag · dots only · gradient overlay improved
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
