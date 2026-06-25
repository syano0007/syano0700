import React, { useState } from "react";
import { useListProducts } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, SlidersHorizontal, X, Store,
  Cpu, Shirt, Sparkles, Home as HomeIcon, ShoppingBasket, Dumbbell,
  Car, Gamepad2, BookOpen, PawPrint, Download, Palette,
  Gem, Baby, Wrench, TreePine, Gift, Star,
  Flame, Timer, Tag,
} from "lucide-react";
import { useCountdown } from "@/hooks/use-countdown";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSEO } from "@/hooks/useSEO";

const ICON_MAP: Record<string, React.ElementType> = {
  Cpu, Shirt, Sparkles, Home: HomeIcon, ShoppingBasket, Dumbbell,
  Car, Gamepad2, BookOpen, PawPrint, Download, Palette,
  Gem, Baby, Wrench, TreePine, Gift,
};

const NO_SCROLL = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";

type SortOption = "newest" | "price_asc" | "price_desc" | "highest_rated" | "most_discounted" | "best_selling";

export default function Products() {
  const { t, i18n } = useTranslation();
  const { currency, symbol, exchangeRate } = useCurrency();
  const lang = i18n.language;

  const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const initialCategory    = sp.get("category") || undefined;
  const initialSearch      = sp.get("search") || "";
  const initialHasDiscount = sp.get("hasDiscount") === "true" || sp.get("onSale") === "true";

  const [search,        setSearch]        = useState(initialSearch);
  const [category,      setCategory]      = useState<string | undefined>(initialCategory);
  const [subcategory,   setSubcategory]   = useState<string | undefined>(undefined);
  const [sortBy,        setSortBy]        = useState<SortOption>("newest");
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [hasDiscount,   setHasDiscount]   = useState(initialHasDiscount);
  const [inStock,       setInStock]       = useState(false);
  const [minRating,     setMinRating]     = useState(0);
  const [filtersOpen,   setFiltersOpen]   = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);

  /* Countdown — only active when Hot Deals filter is on */
  const getFlashSaleTarget = React.useCallback(
    () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    [],
  );
  const { formatted: flashSaleFormatted } = useCountdown(getFlashSaleTarget);

  const debouncedSearch = useDebounce(search, 350);
  const matchedCategory = category ? CATEGORIES.find((c) => c.slug === category) : undefined;
  const categoryLabel = matchedCategory
    ? lang === "ar" ? matchedCategory.ar : matchedCategory.en
    : category ?? null;

  useSEO({
    title: categoryLabel
      ? lang === "ar" ? `${categoryLabel} — تسوّق الآن` : `${categoryLabel} — Shop online`
      : lang === "ar" ? "اكتشف جميع المنتجات" : "Discover all products",
    description: categoryLabel
      ? lang === "ar"
        ? `تسوّق أفضل منتجات ${categoryLabel} من بائعين موثوقين في سوريا. توصيل سريع، دفع آمن.`
        : `Shop the best ${categoryLabel} from trusted sellers across Syria. Fast delivery, secure payments.`
      : lang === "ar"
      ? "تصفّح آلاف المنتجات من البائعين السوريين الموثوقين. فلتر بالفئة، السعر، والتقييم."
      : "Browse thousands of products from trusted Syrian sellers. Filter by category, price, and rating.",
    canonical: category ? `/products?category=${category}` : "/products",
  });

  const toUsd = (val: string) => {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : currency === "SYP" ? n / exchangeRate : n;
  };

  const PAGE_SIZE = 24;
  const [offset, setOffset] = React.useState(0);
  const [accumulated, setAccumulated] = React.useState<any[]>([]);
  const prevFilterKey = React.useRef("");

  const filterKey = [debouncedSearch, category, subcategory, sortBy, minPriceInput, maxPriceInput, hasDiscount, inStock, minRating].join("|");

  React.useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setOffset(0);
      setAccumulated([]);
    }
  }, [filterKey]);

  const { data: pageData, isLoading, isFetching } = useListProducts({
    search:      debouncedSearch || undefined,
    category:    category && category !== "all" ? category : undefined,
    subcategory: subcategory && subcategory !== "all" ? subcategory : undefined,
    sortBy,
    minPrice:    toUsd(minPriceInput),
    maxPrice:    toUsd(maxPriceInput),
    hasDiscount: hasDiscount || undefined,
    inStock:     inStock || undefined,
    minRating:   minRating > 0 ? minRating : undefined,
    limit:       PAGE_SIZE,
    offset,
  } as any);

  React.useEffect(() => {
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

  const products = accumulated;
  const hasMore = (pageData?.length ?? 0) >= PAGE_SIZE;

  const activeCat = CATEGORIES.find((c) => c.slug === category);

  const selectCategory = (slug: string | undefined) => {
    setCategory(slug);
    setSubcategory(undefined);
  };

  const clearFilters = () => {
    setSearch(""); setCategory(undefined); setSubcategory(undefined);
    setSortBy("newest"); setMinPriceInput(""); setMaxPriceInput("");
    setHasDiscount(false); setInStock(false); setMinRating(0);
  };

  const activeFilterCount = [
    search, category && category !== "all", subcategory,
    sortBy !== "newest", minPriceInput, maxPriceInput,
    hasDiscount, inStock, minRating > 0,
  ].filter(Boolean).length;

  const hasActive = activeFilterCount > 0;

  const SORT_LABELS: Record<SortOption, string> = {
    newest:          t("products.sort_newest"),
    price_asc:       t("products.sort_price_asc"),
    price_desc:      t("products.sort_price_desc"),
    highest_rated:   t("products.sort_highest_rated"),
    most_discounted: t("products.sort_most_discounted"),
    best_selling:    t("products.sort_best_selling"),
  };

  const renderStarPicker = () => (
    <div className="flex gap-1 flex-wrap">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setMinRating(minRating === star ? 0 : star)}
          className={cn(
            "flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-sm font-medium border transition-colors",
            minRating === star
              ? "bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950/50 dark:border-amber-600/60 dark:text-amber-400"
              : "border-border text-muted-foreground hover:border-amber-300 hover:text-amber-500"
          )}
        >
          <Star className={cn("h-3.5 w-3.5 me-0.5", minRating === star ? "fill-amber-500 text-amber-500" : "")} />
          {star}+
        </button>
      ))}
    </div>
  );

  const renderMobileAdvancedFilters = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("products.price_range")} ({symbol})
        </Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder={t("products.min_price")}
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            className="h-10 text-base"
          />
          <span className="text-muted-foreground text-sm shrink-0">—</span>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder={t("products.max_price")}
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            className="h-10 text-base"
          />
        </div>
      </div>
      <div>
        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("products.min_rating")}
        </Label>
        {renderStarPicker()}
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <Checkbox id="on-sale" checked={hasDiscount} onCheckedChange={(v) => setHasDiscount(!!v)} />
          <Label htmlFor="on-sale" className="cursor-pointer text-sm font-medium">{t("products.on_sale")}</Label>
        </div>
        <div className="flex items-center gap-2.5">
          <Checkbox id="in-stock-filter" checked={inStock} onCheckedChange={(v) => setInStock(!!v)} />
          <Label htmlFor="in-stock-filter" className="cursor-pointer text-sm font-medium">{t("products.in_stock_only")}</Label>
        </div>
      </div>
      {hasActive && (
        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full gap-1.5">
          <X className="h-3.5 w-3.5" />
          {t("products.clear_filters")}
        </Button>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="w-full max-w-[80rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8 space-y-0">

        <div className="mb-5">
          <h1 className="heading-section">{t("products.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("products.subtitle")}</p>
        </div>

        {/* ── Integrated Search Bar ─────────────────────── */}
        <div className="flex rounded-xl border bg-background shadow-sm overflow-hidden mb-4 h-11">

          <div className="hidden sm:flex shrink-0 border-e">
            <Select value={category || "all"} onValueChange={(v) => selectCategory(v === "all" ? undefined : v)}>
              <SelectTrigger className="h-11 w-[9.25rem] rounded-none border-0 bg-muted/30 shadow-none text-sm focus:ring-0 focus:ring-offset-0 truncate">
                <SelectValue placeholder={t("products.all_categories")} />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">{t("products.all_categories")}</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>
                    {lang === "ar" ? cat.ar : cat.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("products.search_placeholder")}
              className="h-11 border-0 rounded-none shadow-none ps-9 pe-9 focus-visible:ring-0 bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex shrink-0 border-s">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-11 w-[11.75rem] rounded-none border-0 bg-muted/20 shadow-none text-sm focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="newest">{t("products.sort_newest")}</SelectItem>
                <SelectItem value="price_asc">{t("products.sort_price_asc")}</SelectItem>
                <SelectItem value="price_desc">{t("products.sort_price_desc")}</SelectItem>
                <SelectItem value="highest_rated">{t("products.sort_highest_rated")}</SelectItem>
                <SelectItem value="most_discounted">{t("products.sort_most_discounted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-3.5 shrink-0 border-s text-sm font-medium transition-colors",
              filtersOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex sm:hidden shrink-0 border-s">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="flex items-center px-3 h-full text-muted-foreground hover:text-foreground relative">
                  <SlidersHorizontal className="h-[1.125rem] w-[1.125rem]" />
                  {activeFilterCount > 0 && (
                    <span className="absolute top-1.5 end-1.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto pb-8" aria-describedby={undefined}>
                <SheetHeader className="mb-5">
                  <SheetTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t("products.filters")}
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{activeFilterCount}</Badge>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-5">
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("products.all_categories")}
                    </Label>
                    <Select value={category || "all"} onValueChange={(v) => selectCategory(v === "all" ? undefined : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("products.all_categories")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        <SelectItem value="all">{t("products.all_categories")}</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {lang === "ar" ? cat.ar : cat.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeCat && activeCat.subcategories.length > 0 && (
                    <div>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        {t("products.subcategory")}
                      </Label>
                      <Select value={subcategory || "all"} onValueChange={(v) => setSubcategory(v === "all" ? undefined : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("products.all_subcategories")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[260px]">
                          <SelectItem value="all">{t("products.all_subcategories")}</SelectItem>
                          {activeCat.subcategories.map((sub) => (
                            <SelectItem key={sub.slug} value={sub.slug}>
                              {lang === "ar" ? sub.ar : sub.en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("products.sort_by")}
                    </Label>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">{t("products.sort_newest")}</SelectItem>
                        <SelectItem value="price_asc">{t("products.sort_price_asc")}</SelectItem>
                        <SelectItem value="price_desc">{t("products.sort_price_desc")}</SelectItem>
                        <SelectItem value="highest_rated">{t("products.sort_highest_rated")}</SelectItem>
                        <SelectItem value="most_discounted">{t("products.sort_most_discounted")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {renderMobileAdvancedFilters()}
                </div>
                <div className="mt-5">
                  <Button className="w-full h-11" onClick={() => setMobileOpen(false)}>
                    {lang === "ar"
                      ? `عرض النتائج (${products?.length ?? 0})`
                      : `Show Results (${products?.length ?? 0})`}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* ── Desktop Advanced Filters Panel ────────────── */}
        {filtersOpen && (
          <div className="mb-4 px-4 py-4 bg-muted/20 border rounded-xl hidden sm:block">
            <div className="flex flex-wrap gap-6 items-start">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("products.min_price")} ({symbol})
                </Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  className="h-9 w-[7.5rem]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("products.max_price")} ({symbol})
                </Label>
                <Input
                  type="number" min="0" placeholder="∞"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  className="h-9 w-[7.5rem]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("products.min_rating")}
                </Label>
                {renderStarPicker()}
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <div className="flex items-center gap-2.5">
                  <Checkbox id="on-sale-d" checked={hasDiscount} onCheckedChange={(v) => setHasDiscount(!!v)} />
                  <Label htmlFor="on-sale-d" className="cursor-pointer text-sm font-medium">{t("products.on_sale")}</Label>
                </div>
                <div className="flex items-center gap-2.5">
                  <Checkbox id="in-stock-d" checked={inStock} onCheckedChange={(v) => setInStock(!!v)} />
                  <Label htmlFor="in-stock-d" className="cursor-pointer text-sm font-medium">{t("products.in_stock_only")}</Label>
                </div>
              </div>
              {hasActive && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 h-9 self-end">
                  <X className="h-3.5 w-3.5" />
                  {t("products.clear_filters")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Category Chips ────────────────────────────── */}
        <div className={cn("flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0", NO_SCROLL)}>
          <button
            onClick={() => selectCategory(undefined)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium shrink-0 transition-[background-color,border-color,color,opacity] duration-150 border",
              !category || category === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-border/80 hover:text-foreground hover:bg-muted/40"
            )}
          >
            {t("products.all_categories")}
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? Store;
            const active = category === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => selectCategory(active ? undefined : cat.slug)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium shrink-0 transition-[background-color,border-color,color,opacity] duration-150 border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-border/80 hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary-foreground" : cat.iconColor)} />
                {lang === "ar" ? cat.ar : cat.en}
              </button>
            );
          })}
        </div>

        {/* ── Subcategory Chips ─────────────────────────── */}
        {activeCat && activeCat.subcategories.length > 0 && (
          <div className={cn("flex gap-1.5 overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 mt-2", NO_SCROLL)}>
            <button
              onClick={() => setSubcategory(undefined)}
              className={cn(
                "whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-[background-color,border-color,color,opacity] duration-150 border",
                !subcategory
                  ? "bg-foreground/10 text-foreground border-foreground/15 font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {t("products.all_subcategories")}
            </button>
            {activeCat.subcategories.map((sub) => (
              <button
                key={sub.slug}
                onClick={() => setSubcategory(sub.slug === subcategory ? undefined : sub.slug)}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-[background-color,border-color,color,opacity] duration-150 border",
                  subcategory === sub.slug
                    ? "bg-primary/12 text-primary border-primary/20 font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {lang === "ar" ? sub.ar : sub.en}
              </button>
            ))}
          </div>
        )}

        {/* ── Active filter tags + product count ────────── */}
        <div className="flex items-center justify-between mt-3 mb-4 min-h-[26px]">
          <div className="flex items-center gap-2 flex-wrap">
            {hasDiscount && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {t("products.on_sale")}
                <button onClick={() => setHasDiscount(false)} className="ms-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            )}
            {inStock && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                {t("products.in_stock_only")}
                <button onClick={() => setInStock(false)} className="ms-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            )}
            {minRating > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {"★".repeat(minRating)}+
                <button onClick={() => setMinRating(0)} className="ms-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            )}
            {(minPriceInput || maxPriceInput) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {minPriceInput && maxPriceInput
                  ? `${symbol}${minPriceInput}–${symbol}${maxPriceInput}`
                  : minPriceInput ? `≥${symbol}${minPriceInput}` : `≤${symbol}${maxPriceInput}`}
                <button onClick={() => { setMinPriceInput(""); setMaxPriceInput(""); }} className="ms-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            )}
            {sortBy !== "newest" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                {SORT_LABELS[sortBy]}
                <button onClick={() => setSortBy("newest")} className="ms-0.5 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
              </span>
            )}
            {hasActive && !minPriceInput && !maxPriceInput && !hasDiscount && !inStock && !(minRating > 0) && sortBy === "newest" && !search && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {t("products.clear_filters")}
              </button>
            )}
          </div>
          {!isLoading && products && (
            <p className="text-sm text-muted-foreground shrink-0">
              {t("products.count", { count: products.length })}
            </p>
          )}
        </div>

        {/* ── Hot Deals Banner (shown when hasDiscount filter is active) ── */}
        {hasDiscount && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-rose-950/40 to-background border border-rose-500/20 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-foreground">{t("products.hot_deals")}</span>
                  <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Tag className="h-2.5 w-2.5" />
                    {t("products.exclusive_discounts")}
                  </span>
                </div>
                {!isLoading && products && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("products.count", { count: products.length })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
                <Timer className="h-3 w-3 shrink-0" />
                <span className="opacity-80">{t("home.deals.ends_in")}</span>
                <span dir="ltr">{flashSaleFormatted}</span>
              </span>
            </div>
          </div>
        )}

        {/* ── Product Grid ──────────────────────────────── */}
        {isLoading ? (
          <div className="product-grid">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col rounded-xl bg-muted/30 overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-2.5 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-5 bg-muted rounded w-1/4 mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="sy-empty-state flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-semibold mb-2">{t("products.no_found")}</h3>
            <p className="text-muted-foreground max-w-sm mb-6 text-sm px-4">{t("products.no_found_desc")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {search && (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  {t("products.clear_search")}
                </Button>
              )}
              {hasActive && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t("products.clear_filters")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="product-grid">
              {products.map((product: any) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  flashSaleEndsIn={
                    hasDiscount && product.discountPercent && product.discountPercent > 0
                      ? flashSaleFormatted
                      : undefined
                  }
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                  disabled={isFetching}
                  className="min-w-[12.5rem]"
                >
                  {isFetching ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      {t("common.loading")}
                    </span>
                  ) : (
                    t("products.load_more")
                  )}
                </Button>
              </div>
            )}
            {!hasMore && products.length > PAGE_SIZE && (
              <p className="text-center text-sm text-muted-foreground mt-6">
                {t("products.all_shown")}
              </p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
