import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { Banknote, CreditCard, Smartphone, ShieldCheck } from "lucide-react";

export default function PaymentMethodsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("payment_methods.seo_title"),
    description: t("payment_methods.seo_desc"),
    canonical: "/payment-methods",
  });

  const methods = [
    {
      icon: <Banknote className="h-8 w-8 text-primary" />,
      title: t("payment_methods.method1_title"),
      desc: t("payment_methods.method1_desc"),
      badge: t("payment_methods.available"),
      badgeClass: "bg-primary/10 text-primary",
      dim: false,
    },
    {
      icon: <CreditCard className="h-8 w-8 text-muted-foreground" />,
      title: t("payment_methods.method2_title"),
      desc: t("payment_methods.method2_desc"),
      badge: t("payment_methods.coming_soon"),
      badgeClass: "bg-muted text-muted-foreground",
      dim: true,
    },
    {
      icon: <Smartphone className="h-8 w-8 text-muted-foreground" />,
      title: t("payment_methods.method3_title"),
      desc: t("payment_methods.method3_desc"),
      badge: t("payment_methods.coming_soon"),
      badgeClass: "bg-muted text-muted-foreground",
      dim: true,
    },
  ];

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("payment_methods.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("payment_methods.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("payment_methods.hero_desc")}
            </p>
          </div>
        </section>

        {/* Methods */}
        <section className="border-b border-border">
          <div className="container px-4 py-14 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {methods.map(({ icon, title, desc, badge, badgeClass, dim }) => (
                <div
                  key={title}
                  className="rounded-xl p-6 bg-card border border-border"
                  style={{ opacity: dim ? 0.6 : 1 }}
                >
                  <div className="mb-5">{icon}</div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-bold text-[15px] text-foreground">{title}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}>
                      {badge}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security note */}
        <section>
          <div className="container px-4 py-12 max-w-3xl mx-auto">
            <div className="rounded-xl p-6 flex items-start gap-5 bg-card border border-border">
              <ShieldCheck className="h-8 w-8 flex-shrink-0 mt-1 text-primary" />
              <div>
                <h3 className="font-bold mb-2 text-foreground">{t("payment_methods.security_title")}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t("payment_methods.security_desc")}</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
