import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Star, MessageSquare, CheckCircle2, Filter,
  Reply, Pencil, Trash2, MessageCircle, TrendingUp,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { SellerNav } from "@/components/SellerNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSellerReviews,
  getSellerReviewsQueryKey,
  usePatchSellerReviewReply,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const REPLY_MAX = 1000;

function RatingBar({ label, score, max = 5 }: { label: string; score: number | null; max?: number }) {
  const pct = score != null ? Math.round((score / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-8 text-end tabular-nums">{score?.toFixed(1) ?? "—"}</span>
    </div>
  );
}

function ReplyForm({
  reviewId,
  sellerId,
  existingReply,
  onDone,
}: {
  reviewId: number;
  sellerId: number;
  existingReply: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [text, setText] = useState(existingReply ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const remaining = REPLY_MAX - text.length;
  const isOverLimit = remaining < 0;

  const { mutate, isPending } = usePatchSellerReviewReply(sellerId, {
    onSuccess: () => {
      toast({ title: t("seller_reviews.reply_success") });
      onDone();
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("seller_reviews.reply_placeholder")}
        className="min-h-[80px] text-sm resize-none focus-visible:ring-1"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-xs tabular-nums", isOverLimit ? "text-red-500 font-semibold" : "text-muted-foreground")}>
          {remaining} {t("seller_reviews.reply_char_limit")}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onDone} disabled={isPending}>
            {t("seller_reviews.reply_cancel_btn")}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={isPending || isOverLimit || text.trim().length === 0}
            onClick={() => mutate({ reviewId, reply: text.trim() })}
          >
            {isPending ? t("seller_reviews.reply_saving") : t("seller_reviews.reply_save_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review, sellerId }: { review: any; sellerId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [replyOpen, setReplyOpen] = useState(false);
  const avg = (review.communicationRating + review.shippingRating + review.professionalismRating) / 3;
  const isCritical = avg < 3;
  const hasReply = !!review.sellerReply;

  const { mutate: deleteReply, isPending: deleting } = usePatchSellerReviewReply(sellerId, {
    onSuccess: () => toast({ title: t("seller_reviews.reply_deleted") }),
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  return (
    <div className={cn(
      "border rounded-2xl p-4 bg-card space-y-3 transition-colors",
      isCritical && "border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10"
    )}>
      {/* Customer header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
            {(review.customerName as string).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{review.customerName}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <StarRating rating={avg} size="sm" />
            <span className="text-xs font-semibold tabular-nums">{avg.toFixed(1)}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-full px-1.5 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
            {t("seller_reviews.verified_purchase")}
          </span>
        </div>
      </div>

      {/* Customer comment */}
      {review.comment && (
        <p className="text-sm text-foreground/80 leading-relaxed bg-muted/40 rounded-xl px-3 py-2.5">
          "{review.comment}"
        </p>
      )}

      {/* Rating breakdown */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground border-t pt-2.5">
        <span>
          {t("seller_reviews.communication_avg")}:{" "}
          <strong className={review.communicationRating < 3 ? "text-red-500" : "text-foreground"}>
            {review.communicationRating}/5
          </strong>
        </span>
        <span>
          {t("seller_reviews.shipping_avg")}:{" "}
          <strong className={review.shippingRating < 3 ? "text-red-500" : "text-foreground"}>
            {review.shippingRating}/5
          </strong>
        </span>
        <span>
          {t("seller_reviews.professionalism_avg")}:{" "}
          <strong className={review.professionalismRating < 3 ? "text-red-500" : "text-foreground"}>
            {review.professionalismRating}/5
          </strong>
        </span>
      </div>

      {/* Existing seller reply */}
      {hasReply && !replyOpen && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Reply className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[11px] font-semibold text-primary">{t("seller_reviews.seller_response_label")}</span>
            {review.sellerReplyUpdatedAt && (
              <span className="text-[10px] text-muted-foreground ms-auto">
                {t("seller_reviews.reply_edited")} · {new Date(review.sellerReplyUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
            {!review.sellerReplyUpdatedAt && review.sellerReplyAt && (
              <span className="text-[10px] text-muted-foreground ms-auto">
                {new Date(review.sellerReplyAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{review.sellerReply}</p>
        </div>
      )}

      {/* Inline reply form */}
      {replyOpen && (
        <ReplyForm
          reviewId={review.id}
          sellerId={sellerId}
          existingReply={review.sellerReply}
          onDone={() => setReplyOpen(false)}
        />
      )}

      {/* Action buttons */}
      {!replyOpen && (
        <div className="flex items-center gap-2 pt-0.5">
          {!hasReply ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => setReplyOpen(true)}
            >
              <Reply className="h-3 w-3" />
              {t("seller_reviews.reply_btn")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setReplyOpen(true)}
              >
                <Pencil className="h-3 w-3" />
                {t("seller_reviews.edit_reply_btn")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={deleting}
                onClick={() => deleteReply({ reviewId: review.id, reply: null })}
              >
                <Trash2 className="h-3 w-3" />
                {t("seller_reviews.delete_reply_btn")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SellerReviewsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "low">("all");

  const { data: reviewsData, isLoading } = useGetSellerReviews(user?.id ?? 0, {
    query: {
      enabled: !!user?.id,
      queryKey: getSellerReviewsQueryKey(user?.id ?? 0),
    },
  });

  const summary = reviewsData?.summary;
  const allReviews: any[] = reviewsData?.reviews ?? [];
  const reviews =
    filter === "low"
      ? allReviews.filter((r) => (r.communicationRating + r.shippingRating + r.professionalismRating) / 3 < 3)
      : allReviews;

  return (
    <Layout hideFooter>
      <SellerNav />
      <div className="container max-w-4xl px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {t("seller_reviews.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("seller_reviews.subtitle")}</p>
        </div>

        {/* Overview cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: t("seller_reviews.avg_rating"),
                value: summary.overallScore?.toFixed(1) ?? "—",
                icon: <Star className="h-5 w-5 text-amber-500 fill-amber-400" />,
                bg: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30",
                color: "text-amber-700 dark:text-amber-400",
              },
              {
                label: t("seller_reviews.total_reviews"),
                value: String(summary.total),
                icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
                bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30",
                color: "text-blue-700 dark:text-blue-400",
              },
              {
                label: t("seller_reviews.replied_count"),
                value: String(summary.repliedCount ?? 0),
                icon: <MessageCircle className="h-5 w-5 text-violet-500" />,
                bg: "bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30",
                color: "text-violet-700 dark:text-violet-400",
              },
              {
                label: t("seller_reviews.response_rate"),
                value: `${summary.responseRate ?? 0}%`,
                icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
                bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30",
                color: "text-emerald-700 dark:text-emerald-400",
              },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} border rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">{card.icon}</div>
                <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Rating breakdown */}
        {summary && summary.total > 0 && (
          <div className="border rounded-2xl p-5 bg-card space-y-3">
            <h3 className="font-semibold text-sm text-foreground mb-3">{t("seller_reviews.overview_title")}</h3>
            <div className="flex items-center gap-5 mb-4">
              <div className="text-center shrink-0">
                <div className="text-5xl font-black text-foreground tabular-nums leading-none">
                  {summary.overallScore?.toFixed(1) ?? "—"}
                </div>
                <StarRating rating={Math.round(summary.overallScore ?? 0)} size="md" />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("seller_reviews.total_reviews")}: {summary.total}
                </p>
              </div>
              <div className="flex-1 space-y-2">
                <RatingBar label={t("seller_reviews.communication_avg")} score={summary.avgCommunication} />
                <RatingBar label={t("seller_reviews.shipping_avg")} score={summary.avgShipping} />
                <RatingBar label={t("seller_reviews.professionalism_avg")} score={summary.avgProfessionalism} />
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs + reviews list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-base">{t("seller_reviews.recent_title")}</h3>
            <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
              <Button
                variant={filter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter("all")}
                className="h-7 text-xs px-3 rounded-md"
              >
                {t("seller_reviews.all_reviews")}
                {allReviews.length > 0 && (
                  <span className="ms-1.5 text-xs font-bold tabular-nums">{allReviews.length}</span>
                )}
              </Button>
              <Button
                variant={filter === "low" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter("low")}
                className="h-7 text-xs px-3 rounded-md gap-1"
              >
                <Filter className="h-3 w-3" />
                {t("seller_reviews.low_title")}
                {allReviews.filter((r) => (r.communicationRating + r.shippingRating + r.professionalismRating) / 3 < 3).length > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    {allReviews.filter((r) => (r.communicationRating + r.shippingRating + r.professionalismRating) / 3 < 3).length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16 border rounded-2xl bg-card text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("seller_reviews.no_reviews")}</p>
              <p className="text-sm mt-1">{t("seller_reviews.no_reviews_desc")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r: any) => (
                <ReviewCard key={r.id} review={r} sellerId={user?.id ?? 0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
