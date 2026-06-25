// @refresh reset
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useGuestCart } from "@/contexts/GuestCartContext";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ShoppingCart, LogOut, LayoutDashboard, Search, X, Globe, Sun, Moon, DollarSign,
  Menu, Home, Package, ClipboardList, Warehouse, Clock, MessageCircle,
  Users, Store, BarChart2, ScrollText, Settings, Heart, ChevronDown, Bike,
  TrendingUp, Layers, MapPin, User,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useGetCart, getGetCartQueryKey, useGetUnreadCount, useGetDeliveryZones } from "@workspace/api-client-react";
import { LocationMapModal } from "@/components/LocationMapModal";
import { loadSavedZoneId } from "@/lib/location-storage";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useWishlist } from "@/contexts/WishlistContext";
import { useTranslation } from "react-i18next";
import { applyDirection } from "@/i18n";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useSearchSuggestions, useSearchTrending, trackSearchClick } from "@/hooks/use-search";

/* ── MobileNavLink ─────────────────────────────────────────────────────────── */
interface MobileNavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  location: string;
  onClose: () => void;
  isDark?: boolean;
}

const MobileNavLink = React.memo(function MobileNavLink({ href, icon: Icon, label, location, onClose, isDark = true }: MobileNavLinkProps) {
  const inactiveCls = isDark
    ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
    : "text-foreground/65 hover:text-foreground hover:bg-foreground/[0.05]";
  return (
    <Link href={href} onClick={onClose}>
      <div className={cn(
        "flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
        location === href || (href !== "/" && location.startsWith(href))
          ? "bg-emerald-500/10 text-emerald-400"
          : inactiveCls,
      )}>
        <Icon className="h-5 w-5 shrink-0" />
        {label}
      </div>
    </Link>
  );
});

export function Navbar() {
  const [location, navigate] = useLocation();
  const { user, logout, isAuthenticated, isCustomer, isSeller, isAdmin, isCourier } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  const { count: wishlistCount } = useWishlist();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRtl = lang === "ar";
  const isDark = resolvedTheme === "dark";

  /* ── Theme-aware nav tokens ──────────────────────────────────────────── */
  const navFg         = isDark ? "text-white"          : "text-foreground";
  const navFgMuted    = isDark ? "text-white/50"        : "text-foreground/70";
  const navFgSub      = isDark ? "text-white/45"        : "text-foreground/60";
  const navActiveFg   = isDark ? "text-emerald-400"     : "text-emerald-600";
  const navHoverFg    = isDark ? "hover:text-white"     : "hover:text-foreground";
  const navHoverFgMid = isDark ? "hover:text-white/80"  : "hover:text-foreground/80";
  const navHoverBg    = isDark ? "hover:bg-white/[0.05]" : "hover:bg-foreground/[0.06]";
  const navDivider    = isDark ? "bg-white/[0.08]"      : "bg-foreground/[0.12]";
  const navBorder     = isDark ? "border-white/[0.08]"  : "border-foreground/[0.12]";
  const navBorderHov  = isDark ? "hover:border-white/[0.14]" : "hover:border-foreground/[0.2]";
  const navInputColor = isDark ? "rgba(255,255,255,0.75)" : "rgba(17,24,39,0.88)";
  const navSearchBg   = isDark
    ? "bg-white/[0.06] hover:bg-white/[0.08] focus-within:bg-white/[0.08] border border-white/[0.08] focus-within:border-white/[0.14]"
    : "bg-foreground/[0.05] hover:bg-foreground/[0.07] focus-within:bg-foreground/[0.07] border border-foreground/[0.14] focus-within:border-foreground/[0.25]";
  const navSearchIcon  = isDark ? "text-white/30"  : "text-foreground/45";
  const navXBtn        = isDark ? "text-white/30 hover:text-white/60"  : "text-foreground/45 hover:text-foreground/70";
  const navDropBg      = isDark ? "bg-[#111] border-white/[0.1]"       : "bg-popover border-border";
  const navDropText    = isDark ? "text-white/90"  : "text-foreground/90";
  const navDropSub     = isDark ? "text-white/35"  : "text-muted-foreground";
  const navDropMeta    = isDark ? "text-white/30"  : "text-foreground/40";
  const navDropRecent  = isDark ? "text-white/60"  : "text-foreground/70";
  const navSettingsBtn = isDark
    ? "text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.14]"
    : "text-foreground/65 hover:text-foreground hover:bg-foreground/[0.06] border border-foreground/[0.14] hover:border-foreground/[0.25]";
  const navUserBtn     = isDark
    ? "bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.09] hover:border-white/[0.15]"
    : "bg-foreground/[0.05] border border-foreground/[0.14] hover:bg-foreground/[0.09] hover:border-foreground/[0.22]";
  const navLoginLink   = isDark
    ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
    : "text-foreground/65 hover:text-foreground hover:bg-foreground/[0.06]";

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debouncedSearch = useDebounce(searchQuery, 200);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flatItemsRef = useRef<Array<{ id: string; action: () => void }>>([]);

  /* ── Location selector ─────────────────────────────────────────── */
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(loadSavedZoneId);
  const { data: zones = [] } = useGetDeliveryZones({ staleTime: 10 * 60 * 1000 });
  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("syano_recent_searches") || "[]"); } catch { return []; }
  });

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const switchLanguage = (l: string) => { i18n.changeLanguage(l); applyDirection(l); };

  useEffect(() => { applyDirection(i18n.language); }, [i18n.language]);
  useEffect(() => { if (searchOpen && inputRef.current) inputRef.current.focus(); }, [searchOpen]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Mobile scroll-lock: freeze page while search overlay is open ──────── */
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    if (searchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [searchOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Sync zone label when user confirms location from modal */
  useEffect(() => {
    const handler = (e: Event) => {
      const { zoneId } = (e as CustomEvent<{ zoneId: number | null }>).detail;
      setSelectedZoneId(zoneId);
    };
    window.addEventListener("syano:location-updated", handler);
    return () => window.removeEventListener("syano:location-updated", handler);
  }, []);

  const saveRecentSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const next = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 6);
      try { localStorage.setItem("syano_recent_searches", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try { localStorage.removeItem("syano_recent_searches"); } catch {}
  }, []);

  const removeRecentSearch = useCallback((q: string) => {
    setRecentSearches(prev => {
      const next = prev.filter(s => s !== q);
      try { localStorage.setItem("syano_recent_searches", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Reset highlight when query changes
  useEffect(() => { setHighlightedIndex(-1); }, [debouncedSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0) {
      const id = flatItemsRef.current[highlightedIndex]?.id;
      if (id) document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchOpen(false); setSearchQuery(""); setHighlightedIndex(-1); return;
    }
    const items = flatItemsRef.current;
    if (!searchOpen || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && items[highlightedIndex]) {
      e.preventDefault();
      items[highlightedIndex].action();
    }
  }, [searchOpen, highlightedIndex]);

  const { data: cart } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: isCustomer } });
  const cartItemCount = cart?.itemCount || 0;
  const { guestTotal } = useGuestCart();
  const visibleCartCount = isAuthenticated ? cartItemCount : guestTotal;
  const { data: unreadData } = useGetUnreadCount({ query: { queryKey: ["/api/conversations/unread-count"] as const, enabled: isAuthenticated, refetchInterval: 15_000 } });
  const unreadMsgCount = unreadData?.unread ?? 0;

  const { suggestions, isLoading: searchLoading } = useSearchSuggestions(debouncedSearch);
  const trendingSearches = useSearchTrending();

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim());
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  }, [searchQuery, navigate, saveRecentSearch]);

  const handleSuggestionTextClick = useCallback((text: string, type: "suggestion" | "category" | "store" = "suggestion") => {
    saveRecentSearch(text);
    trackSearchClick(text, type);
    navigate(`/shop?q=${encodeURIComponent(text)}`);
    setSearchOpen(false);
    setSearchQuery("");
  }, [navigate, saveRecentSearch]);

  // Sync navigable items to ref whenever suggestions / query / dropdown state changes
  useEffect(() => {
    if (!searchOpen) { flatItemsRef.current = []; return; }
    if (debouncedSearch.length < 2) {
      flatItemsRef.current = recentSearches.map((s, i) => ({
        id: `nav-opt-${i}`,
        action: () => { setSearchQuery(s); },
      }));
      return;
    }
    const suggs = (suggestions.suggestions ?? []).slice(0, 6);
    const strs  = (suggestions.stores  ?? []).slice(0, 3);
    const items: Array<{ id: string; action: () => void }> = [];
    suggs.forEach((s, i) => {
      const text = isRtl && s.textAr ? s.textAr : s.text;
      items.push({ id: `nav-opt-${i}`, action: () => handleSuggestionTextClick(text) });
    });
    strs.forEach((s, i) => {
      items.push({
        id: `nav-opt-${suggs.length + i}`,
        action: () => {
          trackSearchClick(s.storeName, "store");
          navigate(s.storeSlug ? `/store/${s.storeSlug}` : `/shop?sellerId=${s.userId}`);
          setSearchOpen(false); setSearchQuery("");
        },
      });
    });
    items.push({
      id: `nav-opt-${suggs.length + strs.length}`,
      action: () => {
        if (debouncedSearch.trim()) {
          saveRecentSearch(debouncedSearch.trim());
          navigate(`/shop?q=${encodeURIComponent(debouncedSearch.trim())}`);
          setSearchOpen(false); setSearchQuery("");
        }
      },
    });
    flatItemsRef.current = items;
  }, [searchOpen, debouncedSearch, suggestions, recentSearches, isRtl, handleSuggestionTextClick, navigate, saveRecentSearch]);

  const AUTH_PATHS = ["/login", "/register"];
  const isAuthPage = AUTH_PATHS.includes(location);

  const sellerLinks = useMemo(() => [
    { href: "/seller/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/seller/products", icon: Package, label: t("nav.products") },
    { href: "/seller/orders", icon: ClipboardList, label: t("nav.orders") },
    { href: "/seller/inventory", icon: Warehouse, label: t("nav.inventory") },
  ], [t]);

  const adminLinks = useMemo(() => [
    { href: "/admin", icon: LayoutDashboard, label: t("admin.nav_dashboard") },
    { href: "/admin/users", icon: Users, label: t("admin.nav_users") },
    { href: "/admin/sellers", icon: Store, label: t("admin.nav_sellers") },
    { href: "/admin/products", icon: Package, label: t("admin.nav_products") },
    { href: "/admin/orders", icon: ShoppingCart, label: t("admin.nav_orders") },
    { href: "/admin/analytics", icon: BarChart2, label: t("admin.nav_analytics") },
    { href: "/admin/logs", icon: ScrollText, label: t("admin.nav_logs") },
    { href: "/admin/settings", icon: Settings, label: t("admin.nav_settings") },
  ], [t]);

  const customerLinks = useMemo(() => [
    { href: "/customer/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { href: "/orders", icon: ClipboardList, label: t("nav.orders") },
  ], [t]);

  /* ── Header style: theme-aware glassmorphism ─────────────────────────────── */
  const headerStyle: React.CSSProperties = {
    background: scrolled
      ? "linear-gradient(135deg, #276221 0%, #1f5019 100%)"
      : "linear-gradient(135deg, #2d7028 0%, #276221 100%)",
    boxShadow: scrolled
      ? "0 4px 32px rgba(39,98,33,0.35), 0 1px 0 rgba(0,0,0,0.1)"
      : "0 2px 12px rgba(39,98,33,0.22)",
    transition: "background 0.3s ease, box-shadow 0.3s ease",
  };

  const navLinks = isRtl
    ? [
      { href: "/", label: "الرئيسية" },
      { href: "/shop", label: "تسوق" },
      { href: "/categories", label: "الفئات" },
      { href: "/sellers/directory", label: "المتاجر" },
      { href: "/shop?hasDiscount=true", label: "العروض" },
    ]
    : [
      { href: "/", label: "Home" },
      { href: "/shop", label: "Shop" },
      { href: "/categories", label: "Categories" },
      { href: "/sellers/directory", label: "Stores" },
      { href: "/shop?hasDiscount=true", label: "Deals" },
    ];

  // Slice helpers so index math is consistent between render & keyboard nav ref
  const _navSuggsSlice = (suggestions.suggestions ?? []).slice(0, 6);
  const _navStrsSlice  = (suggestions.stores  ?? []).slice(0, 3);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 w-full"
      style={{ ...headerStyle, fontFamily: "'Cairo', sans-serif" }}
    >
      {/* Safe area spacer for iOS notch */}
      <div aria-hidden="true" className="w-full md:hidden" style={{ height: "env(safe-area-inset-top, 0px)" }} />

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>

        {/* ══ MOBILE NAV (< md) ══════════════════════════════════════════════ */}
        {/* Mobile top bar is always on the SYANO green background — icons must always be white */}
        <div className="md:hidden flex h-[3.75rem] items-center justify-between px-4 gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Syano home">
            <img src="/syano-logo.png" alt="" width={30} height={30}
              className="h-[1.875rem] w-[1.875rem] object-contain drop-shadow-[0_0_10px_rgba(39,98,33,0.8)]" loading="eager" />
            <span style={{ fontWeight: 800, letterSpacing: "0.1em", fontSize: "1rem" }} className="text-white uppercase">SYANO</span>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            {!isAuthPage && (
              <button onClick={() => setSearchOpen(!searchOpen)}
                aria-label={t("a11y.search")}
                aria-expanded={searchOpen}
                className="h-10 w-10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <Search className="h-[1.0625rem] w-[1.0625rem]" />
              </button>
            )}
            {isAuthenticated && <NotificationCenter btnClassName="h-10 w-10 text-white/60 hover:text-white transition-colors" />}
            {isAuthenticated && !isCourier && (
              <Link
                href={isAdmin ? "/admin/messages" : isSeller ? "/seller/messages" : "/messages"}
                className="relative h-10 w-10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                aria-label={isRtl ? "الرسائل" : "Messages"}
              >
                <MessageCircle className="h-[1.0625rem] w-[1.0625rem]" />
                {unreadMsgCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex h-[1rem] w-[1rem] items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white pointer-events-none">
                    {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                  </span>
                )}
              </Link>
            )}
            {!isSeller && !isAdmin && !isCourier && (
              <Link href="/wishlist" aria-label={t("a11y.wishlist")} className="relative h-10 w-10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <Heart className="h-[1.0625rem] w-[1.0625rem]" />
                {wishlistCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 flex h-[1rem] w-[1rem] items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                    {wishlistCount > 99 ? "99+" : wishlistCount}
                  </span>
                )}
              </Link>
            )}
            {!isSeller && !isAdmin && !isCourier && (
              <Link href="/cart" aria-label={t("a11y.openCart")} className="relative h-10 w-10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <ShoppingCart className="h-[1.0625rem] w-[1.0625rem]" />
                {visibleCartCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 flex h-[1rem] w-[1rem] items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                    {visibleCartCount}
                  </span>
                )}
              </Link>
            )}
            <SheetTrigger asChild>
              <button aria-label={t("a11y.openMenu")} className="h-10 w-10 flex items-center justify-center text-white/60 hover:text-white transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
          </div>
        </div>

        {/* Mobile search: replaced by full-screen portal overlay below */}

        {/* ══ DESKTOP NAV (≥ md) ═════════════════════════════════════════════ */}
        <div
          className="container ps-0 hidden md:grid h-[3.75rem] items-center gap-3"
          style={{ gridTemplateColumns: "auto 1fr auto" }}
          dir={isRtl ? "rtl" : "ltr"}
        >

          {/* ── COL 1 → LOGO + LOCATION SELECTOR ─────────────────────────────── */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <img src="/syano-logo.png" alt="Syano" width={46} height={46}
                className="h-[2.875rem] w-[2.875rem] object-contain group-hover:scale-105 transition-transform duration-200"
                style={{ filter: "brightness(1.25) contrast(1.15) drop-shadow(0 2px 8px rgba(0,0,0,0.55))" }}
                loading="eager" />
              <div>
                <div style={{ fontWeight: 900, letterSpacing: "0.1em", fontSize: "1.125rem", lineHeight: 1, color: "white" }} className="uppercase">SYANO</div>
                <div style={{ fontWeight: 500, fontSize: "9px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.82)" }} className="uppercase mt-0.5">سوق سوريا</div>
              </div>
            </Link>

            {/* ── Location button → opens interactive Map Modal ─────────────── */}
            {!isAuthPage && (
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="hidden lg:flex items-center gap-1.5 h-10 ps-2.5 pe-3 rounded-xl border ms-1 transition-all duration-150 bg-white/[0.08] border-white/[0.12] hover:bg-white/[0.13] hover:border-white/[0.22] group"
                aria-label={isRtl ? "تحديد موقع التوصيل" : "Set delivery location"}
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-300 shrink-0 group-hover:scale-110 transition-transform" />
                <div style={{ textAlign: "start" }}>
                  <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.06em", color: "rgba(255,255,255,0.5)", lineHeight: 1.2 }}>
                    {t("nav.deliver_to")}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.9)", lineHeight: 1.3, maxWidth: 110 }} className="truncate">
                    {selectedZone
                      ? (isRtl ? selectedZone.nameAr : selectedZone.nameEn)
                      : t("nav.select_location")}
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* ── COL 2 → CENTER: Search bar ───────────────────────────────────── */}
          {!isAuthPage ? (
            <div ref={searchRef} className="relative flex justify-center">
              <div className="relative w-full">
                <form onSubmit={handleSearchSubmit}>
                  <div
                    className="flex items-center gap-3 rounded-xl h-[2.625rem] px-4 transition-all duration-200"
                    style={{
                      background: "white",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.12), inset 0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <Search className="w-[1.125rem] h-[1.125rem] text-emerald-600 shrink-0" />
                    <input
                      ref={inputRef}
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={isRtl ? "ابحث عن منتجات، متاجر، فئات..." : "Search products, stores, categories..."}
                      role="combobox"
                      aria-expanded={searchOpen}
                      aria-autocomplete="list"
                      aria-controls="nav-search-listbox"
                      aria-activedescendant={highlightedIndex >= 0 ? (flatItemsRef.current[highlightedIndex]?.id ?? undefined) : undefined}
                      style={{ fontFamily: "'Cairo', sans-serif", fontSize: "0.9375rem", background: "transparent", outline: "none", border: "none", color: "#111827", flex: 1, minWidth: 0 }}
                    />
                    {searchQuery && (
                      <button type="button" aria-label={t("a11y.close")} onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>

                {searchOpen && (debouncedSearch.length >= 2 || recentSearches.length > 0 || trendingSearches.length > 0) && (
                  <div id="nav-search-listbox" role="listbox" className={`absolute top-full mt-2 inset-x-0 w-screen max-w-sm sm:min-w-[22rem] ${navDropBg} rounded-2xl shadow-2xl z-50 overflow-hidden`}>
                    {debouncedSearch.length >= 2 ? (
                      searchLoading ? (
                        <div className="py-2">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 animate-pulse">
                              <div className={`h-3.5 w-3.5 rounded-full shrink-0 ${isDark ? "bg-white/[0.08]" : "bg-foreground/[0.08]"}`} />
                              <div className={`h-3 rounded ${isDark ? "bg-white/[0.08]" : "bg-foreground/[0.08]"}`} style={{ width: `${50 + i * 18}%` }} />
                            </div>
                          ))}
                        </div>
                      ) : (suggestions.suggestions?.length ?? 0) === 0 && (suggestions.stores?.length ?? 0) === 0 && (suggestions.categories?.length ?? 0) === 0 ? (
                        <div className={`p-4 text-sm ${navDropMeta} text-center`}>{isRtl ? "لا توجد نتائج" : "No results found"}</div>
                      ) : (
                        <div className="py-1 max-h-[22rem] overflow-y-auto">

                          {/* ── Suggested searches ── */}
                          {(suggestions.suggestions?.length ?? 0) > 0 && _navSuggsSlice.map((s, i) => {
                            const displayText = isRtl && s.textAr ? s.textAr : s.text;
                            const isHl = highlightedIndex === i;
                            const itemId = flatItemsRef.current[i]?.id ?? `nav-opt-${i}`;
                            return (
                              <button key={i}
                                id={itemId}
                                role="option"
                                aria-selected={isHl}
                                onClick={() => handleSuggestionTextClick(displayText)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 transition-colors ${isHl ? (isDark ? "bg-white/[0.08]" : "bg-foreground/[0.07]") : navHoverBg}`}
                                style={{ textAlign: isRtl ? "right" : "left" }}>
                                <Search className={`h-3.5 w-3.5 ${s.type === "intent" ? "text-amber-400/70" : navDropMeta} shrink-0`} />
                                <span style={{ fontSize: "0.8125rem" }} className={`${navDropText} truncate flex-1`}>{displayText}</span>
                                {s.type === "intent" && (
                                  <span style={{ fontSize: "9px", fontWeight: 700 }} className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase">
                                    {s.meta === "price_asc" ? (isRtl ? "أرخص" : "price") : isRtl ? "الأفضل" : "top"}
                                  </span>
                                )}
                                {s.type !== "intent" && s.meta && (
                                  <span style={{ fontSize: "10px" }} className={`shrink-0 ${navDropMeta}`}>{s.meta}</span>
                                )}
                              </button>
                            );
                          })}

                          {/* ── Categories ── */}
                          {(suggestions.categories?.length ?? 0) > 0 && (
                            <>
                              <div className={`px-3.5 pt-2.5 pb-1 border-t ${navBorder} flex items-center gap-1.5`}>
                                <Layers className={`h-3 w-3 ${navDropMeta}`} />
                                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase`}>
                                  {isRtl ? "فئات" : "Categories"}
                                </span>
                              </div>
                              <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
                                {(suggestions.categories ?? []).slice(0, 4).map(cat => (
                                  <button key={cat.slug}
                                    onClick={() => { trackSearchClick(cat.slug, "category"); navigate(`/shop?category=${encodeURIComponent(cat.slug)}`); setSearchOpen(false); setSearchQuery(""); }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${navBorder} ${navHoverBg} ${navDropText} transition-colors flex items-center gap-1`}>
                                    <Layers className="h-3 w-3 shrink-0 text-emerald-500" />
                                    {isRtl ? cat.labelAr : cat.labelEn}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {/* ── Stores ── */}
                          {(suggestions.stores?.length ?? 0) > 0 && (
                            <>
                              <div className={`px-3.5 pt-2.5 pb-1 border-t ${navBorder} flex items-center gap-1.5`}>
                                <Store className={`h-3 w-3 ${navDropMeta}`} />
                                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase`}>
                                  {isRtl ? "متاجر" : "Stores"}
                                </span>
                              </div>
                              {_navStrsSlice.map((s, i) => {
                                const sIdx = _navSuggsSlice.length + i;
                                const isHl = highlightedIndex === sIdx;
                                const itemId = flatItemsRef.current[sIdx]?.id ?? `nav-opt-${sIdx}`;
                                return (
                                <button key={s.userId}
                                  id={itemId}
                                  role="option"
                                  aria-selected={isHl}
                                  onClick={() => { trackSearchClick(s.storeName, "store"); navigate(s.storeSlug ? `/store/${s.storeSlug}` : `/shop?sellerId=${s.userId}`); setSearchOpen(false); setSearchQuery(""); }}
                                  className={`w-full flex items-center gap-3 px-3.5 py-2 transition-colors ${isHl ? (isDark ? "bg-white/[0.08]" : "bg-foreground/[0.07]") : navHoverBg}`}
                                  style={{ textAlign: isRtl ? "right" : "left" }}>
                                  {s.storeLogo
                                    ? <img src={s.storeLogo} alt="" className={`h-7 w-7 rounded-lg object-cover border ${navBorder} shrink-0`} />
                                    : <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center bg-emerald-500/10`}><Store className="h-3.5 w-3.5 text-emerald-500" /></div>
                                  }
                                  <div className="flex-1 min-w-0">
                                    <div style={{ fontSize: "0.8125rem", fontWeight: 600 }} className={`${navDropText} truncate`}>{s.storeName}</div>
                                    {s.city && <div style={{ fontSize: "11px" }} className={navDropSub}>{s.city}</div>}
                                  </div>
                                  <span style={{ fontSize: "10px" }} className={`${navDropMeta} uppercase font-semibold shrink-0`}>{isRtl ? "متجر" : "Store"}</span>
                                </button>
                                );
                              })}
                            </>
                          )}

                          {/* ── See all results ── */}
                          {(() => {
                            const seeAllIdx = _navSuggsSlice.length + _navStrsSlice.length;
                            const isHl = highlightedIndex === seeAllIdx;
                            const itemId = flatItemsRef.current[seeAllIdx]?.id ?? `nav-opt-${seeAllIdx}`;
                            return (
                              <button
                                id={itemId}
                                role="option"
                                aria-selected={isHl}
                                onClick={handleSearchSubmit as any}
                                className={`w-full px-3.5 py-2.5 text-sm text-emerald-400 font-semibold transition-colors border-t ${navBorder} flex items-center gap-2 ${isHl ? (isDark ? "bg-white/[0.08]" : "bg-foreground/[0.07]") : navHoverBg}`}>
                                <Search className="h-3.5 w-3.5" />
                                {isRtl ? `عرض جميع النتائج لـ "${debouncedSearch}"` : `See all results for "${debouncedSearch}"`}
                              </button>
                            );
                          })()}
                        </div>
                      )
                    ) : (
                      <div className="py-1.5">
                        {/* Recent searches */}
                        {recentSearches.length > 0 && (
                          <>
                            <div className="flex items-center justify-between px-3.5 pt-2 pb-1">
                              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase flex items-center gap-1.5`}>
                                <Clock className="h-3 w-3" /> {isRtl ? "البحث السابق" : "Recent"}
                              </span>
                              <button onClick={clearRecentSearches} style={{ fontSize: "11px" }} className={`${navXBtn} transition-colors`}>
                                {isRtl ? "مسح الكل" : "Clear all"}
                              </button>
                            </div>
                            {recentSearches.map(s => (
                              <div key={s} className="flex items-center group">
                                <button onClick={() => { setSearchQuery(s); setSearchOpen(true); }}
                                  className={`flex-1 flex items-center gap-2.5 px-3.5 py-2 ${navHoverBg} transition-colors`}>
                                  <Clock className={`h-3.5 w-3.5 ${navDropMeta} shrink-0`} />
                                  <span style={{ fontSize: "0.8125rem" }} className={`${navDropRecent} truncate`}>{s}</span>
                                </button>
                                <button onClick={() => removeRecentSearch(s)}
                                  className={`px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity ${navXBtn}`}>
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Popular / trending searches */}
                        {trendingSearches.length > 0 && (
                          <>
                            <div className={`px-3.5 pt-2.5 pb-1 ${recentSearches.length > 0 ? `border-t ${navBorder}` : ""} flex items-center gap-1.5`}>
                              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase flex items-center gap-1.5`}>
                                <TrendingUp className="h-3 w-3" /> {isRtl ? "الأكثر بحثاً" : "Popular"}
                              </span>
                            </div>
                            <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
                              {trendingSearches.slice(0, 8).map(t => (
                                <button key={t.query}
                                  onClick={() => { setSearchQuery(t.query); navigate(`/shop?q=${encodeURIComponent(t.query)}`); setSearchOpen(false); setSearchQuery(""); }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${navBorder} ${navHoverBg} ${navDropText} transition-colors`}>
                                  {t.query}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : <div />}

          {/* ── COL 3 → Icons + Auth ──────────────────────────────────────────── */}
          <div className="flex items-center gap-3 shrink-0">

            {/* Notifications — authenticated users */}
            {isAuthenticated && <NotificationCenter />}

            {/* Messages — authenticated users (not couriers) */}
            {isAuthenticated && !isCourier && (
              <Link
                href={isAdmin ? "/admin/messages" : isSeller ? "/seller/messages" : "/messages"}
                className="relative h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.92] hover:bg-white text-[#111111] transition-all duration-200"
                aria-label={t("nav.messages")}
              >
                <MessageCircle className="h-[1.125rem] w-[1.125rem]" />
                {unreadMsgCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 flex h-[1.0625rem] w-[1.0625rem] items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white pointer-events-none">
                    {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                  </span>
                )}
              </Link>
            )}

            {/* Wishlist — customers and guests */}
            {!isSeller && !isAdmin && !isCourier && (
              <Link href="/wishlist"
                className="relative h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.92] hover:bg-white text-[#111111] transition-all duration-200"
                aria-label={t("a11y.wishlist")}>
                <Heart className="h-[1.125rem] w-[1.125rem]" />
                {wishlistCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 flex h-[1.0625rem] w-[1.0625rem] items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white pointer-events-none">
                    {wishlistCount > 99 ? "99+" : wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Cart — customers and guests */}
            {!isSeller && !isAdmin && !isCourier && (
              <Link href="/cart"
                className="relative h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.92] hover:bg-white text-[#111111] transition-all duration-200"
                aria-label={t("a11y.openCart")}>
                <ShoppingCart className="h-[1.125rem] w-[1.125rem]" />
                {visibleCartCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -end-0.5 flex h-[1.0625rem] w-[1.0625rem] items-center justify-center rounded-full bg-white text-[8px] font-bold text-[#276221] pointer-events-none">
                    {visibleCartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Settings dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.92] hover:bg-white text-[#111111] transition-all duration-200"
                  aria-label={t("nav.settings")}
                >
                  <Settings className="h-[1.125rem] w-[1.125rem]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="bg-popover border-border shadow-2xl shadow-black/[0.15] w-56 p-0 overflow-hidden rounded-2xl">

                {/* Theme */}
                <div className="px-3 pt-3 pb-2">
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className="text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <Sun className="h-3 w-3" /> {isRtl ? "المظهر" : "Theme"}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { val: "light", ar: "فاتح", en: "Light" },
                      { val: "dark", ar: "داكن", en: "Dark" },
                      { val: "system", ar: "تلقائي", en: "Auto" },
                    ] as const).map(opt => (
                      <button key={opt.val} onClick={() => setTheme(opt.val)}
                        style={{ fontSize: "11px", fontWeight: 600 }}
                        className={cn(
                          "py-1.5 rounded-lg transition-colors",
                          theme === opt.val
                            ? "bg-emerald-500 text-white"
                            : "bg-secondary text-foreground/60 hover:bg-secondary/70 hover:text-foreground"
                        )}>
                        {isRtl ? opt.ar : opt.en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border mx-3" />

                {/* Language */}
                <div className="px-3 py-2">
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className="text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> {isRtl ? "اللغة" : "Language"}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { val: "ar", label: "العربية" },
                      { val: "en", label: "English" },
                    ] as const).map(opt => (
                      <button key={opt.val} onClick={() => switchLanguage(opt.val)}
                        style={{ fontSize: "11px", fontWeight: 600 }}
                        className={cn(
                          "py-1.5 rounded-lg transition-colors",
                          lang === opt.val
                            ? "bg-emerald-500 text-white"
                            : "bg-secondary text-foreground/60 hover:bg-secondary/70 hover:text-foreground"
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border mx-3" />

                {/* Currency */}
                <div className="px-3 py-2 pb-3">
                  <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className="text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3" /> {isRtl ? "العملة" : "Currency"}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {([
                      { val: "SYP", label: "ل.س SYP" },
                      { val: "USD", label: "$ USD" },
                    ] as const).map(opt => (
                      <button key={opt.val} onClick={() => setCurrency(opt.val)}
                        style={{ fontSize: "11px", fontWeight: 600 }}
                        className={cn(
                          "py-1.5 rounded-lg transition-colors",
                          currency === opt.val
                            ? "bg-emerald-500 text-white"
                            : "bg-secondary text-foreground/60 hover:bg-secondary/70 hover:text-foreground"
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider */}
            <div className="w-px h-6 bg-white/25 mx-0.5" />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 h-10 ps-2.5 pe-3.5 rounded-full bg-white/[0.12] hover:bg-white/[0.2] border border-white/[0.2] hover:border-white/[0.35] transition-all duration-200">
                    <div className="w-7 h-7 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "white" }}>
                        {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, maxWidth: 90, color: "rgba(255,255,255,0.9)" }} className="truncate">{user?.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border shadow-xl shadow-black/10 w-52">
                  <div className="px-3 py-2.5 border-b border-border">
                    <p style={{ fontSize: "0.8125rem", fontWeight: 700 }} className="text-foreground">{user?.name}</p>
                    <p style={{ fontSize: "11px" }} className="text-muted-foreground truncate" translate="no">{user?.email}</p>
                  </div>
                  <DropdownMenuItem asChild className="text-foreground/70 focus:text-foreground focus:bg-muted/60 cursor-pointer mt-1">
                    <Link href={isAdmin ? "/admin" : isSeller ? "/seller/dashboard" : isCourier ? "/courier" : "/customer/dashboard"}
                      className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
                    </Link>
                  </DropdownMenuItem>
                  {isCustomer && (
                    <DropdownMenuItem asChild className="text-foreground/70 focus:text-foreground focus:bg-muted/60 cursor-pointer">
                      <Link href="/orders" className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" /> {t("nav.orders")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isCustomer && (
                    <DropdownMenuItem asChild className="text-foreground/70 focus:text-foreground focus:bg-muted/60 cursor-pointer">
                      <Link href="/account" className="flex items-center gap-2">
                        <User className="h-4 w-4" /> {t("account.title")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={logout} className="text-rose-500 focus:text-rose-600 focus:bg-rose-500/[0.08] cursor-pointer">
                    <LogOut className="me-2 h-4 w-4" /> {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={openLogin}
                style={{ fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.02em" }}
                className="h-9 px-5 flex items-center rounded-xl bg-black/80 hover:bg-black active:scale-95 text-white transition-all duration-200 ease-in-out whitespace-nowrap shadow-md shadow-black/30 hover:shadow-lg">
                {t("nav.login")}
              </button>
            )}
          </div>

        </div>

        {/* ══ MOBILE DRAWER ════════════════════════════════════════════════════ */}
        <SheetContent side={isRtl ? "right" : "left"}
          className="w-[min(300px,78vw)] p-0 flex flex-col"
          style={{
            background: isDark ? "#0d0d0d" : "white",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
          }}
          aria-describedby={undefined}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="relative flex flex-col items-center justify-center pt-10 pb-7 shrink-0 overflow-hidden"
            style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)" }}>
            <div className="absolute top-6 left-1/2 -translate-x-1/2 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
            <img src="/syano-logo.png" alt="Syano" width={64} height={64}
              className="relative z-10 h-16 w-16 object-contain drop-shadow-[0_0_20px_rgba(39,98,33,0.75)]" loading="eager" />
            <p className="relative z-10 mt-3 text-xl font-black tracking-[0.28em] uppercase"
              style={{ color: isDark ? "white" : "#111" }}>SYANO</p>
            <p className="relative z-10 mt-1 text-xs font-semibold tracking-[0.12em] text-emerald-400/60 uppercase">سوق سوريا</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
            <MobileNavLink href="/" icon={Home} label={isRtl ? "الرئيسية" : "Home"} location={location} onClose={closeMobileMenu} isDark={isDark} />
            <MobileNavLink href="/shop" icon={Package} label={isRtl ? "تسوق" : "Shop"} location={location} onClose={closeMobileMenu} isDark={isDark} />
            <MobileNavLink href="/categories" icon={Layers} label={isRtl ? "الفئات" : "Categories"} location={location} onClose={closeMobileMenu} isDark={isDark} />
            <MobileNavLink href="/sellers/directory" icon={Store} label={isRtl ? "المتاجر" : "Stores"} location={location} onClose={closeMobileMenu} isDark={isDark} />
            {isAdmin && adminLinks.map(l => <MobileNavLink key={l.href} {...l} location={location} onClose={closeMobileMenu} isDark={isDark} />)}
            {isSeller && sellerLinks.map(l => <MobileNavLink key={l.href} {...l} location={location} onClose={closeMobileMenu} isDark={isDark} />)}
            {isCourier && <MobileNavLink href="/courier" icon={Bike} label={isRtl ? "مساحة العمل" : "Workspace"} location={location} onClose={closeMobileMenu} isDark={isDark} />}
            {isCustomer && customerLinks.map(l => <MobileNavLink key={l.href} {...l} location={location} onClose={closeMobileMenu} isDark={isDark} />)}
            {isCustomer && <MobileNavLink href="/account" icon={User} label={t("account.title")} location={location} onClose={closeMobileMenu} isDark={isDark} />}
            {isCustomer && <MobileNavLink href="/cart" icon={ShoppingCart} label={isRtl ? "السلة" : "Cart"} location={location} onClose={closeMobileMenu} isDark={isDark} />}
            {isAuthenticated && !isCourier && (
              <Link href={isAdmin ? "/admin/messages" : isSeller ? "/seller/messages" : "/messages"} onClick={closeMobileMenu}>
                <div className={cn(
                  "flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                  ["/messages", "/seller/messages", "/admin/messages"].includes(location)
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isDark
                      ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                      : "text-foreground/65 hover:text-foreground hover:bg-foreground/[0.05]",
                )}>
                  <span className="relative">
                    <MessageCircle className="h-5 w-5 shrink-0" />
                    {unreadMsgCount > 0 && (
                      <span className="absolute -top-1 -end-1 flex h-[1rem] w-[1rem] items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white pointer-events-none">
                        {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                      </span>
                    )}
                  </span>
                  {isRtl ? "الرسائل" : "Messages"}
                </div>
              </Link>
            )}
          </div>

          <div className="px-3 py-2 space-y-0.5"
            style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)" }}
              className="uppercase px-3 mb-1 pt-1">
              {isRtl ? "التفضيلات" : "Preferences"}
            </p>
            {/* Language */}
            <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-3 px-3 min-h-[44px]">
              <Globe className="h-5 w-5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }} />
              <span style={{ fontSize: "14px", fontWeight: 500, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}>
                {isRtl ? "اللغة" : "Language"}
              </span>
              <div className="flex gap-1">
                {["en", "ar"].map(l => (
                  <button key={l} onClick={() => switchLanguage(l)}
                    className={cn("px-2.5 py-0.5 rounded text-xs font-bold transition-colors",
                      lang === l
                        ? "bg-emerald-500 text-white"
                        : isDark
                          ? "bg-white/[0.07] text-white/40 hover:bg-white/[0.12]"
                          : "bg-black/[0.06] text-foreground/50 hover:bg-black/[0.11]"
                    )}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {/* Currency */}
            <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-3 px-3 min-h-[44px]">
              <DollarSign className="h-5 w-5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }} />
              <span style={{ fontSize: "14px", fontWeight: 500, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}>
                {isRtl ? "العملة" : "Currency"}
              </span>
              <div className="flex gap-1">
                {["USD", "SYP"].map(c => (
                  <button key={c} onClick={() => setCurrency(c as any)}
                    className={cn("px-2.5 py-0.5 rounded text-xs font-bold transition-colors",
                      currency === c
                        ? "bg-emerald-500 text-white"
                        : isDark
                          ? "bg-white/[0.07] text-white/40 hover:bg-white/[0.12]"
                          : "bg-black/[0.06] text-foreground/50 hover:bg-black/[0.11]"
                    )}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {/* Theme */}
            <div className="grid [grid-template-columns:auto_1fr_auto] items-center gap-x-3 px-3 min-h-[44px]">
              <Sun className="h-5 w-5" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }} />
              <span style={{ fontSize: "14px", fontWeight: 500, color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)" }}>
                {isRtl ? "المظهر" : "Theme"}
              </span>
              <div className="flex gap-1">
                {(["light", "dark", "system"] as const).map(tm => (
                  <button key={tm} onClick={() => setTheme(tm)}
                    className={cn("px-2 py-0.5 rounded text-xs font-bold transition-colors",
                      theme === tm
                        ? "bg-emerald-500 text-white"
                        : isDark
                          ? "bg-white/[0.07] text-white/40 hover:bg-white/[0.12]"
                          : "bg-black/[0.06] text-foreground/50 hover:bg-black/[0.11]"
                    )}>
                    {tm[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 pb-safe-4 pt-3"
            style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)" }}>
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <span style={{ fontSize: "14px", fontWeight: 800 }} className="text-emerald-400">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "white" : "#111" }} className="truncate">{user?.name}</p>
                    <p style={{ fontSize: "11px", color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)" }} className="truncate" translate="no">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 w-full px-3 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors min-h-[44px]"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  {t("nav.logout")}
                </button>
              </>
            ) : (
              <div className="px-1">
                <button
                  onClick={() => { setMobileMenuOpen(false); openLogin(); }}
                  style={{ fontWeight: 700, fontSize: "14px" }}
                  className="flex items-center justify-center w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
                  {t("nav.login")}
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ══ MOBILE SEARCH OVERLAY (portal → escapes all stacking contexts) ═══
          Renders into document.body so z-[9999] is always respected.
          Backdrop: bg-black/30 backdrop-blur-sm, click to dismiss.
          Panel:    bg-background slides from top (200 ms ease).
          Scroll:   body overflow:hidden applied via useEffect above.
          Desktop:  md:hidden — never renders on ≥768 px.
      ══════════════════════════════════════════════════════════════════════ */}
      {searchOpen && !isAuthPage && createPortal(
        <>
          <style>{`
            @keyframes syano-backdrop-in {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes syano-panel-in {
              from { opacity: 0; transform: translateY(-10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .syano-mob-backdrop { animation: syano-backdrop-in 200ms ease forwards; }
            .syano-mob-panel    { animation: syano-panel-in 200ms ease forwards; }
          `}</style>

          <div
            className="syano-mob-backdrop md:hidden fixed inset-0 z-[9999]"
            role="dialog"
            aria-modal="true"
            aria-label={isRtl ? "البحث" : "Search"}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {/* ── Backdrop — tap anywhere to close ─────────────────────── */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              aria-hidden="true"
            />

            {/* ── Panel — slides from top ───────────────────────────────── */}
            <div
              className="syano-mob-panel relative bg-background"
              style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }}
            >
              {/* iOS safe area (notch) */}
              <div aria-hidden="true" style={{ height: "env(safe-area-inset-top, 0px)" }} />

              {/* Search input row */}
              <div className="flex items-center gap-2 px-3 h-[3.75rem]">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex-1 flex items-center gap-2 bg-muted border border-border rounded-xl px-3 h-10"
                >
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={isRtl ? "ابحث عن منتجات، متاجر..." : "Search products, stores..."}
                    className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                    style={{ fontFamily: "'Cairo', sans-serif", minWidth: 0 }}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label={t("a11y.close")}
                      onClick={() => setSearchQuery("")}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </form>

                {/* Cancel button */}
                <button
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-1 flex items-center"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </div>

              {/* Suggestions */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 3.75rem)" }}>
                {debouncedSearch.length >= 2 ? (
                  searchLoading ? (
                    <div className="py-2">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                          <div className={`h-3.5 w-3.5 rounded-full shrink-0 ${isDark ? "bg-white/[0.08]" : "bg-foreground/[0.08]"}`} />
                          <div className={`h-3 rounded ${isDark ? "bg-white/[0.08]" : "bg-foreground/[0.08]"}`} style={{ width: `${45 + i * 15}%` }} />
                        </div>
                      ))}
                    </div>
                  ) : (suggestions.suggestions?.length ?? 0) === 0 && (suggestions.stores?.length ?? 0) === 0 && (suggestions.categories?.length ?? 0) === 0 ? (
                    <div className={`p-6 text-sm ${navDropMeta} text-center`}>
                      {isRtl ? "لا توجد نتائج" : "No results found"}
                    </div>
                  ) : (
                    <>
                      {/* Suggested searches */}
                      {(suggestions.suggestions ?? []).slice(0, 6).map((s, i) => {
                        const displayText = isRtl && s.textAr ? s.textAr : s.text;
                        return (
                          <button
                            key={i}
                            onClick={() => handleSuggestionTextClick(displayText)}
                            className={`w-full flex items-center gap-3 px-4 py-3 ${navHoverBg} transition-colors`}
                            style={{ textAlign: isRtl ? "right" : "left" }}
                          >
                            <Search className={`h-4 w-4 ${navDropMeta} shrink-0`} />
                            <span style={{ fontSize: "0.875rem" }} className={`${navDropText} truncate flex-1`}>
                              {displayText}
                            </span>
                            {s.type === "intent" && (
                              <span style={{ fontSize: "9px", fontWeight: 700 }} className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase">
                                {s.meta === "price_asc" ? (isRtl ? "أرخص" : "price") : isRtl ? "الأفضل" : "top"}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* Categories */}
                      {(suggestions.categories?.length ?? 0) > 0 && (
                        <>
                          <div className={`px-4 pt-3 pb-2 border-t ${navBorder} flex items-center gap-1.5`}>
                            <Layers className={`h-3 w-3 ${navDropMeta}`} />
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase`}>
                              {isRtl ? "فئات" : "Categories"}
                            </span>
                          </div>
                          <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {(suggestions.categories ?? []).slice(0, 5).map(cat => (
                              <button
                                key={cat.slug}
                                onClick={() => { trackSearchClick(cat.slug, "category"); navigate(`/shop?category=${encodeURIComponent(cat.slug)}`); setSearchOpen(false); setSearchQuery(""); }}
                                className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${navBorder} ${navHoverBg} ${navDropText} transition-colors flex items-center gap-1.5`}
                              >
                                <Layers className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                {isRtl ? cat.labelAr : cat.labelEn}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Stores */}
                      {(suggestions.stores?.length ?? 0) > 0 && (
                        <>
                          <div className={`px-4 pt-3 pb-2 border-t ${navBorder} flex items-center gap-1.5`}>
                            <Store className={`h-3 w-3 ${navDropMeta}`} />
                            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }} className={`${navDropMeta} uppercase`}>
                              {isRtl ? "متاجر" : "Stores"}
                            </span>
                          </div>
                          {(suggestions.stores ?? []).slice(0, 3).map(s => (
                            <button
                              key={s.userId}
                              onClick={() => { trackSearchClick(s.storeName, "store"); navigate(s.storeSlug ? `/store/${s.storeSlug}` : `/shop?sellerId=${s.userId}`); setSearchOpen(false); setSearchQuery(""); }}
                              className={`w-full flex items-center gap-3 px-4 py-3 ${navHoverBg} transition-colors`}
                              style={{ textAlign: isRtl ? "right" : "left" }}
                            >
                              {s.storeLogo
                                ? <img src={s.storeLogo} alt="" className={`h-8 w-8 rounded-lg object-cover border ${navBorder} shrink-0`} />
                                : <div className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center bg-emerald-500/10"><Store className="h-4 w-4 text-emerald-500" /></div>
                              }
                              <div className="flex-1 min-w-0">
                                <div style={{ fontSize: "0.875rem", fontWeight: 600 }} className={`${navDropText} truncate`}>{s.storeName}</div>
                                {s.city && <div style={{ fontSize: "11px" }} className={navDropSub}>{s.city}</div>}
                              </div>
                              <span style={{ fontSize: "10px" }} className={`${navDropMeta} uppercase font-semibold shrink-0`}>{isRtl ? "متجر" : "Store"}</span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* See all results */}
                      <button
                        onClick={handleSearchSubmit as React.MouseEventHandler}
                        className={`w-full px-4 py-3.5 text-sm text-emerald-500 font-semibold border-t ${navBorder} flex items-center gap-2 ${navHoverBg} transition-colors`}
                      >
                        <Search className="h-4 w-4" />
                        {isRtl ? `عرض جميع النتائج لـ "${debouncedSearch}"` : `See all results for "${debouncedSearch}"`}
                      </button>
                    </>
                  )
                ) : (
                  /* Empty query — show recent + trending */
                  <>
                    {recentSearches.length > 0 && (
                      <>
                        <div className="flex items-center justify-between px-4 pt-4 pb-2">
                          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em" }} className={`${navDropMeta} uppercase flex items-center gap-1.5`}>
                            <Clock className="h-3.5 w-3.5" /> {isRtl ? "البحث السابق" : "Recent searches"}
                          </span>
                          <button
                            onClick={clearRecentSearches}
                            style={{ fontSize: "12px" }}
                            className={`${navXBtn} transition-colors`}
                          >
                            {isRtl ? "مسح الكل" : "Clear all"}
                          </button>
                        </div>
                        {recentSearches.map(s => (
                          <div key={s} className="flex items-center group">
                            <button
                              onClick={() => setSearchQuery(s)}
                              className={`flex-1 flex items-center gap-3 px-4 py-3 ${navHoverBg} transition-colors`}
                            >
                              <Clock className={`h-4 w-4 ${navDropMeta} shrink-0`} />
                              <span style={{ fontSize: "0.875rem" }} className={`${navDropRecent} truncate`}>{s}</span>
                            </button>
                            <button
                              onClick={() => removeRecentSearch(s)}
                              className={`px-4 py-3 ${navXBtn} opacity-0 group-hover:opacity-100 transition-opacity`}
                              aria-label={isRtl ? "حذف" : "Remove"}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}

                    {trendingSearches.length > 0 && (
                      <>
                        <div className={`px-4 pt-4 pb-2 ${recentSearches.length > 0 ? `border-t ${navBorder}` : ""} flex items-center gap-1.5`}>
                          <TrendingUp className={`h-3.5 w-3.5 ${navDropMeta}`} />
                          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em" }} className={`${navDropMeta} uppercase`}>
                            {isRtl ? "الأكثر بحثاً" : "Popular searches"}
                          </span>
                        </div>
                        <div className="px-4 pb-4 flex flex-wrap gap-2">
                          {trendingSearches.slice(0, 10).map(tr => (
                            <button
                              key={tr.query}
                              onClick={() => { setSearchQuery(tr.query); navigate(`/shop?q=${encodeURIComponent(tr.query)}`); setSearchOpen(false); setSearchQuery(""); }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${navBorder} ${navHoverBg} ${navDropText} transition-colors`}
                            >
                              {tr.query}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {recentSearches.length === 0 && trendingSearches.length === 0 && (
                      <div className={`px-4 py-8 text-sm ${navDropMeta} text-center`}>
                        {isRtl ? "ابدأ الكتابة للبحث..." : "Start typing to search..."}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
      {/* ── Location Map Modal (portal) ──────────────────────────── */}
      <LocationMapModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
      />
    </header>
  );
}
