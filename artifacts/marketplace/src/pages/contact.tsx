import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useSEO } from "@/hooks/useSEO";
import { Mail, Phone, MapPin, MessageSquare, Store } from "lucide-react";
import TurnstileWidget, { type TurnstileHandle } from "@/components/TurnstileWidget";

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  useSEO({
    title: t("contact.seo_title"),
    description: t("contact.seo_desc"),
    canonical: "/contact",
  });

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [tsToken, setTsToken] = useState("");
  const tsRef = useRef<TurnstileHandle>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = t("contact.err_name");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = t("contact.err_email");
    if (!form.subject.trim()) e.subject = t("contact.err_subject");
    if (!form.message.trim() || form.message.trim().length < 10) e.message = t("contact.err_message");
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitted(true);
  }

  const channels = [
    {
      icon: <Mail className="h-5 w-5 text-primary" />,
      label: t("contact.ch_email"),
      value: "hello@syano.online",
      href: "mailto:hello@syano.online",
      external: false,
    },
    {
      icon: <Phone className="h-5 w-5 text-primary" />,
      label: t("contact.ch_whatsapp"),
      value: t("contact.phone_placeholder"),
      href: null,
      external: true,
    },
    {
      icon: <MapPin className="h-5 w-5 text-primary" />,
      label: t("contact.ch_location"),
      value: t("contact.ch_location_value"),
      href: null,
      external: false,
    },
  ];

  const inputBase = "w-full rounded-lg px-4 py-2.5 text-sm outline-none bg-card border text-foreground placeholder:text-muted-foreground focus:border-primary transition-colors duration-150";

  return (
    <Layout>
      <div dir={isRtl ? "rtl" : "ltr"} className="bg-background text-foreground">

        {/* Hero */}
        <section className="bg-card/60 border-b border-border">
          <div className="container px-4 py-16 md:py-20 max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-6 bg-primary/10 border border-primary/25 text-primary">
              {t("contact.badge")}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight text-foreground">
              {t("contact.hero_title")}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t("contact.hero_desc")}
            </p>
          </div>
        </section>

        <div className="container px-4 py-14 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Left — contact channels */}
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-5 text-foreground">{t("contact.channels_title")}</h2>
                <div className="space-y-4">
                  {channels.map(({ icon, label, value, href, external }) => (
                    <div key={label} className="rounded-xl p-4 flex items-start gap-4 bg-card border border-border">
                      <div className="mt-0.5 flex-shrink-0">{icon}</div>
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-muted-foreground">{label}</p>
                        {href ? (
                          <a
                            href={href}
                            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                            className="text-sm font-medium transition-colors duration-150 text-foreground hover:text-primary"
                          >
                            {value}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-foreground">{value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seller support */}
              <div className="rounded-xl p-5 bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-primary">{t("contact.seller_support_title")}</p>
                </div>
                <p className="text-sm leading-relaxed mb-3 text-muted-foreground">
                  {t("contact.seller_support_desc")}
                </p>
                <a
                  href="mailto:sellers@syano.online"
                  className="text-sm font-medium transition-colors duration-150 text-primary hover:opacity-80"
                >
                  sellers@syano.online
                </a>
              </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-bold mb-6 text-foreground">{t("contact.form_title")}</h2>

              {submitted ? (
                <div className="rounded-xl p-5 sm:p-8 text-center bg-card border border-border">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="text-lg font-bold mb-2 text-foreground">{t("contact.success_title")}</h3>
                  <p className="text-sm text-muted-foreground">{t("contact.success_desc")}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {(["name", "email", "subject"] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                        {t(`contact.field_${field}`)}
                      </label>
                      <input
                        type={field === "email" ? "email" : "text"}
                        value={form[field]}
                        onChange={e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: "" })); }}
                        placeholder={t(`contact.placeholder_${field}`)}
                        className={`${inputBase} ${errors[field] ? "border-destructive" : "border-border"}`}
                      />
                      {errors[field] && <p className="text-xs mt-1 text-destructive">{errors[field]}</p>}
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                      {t("contact.field_message")}
                    </label>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErrors(er => ({ ...er, message: "" })); }}
                      placeholder={t("contact.placeholder_message")}
                      className={`${inputBase} resize-none ${errors.message ? "border-destructive" : "border-border"}`}
                    />
                    {errors.message && <p className="text-xs mt-1 text-destructive">{errors.message}</p>}
                  </div>
                  <TurnstileWidget
                    ref={tsRef}
                    containerId="ts-contact"
                    onVerify={setTsToken}
                    onExpire={() => setTsToken("")}
                  />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity duration-150 hover:opacity-90 bg-primary text-white"
                  >
                    {t("contact.submit_btn")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
