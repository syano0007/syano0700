import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import useAnnouncer from "@/hooks/useAnnouncer";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useSEO } from "@/hooks/useSEO";
import { recordSearchClick, useSearchTrending, type TrendingQuery } from "@/hooks/use-search";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, SlidersHorizontal, X, Store, ChevronRight,
  Star, TrendingUp, Package, Layers, ArrowRight, SearchX,
  Cpu, Shirt, Sparkles, Home as HomeIcon, ShoppingBasket, Dumbbell,
  Car, Gamepad2, BookOpen, PawPrint, Download, Palette,
  Gem, Baby, Wrench, TreePine, Gift, Info,
} from "lucide-react";
import { Link } from "wouter";

const ICON_MAP: Record<string, React.ElementType> = {
  Cpu, Shirt, Sparkles, Home: HomeIcon, ShoppingBasket, Dumbbell,
  Car, Gamepad2, BookOpen, PawPrint, Download, Palette,
  Gem, Baby, Wrench, TreePine, Gift,
};

type SortOption = "relevance" | "newest" | "price_asc" | "price_desc" | "highest_rated" | "rating" | "most_discounted" | "best_selling";
type ActiveTab = "products" | "stores" | "categories";

interface SearchResultProduct {
  id: number;
  name: string;
  nameAr: string | null;
  price: number;
  discountPercent: number | null;
  finalPrice: number;
  category: string;
  subcategory: string | null;
  stock: number;
  imageUrl: string | null;
  imageUrls: string[];
  featured: boolean;
  isBestDeal: boolean;
  hasVariants: boolean;
  averageRating: number;
  reviewCount: number;
  seller: { id: number; name: string; storeName: string | null; storeSlug: string | null; storeLogo: string | null };
  createdAt: string;
  score: number;
}
interface SearchIntent {
  modifiers: string[];
  mappedCategory: string | null;
  expandedTerms: string[];
  nlpBaseTokens?: string[];
  nlpExpandedCount?: number;
  primaryLanguage?: "ar" | "en";
}
interface FilterMeta {
  priceRange: { min: number; max: number };
  totalUnfiltered: number;
  appliedFilters: {
    minPrice:  number | null;
    maxPrice:  number | null;
    minRating: number | null;
    category:  string | null;
    storeId:   number | null;
    inStock:   boolean;
    onSale:    boolean;
  };
}
interface SearchFallback {
  level: number;
  originalQuery?: string;
  relaxedQuery?: string;
  matchType?: string;
  inferredCategory?: string;
  reason?: string;
}
interface SearchApiResponse {
  results: SearchResultProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchLogId?: number | null;
  filterMeta?: FilterMeta;
  intent: SearchIntent;
  didYouMean?: string | null;
  detectedIntent?: string | null;
  synonymExpanded?: boolean;
  fallback?: SearchFallback | null;
  searchMode?: "hybrid" | "fts_only";
  semanticResultCount?: number;
}

interface FilterOption { slug: string; nameEn: string; nameAr: string; productCount: number; }
interface StoreFilterOption { id: number; nameEn: string; nameAr: string; slug: string; productCount: number; }
interface FilterOptionsResponse {
  categories: FilterOption[];
  stores: StoreFilterOption[];
  priceRange: { min: number; max: number };
}
interface RelatedQuery { query: string; count: number; }

interface StoreResult {
  userId: number;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string | null;
  categories: string[];
  city: string | null;
  followerCount: number;
  productCount: number;
  averageRating: number | null;
  totalReviews: number;
  trustScore: number | null;
}

const PAGE_SIZE = 24;

export default function SearchPage() {
  const announce = useAnnouncer();
  const { t, i18n } = useTranslation();
  const { currency, symbol, exchangeRate } = useCurrency();
  const lang = i18n.language;
  const isRtl = lang === "ar";
  const [location, navigate] = useLocation();

  /* ── Toolbar height measurement (ResizeObserver — dynamic, no static values) ── */
  const searchHeaderRef = useRef<HTMLDivElement>(null);
  const [searchHeaderHeight, setSearchHeaderHeight] = useState(144);

  useLayoutEffect(() => {
    const el = searchHeaderRef.current;
    if (!el) return;
    setSearchHeaderHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      setSearchHeaderHeight(entries[0]?.contentRect.height ?? el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.style.scrollPaddingTop =
      `calc(var(--navbar-height) + ${searchHeaderHeight + 8}px)`;
    return () => { document.documentElement.style.scrollPaddingTop = ""; };
  }, [searchHeaderHeight]);

  /* Sticky top for sidebar + any sticky sub-elements */
  const belowToolbar = `calc(var(--navbar-height) + ${searchHeaderHeight}px)`;

  const getInitialParams = () => {
    const sp2 = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const q = sp2.get("q") || sp2.get("search") || "";
    const cat = sp2.get("category") || undefined;
    const disc = sp2.get("hasDiscount") === "true";
    const rawSort = sp2.get("sortBy") || sp2.get("sort") || (q ? "relevance" : "newest");
    const sort = rawSort === "best_sellers" ? "best_selling" : rawSort as SortOption;
    return { q, cat, disc, sort };
  };
  const init = getInitialParams();

  const [query, setQuery] = useState(init.q);
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [sortBy, setSortBy] = useState<SortOption>(init.sort);
  const [category, setCategory] = useState<string | undefined>(init.cat);
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [hasDiscount, setHasDiscount] = useState(init.disc);
  const [inStock, setInStock] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nlpBannerDismissed, setNlpBannerDismissed] = useState(false);
  const [intentPillDismissed, setIntentPillDismissed] = useState(false);

  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<any[]>([]);
  const prevFilterKey = useRef("");

  const [searchPage, setSearchPage] = useState(1);
  const [searchAccumulated, setSearchAccumulated] = useState<SearchResultProduct[]>([]);
  const prevSearchFilterKey = useRef("");

  const [stores, setStores] = useState<StoreResult[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 350);
  const searchMode = debouncedQuery.length >= 1;

  useSEO({
    title: debouncedQuery
      ? lang === "ar" ? `نتائج البحث عن "${debouncedQuery}"` : `Search results for "${debouncedQuery}"`
      : lang === "ar" ? "تسوق" : "Shop",
    description: lang === "ar"
      ? "اكتشف الآلاف من المنتجات والمتاجر السورية في سوق سيانو"
      : "Discover thousands of products and Syrian stores on Syano marketplace",
    noindex: true,
  });

  useEffect(() => {
    const sp2 = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const urlQ = sp2.get("q") || sp2.get("search") || "";
    const urlCat = sp2.get("category") || undefined;
    const urlDisc = sp2.get("hasDiscount") === "true";
    const rawSort = sp2.get("sortBy") || sp2.get("sort") || (urlQ ? "relevance" : "newest");
    if (urlQ !== query) setQuery(urlQ);
    if (urlCat !== undefined && urlCat !== category) setCategory(urlCat);
    if (urlDisc && !hasDiscount) setHasDiscount(true);
    if (rawSort && rawSort !== sortBy) setSortBy((rawSort === "best_sellers" ? "best_selling" : rawSort) as SortOption);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const toUsd = (val: string) => {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : currency === "SYP" ? n / exchangeRate : n;
  };

  const filterKey = [debouncedQuery, category, sortBy, minPriceInput, maxPriceInput, hasDiscount, inStock, minRating, storeId].join("|");

  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setOffset(0);
      setAccumulated([]);
    }
  }, [filterKey]);

  const searchFilterKey = [debouncedQuery, category, sortBy, minPriceInput, maxPriceInput, minRating, inStock, storeId].join("|");
  useEffect(() => {
    if (prevSearchFilterKey.current !== searchFilterKey) {
      prevSearchFilterKey.current = searchFilterKey;
      setSearchPage(1);
      setSearchAccumulated([]);
      setNlpBannerDismissed(false);
      setIntentPillDismissed(false);
    }
  }, [searchFilterKey]);

  const searchSortParam = sortBy === "highest_rated" ? "rating" : sortBy === "best_selling" ? "newest" : sortBy === "most_discounted" ? "price_desc" : sortBy;

  const { data: searchData, isLoading: searchResultLoading, isFetching: searchResultFetching } = useQuery<SearchApiResponse>({
    queryKey: ["search/results/v2", debouncedQuery, searchPage, searchSortParam, category, minPriceInput, maxPriceInput, minRating, inStock, storeId],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        page: String(searchPage),
        limit: String(PAGE_SIZE),
        sortBy: searchSortParam,
      });
      if (category && category !== "all") params.set("category", category);
      const minPriceSYP = toUsd(minPriceInput);
      const maxPriceSYP = toUsd(maxPriceInput);
      if (minPriceSYP !== undefined) params.set("minPrice", String(Math.round(minPriceSYP * (currency === "USD" ? exchangeRate : 1))));
      if (maxPriceSYP !== undefined) params.set("maxPrice", String(Math.round(maxPriceSYP * (currency === "USD" ? exchangeRate : 1))));
      if (minRating > 0) params.set("minRating", String(minRating));
      if (inStock) params.set("inStock", "true");
      if (hasDiscount) params.set("hasDiscount", "true");
      if (storeId !== null) params.set("storeId", String(storeId));
      const res = await fetch(`/api/search/results?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json() as Promise<SearchApiResponse>;
    },
    enabled: searchMode,
    staleTime: 5000,
    placeholderData: (prev) => prev,
  });

  /* ── Filter options (for store filter sidebar) ─────────────────────── */
  const { data: filterOptions } = useQuery<FilterOptionsResponse>({
    queryKey: ["search/filter-options", debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/search/filter-options?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load filter options");
      return res.json() as Promise<FilterOptionsResponse>;
    },
    staleTime: 30_000,
  });

  /* ── Related searches ───────────────────────────────────────────────── */
  const { data: relatedData } = useQuery<{ related: RelatedQuery[] }>({
    queryKey: ["search/related", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return { related: [] };
      const res = await fetch(`/api/search/related?q=${encodeURIComponent(debouncedQuery)}&limit=6`);
      if (!res.ok) return { related: [] };
      return res.json() as Promise<{ related: RelatedQuery[] }>;
    },
    enabled: searchMode && debouncedQuery.length >= 2,
    staleTime: 60_000,
  });
  const relatedSearches = relatedData?.related ?? [];

  useEffect(() => {
    if (!searchData) return;
    if (searchPage === 1) {
      setSearchAccumulated(searchData.results);
    } else {
      setSearchAccumulated((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...searchData.results.filter((p) => !seen.has(p.id))];
      });
    }
  }, [searchData, searchPage]);

  /* When in search mode, "relevance" is not a valid browse-endpoint sort — fall back to "newest" */
  const browseSortBy = (sortBy === "relevance" || sortBy === "rating") ? "newest" : sortBy;

  const { data: pageData, isLoading: productsLoading, isFetching } = useListProducts({
    search: debouncedQuery || undefined,
    category: category && category !== "all" ? category : undefined,
    sortBy: browseSortBy,
    minPrice: toUsd(minPriceInput),
    maxPrice: toUsd(maxPriceInput),
    hasDiscount: hasDiscount || undefined,
    inStock: inStock || undefined,
    minRating: minRating > 0 ? minRating : undefined,
    limit: PAGE_SIZE,
    offset,
  } as any);

  useEffect(() => {
    if (!pageData) return;
    if (offset === 0) {
      setAccumulated(pageData);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((p: any) => p.id));
        return [...prev, ...pageData.filter((p: any) => !seen.has(p.id))];
      });
    }
  }, [pageData, offset]);

  const products = searchMode ? searchAccumulated : accumulated;
  const isLoadingProducts = searchMode ? (searchResultLoading && searchAccumulated.length === 0) : (productsLoading && accumulated.length === 0);
  const isFetchingProducts = searchMode ? searchResultFetching : isFetching;
  const totalResults = searchMode ? (searchData?.total ?? 0) : undefined;
  const searchIntent = searchMode ? (searchData?.intent ?? null) : null;
  const searchLogId: number | null = searchMode ? (searchData?.searchLogId ?? null) : null;
  const searchFallback = searchMode ? (searchData?.fallback ?? null) : null;
  const apiEngineMode = searchMode ? (searchData?.searchMode ?? "fts_only") : "fts_only";
  const semanticResultCount = searchMode ? (searchData?.semanticResultCount ?? 0) : 0;

  useEffect(() => {
    if (!debouncedQuery || !searchData) return;
    const count = searchData.total ?? 0;
    announce(t("a11y.searchResultsCount", { count, query: debouncedQuery }));
  }, [searchData?.total, debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fallbackBannerDismissed, setFallbackBannerDismissed] = useState(false);
  useEffect(() => { setFallbackBannerDismissed(false); }, [debouncedQuery]);
  const hasMoreProducts = searchMode
    ? (searchPage < (searchData?.totalPages ?? 1))
    : ((pageData?.length ?? 0) >= PAGE_SIZE);
  const handleLoadMore = searchMode
    ? () => setSearchPage((p) => p + 1)
    : () => setOffset((o) => o + PAGE_SIZE);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setStores([]);
      return;
    }
    setStoresLoading(true);
    fetch(`/api/sellers/directory?search=${encodeURIComponent(debouncedQuery)}&limit=24`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []))
      .catch(() => setStores([]))
      .finally(() => setStoresLoading(false));
  }, [debouncedQuery]);

  const trendingSearches = useSearchTrending();

  const matchedCategories = CATEGORIES.filter((c) => {
    if (!debouncedQuery || debouncedQuery.length < 2) return false;
    const q = debouncedQuery.toLowerCase();
    return (
      c.slug.toLowerCase().includes(q) ||
      c.en.toLowerCase().includes(q) ||
      c.ar.includes(debouncedQuery) ||
      c.subcategories.some((s) => s.en.toLowerCase().includes(q) || s.ar.includes(debouncedQuery))
    );
  });

  const defaultSort = searchMode ? "relevance" : "newest";
  const activeFilterCount = [
    category && category !== "all", sortBy !== defaultSort,
    minPriceInput, maxPriceInput, hasDiscount, inStock, minRating > 0, storeId !== null,
  ].filter(Boolean).length;

  const SORT_LABELS: Record<SortOption, string> = {
    relevance:       t("search.sort.relevance"),
    newest:          t("search.sort.newest"),
    price_asc:       t("search.sort.priceLow"),
    price_desc:      t("search.sort.priceHigh"),
    highest_rated:   t("search.sort.rating"),
    rating:          t("search.sort.rating"),
    most_discounted: lang === "ar" ? "أكبر خصم" : "Most Discounted",
    best_selling:    lang === "ar" ? "الأكثر مبيعاً" : "Best Selling",
  };

  const SEARCH_MODE_SORT_OPTIONS: SortOption[] = ["relevance", "price_asc", "price_desc", "rating", "newest"];
  const BROWSE_MODE_SORT_OPTIONS: SortOption[] = ["newest", "price_asc", "price_desc", "highest_rated", "most_discounted", "best_selling"];
  const activeSortOptions = searchMode ? SEARCH_MODE_SORT_OPTIONS : BROWSE_MODE_SORT_OPTIONS;

  const MODIFIER_LABELS: Record<string, string> = {
    cheap: lang === "ar" ? "رخيص" : "Budget",
    premium: lang === "ar" ? "فاخر" : "Premium",
    used: lang === "ar" ? "مستعمل" : "Used",
  };

  const TAB_CONFIG: { key: ActiveTab; label: string; count: number; icon: React.ElementType }[] = [
    { key: "products",   label: lang === "ar" ? "المنتجات" : "Products",   count: products.length,          icon: Package },
    { key: "stores",     label: lang === "ar" ? "المتاجر" : "Stores",       count: stores.length,            icon: Store },
    { key: "categories", label: lang === "ar" ? "الفئات" : "Categories",  count: matchedCategories.length, icon: Layers },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const clearFilters = () => {
    setCategory(undefined); setSortBy("newest");
    setMinPriceInput(""); setMaxPriceInput("");
    setHasDiscount(false); setInStock(false); setMinRating(0); setStoreId(null);
  };

  const handleSortChange = (v: string) => {
    const newSort = v as SortOption;
    setSortBy(newSort);
    const sp = new URLSearchParams(window.location.search);
    sp.set("sortBy", newSort);
    navigate(`/shop?${sp.toString()}`);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background" dir={isRtl ? "rtl" : "ltr"}>
        {/* ── Search Header ─────────────────────────────────────── */}
        <div ref={searchHeaderRef} className="border-b border-border/60 bg-card/90 backdrop-blur-sm sticky z-30" style={{ top: "var(--navbar-height)" }}>
          <div className="container py-3 px-4">
            <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-1 bg-background border border-border/70 rounded-xl px-3.5 h-10 focus-within:border-emerald-500/60 transition-colors">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن منتجات أو متاجر..." : "Search products or stores..."}
                  className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                  style={{ fontFamily: "'Cairo', sans-serif" }}
                  autoFocus={!init.q}
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(""); navigate("/shop"); }}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button type="submit" size="sm" className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                {lang === "ar" ? "بحث" : "Search"}
              </Button>
            </form>

            {debouncedQuery && (
              <div className="mt-2">
                <span className="text-sm text-muted-foreground">
                  {lang === "ar" ? `نتائج البحث عن ` : `Results for `}
                  <span className="font-semibold text-foreground">"{debouncedQuery}"</span>
                </span>
              </div>
            )}

            {/* Intent Pill — shown when server detects a strong search intent */}
            {!intentPillDismissed && searchData?.detectedIntent && (
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="gap-1.5 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-full px-3 py-1"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  {t(`search.intent.${searchData.detectedIntent}`, t("search.intent.category_browse"))}
                </Badge>
                <button
                  onClick={() => setIntentPillDismissed(true)}
                  aria-label={t("search.intent.dismiss")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mt-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {TAB_CONFIG.map(({ key, label, count, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    activeTab === key
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[18px] text-center",
                      activeTab === key ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    )}>{count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Products Tab ─────────────────────────────────────── */}
        {activeTab === "products" && (
          <div className="container px-4 pb-6" style={{ paddingTop: `${searchHeaderHeight}px` }}>
            <div className="flex flex-col lg:flex-row gap-6">

              {/* Sidebar Filters — desktop */}
              <aside className="hidden lg:block w-56 shrink-0">
                <div className="sticky space-y-5" style={{ top: belowToolbar }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t("search.filters.title")}</span>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                        {t("search.filters.clearAll")}
                      </button>
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("search.filters.category")}
                    </Label>
                    <Select value={category ?? "all"} onValueChange={(v) => setCategory(v === "all" ? undefined : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={lang === "ar" ? "جميع الفئات" : "All categories"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{lang === "ar" ? "جميع الفئات" : "All categories"}</SelectItem>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.slug} value={c.slug}>
                            {lang === "ar" ? c.ar : c.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sort */}
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {lang === "ar" ? "ترتيب حسب" : "Sort by"}
                    </Label>
                    <Select value={sortBy} onValueChange={handleSortChange}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeSortOptions.map((k) => (
                          <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price */}
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("search.filters.price")} ({symbol})
                    </Label>
                    <div className="flex gap-2">
                      <Input type="number" min="0" value={minPriceInput}
                        onChange={(e) => setMinPriceInput(e.target.value)}
                        placeholder={t("search.filters.priceFrom")} className="h-8 text-sm" />
                      <Input type="number" min="0" value={maxPriceInput}
                        onChange={(e) => setMaxPriceInput(e.target.value)}
                        placeholder={t("search.filters.priceTo")} className="h-8 text-sm" />
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("search.filters.rating")}
                    </Label>
                    <div className="flex gap-1 flex-wrap">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setMinRating(minRating === star ? 0 : star)}
                          className={cn(
                            "flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors",
                            minRating === star
                              ? "bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950/50 dark:border-amber-600/60 dark:text-amber-400"
                              : "border-border text-muted-foreground hover:border-amber-300"
                          )}>
                          <Star className={cn("h-3 w-3", minRating === star ? "fill-amber-500 text-amber-500" : "")} />
                          {star}+
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Store filter — only visible in search mode with results */}
                  {searchMode && (filterOptions?.stores?.length ?? 0) > 0 && (
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        {t("search.filters.store")}
                      </Label>
                      <div className="space-y-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border">
                        <button
                          type="button"
                          onClick={() => setStoreId(null)}
                          className={cn(
                            "w-full text-start flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors",
                            storeId === null
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          <span>{lang === "ar" ? "جميع المتاجر" : "All stores"}</span>
                        </button>
                        {(filterOptions?.stores ?? []).slice(0, 12).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStoreId(storeId === s.id ? null : s.id)}
                            className={cn(
                              "w-full text-start flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors",
                              storeId === s.id
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                          >
                            <span className="truncate max-w-[120px]">{lang === "ar" ? (s.nameAr || s.nameEn) : s.nameEn}</span>
                            <span className="shrink-0 ms-1 opacity-50">{s.productCount}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggles */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Checkbox id="onSale" checked={hasDiscount} onCheckedChange={(c) => setHasDiscount(!!c)} />
                      <label htmlFor="onSale" className="text-sm cursor-pointer select-none">
                        {lang === "ar" ? "عروض وخصومات فقط" : "On Sale Only"}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="inStock" checked={inStock} onCheckedChange={(c) => setInStock(!!c)} />
                      <label htmlFor="inStock" className="text-sm cursor-pointer select-none">
                        {t("search.filters.inStock")}
                      </label>
                    </div>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 min-w-0">

                {/* ── NLP Insights Banner — above filter controls (Bug 3 fix) ── */}
                {searchMode && !nlpBannerDismissed && (searchIntent?.nlpExpandedCount ?? 0) > 0 && (
                  <div
                    dir={isRtl ? "rtl" : "ltr"}
                    className="flex items-center gap-2.5 mb-3 px-3.5 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs"
                  >
                    <span className="shrink-0 text-base leading-none" aria-hidden="true">🔍</span>
                    <span className="flex-1 text-violet-700 dark:text-violet-300 leading-snug">
                      {isRtl
                        ? `تم مطابقة ${searchIntent!.nlpExpandedCount} مرادفات لغوية لـ: ${(searchIntent!.nlpBaseTokens ?? []).join("، ")}`
                        : `Matched ${searchIntent!.nlpExpandedCount} linguistic synonyms for: ${(searchIntent!.nlpBaseTokens ?? []).join(", ")}`
                      }
                    </span>
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20 tracking-wide"
                      title={isRtl ? "لغة الاستعلام" : "Query language"}
                    >
                      {searchIntent!.primaryLanguage === "ar" ? "العربية" : "English"}
                    </span>
                    <button
                      type="button"
                      aria-label={isRtl ? "إخفاء" : "Dismiss"}
                      onClick={() => setNlpBannerDismissed(true)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors rounded-full p-0.5 hover:bg-violet-500/10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* ── Active filter chips + result count — above filter controls (Bug 3 fix) ── */}
                {searchMode && (searchIntent?.modifiers.length || searchIntent?.mappedCategory || debouncedQuery || totalResults !== undefined) && (
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {totalResults !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {isRtl
                          ? `${totalResults.toLocaleString()} نتيجة`
                          : `${totalResults.toLocaleString()} result${totalResults !== 1 ? "s" : ""}`}
                      </span>
                    )}
                    {apiEngineMode === "hybrid" && (
                      <span
                        title={t("search.semantic.hybridTooltip", { count: semanticResultCount })}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 select-none"
                      >
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                        </svg>
                        {t("search.semantic.smartSearch")}
                      </span>
                    )}
                    {debouncedQuery && (
                      <button
                        type="button"
                        onClick={() => { setQuery(""); navigate("/shop"); }}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Search className="h-3 w-3 shrink-0" />
                        <span className="max-w-[120px] truncate">
                          {debouncedQuery.length > 22 ? `${debouncedQuery.slice(0, 22)}…` : debouncedQuery}
                        </span>
                        <X className="h-3 w-3 ms-0.5 opacity-70 shrink-0" />
                      </button>
                    )}
                    {searchIntent?.mappedCategory && (
                      <button
                        type="button"
                        onClick={() => setCategory(searchIntent.mappedCategory ?? undefined)}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/15 transition-colors"
                      >
                        {searchIntent.mappedCategory}
                        <X className="h-3 w-3 ms-0.5 opacity-70" />
                      </button>
                    )}
                    {(searchIntent?.modifiers ?? []).map((mod) => (
                      <span key={mod} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {MODIFIER_LABELS[mod] ?? mod}
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Mobile filter bar — static, below chips (Bug 3 fix: no sticky) ── */}
                <div className="flex items-center gap-2 mb-4 lg:hidden">
                  <button onClick={() => setFiltersOpen(!filtersOpen)}
                    className={cn(
                      "flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-sm font-medium transition-colors",
                      filtersOpen || activeFilterCount > 0
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {lang === "ar" ? "الفلاتر" : "Filters"}
                    {activeFilterCount > 0 && (
                      <span className="bg-emerald-500 text-white rounded-full h-4 w-4 text-[10px] flex items-center justify-center font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="h-9 flex-1 text-sm max-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSortOptions.map((k) => (
                        <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
                      {t("search.filters.clearAll")}
                    </button>
                  )}
                </div>

                {/* ── Mobile expanded filters — space-y-5 matching desktop sidebar (Bug 2b fix) ── */}
                {filtersOpen && (
                  <div className="lg:hidden mb-4 p-4 bg-card rounded-xl border border-border/60 space-y-5">
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        {lang === "ar" ? "الفئة" : "Category"}
                      </Label>
                      <Select value={category ?? "all"} onValueChange={(v) => setCategory(v === "all" ? undefined : v)}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={lang === "ar" ? "جميع الفئات" : "All categories"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{lang === "ar" ? "جميع الفئات" : "All categories"}</SelectItem>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>{lang === "ar" ? c.ar : c.en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        {lang === "ar" ? "السعر" : "Price"} ({symbol})
                      </Label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" value={minPriceInput}
                          onChange={(e) => setMinPriceInput(e.target.value)}
                          placeholder={lang === "ar" ? "من" : "Min"} className="h-9 text-sm" />
                        <Input type="number" min="0" value={maxPriceInput}
                          onChange={(e) => setMaxPriceInput(e.target.value)}
                          placeholder={lang === "ar" ? "إلى" : "Max"} className="h-9 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        {lang === "ar" ? "التقييم" : "Rating"}
                      </Label>
                      <div className="flex gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" onClick={() => setMinRating(minRating === star ? 0 : star)}
                            className={cn(
                              "flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors",
                              minRating === star
                                ? "bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950/50 dark:border-amber-600/60 dark:text-amber-400"
                                : "border-border text-muted-foreground"
                            )}>
                            <Star className={cn("h-3 w-3", minRating === star ? "fill-amber-500 text-amber-500" : "")} />
                            {star}+
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox id="mOnSale" checked={hasDiscount} onCheckedChange={(c) => setHasDiscount(!!c)} />
                        <label htmlFor="mOnSale" className="text-sm">{lang === "ar" ? "عروض فقط" : "On Sale Only"}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="mInStock" checked={inStock} onCheckedChange={(c) => setInStock(!!c)} />
                        <label htmlFor="mInStock" className="text-sm">{t("search.filters.inStock")}</label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Products Grid */}
                {isLoadingProducts && products.length === 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                        <Skeleton className="aspect-square w-full rounded-none" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-2.5 w-2/3" />
                          <Skeleton className="h-3.5 w-full" />
                          <Skeleton className="h-3.5 w-4/5" />
                          <div className="pt-2">
                            <Skeleton className="h-5 w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center" dir={isRtl ? "rtl" : "ltr"}>
                    {searchMode && searchFallback ? (
                      /* Fallback returned products but then they got deduped away — show empty+trending */
                      <>
                        <SearchX className="h-16 w-16 text-muted-foreground/30 mb-5" />
                        <p className="text-xl font-semibold text-foreground mb-2">
                          {t("search.empty.title", { query: debouncedQuery })}
                        </p>
                        <p className="text-sm text-muted-foreground mb-5">
                          {t("search.empty.subtitle")}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => { setQuery(""); navigate("/shop"); }}>
                          {t("search.empty.clearButton")}
                        </Button>
                      </>
                    ) : searchMode ? (
                      <>
                        <SearchX className="h-16 w-16 text-muted-foreground/30 mb-5" />
                        <p className="text-xl font-semibold text-foreground mb-2">
                          {t("search.empty.title", { query: debouncedQuery })}
                        </p>
                        <p className="text-sm text-muted-foreground mb-5">
                          {t("search.empty.subtitle")}
                        </p>
                        {searchData?.didYouMean && (
                          <button
                            type="button"
                            onClick={() => { setQuery(searchData.didYouMean!); navigate(`/shop?q=${encodeURIComponent(searchData.didYouMean!)}`); }}
                            className="mb-4 px-4 py-2 rounded-xl text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          >
                            {t("search.empty.didYouMean", { suggestion: searchData.didYouMean })}
                          </button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => { setQuery(""); navigate("/shop"); }}>
                          {t("search.empty.clearButton")}
                        </Button>
                        {activeFilterCount > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
                            {t("search.filters.clearAll")}
                          </Button>
                        )}
                        {trendingSearches.length >= 3 && (
                          <div className="mt-8">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                              {t("search.empty.trending")}
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                              {trendingSearches.slice(0, 5).map((tr: TrendingQuery) => (
                                <button
                                  key={tr.query}
                                  type="button"
                                  onClick={() => { setQuery(tr.query); navigate(`/shop?q=${encodeURIComponent(tr.query)}`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-border/70 text-foreground/75 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                                >
                                  <TrendingUp className="h-3 w-3 shrink-0 opacity-60" />
                                  {tr.query}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <Link href="/categories" className="mt-6 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                          {t("search.empty.browseCategories")}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
                        <p className="text-lg font-semibold text-foreground mb-1">
                          {activeFilterCount > 0 ? t("search.results.noResultsWithFilters") : (lang === "ar" ? "لا توجد منتجات" : "No products found")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("search.results.tryReducingFilters")}
                        </p>
                        {activeFilterCount > 0 && (
                          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                            {t("search.filters.clearAll")}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* ── Fallback Banner ───────────────────────────────── */}
                    {searchMode && searchFallback && !fallbackBannerDismissed && (
                      <div
                        className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm"
                        dir={isRtl ? "rtl" : "ltr"}
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-amber-800 dark:text-amber-300">
                            {t(`search.fallback.level${searchFallback.level}Title`)}
                          </p>
                          <p className="text-amber-700/80 dark:text-amber-400/80 leading-snug mt-0.5">
                            {t(`search.fallback.level${searchFallback.level}Subtitle`, {
                              query:           debouncedQuery,
                              relaxedQuery:    searchFallback.relaxedQuery ?? "",
                              category:        searchFallback.inferredCategory ?? "",
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFallbackBannerDismissed(true)}
                          aria-label={t("search.fallback.dismiss")}
                          className="shrink-0 rounded p-0.5 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {products.map((p: any) => (
                        <div key={p.id} onClick={() => { if (searchMode && searchLogId != null) recordSearchClick(searchLogId); }}>
                          <ProductCard product={p} highlightQuery={debouncedQuery || undefined} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Load more ─────────────────────────────────────── */}
                {products.length > 0 && hasMoreProducts && (
                  <div className="flex justify-center mt-8">
                    <Button variant="outline" onClick={handleLoadMore}
                      disabled={isFetchingProducts}
                      className="min-w-[140px]">
                      {isFetchingProducts
                        ? (lang === "ar" ? "جاري التحميل..." : "Loading...")
                        : (lang === "ar" ? "تحميل المزيد" : "Load more")}
                    </Button>
                  </div>
                )}

                {/* ── Related Searches — shown for any result count ── */}
                {searchMode && relatedSearches.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-border/60" dir={isRtl ? "rtl" : "ltr"}>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                        {t("search.related.title")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {relatedSearches.map((r) => (
                        <button
                          key={r.query}
                          type="button"
                          onClick={() => { setQuery(r.query); navigate(`/shop?q=${encodeURIComponent(r.query)}`); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-border/70 text-foreground/75 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors"
                        >
                          <Search className="h-3 w-3 shrink-0 opacity-60" />
                          {r.query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stores Tab ───────────────────────────────────────── */}
        {activeTab === "stores" && (
          <div className="container px-4 pb-6" style={{ paddingTop: `${searchHeaderHeight}px` }}>
            {storesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-40" />
                ))}
              </div>
            ) : stores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Store className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-lg font-semibold text-foreground mb-1">
                  {lang === "ar" ? "لا توجد متاجر" : "No stores found"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "حاول البحث بكلمة مختلفة" : "Try a different search term"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stores.map((s) => (
                  <Link key={s.userId} href={s.storeSlug ? `/store/${s.storeSlug}` : `/shop?sellerId=${s.userId}`}>
                    <div className="bg-card border border-border/60 rounded-2xl p-4 hover:border-emerald-500/40 hover:shadow-md transition-all group cursor-pointer">
                      <div className="flex items-center gap-3 mb-3">
                        {s.storeLogo ? (
                          <img src={s.storeLogo} alt={s.storeName}
                            className="h-12 w-12 rounded-xl object-cover border border-border/60 shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <Store className="h-6 w-6 text-emerald-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {s.storeName}
                          </div>
                          {s.city && (
                            <div className="text-xs text-muted-foreground truncate">{s.city}</div>
                          )}
                        </div>
                      </div>
                      {s.categories && s.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {s.categories.slice(0, 2).map((cat: string) => (
                            <span key={cat} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-muted-foreground">
                          {s.followerCount > 0 && `${s.followerCount} ${lang === "ar" ? "متابع" : "followers"}`}
                        </div>
                        <ChevronRight className={cn("h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity", isRtl && "rotate-180")} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Categories Tab ───────────────────────────────────── */}
        {activeTab === "categories" && (
          <div className="container px-4 pb-6" style={{ paddingTop: `${searchHeaderHeight}px` }}>
            {matchedCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-lg font-semibold text-foreground mb-1">
                  {lang === "ar" ? "لا توجد فئات مطابقة" : "No categories found"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "حاول البحث بكلمة مختلفة" : "Try a different search term"}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {matchedCategories.map((cat) => {
                  const Icon = ICON_MAP[cat.icon] ?? Package;
                  const matchingSubcats = cat.subcategories.filter((s) => {
                    const q = debouncedQuery.toLowerCase();
                    return s.en.toLowerCase().includes(q) || s.ar.includes(debouncedQuery);
                  });
                  return (
                    <div key={cat.slug} className="bg-card border border-border/60 rounded-2xl p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", cat.iconBg)}>
                          <Icon className={cn("h-5 w-5", cat.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground">{lang === "ar" ? cat.ar : cat.en}</div>
                          <div className="text-xs text-muted-foreground">
                            {cat.subcategories.length} {lang === "ar" ? "فئة فرعية" : "subcategories"}
                          </div>
                        </div>
                        <Link href={`/shop?category=${encodeURIComponent(cat.slug)}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
                            {lang === "ar" ? "تصفح" : "Browse"}
                            <ArrowRight className={cn("h-3.5 w-3.5", isRtl && "rotate-180")} />
                          </Button>
                        </Link>
                      </div>
                      {matchingSubcats.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {matchingSubcats.map((sub) => (
                            <Link key={sub.slug} href={`/shop?category=${encodeURIComponent(cat.slug)}&subcategory=${encodeURIComponent(sub.slug)}`}>
                              <Badge variant="secondary" className="cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                {lang === "ar" ? sub.ar : sub.en}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* All categories when query matches broadly */}
                {matchedCategories.length < 5 && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-3">
                      {lang === "ar" ? "جميع الفئات" : "All Categories"}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {CATEGORIES.filter((c) => !matchedCategories.find((m) => m.slug === c.slug)).map((cat) => {
                        const Icon = ICON_MAP[cat.icon] ?? Package;
                        return (
                          <Link key={cat.slug} href={`/shop?category=${encodeURIComponent(cat.slug)}`}>
                            <div className="flex flex-col items-center gap-2 p-3 bg-card border border-border/60 rounded-xl hover:border-emerald-500/40 hover:shadow-sm transition-all cursor-pointer group">
                              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", cat.iconBg)}>
                                <Icon className={cn("h-5 w-5", cat.iconColor)} />
                              </div>
                              <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors">
                                {lang === "ar" ? cat.ar : cat.en}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state — no query */}
        {!debouncedQuery && (
          <div className="container px-4 py-12 text-center">
            <Search className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-xl font-semibold text-foreground mb-2">
              {lang === "ar" ? "اكتشف منتجاتنا" : "Discover our products"}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {lang === "ar"
                ? "ابحث عن منتجات، تسوق بالفئات، أو اكتشف متاجر سورية متميزة"
                : "Search for products, browse categories, or discover top Syrian stores"}
            </p>

            {/* Category shortcuts */}
            <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-3xl mx-auto">
              {CATEGORIES.slice(0, 12).map((cat) => {
                const Icon = ICON_MAP[cat.icon] ?? Package;
                return (
                  <Link key={cat.slug} href={`/shop?category=${encodeURIComponent(cat.slug)}`}>
                    <div className="flex flex-col items-center gap-2 p-3 bg-card border border-border/60 rounded-xl hover:border-emerald-500/40 hover:shadow-sm transition-all cursor-pointer group">
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", cat.iconBg)}>
                        <Icon className={cn("h-5 w-5", cat.iconColor)} />
                      </div>
                      <span className="text-[11px] font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors">
                        {lang === "ar" ? cat.ar : cat.en}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
