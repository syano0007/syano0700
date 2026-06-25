import { ArrowLeft, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { Product } from "@workspace/api-client-react";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

interface ArrivalData {
  id: number;
  name: string;
  categoryLabel: string;
  price: number;
  daysAgo: number;
  img: string;
  productId?: number;
}

export function NewArrivals({ newArrivals }: { newArrivals?: Product[] }) {
  const { t, i18n } = useTranslation();
  const { format } = useCurrency();

  const items: ArrivalData[] = (newArrivals && newArrivals.length >= 4
    ? newArrivals.slice(0, 4).map((p, i) => {
        const imgs = (p as any).imageUrls as string[] | undefined;
        return {
          id: p.id,
          productId: p.id,
          name: p.name,
          categoryLabel: p.category ?? "",
          price: (p as any).finalPrice ? Number((p as any).finalPrice) : Number(p.price),
          daysAgo: Math.floor(i / 2) + 1,
          img: imgs?.[0] ?? "",
        };
      })
    : []);

  if (items.length < 4) return null;

  const main = items[0];
  const rest = items.slice(1, 4);

  return (
    <section dir={i18n.dir()} style={{ fontFamily: "'Cairo', sans-serif" }} className="bg-background py-12 md:py-20 lg:py-28 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 md:mb-10 lg:mb-14">
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.12em" }} className="text-emerald-400 uppercase mb-3">{t("home.arrivals.eyebrow")}</p>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(24px, 3vw, 38px)", letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-foreground">{t("home.arrivals.title")}</h2>
          </div>
          <Link href="/shop" style={{ fontWeight: 600, fontSize: "0.875rem" }} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors pb-1">
            {t("home.arrivals.see_all")} <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 gap-5 lg:h-[35rem]">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease }}
            className="sm:col-span-2 lg:col-span-2 lg:row-span-2 group relative bg-card border border-border hover:border-border/80 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 sy-card-elevated min-h-[280px] sm:min-h-[360px] lg:min-h-0"
          >
            <Link href={main.productId ? `/products/${main.productId}` : "/products"} className="block w-full h-full">
              <img src={main.img} alt={main.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" style={{ filter: "brightness(var(--img-dim-arrival)) contrast(1.1)" }} />
              <div className="absolute inset-0 sy-overlay-heavy" />
              <div className="absolute top-5 start-5">
                <div style={{ fontWeight: 700, fontSize: "var(--font-xs-up)" }} className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-full">
                  <Zap className="w-3 h-3" /> {t("home.arrivals.new_since", { count: main.daysAgo })}
                </div>
              </div>
              <div className="absolute bottom-0 start-0 end-0 p-7">
                <p style={{ fontWeight: 500, fontSize: "var(--font-xs-up)", letterSpacing: "0.06em" }} className="text-emerald-400 uppercase mb-2">{main.categoryLabel}</p>
                <h3 style={{ fontWeight: 800, fontSize: "1.75rem", lineHeight: 1.3, letterSpacing: "-0.01em" }} className="text-white mb-3">{main.name}</h3>
                <div style={{ fontWeight: 800, fontSize: "1.5rem" }} className="text-emerald-400" translate="no">
                  {format(main.price)}
                </div>
              </div>
            </Link>
          </motion.div>

          {rest.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease }}
              className="group relative bg-card border border-border hover:border-border/80 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 sy-card-elevated min-h-[200px] lg:min-h-0"
            >
              <Link href={product.productId ? `/products/${product.productId}` : "/products"} className="block w-full h-full">
                <img src={product.img} alt={product.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" style={{ filter: "brightness(var(--img-dim-arrival)) contrast(1.1)" }} />
                <div className="absolute inset-0 sy-overlay-medium" />
                <div className="absolute top-3 start-3">
                  <div style={{ fontWeight: 700, fontSize: "10px" }} className="flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/10 text-white/70 px-2 py-0.5 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {t("home.arrivals.ago", { count: product.daysAgo })}
                  </div>
                </div>
                <div className="absolute bottom-0 start-0 end-0 p-4">
                  <p style={{ fontWeight: 500, fontSize: "10px" }} className="text-emerald-400/70 uppercase mb-1">{product.categoryLabel}</p>
                  <h3 style={{ fontWeight: 700, fontSize: "0.9375rem", lineHeight: 1.3 }} className="text-white mb-2">{product.name}</h3>
                  <div style={{ fontWeight: 800, fontSize: "1.0625rem" }} className="text-emerald-400" translate="no">
                    {format(product.price)}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
