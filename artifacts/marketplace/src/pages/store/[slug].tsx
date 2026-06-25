// @refresh reset
import { useState, useMemo } from "react";
import { calculateDiscountPercent } from "@/lib/pricing";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import {
  Star, Users, Package, ShoppingBag, Calendar,
  MapPin, Globe, CheckCircle2, MessageCircle, ArrowLeft,
  TrendingUp, Search, ChevronDown, Shield, Award,
  Clock, RotateCcw, Truck, Sparkles, BadgeCheck,
  Filter, Phone, Mail, Instagram, ExternalLink,
} from "lucide-react";
import { SellerTrustBadge, TrustScoreBar, type VerificationLevel } from "@/components/SellerTrustBadge";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  useGetStoreProfile,
  useGetFollowStatus,
  getFollowStatusQueryKey,
  useFollowStore,
  useUnfollowStore,
  useGetSellerReviews,
  getSellerReviewsQueryKey,
  useStartConversation,
  useListProducts,
  type StoreProfile,
} from "@workspace/api-client-react";
import { SellerReviewPrompt } from "@/components/SellerReviewPrompt";
import { useToast } from "@/hooks/use-toast";

/* ── Types ───────────────────────────────────────────────────── */
type Tab = "products" | "featured" | "reviews" | "about" | "contact" | "policies";
type SortKey = "newest" | "price_asc" | "price_desc" | "name";

/* ── Helpers ─────────────────────────────────────────────────── */
function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const s = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${
            i <= full
              ? "fill-amber-400 text-amber-400"
              : i === full + 1 && half
              ? "fill-amber-200 text-amber-400"
              : "fill-none text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function TrustBadge({
  verificationLevel,
  trustScore,
  isVerified,
}: {
  verificationLevel: string;
  trustScore: number | null;
  isVerified?: boolean;
}) {
  if (!isVerified && verificationLevel === "none") return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SellerTrustBadge
        level={(verificationLevel ?? "none") as VerificationLevel}
        isVerified={isVerified ?? false}
        size="sm"
      />
      {trustScore != null && (
        <span className="text-[10px] text-muted-foreground font-medium">{trustScore}/100</span>
      )}
    </div>
  );
}

/* ── Follow Button ───────────────────────────────────────────── */
function FollowButton({ sellerId }: { sellerId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: status, isLoading } = useGetFollowStatus(sellerId, {
    query: { enabled: !!user && user.role === "customer", queryKey: getFollowStatusQueryKey(sellerId) },
  });
  const followMut = useFollowStore();
  const unfollowMut = useUnfollowStore();

  if (!user || user.role !== "customer") return null;
  if (isLoading) return <Skeleton className="h-10 w-36 rounded-xl" />;

  const following = status?.following ?? false;
  const count = status?.followerCount ?? 0;

  const toggle = () => {
    if (following) {
      unfollowMut.mutate(sellerId, {
        onError: () =>
          toast({ title: t("common.error"), description: t("store.unfollow_error"), variant: "destructive" }),
      });
    } else {
      followMut.mutate(sellerId, {
        onSuccess: () =>
          toast({ title: t("store.follow_success_title"), description: t("store.follow_success_desc") }),
        onError: () =>
          toast({ title: t("common.error"), description: t("store.follow_error"), variant: "destructive" }),
      });
    }
  };

  const busy = followMut.isPending || unfollowMut.isPending;

  return (
    <Button
      onClick={toggle}
      disabled={busy}
      variant={following ? "secondary" : "default"}
      size="sm"
      className="gap-2 h-10 px-5 rounded-xl font-semibold"
    >
      {following ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          {t("store.following")}
        </>
      ) : (
        <>
          <Users className="h-4 w-4 shrink-0" />
          {t("store.follow")}
        </>
      )}
      {count > 0 && <span className="text-xs font-normal opacity-60">({count.toLocaleString()})</span>}
    </Button>
  );
}

/* ── Contact Button ──────────────────────────────────────────── */
function ContactButton({ sellerId }: { sellerId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const startConv = useStartConversation();

  if (!user || user.role !== "customer") return null;

  const handleContact = () => {
    startConv.mutate(
      { sellerId },
      {
        onSuccess: () => navigate("/messages"),
        onError: () =>
          toast({ title: t("common.error"), description: t("store.contact_error"), variant: "destructive" }),
      }
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleContact}
      disabled={startConv.isPending}
      className="gap-2 h-10 px-5 rounded-xl font-semibold"
    >
      <MessageCircle className="h-4 w-4 shrink-0" />
      {t("store.contact_seller")}
    </Button>
  );
}

/* ── KPI Card ────────────────────────────────────────────────── */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accentColor: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-card border-s-4 border hover:shadow-sm transition-shadow min-w-0"
      style={{ borderInlineStartColor: accentColor }}
    >
      <div
        className="h-8 w-8 rounded-xl flex items-center justify-center mb-0.5"
        style={{ backgroundColor: accentColor + "22" }}
      >
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
      </div>
      <span translate="no" className="text-xl font-black text-foreground tabular-nums leading-tight">
        {value}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground/70 text-center">{sub}</span>}
    </div>
  );
}

/* ── Mini Product Card ───────────────────────────────────────── */
function MiniProductCard({ product, format }: { product: any; format: (v: number) => string }) {
  const dp = calculateDiscountPercent(product.price, product.finalPrice ?? product.price);
  return (
    <Link href={`/products/${product.id}`}>
      <div className="group border rounded-2xl overflow-hidden bg-card hover:shadow-md transition-all cursor-pointer h-full flex flex-col">
        <div className="aspect-square bg-muted/40 overflow-hidden relative shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {product.featured && (
            <span className="absolute top-2 start-2 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              ★
            </span>
          )}
          {dp > 0 && (
            <span className="absolute top-2 end-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              -{dp}%
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1 flex-1">
          <p className="text-sm font-semibold line-clamp-2 leading-snug flex-1">{product.name}</p>
          <div className="flex items-end gap-1.5 mt-auto">
            {dp > 0 ? (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] text-muted-foreground line-through leading-none">
                  {format(product.price)}
                </span>
                <span translate="no" className="text-primary font-bold text-sm leading-tight">
                  {format(product.finalPrice ?? product.price)}
                </span>
              </div>
            ) : (
              <span translate="no" className="text-primary font-bold text-sm">
                {format(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Products Tab ────────────────────────────────────────────── */
function ProductsTab({ sellerId, storeCategories }: { sellerId: number; storeCategories: string[] }) {
  const { format: fmtCurrency } = useCurrency();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const { data, isLoading } = useListProducts({ sellerId, limit: 100 } as any);
  const products: any[] = (data as any)?.products ?? (Array.isArray(data) ? data : []);

  const filtered = useMemo(() => {
    let list = [...products];
    if (catFilter) list = list.filter((p) => p.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.name as string).toLowerCase().includes(q));
    }
    if (sortBy === "price_asc") list.sort((a, b) => (a.finalPrice ?? a.price) - (b.finalPrice ?? b.price));
    else if (sortBy === "price_desc") list.sort((a, b) => (b.finalPrice ?? b.price) - (a.finalPrice ?? a.price));
    else if (sortBy === "name") list.sort((a, b) => (a.name as string).localeCompare(b.name as string));
    return list;
  }, [products, search, sortBy, catFilter]);

  const sortLabel: Record<SortKey, string> = {
    newest: t("store.sort_newest"),
    price_asc: t("store.sort_price_asc"),
    price_desc: t("store.sort_price_desc"),
    name: t("store.sort_name"),
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="store-grid">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Search + Sort row */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("store.search_placeholder")}
            className="ps-9 h-10 rounded-xl"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-10 rounded-xl shrink-0">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortLabel[sortBy]}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["newest", "price_asc", "price_desc", "name"] as SortKey[]).map((k) => (
              <DropdownMenuItem key={k} onClick={() => setSortBy(k)} className={sortBy === k ? "bg-accent" : ""}>
                {sortLabel[k]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category chips */}
      {storeCategories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCatFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              catFilter === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-muted hover:border-primary/40"
            }`}
          >
            {t("store.filter_all")}
          </button>
          {storeCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat === catFilter ? null : cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                catFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-muted hover:border-primary/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {catFilter || search ? t("store.no_products_in_category") : t("store.no_products")}
          </p>
          {!catFilter && !search && <p className="text-sm mt-1">{t("store.no_products_desc")}</p>}
        </div>
      ) : (
        <div className="store-grid">
          {filtered.map((p: any) => (
            <MiniProductCard key={p.id} product={p} format={fmtCurrency} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Featured Tab ────────────────────────────────────────────── */
function FeaturedTab({ sellerId }: { sellerId: number }) {
  const { format: fmtCurrency } = useCurrency();
  const { t } = useTranslation();

  const { data: featuredData, isLoading: featuredLoading } = useListProducts(
    { sellerId, featured: true, limit: 12 } as any
  );
  const { data: allData, isLoading: allLoading } = useListProducts(
    { sellerId, limit: 8, sortBy: "newest" } as any
  );

  const featured: any[] = (featuredData as any)?.products ?? (Array.isArray(featuredData) ? featuredData : []);
  const newest: any[] = ((allData as any)?.products ?? (Array.isArray(allData) ? allData : [])).slice(0, 8);

  if (featuredLoading || allLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40 rounded" />
        <div className="store-grid">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Featured */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <h3 className="text-base font-bold">{t("store.featured_products")}</h3>
        </div>
        {featured.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-2xl">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("store.no_featured_products")}</p>
            <p className="text-sm mt-1">{t("store.no_featured_desc")}</p>
          </div>
        ) : (
          <div className="store-grid">
            {featured.map((p: any) => (
              <MiniProductCard key={p.id} product={p} format={fmtCurrency} />
            ))}
          </div>
        )}
      </div>

      {/* New Arrivals */}
      {newest.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-primary shrink-0" />
            <h3 className="text-base font-bold">{t("store.new_arrivals")}</h3>
          </div>
          <div className="store-grid">
            {newest.map((p: any) => (
              <MiniProductCard key={p.id} product={p} format={fmtCurrency} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reviews Tab ─────────────────────────────────────────────── */
function ReviewCard({ review, storeName }: { review: any; storeName?: string }) {
  const { t } = useTranslation();
  const avg = (review.communicationRating + review.shippingRating + review.professionalismRating) / 3;
  const hasReply = !!review.sellerReply;
  return (
    <div className="border rounded-2xl p-4 bg-card space-y-3">
      {/* Customer row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {(review.customerName as string).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{review.customerName}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <RatingStars rating={Math.round(avg)} />
            <span className="text-xs text-muted-foreground font-medium">{avg.toFixed(1)}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-full px-1.5 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
            {t("store.verified_purchase")}
          </span>
        </div>
      </div>

      {/* Customer comment */}
      {review.comment && <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>}

      {/* Sub-ratings */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground border-t pt-2.5">
        <span>{t("store.communication")}: <strong>{review.communicationRating}/5</strong></span>
        <span>{t("store.shipping")}: <strong>{review.shippingRating}/5</strong></span>
        <span>{t("store.professionalism")}: <strong>{review.professionalismRating}/5</strong></span>
      </div>

      {/* Seller reply — only shown when present */}
      {hasReply && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 space-y-2">
          {/* Reply header */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">
                {storeName ? storeName.charAt(0).toUpperCase() : "S"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary leading-none">
                {storeName ?? t("store.seller_response_label", "Seller Response")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("store.seller_response_label", "Seller Response")}
                {review.sellerReplyAt && (
                  <span className="ms-1">
                    · {new Date(review.sellerReplyAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {review.sellerReplyUpdatedAt && (
                  <span className="ms-1 italic">· {t("seller_reviews.reply_edited", "Edited")}</span>
                )}
              </p>
            </div>
          </div>
          {/* Reply body */}
          <p className="text-sm text-foreground/80 leading-relaxed ps-8">
            {review.sellerReply}
          </p>
        </div>
      )}
    </div>
  );
}

function RatingBar({ label, score, max = 5 }: { label: string; score: number | null; max?: number }) {
  const pct = score != null ? Math.round((score / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-end tabular-nums">{score?.toFixed(1) ?? "—"}</span>
    </div>
  );
}

function ReviewsTab({
  sellerId,
  sellerName,
  reviewsData,
  reviewsLoading,
}: {
  sellerId: number;
  sellerName: string;
  reviewsData: any;
  reviewsLoading: boolean;
}) {
  const { t } = useTranslation();

  if (reviewsLoading)
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    );

  const hasReviews = reviewsData && reviewsData.reviews.length > 0;
  const { summary, reviews } = reviewsData ?? { summary: null, reviews: [] };

  return (
    <div className="space-y-5">
      {/* Write review prompt for eligible customers */}
      <SellerReviewPrompt sellerId={sellerId} sellerName={sellerName} />

      {/* Summary card */}
      {summary && summary.total > 0 && (
        <div className="p-5 border rounded-2xl bg-card">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            {/* Score bubble */}
            <div className="text-center shrink-0">
              <div className="text-4xl font-black text-foreground leading-none tabular-nums">
                {summary.overallScore?.toFixed(1) ?? "—"}
              </div>
              <RatingStars rating={Math.round(summary.overallScore ?? 0)} size="md" />
              <p className="text-xs text-muted-foreground mt-1">
                {t("store.stat_rating", { count: summary.total })}
              </p>
            </div>
            {/* Distribution bars */}
            <div className="flex-1 space-y-2 w-full">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t("store.rating_distribution")}
              </p>
              <RatingBar label={t("store.communication")} score={summary.avgCommunication} />
              <RatingBar label={t("store.shipping")} score={summary.avgShipping} />
              <RatingBar label={t("store.professionalism")} score={summary.avgProfessionalism} />
            </div>
          </div>
        </div>
      )}

      {/* Empty state (no reviews yet) */}
      {!hasReviews && (
        <div className="text-center py-16 text-muted-foreground">
          <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("store.no_reviews")}</p>
          <p className="text-sm mt-1">{t("store.no_reviews_desc")}</p>
        </div>
      )}

      {/* Review cards */}
      {hasReviews && (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <ReviewCard key={r.id} review={r} storeName={sellerName} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── About Tab ───────────────────────────────────────────────── */
function AboutTab({ store }: { store: StoreProfile & Record<string, any> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Description */}
      {store.storeDescription ? (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
            {t("store.about_title")}
          </h3>
          <p className="text-foreground/80 leading-relaxed">{store.storeDescription}</p>
        </div>
      ) : null}

      {/* Categories */}
      {store.categories && store.categories.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
            {t("store.categories_title")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(store.categories as string[]).map((cat) => (
              <Badge key={cat} variant="secondary" className="rounded-full">
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Location + links */}
      <div className="flex flex-col gap-2">
        {store.city && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{store.city}</span>
          </div>
        )}
        {store.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={store.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate"
            >
              {store.website}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            {t("store.member_since")}{" "}
            {new Date(store.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Trust & Verification */}
      {(store.trustScore != null || store.isVerified) && (
        <div className="p-4 border rounded-2xl bg-card space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{t("store.trust_info_title")}</span>
            <SellerTrustBadge
              level={(store.verificationLevel ?? "none") as VerificationLevel}
              isVerified={store.isVerified ?? false}
              size="sm"
            />
          </div>
          {store.trustScore != null && (
            <TrustScoreBar score={store.trustScore} size="md" />
          )}
          {store.isVerified && store.verifiedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>
                {t("store.verified_since")}{" "}
                {new Date(store.verifiedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Seller score */}
      {store.sellerScore != null && (
        <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-bold text-primary">{t("store.seller_score")}</span>
          </div>
          <div className="text-2xl font-black text-primary tabular-nums">{store.sellerScore}/5</div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("store.seller_score_based", { count: store.sellerReviewCount })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Contact Tab ─────────────────────────────────────────────── */
function ContactTab({ store }: { store: StoreProfile & Record<string, any> }) {
  const { t } = useTranslation();

  const contactItems = [
    { key: "contactPhone", label: t("store.contact_phone"), icon: Phone,
      href: store.contactPhone ? `tel:${store.contactPhone}` : null },
    { key: "contactEmail", label: t("store.contact_email"), icon: Mail,
      href: store.contactEmail ? `mailto:${store.contactEmail}` : null },
    { key: "website", label: t("store.contact_website"), icon: Globe,
      href: store.website },
    { key: "whatsapp", label: t("store.contact_whatsapp"), icon: Phone,
      href: store.whatsapp ? `https://wa.me/${(store.whatsapp as string).replace(/\D/g, "")}` : null },
    { key: "telegram", label: t("store.contact_telegram"), icon: ExternalLink,
      href: store.telegram
        ? (store.telegram as string).startsWith("@")
          ? `https://t.me/${(store.telegram as string).slice(1)}`
          : store.telegram
        : null },
    { key: "facebook", label: t("store.contact_facebook"), icon: ExternalLink,
      href: store.facebook
        ? (store.facebook as string).startsWith("http")
          ? store.facebook
          : `https://facebook.com/${store.facebook}`
        : null },
    { key: "instagram", label: t("store.contact_instagram"), icon: Instagram,
      href: store.instagram
        ? (store.instagram as string).startsWith("@")
          ? `https://instagram.com/${(store.instagram as string).slice(1)}`
          : `https://instagram.com/${store.instagram}`
        : null },
  ].filter((item) => !!(store as Record<string, unknown>)[item.key]);

  if (contactItems.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{t("store.no_contact_info")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-lg">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-4">
        {t("store.contact_section_title")}
      </h3>
      {contactItems.map(({ key, label, icon: Icon, href }) => (
        <a
          key={key}
          href={href ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3.5 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all group"
        >
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase font-medium tracking-wide">{label}</p>
            <p className="text-sm font-medium truncate">{String((store as Record<string, unknown>)[key] ?? "")}</p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
        </a>
      ))}
    </div>
  );
}

/* ── Policies Tab ────────────────────────────────────────────── */
function PoliciesTab({ store }: { store: StoreProfile & Record<string, any> }) {
  const { t } = useTranslation();

  const policies = [
    { key: "shippingPolicy", label: t("store.policy_label_shipping"), icon: Truck },
    { key: "returnPolicy",   label: t("store.policy_label_return"),   icon: RotateCcw },
    { key: "warrantyPolicy", label: t("store.policy_label_warranty"), icon: Shield },
    { key: "privacyPolicy",  label: t("store.policy_label_privacy"),  icon: Award },
  ].filter((p) => !!(store as Record<string, unknown>)[p.key]);

  if (policies.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">{t("store.no_policies")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {policies.map(({ key, label, icon: Icon }) => (
        <div key={key} className="border rounded-2xl bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b bg-muted/30">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold">{label}</h3>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {String((store as Record<string, unknown>)[key] ?? "")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data: store, isLoading, isError } = useGetStoreProfile(slug);
  const { data: reviewsData, isLoading: reviewsLoading } = useGetSellerReviews(
    store?.sellerId ?? 0,
    {
      query: {
        enabled: !!store?.sellerId && activeTab === "reviews",
        queryKey: getSellerReviewsQueryKey(store?.sellerId ?? 0),
      },
    }
  );

  useSEO({
    title: store
      ? lang === "ar"
        ? `متجر ${store.storeName} — سيانو`
        : `${store.storeName} Store on Syano`
      : lang === "ar"
      ? "متجر على سيانو"
      : "Store on Syano",
    description: store
      ? (
          store.storeDescription ||
          (lang === "ar"
            ? `تسوّق من متجر ${store.storeName} على سيانو. منتجات متنوعة، توصيل سريع، دفع آمن.`
            : `Shop ${store.storeName} on Syano — trusted Syrian seller. Browse products, fast delivery, secure checkout.`)
        ).slice(0, 160)
      : undefined,
    canonical: `/store/${slug}`,
    image: store?.storeLogo || undefined,
    jsonLd: store
      ? {
          "@context": "https://schema.org",
          "@type": "Store",
          "@id": `https://syano.online/store/${slug}`,
          name: store.storeName,
          description: store.storeDescription || undefined,
          url: `https://syano.online/store/${slug}`,
          logo: store.storeLogo ? { "@type": "ImageObject", url: store.storeLogo } : undefined,
          image: store.storeLogo || undefined,
          address: {
            "@type": "PostalAddress",
            addressLocality: store.city || "Aleppo",
            addressCountry: "SY",
          },
          aggregateRating:
            store.reviewCount && store.reviewCount > 0
              ? {
                  "@type": "AggregateRating",
                  ratingValue: store.averageRating ?? 0,
                  reviewCount: store.reviewCount,
                }
              : undefined,
        }
      : undefined,
  });

  /* Loading skeleton */
  if (isLoading)
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-0">
          <Skeleton className="h-52 sm:h-64 w-full" />
          <div className="px-4 pt-4 space-y-4">
            <div className="flex gap-4 items-end -mt-10">
              <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          </div>
        </div>
      </Layout>
    );

  /* Error state */
  if (isError || !store)
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-2">{t("store.not_found_title")}</h2>
          <p className="text-muted-foreground mb-6">{t("store.not_found_desc")}</p>
          <Link href="/shop">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180 shrink-0" />
              {t("store.browse_products")}
            </Button>
          </Link>
        </div>
      </Layout>
    );

  const storeExt = store as typeof store & Record<string, any>;
  const storeAccent: string = (storeExt.accentColor as string | null) || "#276221";

  const hasContact = !!(
    storeExt.contactPhone || storeExt.contactEmail || storeExt.website ||
    storeExt.whatsapp || storeExt.telegram || storeExt.facebook || storeExt.instagram
  );
  const hasPolicies = !!(
    storeExt.shippingPolicy || storeExt.returnPolicy ||
    storeExt.warrantyPolicy || storeExt.privacyPolicy
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: t("store.tab_products") },
    { key: "featured", label: t("store.tab_featured") },
    {
      key: "reviews",
      label:
        store.sellerReviewCount > 0
          ? t("store.tab_reviews_count", { count: store.sellerReviewCount })
          : t("store.tab_reviews"),
    },
    { key: "about", label: t("store.tab_about") },
    ...(hasContact  ? [{ key: "contact"  as Tab, label: t("store.tab_contact")  }] : []),
    ...(hasPolicies ? [{ key: "policies" as Tab, label: t("store.tab_policies") }] : []),
  ];

  const storeCategories: string[] = (store.categories as string[]) ?? [];

  return (
    <Layout>
      {/* ── Banner ─────────────────────────────────────────────── */}
      <div
        className="w-full h-48 sm:h-64 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${storeAccent}40, ${storeAccent}15, transparent), hsl(var(--muted))` }}
      >
        {store.storeBanner && (
          <img src={store.storeBanner} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        {/* Back button on banner */}
        <div className="absolute top-4 start-4">
          <Link href="/shop">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white bg-black/30 hover:bg-black/50 rounded-xl h-8 px-3"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180 shrink-0" />
              <span className="text-xs font-medium">{t("store.back_to_products")}</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        {/* ── Store Identity ──────────────────────────────────── */}
        <div className="relative -mt-14 mb-5 flex items-end gap-4">
          {/* Logo */}
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-background bg-card shadow-xl flex items-center justify-center shrink-0 overflow-hidden">
            {store.storeLogo ? (
              <img src={store.storeLogo} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-black" style={{ color: storeAccent }}>
                {(store.storeName || "S").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Name + Trust */}
          <div className="pb-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight break-words min-w-0">
                {store.storeName}
              </h1>
              <TrustBadge
                verificationLevel={storeExt.verificationLevel ?? "none"}
                trustScore={storeExt.trustScore ?? null}
                isVerified={storeExt.isVerified ?? false}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{store.sellerName}</p>
            {store.averageRating != null && store.reviewCount > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <RatingStars rating={store.averageRating} size="sm" />
                <span className="text-xs font-bold text-amber-600 tabular-nums">
                  {store.averageRating.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({store.reviewCount.toLocaleString()})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── CTAs ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <FollowButton sellerId={store.sellerId} />
          <ContactButton sellerId={store.sellerId} />
        </div>

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiCard
            icon={Users}
            label={t("store.kpi_followers")}
            value={store.followerCount.toLocaleString()}
            accentColor={storeAccent}
          />
          <KpiCard
            icon={Package}
            label={t("store.kpi_products")}
            value={store.totalProducts.toLocaleString()}
            accentColor={storeAccent}
          />
          {store.averageRating != null ? (
            <KpiCard
              icon={Star}
              label={t("store.kpi_rating")}
              value={store.averageRating.toFixed(1)}
              sub={`(${store.reviewCount})`}
              accentColor={storeAccent}
            />
          ) : (
            <KpiCard
              icon={ShoppingBag}
              label={t("store.stat_completion")}
              value={`${store.completionRate}%`}
              accentColor={storeAccent}
            />
          )}
          <KpiCard
            icon={ShoppingBag}
            label={t("store.kpi_orders")}
            value={store.totalOrders.toLocaleString()}
            sub={`${store.completionRate}% ✓`}
            accentColor={storeAccent}
          />
        </div>

        {/* ── Sticky Tabs ────────────────────────────────────── */}
        <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b -mx-4 px-4 mb-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-none max-w-5xl">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === tab.key ? { borderColor: storeAccent, color: storeAccent } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Panels ─────────────────────────────────────── */}
        <div className="pb-12">
          {activeTab === "products" && (
            <ProductsTab sellerId={store.sellerId} storeCategories={storeCategories} />
          )}
          {activeTab === "featured" && <FeaturedTab sellerId={store.sellerId} />}
          {activeTab === "reviews" && (
            <ReviewsTab
              sellerId={store.sellerId}
              sellerName={(store as any).storeName ?? (store as any).name ?? ""}
              reviewsData={reviewsData}
              reviewsLoading={reviewsLoading}
            />
          )}
          {activeTab === "about"    && <AboutTab    store={storeExt} />}
          {activeTab === "contact"  && <ContactTab  store={storeExt} />}
          {activeTab === "policies" && <PoliciesTab store={storeExt} />}
        </div>
      </div>
    </Layout>
  );
}
