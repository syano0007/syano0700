import { useTranslation } from "react-i18next";
import { Link } from "wouter";

// ── Reference image — copied from attached asset, served from public/ ──────
// One image, cropped differently per card via objectPosition.
// Featured card  → shows kitchen area (left 72% of image, rows 16-86%)
// Electronics    → shows top-right card area (x≈73-94%, y≈16-51%)
// Fashion        → shows bottom-right card area (x≈73-94%, y≈54-86%)
const REF_IMG = "/hero-ref.png";
const HERO_IMG = REF_IMG;
const ELECTRONICS_IMG = REF_IMG;
const FASHION_IMG = REF_IMG;

// ── Glass ─────────────────────────────────────────────────────────────────
const GLASS = {
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
} as const;

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M7.5 2.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomeHeroV2() {
  const { t } = useTranslation();

  return (
    /*
     * direction:ltr on the grid wrapper pins featured card visually LEFT and
     * category stack visually RIGHT regardless of page-level dir="rtl".
     * Section is full-bleed medium forest green, cards embedded in atmosphere.
     */
    <section
      aria-label={t("hero.v2.sectionLabel", "Hero section")}
      style={{
        position: "relative",
        overflow: "hidden",
        /* Fix #6 — lighter, more vibrant medium forest green */
        background:
          "linear-gradient(175deg, #4a7a48 0%, #3d6b3a 40%, #325930 100%)",
      }}
    >

      {/* ══════════════════════════════════════════════════════════
          SECTION ATMOSPHERE
      ══════════════════════════════════════════════════════════ */}

      {/* Fix #12 — full-width wavy lines, slightly more visible */}
      <span aria-hidden="true" style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: "130px", opacity: 0.16, pointerEvents: "none",
      }}>
        <svg
          viewBox="0 0 1440 130"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%" }}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 45 Q180 5 360 45 Q540 85 720 45 Q900 5 1080 45 Q1260 85 1440 45"
            stroke="white" strokeWidth="1.6" />
          <path d="M0 62 Q180 22 360 62 Q540 102 720 62 Q900 22 1080 62 Q1260 102 1440 62"
            stroke="white" strokeWidth="1.1" />
          <path d="M0 79 Q180 39 360 79 Q540 109 720 79 Q900 39 1080 79 Q1260 109 1440 79"
            stroke="white" strokeWidth="0.8" />
          <path d="M0 28 Q180 4 360 28 Q540 70 720 28 Q900 4 1080 28 Q1260 70 1440 28"
            stroke="white" strokeWidth="0.5" />
        </svg>
      </span>

      {/* Fix #10 — left glow orb (matches the luminous dot in reference left area) */}
      <span aria-hidden="true" style={{
        position: "absolute", top: "35%", left: "3%",
        width: "280px", height: "280px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(140,220,100,0.18) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <span aria-hidden="true" style={{
        position: "absolute",
        top: "calc(35% + 135px)", left: "calc(3% + 135px)",
        width: "9px", height: "9px", borderRadius: "50%",
        backgroundColor: "#8FD060",
        boxShadow: "0 0 14px 5px rgba(143,208,96,0.55)",
        pointerEvents: "none",
      }} />

      {/* Fix #11 — large naturalistic leaf silhouettes, right side of section */}
      <span aria-hidden="true" style={{
        position: "absolute", top: "-10px", right: "-10px",
        width: "260px", height: "560px",
        opacity: 0.22, pointerEvents: "none",
      }}>
        <svg viewBox="0 0 260 560" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Tall primary stem + blade */}
          <path d="M200 0 Q240 100 220 200 Q200 300 180 400 Q160 500 170 560"
            stroke="#5a9050" strokeWidth="3" fill="none" />
          {/* Right large leaf blade */}
          <path d="M220 80 C250 60 270 140 240 180 C210 220 180 210 180 240
                   C180 270 200 300 190 340 L170 560 L170 400 C160 360 150 300
                   170 260 C190 220 220 220 220 180 C220 140 200 100 220 80Z"
            fill="#3e6e34" />
          {/* Secondary leaf left */}
          <path d="M180 100 C140 80 100 140 110 200 C120 260 160 280 170 320
                   C180 360 170 400 170 400"
            fill="#4a7840" />
          {/* Small accent leaves */}
          <path d="M210 200 C240 180 255 230 235 260 C215 290 190 280 190 260
                   C190 240 200 220 210 200Z"
            fill="#3e6e34" />
          {/* Vein lines */}
          <path d="M200 0 Q210 80 190 160 Q175 240 170 340 Q165 440 170 560"
            stroke="#4a8040" strokeWidth="1.5" fill="none" />
          <path d="M220 80 Q195 120 185 160" stroke="#5a9050" strokeWidth="1" fill="none"/>
          <path d="M200 150 Q175 190 168 230" stroke="#5a9050" strokeWidth="1" fill="none"/>
        </svg>
      </span>

      {/* Additional leaves at top-right edge */}
      <span aria-hidden="true" style={{
        position: "absolute", top: "0", right: "80px",
        width: "160px", height: "220px",
        opacity: 0.18, pointerEvents: "none",
      }}>
        <svg viewBox="0 0 160 220" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M120 0 C150 30 160 80 140 120 C120 160 80 170 70 210"
            fill="#4a7840" />
          <path d="M120 0 C100 20 90 70 90 110 C90 150 70 180 65 210"
            stroke="#5a9050" strokeWidth="1.5" fill="none" />
          <path d="M80 40 C110 30 130 80 120 120 C110 160 85 175 70 210"
            fill="#3e6e34" opacity="0.7"/>
        </svg>
      </span>

      {/* ══════════════════════════════════════════════════════════
          GRID
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{ direction: "ltr", position: "relative", zIndex: 1 }}
        className="w-full max-w-[1280px] mx-auto px-6 max-lg:px-4 pt-14 pb-10"
      >
        {/* Fix #8 — 3fr 1fr → closer to 73/27 split */}
        <div className="grid gap-4 grid-cols-[3fr_1fr] max-lg:grid-cols-1">

          {/* ════════════════════════════════════════════════════
              FEATURED CARD
          ════════════════════════════════════════════════════ */}
          <article
            aria-label={t("hero.v2.featuredCard.label", "Featured marketplace experience")}
            style={{
              position: "relative",
              height: "420px",
              borderRadius: "18px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow:
                "0 20px 56px rgba(0,0,0,0.40), 0 4px 14px rgba(0,0,0,0.22)," +
                "inset 0 1px 0 rgba(255,255,255,0.08)",
              backgroundColor: "#1e3320",
            }}
          >
            {/* Layer 1 — Fix #1 — dark premium kitchen image */}
            <img
              src={HERO_IMG}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
                /* Crop to the kitchen card area of the reference image:
                   kitchen card spans x=107-737(~41% center), y=93-497(~51% center) of 1024×576 */
                objectPosition: "41% 51%",
                pointerEvents: "none",
              }}
            />

            {/* Layer 2 — Minimal scrim: just enough at bottom for text legibility */}
            <div aria-hidden="true" style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(to bottom," +
                "rgba(0,0,0,0.00) 0%," +
                "rgba(0,0,0,0.08) 55%," +
                "rgba(0,0,0,0.42) 100%)",
              pointerEvents: "none",
            }} />

            {/* Layer 3 — fix subtle top-right green glow */}
            <span aria-hidden="true" style={{
              position: "absolute", top: "-50px", right: "-50px",
              width: "300px", height: "300px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(60,100,58,0.10) 0%, transparent 60%)",
              pointerEvents: "none",
            }} />

            {/* ────────────────────────────────────────────────
                Fix #4 — Title block (upper-right, ~25% from top)
            ──────────────────────────────────────────────── */}
            <div style={{
              position: "absolute",
              top: "110px",   /* was 36px — moved down to ~25% from top */
              right: "44px",
              textAlign: "right",
              maxWidth: "320px",
              display: "flex", flexDirection: "column", gap: "6px",
            }}>
              {/* Fix #4 — Arabic title: larger, similar scale to English */}
              <h1 style={{
                fontSize: "clamp(1.5rem, 2.4vw, 2.0rem)",
                fontWeight: 700,
                color: "rgba(255,255,255,0.97)",
                lineHeight: 1.2, margin: 0,
                textShadow: "0 2px 20px rgba(0,0,0,0.50)",
              }}>
                {t("hero.v2.featuredCard.arabicTitle", "منحدولة العريض المخدتية")}
              </h1>
              {/* English — slightly smaller, also prominent */}
              <p style={{
                fontSize: "clamp(1.0rem, 1.7vw, 1.35rem)",
                fontWeight: 600,
                color: "rgba(255,255,255,0.90)",
                margin: 0, lineHeight: 1.25,
                textShadow: "0 1px 14px rgba(0,0,0,0.40)",
              }}>
                {t("hero.v2.featuredCard.title", "The Modern Gourmet Kitchen")}
              </p>
            </div>

            {/* ────────────────────────────────────────────────
                Fix #5 — Floating glass module
                Position: ~38% from top, left:130px (center of left half)
            ──────────────────────────────────────────────── */}
            <div style={{
              position: "absolute",
              top: "38%",
              left: "120px",   /* was 36px — moved right to center of left third */
              transform: "translateY(-50%)",
              display: "flex", flexDirection: "column", gap: "10px",
            }}>
              {/* Status pill */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "9px 20px",
                borderRadius: "9999px",
                minWidth: "220px",
                ...GLASS,
              }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  backgroundColor: "#6FCF97",
                  boxShadow: "0 0 6px rgba(111,207,151,0.7)",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: "12.5px", fontWeight: 500,
                  color: "rgba(255,255,255,0.92)",
                  whiteSpace: "nowrap",
                  direction: "rtl",
                }}>
                  {t("hero.v2.badge.status", "نحون معلقة السلسة الإنجابية")}
                </span>
              </div>

              {/* Two action pills — wider primary + small arrow circle */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  padding: "8px 20px",
                  borderRadius: "9999px",
                  ...GLASS,
                }}>
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    backgroundColor: "#6FCF97", flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: "13px", fontWeight: 600,
                    color: "rgba(255,255,255,0.95)",
                    direction: "rtl",
                  }}>
                    {t("hero.v2.badge.action", "الجبين")}
                  </span>
                </div>
                {/* Arrow circle */}
                <div style={{
                  width: "34px", height: "34px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  ...GLASS,
                  color: "rgba(255,255,255,0.85)",
                }}>
                  <ChevronLeft />
                </div>
              </div>
            </div>

            {/* ────────────────────────────────────────────────
                Bottom-left caption (arrow circle + Arabic + English)
            ──────────────────────────────────────────────── */}
            <div style={{
              position: "absolute", bottom: "28px", left: "28px",
              display: "flex", alignItems: "center", gap: "14px",
            }}>
              <Link
                href="/products"
                aria-label={t("hero.v2.featuredCard.ctaAriaLabel", "Browse kitchen collection")}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  ...GLASS,
                  color: "rgba(255,255,255,0.80)",
                  textDecoration: "none",
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.24)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "rgba(255,255,255,0.14)";
                }}
              >
                <ChevronRight />
              </Link>
              <div style={{ direction: "rtl" }}>
                <p style={{
                  fontSize: "11.5px", fontWeight: 600,
                  color: "rgba(255,255,255,0.72)",
                  margin: 0, lineHeight: 1.35,
                }}>
                  {t("hero.v2.featuredCard.captionAr", "التقديمرات المعنتيقي")}
                </p>
                <p style={{
                  fontSize: "10.5px", fontWeight: 400,
                  color: "rgba(255,255,255,0.45)",
                  margin: 0, lineHeight: 1.35, direction: "ltr",
                }}>
                  {t("hero.v2.featuredCard.captionEn", "The Modern Gourmet Kitchen")}
                </p>
              </div>
            </div>
          </article>

          {/* ════════════════════════════════════════════════════
              RIGHT COLUMN
          ════════════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Fix #3, #15 — Electronics Card ── */}
            <article
              aria-label={t("hero.v2.cardA.label", "Electronics category")}
              style={{
                position: "relative",
                height: "202px",
                borderRadius: "18px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)",
                /* Pixel-precise crop: x=750-968, y=93-296 of 1024×576 ref image @ scale 1.339 */
                backgroundImage: `url(${ELECTRONICS_IMG})`,
                backgroundSize: "1371px 771px",
                backgroundPosition: "-1004px -125px",
                backgroundRepeat: "no-repeat",
                backgroundColor: "#2a3a28",
              }}
            >

              {/* Scrim — strong top to erase baked-in reference text chrome */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 0,
                background:
                  "linear-gradient(180deg," +
                  "rgba(15,34,18,0.82) 0%," +
                  "rgba(10,24,12,0.12) 42%," +
                  "rgba(0,0,0,0.82) 100%)",
                pointerEvents: "none",
              }} />

              {/* Arabic + description — top-RIGHT */}
              <div style={{
                position: "absolute", top: "16px", right: "18px",
                textAlign: "right",
                direction: "rtl",
              }}>
                <p style={{
                  fontSize: "12px", fontWeight: 700,
                  color: "rgba(255,255,255,0.92)",
                  margin: "0 0 1px", lineHeight: 1.2,
                }}>
                  {t("hero.v2.cardA.arabicTitle", "التوميعات النمر")}
                </p>
                <p style={{
                  fontSize: "9.5px", fontWeight: 400,
                  color: "rgba(255,255,255,0.55)",
                  margin: 0, direction: "ltr",
                }}>
                  {t("hero.v2.cardA.micro", "High-end audio & smart term")}
                </p>
              </div>

              {/* Main title — bottom-LEFT */}
              <div style={{
                position: "absolute", bottom: "16px", left: "18px",
              }}>
                <h2 style={{
                  fontSize: "1.15rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.97)",
                  margin: "0 0 2px",
                  letterSpacing: "-0.015em",
                  textShadow: "0 1px 10px rgba(0,0,0,0.5)",
                }}>
                  {t("hero.v2.cardA.title", "Precision Electronics")}
                </h2>
                <p style={{
                  fontSize: "10.5px", fontWeight: 400,
                  color: "rgba(255,255,255,0.52)",
                  margin: 0,
                }}>
                  {t("hero.v2.cardA.hint", "Smartphones")}
                </p>
              </div>
            </article>

            {/* ── Fix #2 — Fashion Card ── */}
            <article
              aria-label={t("hero.v2.cardB.label", "Fashion category")}
              style={{
                position: "relative",
                height: "202px",
                borderRadius: "18px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)",
                /* Pixel-precise crop: x=750-968, y=312-497 of 1024×576 ref image @ scale 1.339 */
                backgroundImage: `url(${FASHION_IMG})`,
                backgroundSize: "1371px 771px",
                backgroundPosition: "-1004px -418px",
                backgroundRepeat: "no-repeat",
                backgroundColor: "#1e2e1e",
              }}
            >

              {/* Scrim — strong top to erase baked-in reference text chrome */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 0,
                background:
                  "linear-gradient(180deg," +
                  "rgba(15,34,18,0.82) 0%," +
                  "rgba(10,24,12,0.12) 42%," +
                  "rgba(0,0,0,0.82) 100%)",
                pointerEvents: "none",
              }} />

              {/* Title + description — top-left */}
              <div style={{
                position: "absolute", top: "16px", left: "18px",
              }}>
                <h2 style={{
                  fontSize: "1.15rem", fontWeight: 700,
                  color: "rgba(255,255,255,0.97)",
                  margin: "0 0 2px",
                  letterSpacing: "-0.015em",
                  textShadow: "0 1px 10px rgba(0,0,0,0.5)",
                }}>
                  {t("hero.v2.cardB.title", "Curated Style")}
                </h2>
                <p style={{
                  fontSize: "10px", fontWeight: 400,
                  color: "rgba(255,255,255,0.58)",
                  margin: 0,
                }}>
                  {t("hero.v2.cardB.micro", "Men's and Women's apparel")}
                </p>
              </div>

              {/* Split bottom sub-categories — "Footwear" | "Women's Wear" */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                display: "flex",
              }}>
                <div style={{
                  flex: 1, padding: "9px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                  borderRight: "1px solid rgba(255,255,255,0.09)",
                }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600,
                    color: "rgba(255,255,255,0.78)",
                  }}>
                    {t("hero.v2.cardB.sub1", "Footwear")}
                  </span>
                </div>
                <div style={{
                  flex: 1, padding: "9px 16px",
                  borderTop: "1px solid rgba(255,255,255,0.12)",
                }}>
                  <span style={{
                    fontSize: "11px", fontWeight: 600,
                    color: "rgba(255,255,255,0.78)",
                  }}>
                    {t("hero.v2.cardB.sub2", "Women's Wear")}
                  </span>
                </div>
              </div>
            </article>

          </div>
        </div>
      </div>
    </section>
  );
}
