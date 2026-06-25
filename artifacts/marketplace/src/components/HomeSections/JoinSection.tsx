import { Store, Bike, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSellerOnboarding } from "@/hooks/useSellerOnboarding";
import { useCourierOnboarding } from "@/hooks/useCourierOnboarding";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function JoinSection() {
  const { t, i18n } = useTranslation();
  const { handleOpenYourStore } = useSellerOnboarding();
  const { handleBecomeCourier } = useCourierOnboarding();

  return (
    <section dir={i18n.dir()} style={{ fontFamily: "'Cairo', sans-serif" }} className="bg-background py-12 md:py-20 lg:py-24 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="relative rounded-3xl overflow-hidden bg-card border border-border">
          <div className="absolute inset-0">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.5) 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-emerald-500/[0.06] blur-[100px]" />
            <div className="absolute top-1/2 start-0 -translate-y-1/2 w-[300px] h-[200px] rounded-full bg-emerald-600/[0.04] blur-[80px]" />
            <div className="absolute top-1/2 end-0 -translate-y-1/2 w-[300px] h-[200px] rounded-full bg-emerald-600/[0.04] blur-[80px]" />
          </div>

          <div className="relative z-10 py-8 px-6 sm:py-12 sm:px-10 lg:py-16 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] mb-6">
                <span style={{ fontWeight: 600, fontSize: "var(--font-xs-up)", letterSpacing: "0.08em" }} className="text-emerald-400 uppercase">{t("home.join.badge")}</span>
              </div>
              <h2 style={{ fontWeight: 800, fontSize: "clamp(24px, 3.5vw, 42px)", letterSpacing: "-0.02em", lineHeight: 1.2 }} className="text-foreground mb-4">
                {t("home.join.title")}
              </h2>
              <p style={{ fontWeight: 400, fontSize: "1rem", lineHeight: 1.7 }} className="text-muted-foreground max-w-[500px] mx-auto">
                {t("home.join.subtitle")}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[780px] mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.1, ease }}
                onClick={handleOpenYourStore}
                className="group relative bg-card border border-border hover:border-emerald-500/25 rounded-2xl p-7 cursor-pointer transition-all duration-300 sy-card-elevated"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/15 transition-colors duration-300">
                  <Store className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: "1.25rem" }} className="text-foreground mb-2">{t("home.join.seller_title")}</h3>
                <p style={{ fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.65 }} className="text-muted-foreground mb-6">
                  {t("home.join.seller_desc")}
                </p>
                <div className="flex items-center gap-2 text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{t("home.join.seller_cta")}</span>
                  <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,_rgba(39,98,33,0.06)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.2, ease }}
                onClick={handleBecomeCourier}
                className="group relative bg-card border border-border hover:border-border/80 rounded-2xl p-7 cursor-pointer transition-all duration-300 sy-card-elevated"
              >
                <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mb-5 group-hover:bg-muted transition-colors duration-300">
                  <Bike className="w-6 h-6 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: "1.25rem" }} className="text-foreground mb-2">{t("home.join.courier_title")}</h3>
                <p style={{ fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.65 }} className="text-muted-foreground mb-6">
                  {t("home.join.courier_desc")}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground/70 transition-colors">
                  <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>{t("home.join.courier_cta")}</span>
                  <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
