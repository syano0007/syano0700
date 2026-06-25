import { Link } from "wouter";
import { useTranslation } from "react-i18next";

/* ─────────────────────────────────────────────────────────────────────────────
   AMAZON-STYLE MULTI-ITEM GRID CARDS
   4 white box cards, each hosting a strict 2×2 sub-grid of category tiles.
   Overlaps the bottom edge of the hero banner via -mt-16 + z-10.
   No carousels, no arrows — all items fully exposed at once.
───────────────────────────────────────────────────────────────────────────── */

interface SubItem {
  labelAr: string;
  labelEn: string;
  href:    string;
  img:     string;
}

interface CardDef {
  titleAr:  string;
  titleEn:  string;
  ctaAr:    string;
  ctaEn:    string;
  ctaHref:  string;
  items:    [SubItem, SubItem, SubItem, SubItem];
}

const CARDS: CardDef[] = [
  {
    titleAr: "أحدث الإلكترونيات والتقنية",
    titleEn: "Latest Electronics & Tech",
    ctaAr:   "شاهد جميع المنتجات",
    ctaEn:   "See all products",
    ctaHref: "/shop?category=Electronics",
    items: [
      {
        labelAr: "هواتف ذكية",
        labelEn: "Smartphones",
        href: "/shop?category=Electronics",
        img: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "لابتوبات",
        labelEn: "Laptops",
        href: "/shop?category=Electronics",
        img: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "سماعات",
        labelEn: "Headphones",
        href: "/shop?category=Electronics",
        img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "إكسسوارات",
        labelEn: "Accessories",
        href: "/shop?category=Electronics",
        img: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300&h=300&fit=crop&auto=format&q=80",
      },
    ],
  },
  {
    titleAr: "أزياء وملابس",
    titleEn: "Fashion & Apparel",
    ctaAr:   "تسوق الآن",
    ctaEn:   "Shop now",
    ctaHref: "/shop?category=Fashion",
    items: [
      {
        labelAr: "ملابس رجالية",
        labelEn: "Men's Wear",
        href: "/shop?category=Fashion",
        img: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "ملابس نسائية",
        labelEn: "Women's Wear",
        href: "/shop?category=Fashion",
        img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "أحذية",
        labelEn: "Footwear",
        href: "/shop?category=Fashion",
        img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "حقائب",
        labelEn: "Bags",
        href: "/shop?category=Fashion",
        img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=300&fit=crop&auto=format&q=80",
      },
    ],
  },
  {
    titleAr: "المنزل والمطبخ",
    titleEn: "Home & Kitchen",
    ctaAr:   "شاهد جميع العروض",
    ctaEn:   "See all offers",
    ctaHref: "/shop?category=Home+%26+Kitchen",
    items: [
      {
        labelAr: "أثاث",
        labelEn: "Furniture",
        href: "/shop?category=Home+%26+Kitchen",
        img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "مطبخ",
        labelEn: "Kitchen",
        href: "/shop?category=Home+%26+Kitchen",
        img: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "إضاءة",
        labelEn: "Lighting",
        href: "/shop?category=Home+%26+Kitchen",
        img: "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "ديكور",
        labelEn: "Décor",
        href: "/shop?category=Home+%26+Kitchen",
        img: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300&h=300&fit=crop&auto=format&q=80",
      },
    ],
  },
  {
    titleAr: "جمال ورياضة وأطفال",
    titleEn: "Beauty, Sports & Kids",
    ctaAr:   "تسوق الآن",
    ctaEn:   "Shop now",
    ctaHref: "/shop?category=Beauty+%26+Personal+Care",
    items: [
      {
        labelAr: "عناية بالبشرة",
        labelEn: "Skincare",
        href: "/shop?category=Beauty+%26+Personal+Care",
        img: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "رياضة ولياقة",
        labelEn: "Sports",
        href: "/shop?category=Sports+%26+Fitness",
        img: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "عالم الأطفال",
        labelEn: "Kids",
        href: "/shop?category=Baby+%26+Kids",
        img: "https://images.unsplash.com/photo-1566140967404-b8b3932483f5?w=300&h=300&fit=crop&auto=format&q=80",
      },
      {
        labelAr: "ألعاب",
        labelEn: "Toys",
        href: "/shop?category=Toys+%26+Games",
        img: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=300&h=300&fit=crop&auto=format&q=80",
      },
    ],
  },
];

export function AmazonGridCards() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    /* Part 2 — responsive cols + fluid negative margins + no self-padding (parent handles it) */
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full -mt-6 sm:-mt-12 lg:-mt-20 relative z-10 pb-6"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      {CARDS.map((card, ci) => (
        /* Part 1 — fluid auto height on mobile/tablet; locked 440px on lg+ */
        <div
          key={ci}
          className="w-full h-auto flex flex-col p-5 bg-white/75 dark:bg-neutral-900/80 backdrop-blur-xl rounded-xl shadow-inner border border-white/50 dark:border-neutral-700/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        >
          {/* Card title */}
          <h3
            className="font-bold text-base md:text-lg text-neutral-900 dark:text-neutral-100 leading-snug"
            style={{ textAlign: isRtl ? "right" : "left" }}
          >
            {isRtl ? card.titleAr : card.titleEn}
          </h3>

          {/* Inner 2×2 grid — static block, no flex-grow stretching */}
          <div className="grid grid-cols-2 gap-3 w-full mt-3 mb-1">
            {card.items.map((item, ii) => (
              <Link key={ii} href={item.href} className="group block">
                {/* Part 2 — flex column, text aligned per locale */}
                <div className={`flex flex-col ${isRtl ? "text-right" : "text-left"}`}>
                  {/* Part 2 — ironclad aspect-square prevents any stretching */}
                  <div className="w-full aspect-square bg-neutral-50 dark:bg-neutral-800 rounded-md overflow-hidden">
                    <img
                      src={item.img}
                      alt={isRtl ? item.labelAr : item.labelEn}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                    />
                  </div>
                  {/* Part 2 — breathing micro-label with line-clamp */}
                  <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mt-1.5 line-clamp-1 block pr-0.5">
                    {isRtl ? item.labelAr : item.labelEn}
                  </span>
                </div>
              </Link>
            ))}
          </div>

        </div>
      ))}
    </div>
  );
}
