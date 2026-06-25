import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useGetDeliveryZones } from "@workspace/api-client-react";
import { LocationMapModal } from "@/components/LocationMapModal";
import { loadSavedZoneId, loadSavedCoords, ADDR_KEY as LOCATION_ADDR_KEY } from "@/lib/location-storage";
import {
  CheckCircle, Link2, ArrowLeft, ArrowRight, Facebook,
  User, Phone, MapPin, Home, Briefcase, MoreHorizontal,
  Loader2, Save, ChevronDown, Building2, Navigation,
} from "lucide-react";

interface SavedAddress {
  zoneId: number | null;
  street: string;
  building: string;
  type: "home" | "work" | "other";
}

function loadAddress(): SavedAddress {
  try {
    return JSON.parse(localStorage.getItem(LOCATION_ADDR_KEY) || "null") ?? { zoneId: null, street: "", building: "", type: "home" };
  } catch {
    return { zoneId: null, street: "", building: "", type: "home" };
  }
}

/* ── Section card wrapper ─────────────────────────────────────────── */
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {children}
    </section>
  );
}

/* ── Section header ───────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-emerald-500" />
      </div>
      <div>
        <h2 className="font-semibold text-base leading-tight">{title}</h2>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

/* ── Field wrapper ────────────────────────────────────────────────── */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground/80">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/60 transition-all";

export default function AccountPage() {
  const { user, isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  /* ── Delivery zones ───────────────────────────────────────────── */
  const { data: zones = [] } = useGetDeliveryZones();

  /* ── Location map modal ───────────────────────────────────────── */
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  /* ── Personal info state ──────────────────────────────────────── */
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState((user as { phone?: string } | undefined)?.phone ?? "");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  /* Sync when user loads */
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone((user as { phone?: string }).phone ?? "");
    }
  }, [user]);

  /* ── Address state ────────────────────────────────────────────── */
  const [addr, setAddr] = useState<SavedAddress>(loadAddress);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [savedCoords, setSavedCoords] = useState(loadSavedCoords);

  /* Sync when user confirms location from anywhere (Navbar modal or account modal) */
  useEffect(() => {
    const handler = (e: Event) => {
      const { zoneId, lat, lng } = (e as CustomEvent<{ zoneId: number | null; lat: number; lng: number }>).detail;
      setAddr(a => ({ ...a, zoneId }));
      setSavedCoords({ lat, lng });
    };
    window.addEventListener("syano:location-updated", handler);
    return () => window.removeEventListener("syano:location-updated", handler);
  }, []);

  const selectedZone = zones.find(z => z.id === addr.zoneId) ?? null;
  const zoneName = selectedZone
    ? (isRtl ? selectedZone.nameAr : selectedZone.nameEn)
    : t("account.zone_placeholder");

  /* ── Connected accounts ───────────────────────────────────────── */
  const googleConnected = !!(user as { googleId?: boolean } | undefined)?.googleId;
  const facebookConnected = !!(user as { facebookId?: boolean } | undefined)?.facebookId;
  const [facebookEnabled, setFacebookEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/auth/facebook-app-id")
      .then(r => setFacebookEnabled(r.ok))
      .catch(() => setFacebookEnabled(false));
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────── */
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError(t("account.name_min"));
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("syano_token");
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: trimmed, phone: phone.trim() || null }),
      });
      if (!res.ok) throw new Error("failed");
      toast({ title: t("account.save_success") });
    } catch {
      toast({ title: t("account.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrSaving(true);
    try {
      localStorage.setItem(LOCATION_ADDR_KEY, JSON.stringify(addr));
      toast({ title: t("account.address_saved"), description: t("account.address_saved_desc") });
    } finally {
      setAddrSaving(false);
    }
  }

  /* ── Not authenticated ────────────────────────────────────────── */
  if (!isAuthenticated || !user) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <User className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-muted-foreground">{t("account.login_required")}</p>
          <button
            onClick={openLogin}
            className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
          >
            {t("nav.login")}
          </button>
        </div>
      </Layout>
    );
  }

  const addressTypes = [
    { val: "home" as const, label: t("account.type_home"), icon: Home },
    { val: "work" as const, label: t("account.type_work"), icon: Briefcase },
    { val: "other" as const, label: t("account.type_other"), icon: MoreHorizontal },
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Back ────────────────────────────────────────────────── */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BackIcon className="h-4 w-4" />
          {t("account.back_home")}
        </Link>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <span style={{ fontSize: "1.375rem", fontWeight: 800 }} className="text-emerald-500">
              {user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("account.title")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{user.email ?? (user as { phone?: string }).phone}</p>
          </div>
        </div>

        {/* ══ SECTION 1 — PERSONAL INFORMATION ═══════════════════════ */}
        <SectionCard>
          <SectionHeader
            icon={User}
            title={t("account.personal_info")}
            desc={t("account.personal_info_desc")}
          />

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field label={t("account.full_name")} error={nameError}>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError(""); }}
                  placeholder={t("account.name_placeholder")}
                  className={`${inputCls} ps-9`}
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                  autoComplete="name"
                />
              </div>
            </Field>

            <Field label={t("account.phone")}>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t("account.phone_placeholder")}
                  className={`${inputCls} ps-9`}
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                  autoComplete="tel"
                  type="tel"
                  dir="ltr"
                />
              </div>
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                {saving
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{t("account.saving")}</>
                  : <><Save className="h-4 w-4" />{t("account.save_changes")}</>
                }
              </button>
              <div>
                <span className="text-xs text-muted-foreground">{t("auth.email")}: </span>
                <span className="text-xs font-medium">{user.email}</span>
              </div>
            </div>
          </form>
        </SectionCard>

        {/* ══ SECTION 2 — DELIVERY ADDRESS ════════════════════════════ */}
        <SectionCard>
          <SectionHeader
            icon={MapPin}
            title={t("account.address_title")}
            desc={t("account.address_desc")}
          />

          <form onSubmit={handleSaveAddress} className="space-y-4">

            {/* Pin on Map button */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="w-full flex items-center gap-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] hover:border-emerald-500/60 px-4 py-3 transition-all group"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                <Navigation className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <div style={{ textAlign: "start" }}>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {isRtl ? "تحديد موقعي على الخريطة" : "Pin my location on the map"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {savedCoords
                    ? `${savedCoords.lat.toFixed(4)}, ${savedCoords.lng.toFixed(4)}`
                    : (isRtl ? "اسحب الخريطة لتحديد موقعك الدقيق" : "Drag the map to set your exact spot")}
                </p>
              </div>
              <MapPin className="h-4 w-4 text-emerald-500 ms-auto shrink-0" />
            </button>

            {/* Zone selector */}
            <Field label={t("account.zone_label")}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setZoneOpen(!zoneOpen)}
                  className={`${inputCls} flex items-center justify-between gap-2 cursor-pointer`}
                  aria-haspopup="listbox"
                  aria-expanded={zoneOpen}
                >
                  <span className={selectedZone ? "text-foreground" : "text-muted-foreground"}>
                    {zoneName}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${zoneOpen ? "rotate-180" : ""}`} />
                </button>

                {zoneOpen && zones.length > 0 && (
                  <div
                    role="listbox"
                    className="absolute top-full mt-1.5 start-0 end-0 z-20 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
                    style={{ maxHeight: 240 }}
                  >
                    <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                      {zones.map(zone => (
                        <button
                          key={zone.id}
                          role="option"
                          aria-selected={zone.id === addr.zoneId}
                          type="button"
                          onClick={() => { setAddr(a => ({ ...a, zoneId: zone.id })); setZoneOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                            zone.id === addr.zoneId
                              ? "bg-emerald-500/10 text-emerald-600 font-semibold"
                              : "text-foreground/80 hover:bg-muted/60"
                          }`}
                          style={{ textAlign: isRtl ? "right" : "left" }}
                        >
                          <span>{isRtl ? zone.nameAr : zone.nameEn}</span>
                          {zone.id === addr.zoneId && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Field>

            {/* Street address */}
            <Field label={t("account.street")}>
              <div className="relative">
                <MapPin className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={addr.street}
                  onChange={e => setAddr(a => ({ ...a, street: e.target.value }))}
                  placeholder={t("account.street_placeholder")}
                  className={`${inputCls} ps-9`}
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                />
              </div>
            </Field>

            {/* Building / floor */}
            <Field label={t("account.building")}>
              <div className="relative">
                <Building2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  value={addr.building}
                  onChange={e => setAddr(a => ({ ...a, building: e.target.value }))}
                  placeholder={t("account.building_placeholder")}
                  className={`${inputCls} ps-9`}
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                />
              </div>
            </Field>

            {/* Address type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground/80">{t("account.address_type")}</label>
              <div className="flex gap-2 flex-wrap">
                {addressTypes.map(({ val, label, icon: Icon }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAddr(a => ({ ...a, type: val }))}
                    className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border text-sm font-medium transition-all ${
                      addr.type === val
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600"
                        : "border-border text-foreground/60 hover:border-border/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={addrSaving}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {addrSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />{t("account.saving")}</>
                : <><Save className="h-4 w-4" />{t("account.save_address")}</>
              }
            </button>
          </form>
        </SectionCard>

        {/* ══ SECTION 3 — CONNECTED ACCOUNTS ═════════════════════════ */}
        <SectionCard>
          <SectionHeader icon={Link2} title={t("account.connected_accounts")} />

          {/* Google */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.251 17.64 11.943 17.64 9.2z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Google</p>
                <p className="text-xs text-muted-foreground">{t("auth.google_provider_desc")}</p>
              </div>
            </div>
            {googleConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium shrink-0">
                <CheckCircle className="h-4 w-4" />
                <span>{isRtl ? "مرتبط" : "Connected"}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground shrink-0">
                {isRtl ? "غير مرتبط" : "Not connected"}
              </span>
            )}
          </div>

          {/* Facebook */}
          {facebookEnabled && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#1877F2] flex items-center justify-center shrink-0">
                  <Facebook className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Facebook</p>
                  <p className="text-xs text-muted-foreground">{t("auth.facebook_provider_desc")}</p>
                </div>
              </div>
              {facebookConnected ? (
                <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium shrink-0">
                  <CheckCircle className="h-4 w-4" />
                  <span>{isRtl ? "مرتبط" : "Connected"}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">
                  {isRtl ? "غير مرتبط" : "Not connected"}
                </span>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {isRtl
              ? "لربط حساب، سجّل خروجك ثم استخدم زر «المتابعة مع Google» عند تسجيل الدخول مجدداً."
              : "To connect an account, log out and use \"Continue with Google\" when signing back in."}
          </p>
        </SectionCard>

      </div>

      {/* Location Map Modal */}
      <LocationMapModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </Layout>
  );
}
