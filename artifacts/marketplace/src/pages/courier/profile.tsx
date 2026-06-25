/**
 * CourierProfile — Phase W10 + Preferences (Theme / Language / Currency)
 * Separate page: vehicle information, availability settings, preferences, logout.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import {
  Truck, User, Star, DollarSign, CheckCircle2,
  Wifi, WifiOff, Package, Settings, LogOut,
  RefreshCw, Phone, MapPin, ChevronRight, Home,
  Sun, Moon, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyDirection } from "@/i18n";

// ── Types ────────────────────────────────────────────────────────────────────
interface CourierProfile {
  id: number;
  status: "pending" | "approved" | "suspended";
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
}
interface CourierAvailability {
  courierId: number;
  availabilityStatus: "ONLINE" | "OFFLINE" | "BUSY";
  isAcceptingDeliveries: boolean;
  lastAvailabilityChangeAt: string | null;
}

// ── Courier Nav ───────────────────────────────────────────────────────────────
function CourierNav({ active }: { active: "workspace" | "history" | "earnings" | "profile" }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",          icon: Truck,        labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",   icon: CheckCircle2, labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings",  icon: DollarSign,   labelKey: "courier.nav_earnings" },
    { id: "profile",   href: "/courier/profile",   icon: User,         labelKey: "courier.nav_profile" },
  ] as const;
  return (
    <nav className="flex border-t bg-card shrink-0">
      {items.map(({ id, href, icon: Icon, labelKey }) => (
        <Link key={id} href={href} className={cn(
          "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
          active === id
            ? "text-emerald-600 dark:text-emerald-400 border-t-2 border-emerald-500"
            : "text-muted-foreground hover:text-foreground",
        )}>
          <Icon className="h-4 w-4" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}

// ── Segmented Picker ─────────────────────────────────────────────────────────
function SegmentPicker({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-all",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Pref Row ─────────────────────────────────────────────────────────────────
function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4">
      <span className="text-sm font-medium shrink-0">{label}</span>
      <div className="flex-1 max-w-[200px]">{children}</div>
    </div>
  );
}

export default function CourierProfilePage() {
  const { t, i18n } = useTranslation();
  const { token, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [toggling, setToggling] = useState(false);

  // ── Preferences hooks ───────────────────────────────────────────────────
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const currentTheme = (theme as "system" | "light" | "dark") ?? "system";
  const currentLang  = i18n.language?.startsWith("ar") ? "ar" : "en";

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<CourierProfile>({
    queryKey: ["courier-profile"],
    queryFn: async () => {
      const res = await fetch("/api/couriers/profile", { headers });
      if (res.status === 404) throw new Error("no_profile");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { data: availability, refetch: refetchAvailability } = useQuery<CourierAvailability>({
    queryKey: ["courier-availability"],
    queryFn: async () => {
      const res = await fetch("/api/courier/availability", { headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token && profile?.status === "approved",
    refetchInterval: 30_000,
  });

  const toggleAvailability = async () => {
    if (!availability) return;
    const current = availability.availabilityStatus;
    if (current === "BUSY") {
      toast({ title: t("courier.busy_cannot_toggle"), variant: "destructive" });
      return;
    }
    const newStatus = current === "ONLINE" ? "OFFLINE" : "ONLINE";
    setToggling(true);
    try {
      const res = await fetch("/api/courier/availability", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      refetchAvailability();
      toast({
        title: newStatus === "ONLINE"
          ? t("courier_availability.toggle_on")
          : t("courier_availability.toggle_off"),
      });
    } catch {
      toast({ title: t("courier_availability.toggle_error"), variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const switchLanguage = (lang: "ar" | "en") => {
    i18n.changeLanguage(lang);
    applyDirection(lang);
  };

  const avStatus = availability?.availabilityStatus ?? "OFFLINE";
  const isOnline = avStatus === "ONLINE";
  const isBusy   = avStatus === "BUSY";

  const vehicleEmoji: Record<string, string> = {
    motorcycle: "🏍️",
    scooter: "🛵",
    car: "🚗",
    bicycle: "🚲",
  };

  const themeOptions: { value: "system" | "light" | "dark"; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: t("theme.system"), icon: <Monitor className="h-3 w-3" /> },
    { value: "light",  label: t("theme.light"),  icon: <Sun  className="h-3 w-3" /> },
    { value: "dark",   label: t("theme.dark"),   icon: <Moon className="h-3 w-3" /> },
  ];

  const langOptions: { value: "ar" | "en"; label: string }[] = [
    { value: "ar", label: t("language.ar") },
    { value: "en", label: t("language.en") },
  ];

  const currencyOptions: { value: "SYP" | "USD"; label: string }[] = [
    { value: "SYP", label: t("currency.syp") },
    { value: "USD", label: t("currency.usd") },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b bg-card shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">{t("courier.profile_title")}</h1>
          <p className="text-xs text-muted-foreground">{t("courier.profile_subtitle")}</p>
        </div>
        <button type="button" onClick={() => { refetchProfile(); refetchAvailability(); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {profileLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        )}

        {profile && (
          <>
            {/* Courier avatar / identity */}
            <div className="bg-card border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-2xl shrink-0">
                {vehicleEmoji[profile.vehicleType] ?? "🚚"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base truncate">{t(`delivery.vehicle_${profile.vehicleType}`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("courier.profile_subtitle")}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {profile.rating != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                      <Star className="h-3 w-3 fill-current" />
                      {profile.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    {profile.completedDeliveries} {t("courier.perf_total_deliveries")}
                  </span>
                </div>
              </div>
            </div>

            {/* Availability toggle */}
            <div className={cn(
              "bg-card border rounded-2xl p-4 shadow-sm transition-all",
              isOnline ? "ring-2 ring-emerald-500/30 border-emerald-500/20"
              : isBusy  ? "ring-2 ring-amber-500/30 border-amber-500/20"
              : "border-border",
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    isOnline ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : isBusy  ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-muted",
                  )}>
                    {isOnline ? <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    : isBusy  ? <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t("courier_availability.toggle_label")}</p>
                    <p className={cn("text-xs font-bold mt-0.5",
                      isOnline ? "text-emerald-600 dark:text-emerald-400"
                      : isBusy  ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                    )}>
                      {isOnline ? t("courier_availability.status_online")
                      : isBusy  ? t("courier_availability.status_busy")
                      : t("courier_availability.status_offline")}
                    </p>
                  </div>
                </div>
                {isBusy ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                    {t("courier.busy_on_delivery")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={toggleAvailability}
                    disabled={toggling}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                      isOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
                      toggling && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200",
                      isOnline ? "translate-x-5" : "translate-x-0",
                    )} />
                  </button>
                )}
              </div>
            </div>

            {/* Vehicle information */}
            <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{t("courier.vehicle_info")}</h3>
              </div>
              <InfoRow icon={<Truck className="h-4 w-4" />} label={t("courier.vehicle_label")}>
                {vehicleEmoji[profile.vehicleType] ?? ""} {t(`delivery.vehicle_${profile.vehicleType}`)}
              </InfoRow>
              <InfoRow icon={<Phone className="h-4 w-4" />} label={t("courier.phone_label")}>
                <span translate="no">{profile.phone}</span>
              </InfoRow>
              {profile.district && (
                <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("courier.district_label")}>
                  {profile.district}
                </InfoRow>
              )}
            </div>

            {/* Go to workspace */}
            <Link href="/courier" className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors">
              <Truck className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium flex-1">{t("courier.go_to_workspace")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            {/* Performance Center */}
            <Link href="/courier/performance" className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium flex-1">{t("perf.title")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            {/* ── Preferences ─────────────────────────────────────────── */}
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{t("courier.preferences")}</h3>
              </div>

              {/* Theme */}
              <PrefRow label={t("theme.toggle")}>
                <SegmentPicker
                  options={themeOptions}
                  value={currentTheme}
                  onChange={(v) => setTheme(v as "system" | "light" | "dark")}
                />
              </PrefRow>

              <div className="mx-4 border-t" />

              {/* Language */}
              <PrefRow label={t("language.label")}>
                <SegmentPicker
                  options={langOptions}
                  value={currentLang}
                  onChange={(v) => switchLanguage(v as "ar" | "en")}
                />
              </PrefRow>

              <div className="mx-4 border-t" />

              {/* Currency */}
              <PrefRow label={t("currency.label")}>
                <SegmentPicker
                  options={currencyOptions}
                  value={currency}
                  onChange={(v) => setCurrency(v as "SYP" | "USD")}
                />
              </PrefRow>

              <div className="pb-2" />
            </div>

            {/* ── Home button ──────────────────────────────────────────── */}
            <Link
              href="/"
              className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <Home className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium flex-1 text-primary">{t("courier.home_btn")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            {/* Logout */}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/20"
            >
              <LogOut className="h-4 w-4" />
              {t("courier.logout")}
            </Button>
          </>
        )}
      </div>

      <CourierNav active="profile" />
    </div>
  );
}

function InfoRow({ icon, label, children }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}
