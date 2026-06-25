import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { CheckCircle2, MapPin } from "lucide-react";

const GOVERNORATES = [
  "Aleppo", "Damascus", "Rural Damascus", "Homs", "Hama",
  "Latakia", "Tartus", "Idlib", "Deir ez-Zor", "Raqqa",
  "Al-Hasakah", "Daraa", "As-Suwayda", "Quneitra",
];

const GOV_AR: Record<string, string> = {
  "Aleppo": "حلب",
  "Damascus": "دمشق",
  "Rural Damascus": "ريف دمشق",
  "Homs": "حمص",
  "Hama": "حماة",
  "Latakia": "اللاذقية",
  "Tartus": "طرطوس",
  "Idlib": "إدلب",
  "Deir ez-Zor": "دير الزور",
  "Raqqa": "الرقة",
  "Al-Hasakah": "الحسكة",
  "Daraa": "درعا",
  "As-Suwayda": "السويداء",
  "Quneitra": "القنيطرة",
};

export default function NationwideShippingPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("nationwide.seo_title"),
    description: t("nationwide.seo_desc"),
    canonical: "/shipping/nationwide",
  });

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("nationwide.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("nationwide.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("nationwide.hero_desc")}
            </p>
          </div>
        </section>

        {/* Coverage */}
        <section className="border-b border-border">
          <div className="container px-4 py-14 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-8">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">{t("nationwide.coverage_title")}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {GOVERNORATES.map((gov) => (
                <div
                  key={gov}
                  className="rounded-lg px-4 py-3 flex items-center gap-2 bg-card border border-border"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {isRtl ? GOV_AR[gov] : gov}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline & Rates */}
        <section className="border-b border-border">
          <div className="container px-4 py-12 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-6 text-foreground">{t("nationwide.rates_title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { tier: t("nationwide.tier1_name"), time: t("nationwide.tier1_time"), price: t("nationwide.tier1_price") },
                { tier: t("nationwide.tier2_name"), time: t("nationwide.tier2_time"), price: t("nationwide.tier2_price") },
                { tier: t("nationwide.tier3_name"), time: t("nationwide.tier3_time"), price: t("nationwide.tier3_price") },
              ].map(({ tier, time, price }) => (
                <div key={tier} className="rounded-xl p-5 text-center bg-card border border-border">
                  <p className="font-bold text-[15px] mb-2 text-foreground">{tier}</p>
                  <p className="text-sm mb-3 text-muted-foreground">{time}</p>
                  <p className="text-2xl font-extrabold text-primary">{price}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <div className="container px-4 py-12 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-5 text-foreground">{t("nationwide.notes_title")}</h2>
            <ul className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-primary" />
                  {t(`nationwide.note${n}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

      </div>
    </Layout>
  );
}
