import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useListReviews, useCreateReview, getListReviewsQueryKey, getGetProductQueryKey, Review } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ChevronDown, Star, MessageSquarePlus } from "lucide-react";

interface ReviewSectionProps {
  productId: number;
  averageRating: number | null;
  reviewCount: number;
}

type SortKey = "newest" | "highest" | "lowest";

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs group cursor-pointer">
      <span className="w-2 text-muted-foreground shrink-0 text-end font-medium">{star}</span>
      <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 shrink-0" />
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-5 text-muted-foreground shrink-0 text-end tabular-nums">{count}</span>
    </div>
  );
}

export function ReviewSection({ productId, averageRating, reviewCount }: ReviewSectionProps) {
  const { t } = useTranslation();
  const { isCustomer, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [ratingError, setRatingError] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [visibleCount, setVisibleCount] = useState(10);
  useEffect(() => setVisibleCount(10), [sortKey]);

  const { data: reviews = [], isLoading } = useListReviews(productId, {
    query: { enabled: !!productId, queryKey: getListReviewsQueryKey(productId) }
  });

  const createReview = useCreateReview({
    mutation: {
      onSuccess: () => {
        toast({ title: t("reviews.success"), description: t("reviews.success_desc") });
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey(productId) });
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
        setRating(0);
        setComment("");
        setShowForm(false);
      },
      onError: (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          toast({ title: t("reviews.already_reviewed"), variant: "destructive" });
        } else if (status === 403) {
          toast({ title: t("reviews.no_delivered_order"), variant: "destructive" });
        } else {
          toast({ title: t("reviews.error"), variant: "destructive" });
        }
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setRatingError(true);
      return;
    }
    setRatingError(false);
    createReview.mutate({ id: productId, data: { rating, comment: comment || null } });
  };

  const sortedReviews = useMemo(() => {
    const list = [...(reviews as Review[])];
    if (sortKey === "newest") {
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortKey === "highest") {
      return list.sort((a, b) => b.rating - a.rating);
    } else {
      return list.sort((a, b) => a.rating - b.rating);
    }
  }, [reviews, sortKey]);

  const distribution = useMemo(() => {
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    (reviews as Review[]).forEach((r) => {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) dist[star]++;
    });
    return dist;
  }, [reviews]);

  return (
    <div className="mt-10">
      <Separator className="mb-8" />

      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground mb-4">{t("reviews.title")}</h2>

          {reviewCount > 0 && averageRating != null ? (
            <div className="flex items-start gap-6 flex-wrap sm:flex-nowrap">
              {/* Score */}
              <div className="flex flex-col items-center shrink-0 bg-muted/30 rounded-2xl px-6 py-4 min-w-[100px]">
                <span className="text-review-score text-foreground leading-none mb-1">
                  {averageRating.toFixed(1)}
                </span>
                <StarRating rating={averageRating} size="sm" className="mb-1" />
                <span className="text-xs text-muted-foreground text-center">
                  {reviewCount === 1
                    ? t("reviews.based_on", { count: reviewCount })
                    : t("reviews.based_on_plural", { count: reviewCount })}
                </span>
              </div>

              {/* Distribution bars */}
              {!isLoading && reviews.length > 0 && (
                <div className="flex-1 min-w-[160px] space-y-2">
                  {([5, 4, 3, 2, 1] as const).map((star) => (
                    <RatingBar
                      key={star}
                      star={star}
                      count={distribution[star] || 0}
                      total={reviews.length}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* CTA */}
        <div className="shrink-0">
          {isCustomer && !showForm && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowForm(true)}
            >
              <MessageSquarePlus className="h-4 w-4" />
              {t("reviews.write_review")}
            </Button>
          )}
          {!isAuthenticated && (
            <Link href={`/login?redirect=/products/${productId}`}>
              <Button variant="outline" size="sm">{t("reviews.login_to_review")}</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Write Review Form */}
      {showForm && isCustomer && (
        <form
          onSubmit={handleSubmit}
          className="bg-card border rounded-2xl p-5 mb-8 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">{t("reviews.write_review")}</h3>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">{t("reviews.your_rating")}</p>
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRate={(v) => { setRating(v); setRatingError(false); }}
            />
            {ratingError && (
              <p className="text-xs text-destructive mt-1.5 font-medium">{t("reviews.rating_required")}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">{t("reviews.your_review")}</p>
            <Textarea
              placeholder={t("reviews.review_placeholder")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none rounded-xl"
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setRating(0); setComment(""); setRatingError(false); }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={createReview.isPending}>
              {createReview.isPending ? t("reviews.submitting") : t("reviews.submit")}
            </Button>
          </div>
        </form>
      )}

      {/* Sort bar */}
      {reviews.length > 1 && (
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-muted-foreground font-medium shrink-0">{t("reviews.sort_by", "Sort by")}</span>
          <div className="flex gap-2 flex-wrap">
            {(["newest", "highest", "lowest"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  sortKey === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {t(`reviews.sort_${key}`, key === "newest" ? "Newest" : key === "highest" ? "Highest" : "Lowest")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-muted rounded w-24" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-14 px-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Star className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground mb-1">{t("reviews.no_reviews")}</p>
          <p className="text-sm text-muted-foreground mb-6">{t("reviews.no_reviews_desc")}</p>
          {isCustomer && !showForm && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowForm(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              {t("reviews.write_review")}
            </Button>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-4">
          {sortedReviews.slice(0, visibleCount).map((review) => {
            const avatarColor = getAvatarColor(review.userName);
            return (
              <div
                key={review.id}
                className="bg-card border rounded-2xl p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0 select-none`}>
                      {review.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground leading-tight">{review.userName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {t("reviews.verified")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed ps-[52px]">{review.comment}</p>
                )}
              </div>
            );
          })}
        </div>
        {visibleCount < sortedReviews.length && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((v) => v + 10)}
              className="gap-1.5"
            >
              <ChevronDown className="h-4 w-4" />
              {t("reviews.show_more", "Show more")}
            </Button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
