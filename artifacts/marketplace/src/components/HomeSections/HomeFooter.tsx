import { Instagram, Twitter, Facebook, Youtube, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

const socialLinks = [
  { icon: Instagram, label: "Instagram", href: "https://www.instagram.com/syano.market/" },
  { icon: Twitter,   label: "X (Twitter)", href: "https://x.com/Syanomarket" },
  { icon: Facebook,  label: "Facebook",   href: "https://www.facebook.com/SyanoMarket" },
  { icon: Youtube,   label: "YouTube",    href: "#" },
];

const paymentMethods = ["VISA", "MasterCard", "PayPal", "SyriaTel Cash"];

export function HomeFooter() {
  const { t, i18n } = useTranslation();

  const footerLinks = {
    marketplace: {
      titleKey: "home.footer.marketplace_title",
      links: [
        { labelKey: "home.footer.link_all_products",   href: "/shop" },
        { labelKey: "home.footer.link_deals",          href: "/shop?hasDiscount=true" },
        { labelKey: "home.footer.link_bestsellers",    href: "/shop?sortBy=best_selling" },
        { labelKey: "home.footer.link_new_products",   href: "/shop?sortBy=newest" },
        { labelKey: "home.footer.link_categories",     href: "/categories" },
        { labelKey: "home.footer.link_trusted_stores", href: "/stores" },
        { labelKey: "home.footer.link_wishlist",       href: "/wishlist" },
        { labelKey: "home.footer.link_cart",           href: "/cart" },
      ],
    },
    seller: {
      titleKey: "home.footer.sellers_title",
      links: [
        { labelKey: "home.footer.link_open_store",      href: "/seller/apply" },
        { labelKey: "home.footer.link_seller_dashboard",href: "/seller/dashboard" },
        { labelKey: "home.footer.link_seller_center",   href: "/seller/center" },
        { labelKey: "home.footer.link_seller_how",      href: "/seller/how-to-sell" },
        { labelKey: "home.footer.link_commission",      href: "/seller/commission" },
        { labelKey: "home.footer.link_seller_faq",      href: "/seller/faq" },
        { labelKey: "home.footer.link_seller_terms",    href: "/seller/terms" },
        { labelKey: "home.footer.link_returns",         href: "/returns-policy" },
      ],
    },
    courier: {
      titleKey: "home.footer.s_courier",
      links: [
        { labelKey: "home.footer.link_courier_apply",       href: "/courier/apply" },
        { labelKey: "home.footer.link_courier_workspace",   href: "/courier" },
        { labelKey: "home.footer.link_courier_earnings",    href: "/courier/earnings" },
        { labelKey: "home.footer.link_courier_wallet",      href: "/courier/wallet" },
        { labelKey: "home.footer.link_courier_performance", href: "/courier/performance" },
        { labelKey: "home.footer.link_courier_history",     href: "/courier/history" },
      ],
    },
    company: {
      titleKey: "home.footer.company_title",
      links: [
        { labelKey: "home.footer.link_about",          href: "/about" },
        { labelKey: "home.footer.link_about_story",    href: "/about/story" },
        { labelKey: "home.footer.link_about_team",     href: "/about/team" },
        { labelKey: "home.footer.link_contact",        href: "/contact" },
        { labelKey: "home.footer.link_shipping",       href: "/shipping" },
        { labelKey: "home.footer.link_guarantee",      href: "/syano-guarantee" },
        { labelKey: "home.footer.link_loyalty",        href: "/loyalty" },
        { labelKey: "home.footer.link_payment",        href: "/payment-methods" },
        { labelKey: "home.footer.link_help",           href: "/help" },
        { labelKey: "home.footer.link_privacy",        href: "/privacy-policy" },
        { labelKey: "home.footer.link_terms_page",     href: "/terms-of-use" },
      ],
    },
  };

  return (
    <footer dir={i18n.dir()} style={{ fontFamily: "'Cairo', sans-serif" }} className="bg-background border-t border-border">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="py-10 md:py-16 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-6 lg:gap-10">

          {/* Brand block */}
          <div className="col-span-2 md:col-span-4 lg:col-span-3">
            <div className="flex items-center gap-2.5 mb-5">
              <img
                src="/syano-logo.png"
                alt="Syano"
                width={36}
                height={36}
                className="w-9 h-9 object-contain"
                style={{ filter: "brightness(1.2) contrast(1.1) drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
              />
              <div>
                <div style={{ fontWeight: 800, letterSpacing: "0.08em" }} className="text-foreground text-lg">SYANO</div>
                <div style={{ fontWeight: 400, fontSize: "var(--font-2xs)" }} className="text-emerald-400/70 tracking-widest">سوق سوريا</div>
              </div>
            </div>
            <p style={{ fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.8 }} className="text-muted-foreground mb-8 max-w-[280px]">
              {t("home.footer.tagline")}
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground/70 hover:bg-muted/80 hover:border-border transition-all duration-200"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key} className="lg:col-span-2">
              <h4
                style={{ fontWeight: 700, fontSize: "0.875rem", letterSpacing: "0.02em" }}
                className="text-foreground mb-5"
              >
                {t(section.titleKey)}
              </h4>
              <ul className="flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      style={{ fontWeight: 400, fontSize: "0.8125rem" }}
                      className="text-muted-foreground hover:text-foreground/65 transition-colors duration-200"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div className="col-span-2 md:col-span-4 lg:col-span-3">
            <h4 style={{ fontWeight: 700, fontSize: "0.875rem" }} className="text-foreground mb-2">
              {t("home.footer.newsletter_title")}
            </h4>
            <p style={{ fontWeight: 400, fontSize: "0.8125rem" }} className="text-muted-foreground mb-4 leading-relaxed">
              {t("home.footer.newsletter_desc")}
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder={t("home.footer.newsletter_placeholder")}
                style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 400, fontSize: "0.8125rem" }}
                className="w-full bg-muted/40 border border-border focus:border-emerald-500/40 rounded-xl px-4 py-3 text-foreground/70 placeholder:text-muted-foreground/50 outline-none transition-colors"
              />
              <button
                style={{ fontWeight: 700, fontSize: "0.8125rem" }}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white w-full py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
              >
                {t("home.footer.subscribe")} <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-start">
          <p style={{ fontWeight: 400, fontSize: "0.8125rem" }} className="text-muted-foreground/60">
            {t("home.footer.copyright")}
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {paymentMethods.map((method) => (
              <div
                key={method}
                style={{ fontWeight: 700, fontSize: "var(--font-2xs)", letterSpacing: "0.05em" }}
                className="px-2.5 py-1 bg-muted/40 border border-border text-muted-foreground/60 rounded-md"
              >
                {method}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
            <Link href="/privacy-policy" style={{ fontWeight: 400, fontSize: "var(--font-xs-up)" }} className="text-muted-foreground/60 hover:text-foreground/50 transition-colors">
              {t("home.footer.privacy")}
            </Link>
            <Link href="/terms-of-use" style={{ fontWeight: 400, fontSize: "var(--font-xs-up)" }} className="text-muted-foreground/60 hover:text-foreground/50 transition-colors">
              {t("home.footer.terms")}
            </Link>
            <Link href="/cookies" style={{ fontWeight: 400, fontSize: "var(--font-xs-up)" }} className="text-muted-foreground/60 hover:text-foreground/50 transition-colors">
              {t("home.footer.cookies")}
            </Link>
            <Link href="/returns-policy" style={{ fontWeight: 400, fontSize: "var(--font-xs-up)" }} className="text-muted-foreground/60 hover:text-foreground/50 transition-colors">
              {t("home.footer.link_returns")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
