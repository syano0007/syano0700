import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORY GRID  — Static fully-exposed grid (no carousel arrows)
   All 12 categories visible simultaneously across breakpoints.
   Pastel color backing per category for a fresh, energetic look.
───────────────────────────────────────────────────────────────────────────── */

interface CatDef {
  labelKey: string;
  href:     string;
  img:      string;
  alt:      string;
  bg:       string;
}

/*
  12 categories with unique soft pastel backgrounds matching SYANO's branding:
  1 Electronics · 2 Fashion · 3 Phones · 4 Home & Kitchen
  5 Beauty      · 6 Sports  · 7 Computers · 8 Automotive
  9 Kids        · 10 Toys   · 11 Books    · 12 Local Market
*/
const CATS: CatDef[] = [
  {
    labelKey: "home.quick_cat_bar.electronics",
    href:     "/shop?category=Electronics",
    img:      "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Electronics",
    bg:       "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.fashion",
    href:     "/shop?category=Fashion",
    img:      "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Fashion",
    bg:       "bg-pink-50 dark:bg-pink-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.phones",
    href:     "/shop?category=Electronics",
    img:      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Phones",
    bg:       "bg-indigo-50 dark:bg-indigo-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.home",
    href:     "/shop?category=Home+%26+Kitchen",
    img:      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Home & Kitchen",
    bg:       "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.beauty",
    href:     "/shop?category=Beauty+%26+Personal+Care",
    img:      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Beauty",
    bg:       "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.sports",
    href:     "/shop?category=Sports+%26+Fitness",
    img:      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Sports",
    bg:       "bg-green-50 dark:bg-green-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.computers",
    href:     "/shop?category=Electronics",
    img:      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Computers",
    bg:       "bg-slate-50 dark:bg-slate-800/40",
  },
  {
    labelKey: "home.quick_cat_bar.automotive",
    href:     "/shop?category=Automotive",
    img:      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Automotive",
    bg:       "bg-zinc-100 dark:bg-zinc-800/40",
  },
  {
    labelKey: "home.quick_cat_bar.baby",
    href:     "/shop?category=Baby+%26+Kids",
    img:      "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Kids",
    bg:       "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.toys",
    href:     "/shop?category=Toys+%26+Games",
    img:      "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Toys & Games",
    bg:       "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.books",
    href:     "/shop?category=Books",
    img:      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Books",
    bg:       "bg-teal-50 dark:bg-teal-950/30",
  },
  {
    labelKey: "home.quick_cat_bar.local",
    href:     "/shop?category=Local+Market",
    img:      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=240&h=240&fit=crop&auto=format&q=80",
    alt:      "Local Market",
    bg:       "bg-emerald-50 dark:bg-emerald-950/30",
  },
];

export function CategoryCarousel() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="bg-background border-b border-border mt-3 md:mt-4 px-2 md:px-4 py-4 md:py-5"
      style={{ fontFamily: "'Cairo', sans-serif" }}
      aria-label={isRtl ? "الفئات" : "Categories"}
    >
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3 md:gap-4 w-full">
        {CATS.map((cat, i) => (
          <Link
            key={i}
            href={cat.href}
            className="group cursor-pointer"
          >
            <div
              className={[
                "flex flex-col items-center overflow-hidden",
                "w-full",
                "rounded-2xl",
                cat.bg,
                "group-hover:-translate-y-1",
                "group-hover:shadow-md group-hover:shadow-emerald-500/[0.12]",
                "transition-all duration-200 ease-out",
                "p-1",
              ].join(" ")}
            >
              {/* Image block */}
              <div className="w-full aspect-square shrink-0">
                <img
                  src={cat.img}
                  alt={cat.alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </div>

              {/* Label */}
              <div className="w-full flex items-center justify-center px-1 py-1.5">
                <span
                  className={[
                    "text-center font-semibold text-xs md:text-sm leading-tight",
                    "text-neutral-800 dark:text-white/80",
                    "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
                    "transition-colors duration-200",
                    "truncate w-full",
                  ].join(" ")}
                >
                  {t(cat.labelKey)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
