import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Users, User, Package, ShoppingCart, Settings,
  LogOut, Shield, ChevronRight, ScrollText, Menu, Store,
  Home as HomeIcon, BarChart2, Globe, Sun, Moon, DollarSign, Truck, Sparkles, SearchIcon,
  HeadphonesIcon, ClipboardList, Wifi, MapPin, Radio, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { applyDirection } from "@/i18n";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  badgeKey?: string;
};

type NavGroup = {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "orders_sales",
    labelKey: "admin.nav.group.orders_sales",
    icon: ShoppingCart,
    items: [
      { href: "/admin/orders",              icon: ShoppingCart,  labelKey: "admin.nav_orders",           badgeKey: "orders" },
      { href: "/admin/analytics",           icon: BarChart2,     labelKey: "admin.nav_analytics" },
      { href: "/admin/products",            icon: Package,       labelKey: "admin.nav_products" },
      { href: "/admin/sellers",             icon: Store,         labelKey: "admin.nav_sellers",          badgeKey: "sellers" },
      { href: "/admin/courier-applications",icon: User,          labelKey: "courier_applications.nav",   badgeKey: "couriers" },
    ],
  },
  {
    key: "delivery",
    labelKey: "admin.nav.group.delivery",
    icon: Truck,
    items: [
      { href: "/admin/delivery",            icon: Truck,         labelKey: "delivery.nav" },
      { href: "/admin/delivery-missions",   icon: ClipboardList, labelKey: "delivery_missions.nav" },
      { href: "/admin/courier-locations",   icon: MapPin,        labelKey: "courier_locations.nav" },
      { href: "/admin/tracking-monitor",    icon: Radio,         labelKey: "tracking_monitor.nav" },
      { href: "/admin/courier-availability",icon: Wifi,          labelKey: "courier_availability.nav" },
    ],
  },
  {
    key: "users_roles",
    labelKey: "admin.nav.group.users_roles",
    icon: Users,
    items: [
      { href: "/admin/users",               icon: Users,         labelKey: "admin.nav_users" },
    ],
  },
  {
    key: "reports",
    labelKey: "admin.nav.group.reports",
    icon: BarChart2,
    items: [
      { href: "/admin/search-analytics",    icon: SearchIcon,    labelKey: "admin.nav.searchAnalytics" },
      { href: "/admin/support",             icon: HeadphonesIcon,labelKey: "support.admin_nav",          badgeKey: "support" },
    ],
  },
  {
    key: "settings",
    labelKey: "admin.nav.group.settings",
    icon: Settings,
    items: [
      { href: "/admin/settings",            icon: Settings,      labelKey: "admin.nav_settings" },
      { href: "/admin/logs",                icon: ScrollText,    labelKey: "admin.nav_logs" },
    ],
  },
  {
    key: "platform_tools",
    labelKey: "admin.nav.group.platform_tools",
    icon: Shield,
    items: [
      { href: "/admin/verification",        icon: Shield,        labelKey: "admin.verification_title" },
      { href: "/admin/hero-banners",         icon: Sparkles,      labelKey: "admin.hero_banners.title" },
    ],
  },
];

function isItemActive(href: string, location: string): boolean {
  if (href === "/admin") return location === "/admin";
  return location === href || location.startsWith(href + "/");
}

function isGroupActive(group: NavGroup, location: string): boolean {
  return group.items.some((item) => isItemActive(item.href, location));
}

function groupTotalBadge(group: NavGroup, badges: Record<string, number> | undefined): number {
  if (!badges) return 0;
  return group.items.reduce((sum, item) => sum + (item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0), 0);
}

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const { user, logout, token } = useAuth();
  const { t, i18n } = useTranslation();
  const { setTheme, theme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [location] = useLocation();
  const lang = i18n.language;

  const switchLanguage = (l: string) => {
    i18n.changeLanguage(l);
    applyDirection(l);
  };

  const { data: badges } = useQuery({
    queryKey: ["admin-sidebar-badges"],
    queryFn: async () => {
      const h = { Authorization: `Bearer ${token}` };
      const [statsRes, extRes, couriersRes, supportRes] = await Promise.all([
        fetch("/api/admin/stats",          { headers: h }),
        fetch("/api/admin/stats/extended", { headers: h }),
        fetch("/api/admin/couriers",       { headers: h }),
        fetch("/api/admin/support/stats",  { headers: h }),
      ]);
      const stats        = await statsRes.json();
      const ext          = await extRes.json();
      const couriers     = await couriersRes.json();
      const supportStats = supportRes.ok ? await supportRes.json() : {};
      const pendingCouriers = Array.isArray(couriers)
        ? couriers.filter((c: { status: string }) => c.status === "pending").length
        : 0;
      return {
        orders:   (stats.ordersByStatus ?? []).find((s: { status: string }) => s.status === "pending")?.count ?? 0,
        sellers:  ext.pendingSellerApps ?? 0,
        couriers: pendingCouriers,
        support:  (supportStats.open ?? 0) + (supportStats.pending ?? 0),
      } as Record<string, number>;
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Open state: auto-expand the active group; user can toggle others
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      init[g.key] = isGroupActive(g, location);
    }
    return init;
  });

  // Auto-expand active group on route change
  useEffect(() => {
    for (const g of NAV_GROUPS) {
      if (isGroupActive(g, location)) {
        setOpenGroups((prev) => ({ ...prev, [g.key]: true }));
        break;
      }
    }
  }, [location]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDashboardActive = location === "/admin";

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/syano-logo.png"
            alt="Syano"
            width={32}
            height={32}
            className="h-8 w-8 object-contain shrink-0 drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
            loading="eager"
            decoding="async"
          />
          <div>
            <p className="font-bold text-sm text-foreground leading-none">{t("admin.title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("admin.subtitle")}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">

        {/* ── Dashboard (standalone) ─────────────────────────── */}
        <Link href="/admin" onClick={onNavClick}>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
              isDashboardActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t("admin.nav.group.dashboard")}</span>
            {isDashboardActive && <ChevronRight className="h-3.5 w-3.5 opacity-60 shrink-0" />}
          </div>
        </Link>

        {/* ── Accordion groups ───────────────────────────────── */}
        {NAV_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          const isOpen    = openGroups[group.key] ?? false;
          const active    = isGroupActive(group, location);
          const totalBadge = groupTotalBadge(group, badges);

          return (
            <div key={group.key} className="space-y-0.5">
              {/* Group header button */}
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  active && !isOpen
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-start leading-snug">{t(group.labelKey)}</span>
                {/* Badge on collapsed groups with pending items */}
                {!isOpen && totalBadge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 bg-rose-500 text-white">
                    {totalBadge > 99 ? "99+" : totalBadge}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    isOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              {/* Collapsible children — CSS grid trick for smooth animation */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                  transition: "grid-template-rows 200ms ease",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div className="ps-3 space-y-0.5 pb-1">
                    {group.items.map(({ href, icon: Icon, labelKey, badgeKey }) => {
                      const itemActive = isItemActive(href, location);
                      const badgeCount = badgeKey ? (badges?.[badgeKey] ?? 0) : 0;
                      return (
                        <Link key={href} href={href} onClick={onNavClick}>
                          <div
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                              itemActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="flex-1">{t(labelKey)}</span>
                            {badgeCount > 0 ? (
                              <span
                                className={cn(
                                  "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                                  itemActive ? "bg-white/25 text-white" : "bg-rose-500 text-white"
                                )}
                              >
                                {badgeCount > 99 ? "99+" : badgeCount}
                              </span>
                            ) : (
                              itemActive && <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Preferences ──────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
          {t("nav.preferences")}
        </p>

        {/* Language */}
        <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-2 px-1 py-1.5 min-h-[36px]">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("language.label")}</span>
          <div className="flex gap-1">
            {["en", "ar"].map((l) => (
              <button
                key={l}
                onClick={() => switchLanguage(l)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap",
                  lang === l
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-2 px-1 py-1.5 min-h-[36px]">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("currency.label")}</span>
          <div className="flex gap-1">
            {(["USD", "SYP"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold transition-colors whitespace-nowrap",
                  currency === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-2 px-1 py-1.5 min-h-[36px]">
          <Sun className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("theme.toggle")}</span>
          <div className="flex gap-1">
            {(["light", "dark", "system"] as const).map((tm) => (
              <button
                key={tm}
                onClick={() => setTheme(tm)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors whitespace-nowrap",
                  theme === tm
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tm[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate" translate="no">{user?.email}</p>
          </div>
        </div>
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10 gap-2 mb-1"
          >
            <HomeIcon className="h-4 w-4" />
            {t("admin.home_btn")}
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { setTheme, theme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const isRtl = i18n.language === "ar";
  const lang = i18n.language;
  const [mobileOpen, setMobileOpen] = useState(false);

  const switchLanguage = (l: string) => {
    i18n.changeLanguage(l);
    applyDirection(l);
  };

  return (
    <div className="min-h-screen bg-background flex" dir={isRtl ? "rtl" : "ltr"}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-card border-e border-border flex-col">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 h-14 px-3 border-b bg-card shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? "right" : "left"} className="w-[min(260px,70vw)] p-0" aria-describedby={undefined}>
              <SheetTitle className="sr-only">{t("admin.title")}</SheetTitle>
              <SidebarContent onNavClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-sm truncate">{t("admin.title")}</span>
          </div>

          {/* Mobile top-bar switchers */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-semibold text-muted-foreground"
              onClick={() => switchLanguage(lang === "ar" ? "en" : "ar")}
              title={t("language.label")}
            >
              <Globe className="h-3.5 w-3.5 me-1" />
              {lang.toUpperCase()}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap"
              onClick={() => setCurrency(currency === "USD" ? "SYP" : "USD")}
              title={t("currency.label")}
            >
              <span translate="no">{currency === "SYP" ? "ل.س" : "$"}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
              title={t("theme.toggle")}
            >
              <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-[transform,opacity] duration-150 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-[transform,opacity] duration-150 dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>

        <main id="main-content" className="flex-1 overflow-auto" data-scroll-container>
          {children}
        </main>
      </div>
    </div>
  );
}
