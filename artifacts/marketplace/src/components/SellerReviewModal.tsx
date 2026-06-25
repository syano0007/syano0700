import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Star } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { StarRating } from "@/components/StarRating";
import {
  usePostSellerReview,
  getSellerReviewStatusQueryKey,
  getSellerReviewsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface SellerReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: number;
  sellerName: string;
  onSuccess?: () => void;
}

export function SellerReviewModal({
  open,
  onOpenChange,
  sellerId,
  sellerName,
  onSuccess,
}: SellerReviewModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [communication, setCommunication] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const postReview = usePostSellerReview(sellerId, {
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: getSellerReviewStatusQueryKey(sellerId) });
      queryClient.invalidateQueries({ queryKey: getSellerReviewsQueryKey(sellerId) });
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = (err?.response?.data as any)?.error ?? t("common.error");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  const canSubmit = communication > 0 && shipping > 0 && professionalism > 0;
  const maxComment = 1000;

  function handleSubmit() {
    if (!canSubmit || postReview.isPending) return;
    postReview.mutate({
      communicationRating: communication,
      shippingRating: shipping,
      professionalismRating: professionalism,
      comment: comment.trim() || undefined,
    } as any);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen && submitted) {
      setTimeout(() => {
        setCommunication(0);
        setShipping(0);
        setProfessionalism(0);
        setComment("");
        setSubmitted(false);
      }, 300);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full max-w-md p-0 overflow-hidden sm:rounded-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("store.review_form_title")}</DialogTitle>
          <DialogDescription>{t("store.review_form_subtitle")}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 py-14 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">{t("store.review_success_title")}</h3>
              <p className="text-sm text-muted-foreground">{t("store.review_success_desc")}</p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-2 rounded-xl px-10">
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base">{t("store.review_form_title")}</h2>
                  <p className="text-xs text-muted-foreground">{sellerName}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <RatingField
                label={t("store.review_communication")}
                value={communication}
                onChange={setCommunication}
                hint={t("store.review_stars_hint")}
              />
              <RatingField
                label={t("store.review_shipping")}
                value={shipping}
                onChange={setShipping}
                hint={t("store.review_stars_hint")}
              />
              <RatingField
                label={t("store.review_professionalism")}
                value={professionalism}
                onChange={setProfessionalism}
                hint={t("store.review_stars_hint")}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("store.review_comment_placeholder")}
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, maxComment))}
                  placeholder={t("store.review_comment_placeholder")}
                  className="resize-none rounded-xl text-sm"
                  rows={3}
                />
                <p
                  className={cn(
                    "text-xs text-end tabular-nums",
                    comment.length > maxComment * 0.9
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  )}
                >
                  {comment.length}/{maxComment}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => handleOpenChange(false)}
              >
                {t("store.review_cancel")}
              </Button>
              <Button
                className="flex-1 rounded-xl"
                disabled={!canSubmit || postReview.isPending}
                onClick={handleSubmit}
              >
                {postReview.isPending ? t("common.submitting") : t("store.review_submit")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RatingField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <StarRating rating={value} interactive onRate={onChange} size="lg" />
        {value === 0 && (
          <span className="text-xs text-muted-foreground hidden sm:block">{hint}</span>
        )}
      </div>
    </div>
  );
}
