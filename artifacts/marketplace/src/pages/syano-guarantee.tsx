import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { ShieldCheck, RefreshCcw, Headphones, Star, CheckCircle2 } from "lucide-react";

export default function SyanoGuaranteePage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("guarantee.seo_title"),
    description: t("guarantee.seo_desc"),
    canonical: "/syano-guarantee",
  });

  const pillars = [
    {
      icon: <ShieldCheck className="h-8 w-8" style={{ color: "#276221" }} />,
      title: t("guarantee.pillar1_title"),
      desc: t("guarantee.pillar1_desc"),
      color: "#276221",
    },
    {
      icon: <RefreshCcw className="h-8 w-8" style={{ color: "#3B82F6" }} />,
      title: t("guarantee.pillar2_title"),
      desc: t("guarantee.pillar2_desc"),
      color: "#3B82F6",
    },
    {
      icon: <Headphones className="h-8 w-8" style={{ color: "#8B5CF6" }} />,
      title: t("guarantee.pillar3_title"),
      desc: t("guarantee.pillar3_desc"),
      color: "#8B5CF6",
    },
    {
      icon: <Star className="h-8 w-8" style={{ color: "#F59E0B" }} />,
      title: t("guarantee.pillar4_title"),
      desc: t("guarantee.pillar4_desc"),
      color: "#F59E0B",
    },
  ];

  const protections = Array.from({ length: 6 }, (_, i) => t(`guarantee.protect${i + 1}`));

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-24 max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center bg-primary/10 border-2 border-primary/30">
                <ShieldCheck className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("guarantee.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("guarantee.hero_desc")}
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section className="border-b border-border">
          <div className="container px-4 py-14 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {pillars.map(({ icon, title, desc, color }) => (
                <div key={title} className="rounded-xl p-6 flex items-start gap-5 bg-card border border-border">
                  <div
                    className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color + "18" }}
                  >
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] mb-2 text-foreground">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What's covered */}
        <section>
          <div className="container px-4 py-12 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-6 text-foreground">{t("guarantee.covered_title")}</h2>
            <div className="space-y-3">
              {protections.map((p) => (
                <div key={p} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-muted-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
