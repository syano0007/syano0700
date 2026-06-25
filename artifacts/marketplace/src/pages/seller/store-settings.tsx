// @refresh reset
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Store, Save, ExternalLink, Image, Globe, Phone, Mail, Palette,
  Shield, Search, Activity, Settings2, MessageSquare, Instagram,
  AlertTriangle, CheckCircle2, XCircle, ChevronRight, Loader2,
  BadgeCheck
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSellerDashboardQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface StoreData {
  storeName: string;
  storeNameAr: string;
  description: string;
  descriptionAr: string;
  storeSlug: string;
  city: string;
  category: string;
  storeLogo: string;
  storeBanner: string;
  accentColor: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  whatsapp: string;
  telegram: string;
  facebook: string;
  instagram: string;
  shippingPolicy: string;
  returnPolicy: string;
  warrantyPolicy: string;
  privacyPolicy: string;
  metaTitle: string;
  metaDescription: string;
  seoImageUrl: string;
  businessType: string;
}

const EMPTY: StoreData = {
  storeName: "", storeNameAr: "", description: "", descriptionAr: "",
  storeSlug: "", city: "", category: "",
  storeLogo: "", storeBanner: "", accentColor: "#276221",
  contactPhone: "", contactEmail: "", website: "",
  whatsapp: "", telegram: "", facebook: "", instagram: "",
  shippingPolicy: "", returnPolicy: "", warrantyPolicy: "", privacyPolicy: "",
  metaTitle: "", metaDescription: "", seoImageUrl: "",
  businessType: "",
};

type TabId = "general" | "branding" | "contact" | "policies" | "trust" | "seo" | "health" | "advanced";

interface HealthItem { label: string; ok: boolean; tab: TabId; pts: number; }
interface TrustData {
  trustScore: number | null;
  trustLevel: string;
  isVerified: boolean;
  verificationLevel: string;
  verifiedAt?: string | null;
  components?: {
    completedOrders: number; storeRating: number; deliverySuccess: number;
    reviewCount: number; accountAge: number; followers: number;
    cancellationPenalty: number; violationsPenalty: number;
  };
  details?: {
    totalOrders: number; deliveredOrders: number; deliverySuccessRate: number;
    avgProductRating: number | null; reviewCount: number; followerCount: number;
    totalProducts: number; accountAgeMonths: number; cancellationRate: number;
  };
}
type SaveStatus = "idle" | "saving" | "saved" | "failed";

function computeHealth(form: StoreData, trust: TrustData | null): { score: number; items: HealthItem[] } {
  const items: HealthItem[] = [
    { label: "health_item_name",        ok: form.storeName.trim().length >= 2,                    tab: "general",   pts: 8  },
    { label: "health_item_ar_name",     ok: form.storeNameAr.trim().length >= 2,                  tab: "general",   pts: 5  },
    { label: "health_item_description", ok: form.description.trim().length >= 20,                 tab: "general",   pts: 10 },
    { label: "health_item_slug",        ok: form.storeSlug.trim().length >= 3,                    tab: "advanced",  pts: 7  },
    { label: "health_item_logo",        ok: form.storeLogo.trim().length > 0,                     tab: "branding",  pts: 15 },
    { label: "health_item_banner",      ok: form.storeBanner.trim().length > 0,                   tab: "branding",  pts: 12 },
    { label: "health_item_contact",     ok: !!(form.contactPhone || form.contactEmail || form.whatsapp), tab: "contact",  pts: 15 },
    { label: "health_item_policies",    ok: !!(form.shippingPolicy || form.returnPolicy),         tab: "policies",  pts: 15 },
    { label: "health_item_seo",         ok: !!(form.metaTitle || form.metaDescription),           tab: "seo",       pts: 8  },
    { label: "health_item_trust",       ok: !!(trust?.isVerified || (trust?.trustScore != null && trust.trustScore > 30)), tab: "trust", pts: 5 },
  ];
  const totalPts  = items.reduce((a, i) => a + i.pts, 0);
  const passedPts = items.filter((i) => i.ok).reduce((a, i) => a + i.pts, 0);
  return { score: Math.round((passedPts / totalPts) * 100), items };
}

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#276221" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 55 55)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      <text x="55" y="55" textAnchor="middle" dominantBaseline="central"
        fontSize="22" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function FieldRow({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ms-1">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, badge }: {
  title: string; icon: React.ElementType; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-1 border-b">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

export default function SellerStoreSettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const isRTL = i18n.dir() === "rtl";

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<StoreData>(EMPTY);
  const savedRef = useRef<StoreData>(EMPTY);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [trustData, setTrustData] = useState<TrustData | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);

  const set = useCallback(
    (key: keyof StoreData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
    []
  );
  const setVal = useCallback((key: keyof StoreData, value: string) =>
    setForm((p) => ({ ...p, [key]: value })), []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${BASE_URL}/api/seller-applications/my`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          const loaded: StoreData = {
            storeName:      data.storeName ?? "",
            storeNameAr:    data.storeNameAr ?? "",
            description:    data.description ?? "",
            descriptionAr:  data.descriptionAr ?? "",
            storeSlug:      data.storeSlug ?? "",
            city:           data.city ?? "",
            category:       data.category ?? "",
            storeLogo:      data.storeLogo ?? "",
            storeBanner:    data.storeBanner ?? "",
            accentColor:    data.accentColor ?? "#276221",
            contactPhone:   data.contactPhone ?? data.phone ?? "",
            contactEmail:   data.contactEmail ?? "",
            website:        data.website ?? "",
            whatsapp:       data.whatsapp ?? "",
            telegram:       data.telegram ?? "",
            facebook:       data.facebook ?? "",
            instagram:      data.instagram ?? "",
            shippingPolicy: data.shippingPolicy ?? "",
            returnPolicy:   data.returnPolicy ?? "",
            warrantyPolicy: data.warrantyPolicy ?? "",
            privacyPolicy:  data.privacyPolicy ?? "",
            metaTitle:      data.metaTitle ?? "",
            metaDescription: data.metaDescription ?? "",
            seoImageUrl:    data.seoImageUrl ?? "",
            businessType:   data.businessInfo ?? "",
          };
          setForm(loaded);
          savedRef.current = loaded;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !user?.id) return;
    setTrustLoading(true);
    fetch(`${BASE_URL}/api/sellers/${user.id}/trust`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setTrustData({
          trustScore:        data.liveBreakdown?.total ?? null,
          trustLevel:        data.trustLevel ?? "new",
          isVerified:        data.isVerified ?? false,
          verificationLevel: data.verificationLevel ?? "none",
          verifiedAt:        data.verifiedAt ?? null,
          components:        data.liveBreakdown?.components ?? undefined,
          details:           data.liveBreakdown?.details ?? undefined,
        });
      })
      .catch(() => {})
      .finally(() => setTrustLoading(false));
  }, [token, user?.id]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleTabChange = (tab: TabId) => {
    if (isDirty) { setPendingTab(tab); setShowUnsavedDialog(true); return; }
    setActiveTab(tab);
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setSlugError("");
    try {
      const res = await fetch(`${BASE_URL}/api/sellers/store/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeName:        form.storeName        || undefined,
          storeNameAr:      form.storeNameAr      || undefined,
          storeDescription: form.description      || undefined,
          descriptionAr:    form.descriptionAr    || undefined,
          storeSlug:        form.storeSlug        || undefined,
          storeCity:        form.city             || undefined,
          storeLogo:        form.storeLogo        || undefined,
          storeBanner:      form.storeBanner      || undefined,
          accentColor:      form.accentColor      || undefined,
          website:          form.website          || undefined,
          contactPhone:     form.contactPhone     || undefined,
          contactEmail:     form.contactEmail     || undefined,
          whatsapp:         form.whatsapp         || undefined,
          telegram:         form.telegram         || undefined,
          facebook:         form.facebook         || undefined,
          instagram:        form.instagram        || undefined,
          shippingPolicy:   form.shippingPolicy   || undefined,
          returnPolicy:     form.returnPolicy     || undefined,
          warrantyPolicy:   form.warrantyPolicy   || undefined,
          privacyPolicy:    form.privacyPolicy    || undefined,
          metaTitle:        form.metaTitle        || undefined,
          metaDescription:  form.metaDescription  || undefined,
          seoImageUrl:      form.seoImageUrl      || undefined,
        }),
      });

      if (res.status === 409) {
        setSlugError(t("store_settings.slug_taken_error"));
        setSaveStatus("failed");
        setActiveTab("advanced");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? t("store_settings.error"));
      }

      const updated = await res.json();
      const newSaved: StoreData = {
        ...form,
        storeSlug:   updated.storeSlug   ?? form.storeSlug,
        accentColor: updated.accentColor ?? form.accentColor,
      };
      setForm(newSaved);
      savedRef.current = newSaved;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);

      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetSellerDashboardQueryKey() }),
        qc.invalidateQueries({ predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.some(
            (k) => typeof k === "string" && (k.includes("store") || k.includes("seller"))
          ),
        }),
      ]);
      toast({ title: t("store_settings.saved") });
    } catch (e: any) {
      setSaveStatus("failed");
      setTimeout(() => setSaveStatus("idle"), 3000);
      toast({ title: e.message ?? t("store_settings.error"), variant: "destructive" });
    }
  };

  const { score: healthScore, items: healthItems } = computeHealth(form, trustData);

  const TABS: { id: TabId; labelKey: string; descKey: string; icon: React.ElementType; badge?: number }[] = [
    { id: "general",  labelKey: "tab_general",  descKey: "tab_desc_general",  icon: Store },
    { id: "branding", labelKey: "tab_branding", descKey: "tab_desc_branding", icon: Palette },
    { id: "contact",  labelKey: "tab_contact",  descKey: "tab_desc_contact",  icon: Phone },
    { id: "policies", labelKey: "tab_policies", descKey: "tab_desc_policies", icon: Shield },
    { id: "trust",    labelKey: "tab_trust",    descKey: "tab_desc_trust",    icon: BadgeCheck },
    { id: "seo",      labelKey: "tab_seo",      descKey: "tab_desc_seo",      icon: Search },
    {
      id: "health", labelKey: "tab_health", descKey: "tab_desc_health", icon: Activity,
      badge: healthScore < 80 ? healthItems.filter((i) => !i.ok).length : undefined,
    },
    { id: "advanced", labelKey: "tab_advanced", descKey: "tab_desc_advanced", icon: Settings2 },
  ];

  if (loading) {
    return (
      <Layout>
        <SellerNav />
        <div className="container max-w-4xl mx-auto py-8 px-4 space-y-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  const hasSlug = Boolean(form.storeSlug);

  return (
    <Layout>
      <SellerNav />

      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-5">

        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              {t("store_settings.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("store_settings.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Save status indicator */}
            {saveStatus === "saving" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("store_settings.autosave_saving")}
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t("store_settings.autosave_saved")}
              </span>
            )}
            {saveStatus === "failed" && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {t("store_settings.autosave_failed")}
              </span>
            )}
            {isDirty && saveStatus === "idle" && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("store_settings.unsaved_title")}
              </span>
            )}

            {hasSlug ? (
              <Link href={`/store/${form.storeSlug}`}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t("store_settings.view_public_store")}
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="gap-2 opacity-60">
                <ExternalLink className="h-4 w-4" />
                {t("store_settings.view_store_fallback")}
              </Button>
            )}

            <Button onClick={handleSave} disabled={saveStatus === "saving"} size="sm" className="gap-2">
              {saveStatus === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveStatus === "saving" ? t("store_settings.saving") : t("store_settings.save")}
            </Button>
          </div>
        </div>

        {/* ── Store Completion Banner ───────────────────────────── */}
        {healthScore < 100 && (
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("store_settings.completion_title")}</p>
                  <p className="text-3xl font-black text-foreground mt-0.5 tabular-nums">
                    {healthScore}%{" "}
                    <span className="text-xl font-semibold text-muted-foreground">{t("store_settings.completion_complete")}</span>
                  </p>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${healthScore}%`,
                      backgroundColor: healthScore >= 80 ? "#276221" : healthScore >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>
              {healthItems.filter((i) => !i.ok).length > 0 && (
                <div className="sm:min-w-[210px] space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("store_settings.completion_missing")}:</p>
                  <div className="space-y-1.5">
                    {healthItems.filter((i) => !i.ok).slice(0, 4).map((item) => (
                      <button
                        key={item.label}
                        onClick={() => handleTabChange(item.tab)}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-start group"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />
                        <span className="flex-1">{t(`store_settings.${item.label}`)}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">+{item.pts}pts</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleTabChange("health")}
                    className="mt-1 w-full px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all duration-150"
                  >
                    {t("store_settings.completion_cta")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab Navigation: responsive card grid (2→3→4 cols) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex flex-col items-start gap-2 p-3 sm:p-4 rounded-xl border text-start transition-all duration-200 group min-h-[76px] sm:min-h-0 ${
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:shadow-sm hover:bg-muted/20 active:scale-[0.98]"
                }`}
              >
                <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
                  isActive ? "bg-primary" : "bg-muted group-hover:bg-primary/10"
                }`}>
                  <Icon className={`h-[14px] w-[14px] sm:h-[18px] sm:w-[18px] transition-colors duration-200 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                  }`} />
                </div>
                <div className="min-w-0 w-full">
                  <p className={`text-xs font-semibold leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>
                    {t(`store_settings.${tab.labelKey}`)}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                    {t(`store_settings.${tab.descKey}`)}
                  </p>
                </div>
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute top-1.5 end-1.5 sm:top-2 sm:end-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ──────────────────────────────────────── */}

        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <SectionCard title={t("store_settings.identity_title")} icon={Store}>
              <div className="grid sm:grid-cols-2 gap-4">
                <FieldRow label={t("store_settings.store_name_label")} required>
                  <Input value={form.storeName} onChange={set("storeName")}
                    placeholder={t("store_settings.store_name_placeholder")} />
                </FieldRow>
                <FieldRow label={t("store_settings.store_name_ar_label")}>
                  <Input value={form.storeNameAr} onChange={set("storeNameAr")} dir="rtl"
                    placeholder={t("store_settings.store_name_ar_placeholder")} />
                </FieldRow>
              </div>

              <FieldRow label={t("store_settings.store_description_label")}>
                <Textarea value={form.description} onChange={set("description")} rows={3} className="resize-none"
                  placeholder={t("store_settings.store_description_placeholder")} />
                <p className="text-xs text-muted-foreground text-end">{form.description.length} / 500</p>
              </FieldRow>

              <FieldRow label={t("store_settings.store_description_ar_label")}>
                <Textarea value={form.descriptionAr} onChange={set("descriptionAr")} rows={3} className="resize-none" dir="rtl"
                  placeholder={t("store_settings.store_description_ar_placeholder")} />
              </FieldRow>

              <div className="grid sm:grid-cols-2 gap-4">
                <FieldRow label={t("store_settings.category_label")}>
                  <Input value={form.category} onChange={set("category")}
                    placeholder="Electronics, Fashion, Food..." />
                </FieldRow>
                <FieldRow label={t("store_settings.store_city_label")}>
                  <Input value={form.city} onChange={set("city")}
                    placeholder={t("store_settings.store_city_placeholder")} />
                </FieldRow>
              </div>
            </SectionCard>
          </div>
        )}

        {/* BRANDING TAB */}
        {activeTab === "branding" && (
          <div className="space-y-5">
            <SectionCard title={t("store_settings.branding_title")} icon={Palette}>
              <FieldRow label={t("store_settings.accent_color_label")} hint={t("store_settings.accent_color_hint")}>
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg border-2 border-border shrink-0 cursor-pointer overflow-hidden"
                    style={{ backgroundColor: form.accentColor || "#276221" }}
                  >
                    <input type="color" value={form.accentColor || "#276221"}
                      onChange={(e) => setVal("accentColor", e.target.value)}
                      className="opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <Input value={form.accentColor} onChange={set("accentColor")}
                    placeholder="#276221" className="flex-1 font-mono text-sm" />
                </div>
              </FieldRow>

              <FieldRow label={t("store_settings.store_logo_label")} hint={t("store_settings.store_logo_hint")}>
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {form.storeLogo ? (
                      <img src={form.storeLogo} alt="" className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    ) : (
                      <Image className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input value={form.storeLogo} onChange={set("storeLogo")}
                      placeholder={t("store_settings.store_logo_placeholder")} />
                    <p className="text-xs text-muted-foreground">{t("store_settings.store_logo_hint")}</p>
                  </div>
                </div>
              </FieldRow>

              <FieldRow label={t("store_settings.store_banner_label")} hint={t("store_settings.store_banner_hint")}>
                <div className="space-y-2">
                  <div className="w-full h-32 rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {form.storeBanner ? (
                      <img src={form.storeBanner} alt="" className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="text-center">
                        <Image className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">{t("store_settings.store_banner_hint")}</p>
                      </div>
                    )}
                  </div>
                  <Input value={form.storeBanner} onChange={set("storeBanner")}
                    placeholder={t("store_settings.store_banner_placeholder")} />
                </div>
              </FieldRow>

              {/* Live theme preview */}
              <div className="rounded-xl border p-4 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-3">Store Preview</p>
                <div className="rounded-xl overflow-hidden border bg-background">
                  <div className="h-20 relative" style={{ backgroundColor: form.accentColor + "22" }}>
                    {form.storeBanner && (
                      <img src={form.storeBanner} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="px-4 pb-3 -mt-6 flex items-end gap-3">
                    <div className="h-12 w-12 rounded-xl border-2 border-background bg-card shadow-md overflow-hidden flex items-center justify-center shrink-0"
                      style={{ borderColor: form.accentColor }}>
                      {form.storeLogo ? (
                        <img src={form.storeLogo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold" style={{ color: form.accentColor }}>
                          {(form.storeName || "S").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold">{form.storeName || "Store Name"}</p>
                      <p className="text-xs text-muted-foreground">{form.city || "City"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* CONTACT TAB */}
        {activeTab === "contact" && (
          <div className="space-y-5">
            <SectionCard title={t("store_settings.contact_title")} icon={Phone}>
              <div className="grid sm:grid-cols-2 gap-4">
                <FieldRow label={t("store_settings.contact_phone_label")}>
                  <div className="relative">
                    <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input value={form.contactPhone} onChange={set("contactPhone")} className="ps-9"
                      placeholder={t("store_settings.contact_phone_placeholder")} type="tel" />
                  </div>
                </FieldRow>
                <FieldRow label={t("store_settings.contact_email_label")}>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input value={form.contactEmail} onChange={set("contactEmail")} className="ps-9"
                      placeholder={t("store_settings.contact_email_placeholder")} type="email" />
                  </div>
                </FieldRow>
              </div>

              <FieldRow label={t("store_settings.website_label")}>
                <div className="relative">
                  <Globe className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input value={form.website} onChange={set("website")} className="ps-9"
                    placeholder={t("store_settings.website_placeholder")} type="url" />
                </div>
              </FieldRow>
            </SectionCard>

            <SectionCard title="Social Media" icon={MessageSquare}>
              <div className="grid sm:grid-cols-2 gap-4">
                <FieldRow label={t("store_settings.whatsapp_label")}>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-green-600 font-bold pointer-events-none">W</span>
                    <Input value={form.whatsapp} onChange={set("whatsapp")} className="ps-9"
                      placeholder={t("store_settings.whatsapp_placeholder")} type="tel" />
                  </div>
                </FieldRow>
                <FieldRow label={t("store_settings.telegram_label")}>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-blue-500 font-bold pointer-events-none">T</span>
                    <Input value={form.telegram} onChange={set("telegram")} className="ps-9"
                      placeholder={t("store_settings.telegram_placeholder")} />
                  </div>
                </FieldRow>
                <FieldRow label={t("store_settings.facebook_label")}>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 font-bold pointer-events-none">f</span>
                    <Input value={form.facebook} onChange={set("facebook")} className="ps-9"
                      placeholder={t("store_settings.facebook_placeholder")} />
                  </div>
                </FieldRow>
                <FieldRow label={t("store_settings.instagram_label")}>
                  <div className="relative">
                    <Instagram className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500 pointer-events-none" />
                    <Input value={form.instagram} onChange={set("instagram")} className="ps-9"
                      placeholder={t("store_settings.instagram_placeholder")} />
                  </div>
                </FieldRow>
              </div>
            </SectionCard>
          </div>
        )}

        {/* POLICIES TAB */}
        {activeTab === "policies" && (
          <div className="space-y-5">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{t("store_settings.policy_hint")}</p>
            </div>

            {(["shipping", "return", "warranty", "privacy"] as const).map((type) => {
              const key = `${type}Policy` as keyof StoreData;
              return (
                <SectionCard
                  key={type}
                  title={t(`store_settings.${type}_policy_label`)}
                  icon={Shield}
                  badge={
                    form[key] ? (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 me-1" />
                        {t("store_settings.autosave_saved")}
                      </Badge>
                    ) : undefined
                  }
                >
                  <Textarea
                    value={form[key] as string}
                    onChange={set(key)}
                    rows={5}
                    className="resize-y min-h-[120px]"
                    placeholder={t(`store_settings.${type}_policy_placeholder`)}
                  />
                  <p className="text-xs text-muted-foreground text-end">
                    {t("store_settings.policy_chars", { count: (form[key] as string).length })}
                  </p>
                </SectionCard>
              );
            })}
          </div>
        )}

        {/* TRUST TAB */}
        {activeTab === "trust" && (
          <div className="space-y-5">
            {trustLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
              </div>
            ) : trustData ? (
              <>
                <SectionCard title={t("store_settings.trust_score_label")} icon={BadgeCheck}
                  badge={
                    trustData.isVerified ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-0">
                        <BadgeCheck className="h-3 w-3 me-1" />
                        {t("store_settings.trust_verified_badge")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {t("store_settings.trust_not_verified")}
                      </Badge>
                    )
                  }
                >
                  <div className="flex items-center gap-6">
                    <div className="shrink-0">
                      <ScoreRing score={trustData.trustScore ?? 0} />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("store_settings.trust_level_label")}</p>
                        <p className="text-lg font-semibold capitalize">{trustData.trustLevel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("store_settings.trust_verified_badge")}</p>
                        <p className="text-sm font-medium capitalize">{trustData.verificationLevel}</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {trustData.components && (
                  <SectionCard title={t("store_settings.trust_breakdown_label")} icon={Activity}>
                    <div className="space-y-3">
                      {(
                        [
                          { key: "completedOrders",     label: "Completed Orders",    max: 30 },
                          { key: "storeRating",         label: "Store Rating",        max: 25 },
                          { key: "deliverySuccess",     label: "Delivery Success",    max: 20 },
                          { key: "reviewCount",         label: "Review Count",        max: 10 },
                          { key: "accountAge",          label: "Account Age",         max: 5  },
                          { key: "followers",           label: "Followers",           max: 5  },
                          { key: "cancellationPenalty", label: "Cancellation Penalty",max: 0  },
                          { key: "violationsPenalty",   label: "Violations Penalty",  max: 0  },
                        ] as const
                      ).map(({ key, label, max }) => {
                        const val = (trustData.components as Record<string, number>)[key] ?? 0;
                        const isNeg = val < 0;
                        const barPct = max > 0 ? Math.min(100, (Math.abs(val) / max) * 100) : 0;
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{label}</span>
                              <span className={`font-semibold tabular-nums ${isNeg ? "text-destructive" : val > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                {isNeg ? "" : (max > 0 ? "+" : "")}{val}{max > 0 ? ` / ${max}` : ""}
                              </span>
                            </div>
                            {max > 0 && (
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${barPct}%`, backgroundColor: isNeg ? "#ef4444" : "#276221" }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                <div className="flex justify-end">
                  <Link href="/seller/trust">
                    <Button variant="outline" size="sm" className="gap-2">
                      {t("store_settings.trust_go_to_page")}
                      <ChevronRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="bg-card border rounded-2xl p-8 text-center space-y-3">
                <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">{t("store_settings.trust_not_available")}</p>
                <Link href="/seller/trust">
                  <Button variant="outline" size="sm">{t("store_settings.trust_go_to_page")}</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* SEO TAB */}
        {activeTab === "seo" && (
          <div className="space-y-5">
            <SectionCard title="SEO" icon={Search}>
              <FieldRow label={t("store_settings.meta_title_label")} hint={t("store_settings.meta_title_hint")}>
                <Input value={form.metaTitle} onChange={set("metaTitle")}
                  placeholder={t("store_settings.meta_title_placeholder")} maxLength={80} />
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t("store_settings.meta_title_hint")}</span>
                  <span className={`text-xs ${form.metaTitle.length > 60 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {form.metaTitle.length}/80
                  </span>
                </div>
              </FieldRow>

              <FieldRow label={t("store_settings.meta_description_label")} hint={t("store_settings.meta_description_hint")}>
                <Textarea value={form.metaDescription} onChange={set("metaDescription")} rows={3} className="resize-none"
                  placeholder={t("store_settings.meta_description_placeholder")} maxLength={200} />
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{t("store_settings.meta_description_hint")}</span>
                  <span className={`text-xs ${form.metaDescription.length > 155 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {form.metaDescription.length}/200
                  </span>
                </div>
              </FieldRow>

              <FieldRow label={t("store_settings.seo_image_label")}>
                <Input value={form.seoImageUrl} onChange={set("seoImageUrl")}
                  placeholder={t("store_settings.seo_image_placeholder")} />
                {form.seoImageUrl && (
                  <div className="mt-2 w-full aspect-[1200/630] rounded-xl border overflow-hidden bg-muted/30">
                    <img src={form.seoImageUrl} alt="SEO preview" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </FieldRow>
            </SectionCard>

            {/* Live Search Preview */}
            <SectionCard title={t("store_settings.seo_preview_title")} icon={Search}>
              <div className="rounded-xl border bg-background p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{t("store_settings.seo_preview_url")}{form.storeSlug || "your-store"}</p>
                <p className="text-base font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                  {form.metaTitle || form.storeName || "Your Store Name"}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {form.metaDescription || form.description || "Your store description will appear here in search results."}
                </p>
              </div>
              {/* Open Graph preview */}
              {(form.seoImageUrl || form.storeBanner) && (
                <div className="rounded-xl border overflow-hidden bg-muted/20">
                  <div className="aspect-[1200/630] overflow-hidden">
                    <img src={form.seoImageUrl || form.storeBanner} alt=""
                      className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 border-t bg-background">
                    <p className="text-xs text-muted-foreground uppercase">syano.online</p>
                    <p className="text-sm font-medium">{form.metaTitle || form.storeName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{form.metaDescription || form.description}</p>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* HEALTH TAB */}
        {activeTab === "health" && (
          <div className="space-y-5">
            <div className="bg-card border rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={healthScore} />
                <div className="text-center sm:text-start">
                  <h2 className="text-2xl font-bold">
                    {healthScore >= 80 ? t("store_settings.health_excellent")
                      : healthScore >= 60 ? t("store_settings.health_good")
                      : healthScore >= 40 ? t("store_settings.health_fair")
                      : t("store_settings.health_needs_work")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">{t("store_settings.health_subtitle")}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-muted-foreground">
                      {healthItems.filter((i) => i.ok).length}/{healthItems.length} {t("store_settings.health_completed", "completed")}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {healthScore}/100 {t("store_settings.health_pts")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl overflow-hidden divide-y">
              {healthItems.map((item) => (
                <div key={item.label} className={`flex items-center justify-between px-5 py-4 gap-3 transition-colors ${item.ok ? "" : "hover:bg-muted/30"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {item.ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${item.ok ? "text-foreground" : "text-muted-foreground"}`}>
                        {t(`store_settings.${item.label}`)}
                      </span>
                    </div>
                  </div>
                  {item.ok ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">✓</span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                        +{item.pts}pts
                      </span>
                      <button
                        onClick={() => setActiveTab(item.tab)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold"
                      >
                        {t("store_settings.completion_cta")}
                        <ChevronRight className={`h-3 w-3 ${isRTL ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADVANCED TAB */}
        {activeTab === "advanced" && (
          <div className="space-y-5">
            <SectionCard title={t("store_settings.advanced_title")} icon={Settings2}>
              <p className="text-sm text-muted-foreground">{t("store_settings.advanced_info")}</p>

              <FieldRow label={t("store_settings.store_slug_label")}
                hint={hasSlug ? t("store_settings.store_slug_hint", { slug: form.storeSlug }) : t("store_settings.no_slug_hint")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">/store/</span>
                  <Input
                    value={form.storeSlug}
                    onChange={(e) => {
                      setSlugError("");
                      setVal("storeSlug",
                        e.target.value.toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-")
                          .replace(/^-|-$/g, "")
                      );
                    }}
                    placeholder={t("store_settings.store_slug_placeholder")}
                    className={`flex-1 ${slugError ? "border-destructive" : ""}`}
                  />
                </div>
                {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                {form.storeSlug && (
                  <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{t("store_settings.url_preview_label")}: </span>
                    <span className="font-mono text-primary">syano.online/store/{form.storeSlug}</span>
                  </div>
                )}
              </FieldRow>

              <FieldRow label={t("store_settings.advanced_business_type_label")}>
                <Input value={form.businessType} onChange={set("businessType")}
                  placeholder={t("store_settings.advanced_business_type_placeholder")} />
              </FieldRow>
            </SectionCard>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{t("store_settings.advanced_slug_warning")}</p>
            </div>
          </div>
        )}

        {/* Bottom save */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saveStatus === "saving"} className="gap-2 px-8">
            {saveStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveStatus === "saving" ? t("store_settings.saving") : t("store_settings.save")}
          </Button>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("store_settings.unsaved_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("store_settings.unsaved_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowUnsavedDialog(false);
              setPendingTab(null);
            }}>
              {t("store_settings.unsaved_stay")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setForm(savedRef.current);
                if (pendingTab) setActiveTab(pendingTab);
                setPendingTab(null);
                setShowUnsavedDialog(false);
              }}
            >
              {t("store_settings.unsaved_leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
