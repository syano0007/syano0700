import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { Search, ShoppingCart, CreditCard, Truck, RefreshCcw, User, Store, ChevronDown } from "lucide-react";

interface FaqEntry {
  q: string;
  a: string;
}

interface HelpCategory {
  id: string;
  icon: React.ReactNode;
  title: string;
  items: FaqEntry[];
}

function FaqItem({ q, a }: FaqEntry) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-start gap-3"
      >
        <span className="text-sm font-medium leading-snug text-foreground">{q}</span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 text-muted-foreground ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`overflow-hidden transition-[max-height,padding-bottom] duration-300 ease-in-out ${open ? "max-h-96 pb-4" : "max-h-0"}`}>
        <p className="text-sm leading-relaxed pe-6 text-muted-foreground">{a}</p>
      </div>
    </div>
  );
}

export default function HelpCenterPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useSEO({
    title: t("help.seo_title"),
    description: t("help.seo_desc"),
    canonical: "/help",
  });

  const categories: HelpCategory[] = [
    {
      id: "orders",
      icon: <ShoppingCart className="h-5 w-5" style={{ color: "#276221" }} />,
      title: t("help.cat_orders"),
      items: Array.from({ length: 5 }, (_, i) => ({ q: t(`help.orders_q${i + 1}`), a: t(`help.orders_a${i + 1}`) })),
    },
    {
      id: "payments",
      icon: <CreditCard className="h-5 w-5" style={{ color: "#3B82F6" }} />,
      title: t("help.cat_payments"),
      items: Array.from({ length: 4 }, (_, i) => ({ q: t(`help.payments_q${i + 1}`), a: t(`help.payments_a${i + 1}`) })),
    },
    {
      id: "shipping",
      icon: <Truck className="h-5 w-5" style={{ color: "#8B5CF6" }} />,
      title: t("help.cat_shipping"),
      items: Array.from({ length: 4 }, (_, i) => ({ q: t(`help.shipping_q${i + 1}`), a: t(`help.shipping_a${i + 1}`) })),
    },
    {
      id: "returns",
      icon: <RefreshCcw className="h-5 w-5" style={{ color: "#F59E0B" }} />,
      title: t("help.cat_returns"),
      items: Array.from({ length: 4 }, (_, i) => ({ q: t(`help.returns_q${i + 1}`), a: t(`help.returns_a${i + 1}`) })),
    },
    {
      id: "account",
      icon: <User className="h-5 w-5" style={{ color: "#06B6D4" }} />,
      title: t("help.cat_account"),
      items: Array.from({ length: 4 }, (_, i) => ({ q: t(`help.account_q${i + 1}`), a: t(`help.account_a${i + 1}`) })),
    },
    {
      id: "seller",
      icon: <Store className="h-5 w-5" style={{ color: "#EF4444" }} />,
      title: t("help.cat_seller"),
      items: Array.from({ length: 4 }, (_, i) => ({ q: t(`help.seller_q${i + 1}`), a: t(`help.seller_a${i + 1}`) })),
    },
  ];

  const ICON_COLORS: Record<string, string> = {
    orders: "#276221",
    payments: "#3B82F6",
    shipping: "#8B5CF6",
    returns: "#F59E0B",
    account: "#06B6D4",
    seller: "#EF4444",
  };

  const q = search.toLowerCase().trim();
  const filtered: HelpCategory[] = categories.map(cat => ({
    ...cat,
    items: q
      ? cat.items.filter(item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      : cat.items,
  })).filter(cat => (activeCategory ? cat.id === activeCategory : true) && cat.items.length > 0);

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero + Search */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("help.badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("help.hero_title")}
            </h1>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("help.search_placeholder")}
                className="w-full rounded-xl py-3.5 ps-12 pe-5 text-sm outline-none bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors duration-150"
              />
            </div>
          </div>
        </section>

        <div className="container px-4 py-10 max-w-5xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors duration-150 border ${
                !activeCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {t("help.all")}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors duration-150 border"
                style={{
                  background: activeCategory === cat.id ? ICON_COLORS[cat.id] + "18" : undefined,
                  color: activeCategory === cat.id ? ICON_COLORS[cat.id] : undefined,
                  borderColor: activeCategory === cat.id ? ICON_COLORS[cat.id] + "44" : undefined,
                }}
              >
                {cat.icon}
                {cat.title}
              </button>
            ))}
          </div>

          {/* FAQ sections */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-medium mb-2 text-foreground">{t("help.no_results")}</p>
              <p className="text-sm text-muted-foreground">{t("help.no_results_desc")}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {filtered.map(cat => (
                <div key={cat.id} className="rounded-xl overflow-hidden border border-border">
                  <div className="flex items-center gap-3 px-6 py-4 bg-card/80 border-b border-border">
                    {cat.icon}
                    <h2 className="font-bold text-base text-foreground">{cat.title}</h2>
                  </div>
                  <div className="px-6 bg-background">
                    {cat.items.map((item) => (
                      <FaqItem key={item.q} {...item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
