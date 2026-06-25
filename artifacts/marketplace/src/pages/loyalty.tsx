import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { Gift, Star, Zap, Crown, CheckCircle2 } from "lucide-react";

export default function LoyaltyPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("loyalty.seo_title"),
    description: t("loyalty.seo_desc"),
    canonical: "/loyalty",
  });

  const tiers = [
    {
      icon: <Star className="h-6 w-6" style={{ color: "#8A8A8A" }} />,
      name: t("loyalty.tier1_name"),
      threshold: t("loyalty.tier1_threshold"),
      perks: [t("loyalty.tier1_p1"), t("loyalty.tier1_p2"), t("loyalty.tier1_p3")],
      color: "#8A8A8A",
      featured: false,
      featuredClass: "",
    },
    {
      icon: <Zap className="h-6 w-6" style={{ color: "#3B82F6" }} />,
      name: t("loyalty.tier2_name"),
      threshold: t("loyalty.tier2_threshold"),
      perks: [t("loyalty.tier2_p1"), t("loyalty.tier2_p2"), t("loyalty.tier2_p3")],
      color: "#3B82F6",
      featured: true,
      featuredClass: "bg-blue-500/5 border-blue-500/30",
    },
    {
      icon: <Crown className="h-6 w-6" style={{ color: "#F59E0B" }} />,
      name: t("loyalty.tier3_name"),
      threshold: t("loyalty.tier3_threshold"),
      perks: [t("loyalty.tier3_p1"), t("loyalty.tier3_p2"), t("loyalty.tier3_p3")],
      color: "#F59E0B",
      featured: false,
      featuredClass: "",
    },
  ];

  const howItWorks = Array.from({ length: 4 }, (_, i) => ({
    num: i + 1,
    title: t(`loyalty.how${i + 1}_title`),
    desc: t(`loyalty.how${i + 1}_desc`),
  }));

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-24 max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center bg-primary/10 border-2 border-primary/30">
                <Gift className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("loyalty.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("loyalty.hero_desc")}
            </p>
          </div>
        </section>

        {/* Tiers */}
        <section className="border-b border-border">
          <div className="container px-4 py-14 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-10 text-center text-foreground">{t("loyalty.tiers_title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {tiers.map(({ icon, name, threshold, perks, color, featuredClass }) => (
                <div
                  key={name}
                  className={`rounded-xl p-6 border ${featuredClass || "bg-card border-border"}`}
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: color + "18" }}
                  >
                    {icon}
                  </div>
                  <h3 className="font-bold text-lg mb-0.5 text-foreground">{name}</h3>
                  <p className="text-xs font-medium mb-4" style={{ color }}>{threshold}</p>
                  <ul className="space-y-2">
                    {perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section>
          <div className="container px-4 py-14 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-8 text-foreground">{t("loyalty.how_title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {howItWorks.map(({ num, title, desc }) => (
                <div key={num} className="rounded-xl p-5 bg-card border border-border">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold mb-3 bg-primary/10 text-primary">
                    {num}
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5 text-foreground">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
