import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/* ─────────────────────────────────────────────────────────────────────────────
   QUICK CATEGORY BAR
   ───────────────────────────────────────────────────────────────────────────
   Sticky:      top-[3.75rem] — sits directly below the 60 px fixed navbar.

   Desktop/Tablet (md+):
     justify-evenly  — items fill the full container width evenly.
     Both LTR (English) and RTL (Arabic) feel identical in quality.

   Mobile (<md):
     justify-start   — items at natural size with gap-5 (20 px) between them.
     overflow-x-auto + -webkit-overflow-scrolling: touch → smooth momentum scroll.
     RTL: first item starts from the right; scrolling direction is natural.
     Min tap target: 48 px height.

   Scrollbar:   hidden across all browsers via .syano-qcb class.
   Hover state: primary color + 2 px underline (space reserved → no shift).
   RTL-safe:    paddingInlineStart / paddingInlineEnd logical properties.
───────────────────────────────────────────────────────────────────────────── */

const CATS = [
  { key: "home.quick_cat_bar.electronics", slug: "Electronics"            },
  { key: "home.quick_cat_bar.fashion",     slug: "Fashion"                },
  { key: "home.quick_cat_bar.phones",      slug: "Electronics"            },
  { key: "home.quick_cat_bar.home",        slug: "Home & Kitchen"         },
  { key: "home.quick_cat_bar.beauty",      slug: "Beauty & Personal Care" },
  { key: "home.quick_cat_bar.sports",      slug: "Sports & Fitness"       },
  { key: "home.quick_cat_bar.watches",     slug: "Accessories"            },
  { key: "home.quick_cat_bar.computers",   slug: "Electronics"            },
  { key: "home.quick_cat_bar.automotive",  slug: "Automotive"             },
  { key: "home.quick_cat_bar.baby",        slug: "Baby & Kids"            },
  { key: "home.quick_cat_bar.toys",        slug: "Toys & Games"           },
  { key: "home.quick_cat_bar.books",       slug: "Books"                  },
  { key: "home.quick_cat_bar.local",       slug: "Local Market"           },
  { key: "home.quick_cat_bar.services",    slug: "Services"               },
] as const;

export function QuickCategoryBar() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("home.quick_cat_bar.aria_label")}
      className="border-b border-border bg-background sticky top-[3.75rem] z-40"
    >
      {/* Scrollbar hidden — all three vendor prefixes */}
      <style>{`
        .syano-qcb::-webkit-scrollbar { display: none; }
        .syano-qcb { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/*
        Outer scroll container
        - overflow-x-auto  →  horizontal scroll when content exceeds width
        - WebkitOverflowScrolling touch  →  iOS momentum scroll
        - 48 px height  →  comfortable touch target (≥ 44 px spec)
      */}
      <div
        className="syano-qcb overflow-x-auto"
        style={{
          height: "48px",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        }}
      >
        {/*
          Inner flex row
          ─────────────────────────────────────────────────────────────────
          Mobile (<md):
            justify-start  →  items at natural width, left/right-aligned,
                              scroll when content > container width.
            gap-5 (20 px)  →  clear visual separation between every category.

          Desktop/Tablet (md+):
            md:justify-evenly  →  items distribute evenly across full width.
            md:gap-0           →  evenly handles all spacing; extra gap unneeded.

          min-w-full guarantees the inner row is never narrower than the
          viewport, so md:justify-evenly has a surface to distribute across.
          ─────────────────────────────────────────────────────────────────
        */}
        <div
          className="flex items-center h-full min-w-full justify-start md:justify-evenly gap-5 md:gap-0"
          style={{
            paddingInlineStart: "max(1rem, calc((100% - 1400px) / 2 + 1rem))",
            paddingInlineEnd:   "max(1rem, calc((100% - 1400px) / 2 + 1rem))",
          }}
        >
          {CATS.map((cat, idx) => (
            <Link
              key={`${cat.slug}-${idx}`}
              href={`/shop?category=${encodeURIComponent(cat.slug)}`}
              className={[
                /* Never let items shrink or wrap */
                "flex items-center h-full whitespace-nowrap shrink-0",
                /*
                  Mobile:  text-[13px]  — slightly smaller for narrow viewports,
                             prevents long words from consuming too much width.
                  Desktop: md:text-base — full 16 px as designed.
                */
                "text-[13px] md:text-base font-medium",
                /* Color */
                "text-muted-foreground",
                /* Hover underline — 2 px reserved so layout never shifts */
                "border-b-2 border-transparent",
                "hover:text-primary hover:border-primary",
                "transition-colors duration-150",
              ].join(" ")}
            >
              {t(cat.key)}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
