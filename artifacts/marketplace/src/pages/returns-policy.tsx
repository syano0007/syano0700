import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { RefreshCcw, CheckCircle2, XCircle } from "lucide-react";

const SECTIONS = ["eligibility", "process", "refunds", "non_returnable", "damaged", "contact"];

export default function ReturnsPolicyPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("returns.seo_title"),
    description: t("returns.seo_desc"),
    canonical: "/returns-policy",
  });

  const returnable = Array.from({ length: 5 }, (_, i) => t(`returns.returnable${i + 1}`));
  const nonReturnable = Array.from({ length: 4 }, (_, i) => t(`returns.non_returnable${i + 1}`));

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="h-16 w-16 rounded-full flex items-center justify-center bg-primary/10 border-2 border-primary/30">
                <RefreshCcw className="h-8 w-8 text-primary" />
              </div>
            </div>
            <p className="text-xs font-medium mb-3 text-primary">{t("returns.badge")}</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight text-foreground">
              {t("returns.hero_title")}
            </h1>
            <p className="text-base leading-relaxed max-w-xl mx-auto text-muted-foreground">
              {t("returns.hero_desc")}
            </p>
          </div>
        </section>

        {/* Returnable / Non-returnable summary */}
        <section className="border-b border-border">
          <div className="container px-4 py-12 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-xl p-6 bg-primary/5 border border-primary/20">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5" /> {t("returns.returnable_title")}
                </h3>
                <ul className="space-y-2">
                  {returnable.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-6 bg-destructive/5 border border-destructive/20">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" /> {t("returns.non_returnable_title")}
                </h3>
                <ul className="space-y-2">
                  {nonReturnable.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-destructive" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Full policy */}
        <div className="container px-4 py-12 max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-10">
            <aside className="lg:w-56 flex-shrink-0">
              <div className="sticky top-6">
                <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-muted-foreground">
                  {t("returns.toc_title")}
                </p>
                <nav className="space-y-1">
                  {SECTIONS.map(s => (
                    <a key={s} href={`#rp-${s}`}
                      className="block py-1.5 text-sm transition-colors duration-150 text-muted-foreground hover:text-primary"
                    >
                      {t(`returns.toc_${s}`)}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
            <div className="flex-1 min-w-0 space-y-10">
              {SECTIONS.map(s => (
                <section key={s} id={`rp-${s}`} className="scroll-mt-6">
                  <h2 className="text-lg font-bold mb-3 text-foreground">{t(`returns.${s}_title`)}</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{t(`returns.${s}_body`)}</p>
                </section>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
