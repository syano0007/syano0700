import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

function Accordion({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-5 text-start gap-4"
      >
        <span className="font-medium text-sm leading-snug text-foreground">{q}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 text-muted-foreground ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-[max-height,padding-bottom] duration-300 ease-in-out ${open ? "max-h-96 pb-5" : "max-h-0"}`}
      >
        <p className="text-sm leading-relaxed pe-8 text-muted-foreground">{a}</p>
      </div>
    </div>
  );
}

export default function SellerFaqPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("seller_faq.seo_title"),
    description: t("seller_faq.seo_desc"),
    canonical: "/seller/faq",
  });

  const faqs: FaqItem[] = Array.from({ length: 12 }, (_, i) => ({
    q: t(`seller_faq.q${i + 1}`),
    a: t(`seller_faq.a${i + 1}`),
  }));

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("seller_faq.badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("seller_faq.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("seller_faq.hero_desc")}
            </p>
          </div>
        </section>

        {/* FAQ list */}
        <section>
          <div className="container px-4 py-12 max-w-3xl mx-auto">
            <div className="rounded-xl overflow-hidden border border-border bg-card">
              <div className="px-6">
                {faqs.map((faq) => (
                  <Accordion key={faq.q} {...faq} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Still need help */}
        <section className="bg-card/60 border-t border-border">
          <div className="container px-4 py-12 max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold mb-3 text-foreground">{t("seller_faq.contact_title")}</h2>
            <p className="text-sm leading-relaxed mb-5 text-muted-foreground">{t("seller_faq.contact_desc")}</p>
            <a
              href="mailto:sellers@syano.online"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-opacity duration-150 hover:opacity-80 bg-primary/10 border border-primary/30 text-primary"
            >
              {t("seller_faq.contact_btn")}
            </a>
          </div>
        </section>

      </div>
    </Layout>
  );
}
