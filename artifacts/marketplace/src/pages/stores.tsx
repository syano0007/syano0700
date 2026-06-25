// @refresh reset
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Store, Users, Package, CheckCircle, Filter } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSEO } from "@/hooks/useSEO";
import { useDebounce } from "@/hooks/use-debounce";

const BASE = import.meta.env.BASE_URL ?? "/";

interface StoreItem {
  sellerId: number;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string | null;
  storeBanner: string | null;
  accentColor: string | null;
  categories: string[];
  city: string | null;
  description: string | null;
  isVerified: boolean;
  totalProducts: number;
  followerCount: number;
  averageRating: number | null;
  reviewCount: number;
}

interface DirectoryResponse {
  stores: StoreItem[];
  total: number;
  page: number;
  limit: number;
}

const SORT_OPTIONS = [
  { value: "newest",    labelKey: "stores.sort_newest" },
  { value: "rating",    labelKey: "stores.sort_rating" },
  { value: "followers", labelKey: "stores.sort_followers" },
  { value: "products",  labelKey: "stores.sort_products" },
] as const;

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} style={{ width: size, height: size }} viewBox="0 0 16 16"
          fill={i <= n ? "#f59e0b" : "rgba(128,128,128,0.22)"}>
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 11.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
        </svg>
      ))}
    </span>
  );
}

function StoreCard({ store, isRTL }: { store: StoreItem; isRTL: boolean }) {
  const { t } = useTranslation();
  const rating  = store.averageRating ?? 0;
  const ratingN = Math.round(rating);
  const href    = store.storeSlug ? `/store/${store.storeSlug}` : `/store/${store.sellerId}`;
  const accent  = store.accentColor ?? "#276221";

  return (
    <div className="sy-card sy-card-bg group relative flex flex-col rounded-2xl overflow-hidden border"
      style={{ transition: "box-shadow 0.2s, transform 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      {/* Banner */}
      <div className="relative h-[6.875rem] overflow-hidden bg-muted flex-shrink-0">
        {store.storeBanner ? (
          <img
            src={store.storeBanner} alt="" loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "brightness(0.72)" }}
          />
        ) : (
          <div className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${accent}28, ${accent}0a)` }}
          />
        )}

        {/* Verified badge */}
        {store.isVerified && (
          <div className="absolute top-2 end-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(39,98,33,0.92)", color: "#fff" }}>
            <CheckCircle className="w-3 h-3" />
            {t("stores.verified")}
          </div>
        )}
      </div>

      {/* Logo bubble — overlaps banner */}
      <div className="absolute start-4 top-[4.375rem] w-11 h-11 rounded-xl border-2 border-background overflow-hidden shadow-md"
        style={{ background: `${accent}18` }}>
        {store.storeLogo ? (
          <img src={store.storeLogo} alt={store.storeName} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5 pt-8 pb-4 px-4 flex-1">
        {/* Name */}
        <h3 className="font-bold text-sm leading-snug line-clamp-2" style={{ direction: isRTL ? "rtl" : "ltr" }}>
          {store.storeName}
        </h3>

        {/* Rating */}
        {rating > 0 ? (
          <div className="flex items-center gap-1.5">
            <Stars n={ratingN} size={11} />
            <span className="text-xs text-muted-foreground">{rating.toFixed(1)}</span>
            {store.reviewCount > 0 && (
              <span className="text-xs text-muted-foreground">({store.reviewCount})</span>
            )}
          </div>
        ) : (
          <div className="h-[1.125rem]" />
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3 shrink-0" />
            <span>{store.totalProducts} {t("stores.products")}</span>
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 shrink-0" />
            <span>{store.followerCount} {t("stores.followers")}</span>
          </span>
        </div>

        {/* Categories */}
        {store.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {store.categories.slice(0, 2).map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ color: "var(--muted-foreground)" }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* City */}
        {store.city && (
          <p className="text-[11px] text-muted-foreground truncate">{store.city}</p>
        )}

        {/* CTA */}
        <Link href={href} className="mt-auto block">
          <Button size="sm" variant="outline"
            className="w-full h-8 text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
            {t("stores.visit")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="rounded-2xl border bg-muted animate-pulse h-[17.5rem]" />;
}

export default function StoresPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === "rtl";

  const [search,      setSearch]      = useState("");
  const [sort,        setSort]        = useState("newest");
  const [verifiedOnly,setVerifiedOnly]= useState(false);
  const [limit,       setLimit]       = useState(12);

  const debouncedSearch = useDebounce(search, 350);

  // Reset limit when filters change
  useEffect(() => { setLimit(12); }, [debouncedSearch, sort, verifiedOnly]);

  useSEO({
    title: isRTL ? "دليل المتاجر — سيانو" : "Store Directory — Syano",
    description: isRTL
      ? "اكتشف البائعين الموثوقين في سوريا. تسوق من أفضل المتاجر."
      : "Discover verified sellers across Syria. Shop from the best Syrian stores.",
  });

  const { data, isLoading, isFetching } = useQuery<DirectoryResponse>({
    queryKey: ["sellers/directory", debouncedSearch, sort, verifiedOnly, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ search: debouncedSearch, sort, limit: String(limit) });
      if (verifiedOnly) params.set("verified", "true");
      const res = await fetch(`${BASE}api/sellers/directory?${params}`);
      if (!res.ok) return { stores: [], total: 0, page: 1, limit };
      return res.json();
    },
    staleTime: 60_000,
  });

  const stores  = data?.stores ?? [];
  const total   = data?.total  ?? 0;
  const hasMore = limit < total && !isLoading;

  const sortLabel = t(
    SORT_OPTIONS.find(o => o.value === sort)?.labelKey ?? "stores.sort_newest"
  );

  return (
    <Layout>
      <div dir={i18n.dir()} className="min-h-screen" style={{ fontFamily: "'Cairo','Segoe UI',system-ui,sans-serif" }}>

        {/* ── Page header ──────────────────────────────── */}
        <div className="border-b bg-background">
          <div className="container px-4 py-10 md:py-12">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#276221" }}>
                {isRTL ? "سيانو — سوريا" : "Syano — Syria"}
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
                {t("stores.title")}
              </h1>
              <p className="text-muted-foreground text-sm">{t("stores.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="container px-4 py-8">

          {/* ── Controls ─────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("stores.search_placeholder")}
                className="ps-9"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 shrink-0">
                  <Filter className="h-4 w-4" />
                  {sortLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map(({ value, labelKey }) => (
                  <DropdownMenuItem
                    key={value}
                    className={sort === value ? "font-semibold text-primary" : ""}
                    onClick={() => setSort(value)}
                  >
                    {t(labelKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={verifiedOnly ? "default" : "outline"}
              className="gap-2 shrink-0"
              onClick={() => setVerifiedOnly(v => !v)}
            >
              <CheckCircle className="h-4 w-4" />
              {t("stores.filter_verified")}
            </Button>
          </div>

          {/* ── Results count ────────────────────────────── */}
          {!isLoading && (
            <p className="text-sm text-muted-foreground mb-5">
              {t("stores.total", { count: total })}
            </p>
          )}

          {/* ── Grid ─────────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-24">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-semibold text-lg">{t("stores.no_stores")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("stores.no_stores_desc")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {stores.map((store) => (
                <StoreCard key={store.sellerId} store={store} isRTL={isRTL} />
              ))}
            </div>
          )}

          {/* ── Load More ────────────────────────────────── */}
          {hasMore && (
            <div className="mt-10 text-center">
              <Button
                variant="outline"
                onClick={() => setLimit(l => l + 12)}
                disabled={isFetching}
                className="min-w-[160px]"
              >
                {isFetching ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t("stores.load_more")}
                  </span>
                ) : t("stores.load_more")}
              </Button>
            </div>
          )}

          {!isLoading && stores.length > 0 && !hasMore && (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              {t("stores.all_shown")}
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
