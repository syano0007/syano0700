import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { Info } from "lucide-react";

interface CommRow {
  category: string;
  rate: string;
  example: string;
}

export default function CommissionPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("commission.seo_title"),
    description: t("commission.seo_desc"),
    canonical: "/seller/commission",
  });

  const rows: CommRow[] = [
    { category: t("commission.cat_electronics"), rate: "5%", example: t("commission.ex_electronics") },
    { category: t("commission.cat_fashion"), rate: "8%", example: t("commission.ex_fashion") },
    { category: t("commission.cat_beauty"), rate: "7%", example: t("commission.ex_beauty") },
    { category: t("commission.cat_home"), rate: "6%", example: t("commission.ex_home") },
    { category: t("commission.cat_grocery"), rate: "4%", example: t("commission.ex_grocery") },
    { category: t("commission.cat_sports"), rate: "7%", example: t("commission.ex_sports") },
    { category: t("commission.cat_books"), rate: "5%", example: t("commission.ex_books") },
    { category: t("commission.cat_jewelry"), rate: "10%", example: t("commission.ex_jewelry") },
    { category: t("commission.cat_digital"), rate: "3%", example: t("commission.ex_digital") },
    { category: t("commission.cat_other"), rate: "6%", example: t("commission.ex_other") },
  ];

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("commission.badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("commission.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("commission.hero_desc")}
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border">
          <div className="container px-4 py-12 max-w-3xl mx-auto">
            <div className="rounded-xl p-5 flex items-start gap-4 bg-primary/5 border border-primary/20">
              <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("commission.how_it_works")}
              </p>
            </div>
          </div>
        </section>

        {/* Commission table */}
        <section>
          <div className="container px-4 py-12 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-6 text-foreground">{t("commission.table_title")}</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-card/80 border-b border-border">
                    <th className="px-5 py-4 font-semibold text-start text-foreground">
                      {t("commission.col_category")}
                    </th>
                    <th className="px-5 py-4 font-semibold text-start text-foreground">
                      {t("commission.col_rate")}
                    </th>
                    <th className="px-5 py-4 font-semibold text-start hidden sm:table-cell text-foreground">
                      {t("commission.col_example")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ category, rate, example }, i) => (
                    <tr
                      key={category}
                      className={`${i % 2 === 0 ? "bg-background" : "bg-card/40"} ${i < rows.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-muted-foreground">{category}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-base text-primary">{rate}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Example calculation */}
            <div className="mt-8 rounded-xl p-6 bg-card border border-border">
              <h3 className="font-bold mb-3 text-foreground">{t("commission.calc_title")}</h3>
              <p className="text-sm leading-relaxed mb-3 text-muted-foreground">{t("commission.calc_desc")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                {[
                  { label: t("commission.calc_price"), value: "$100" },
                  { label: t("commission.calc_comm"), value: "$5 (5%)" },
                  { label: t("commission.calc_earn"), value: "$95" },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center rounded-lg py-4 px-3 bg-muted border border-border">
                    <p className="text-xs mb-1 text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold text-primary">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
