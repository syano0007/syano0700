import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetSellerReviewStatus,
  getSellerReviewStatusQueryKey,
} from "@workspace/api-client-react";
import { SellerReviewModal } from "@/components/SellerReviewModal";

interface SellerReviewPromptProps {
  sellerId: number;
  sellerName: string;
  compact?: boolean;
}

export function SellerReviewPrompt({
  sellerId,
  sellerName,
  compact = false,
}: SellerReviewPromptProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data: status, isLoading } = useGetSellerReviewStatus(sellerId, {
    query: {
      enabled: !!user && user.role === "customer" && !!sellerId,
      queryKey: getSellerReviewStatusQueryKey(sellerId),
    },
  });

  if (!user || user.role !== "customer") return null;
  if (isLoading) return null;
  if (!status) return null;
  if (!status.eligible && !status.alreadyReviewed) return null;

  if (status.alreadyReviewed) {
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {t("orders.review_done")}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
        <div className="h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
        </div>
        <div>
          <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
            {t("orders.review_done")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("orders.review_done_sub")}</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/20 rounded-lg"
        >
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {t("store.review_leave")}
        </Button>
        <SellerReviewModal
          open={open}
          onOpenChange={setOpen}
          sellerId={sellerId}
          sellerName={sellerName}
        />
      </>
    );
  }

  return (
    <>
      <div className="border rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/60 dark:from-amber-950/20 dark:to-orange-950/10 border-amber-200/60 dark:border-amber-800/40">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base text-foreground">
                {t("orders.review_prompt_title")}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {t("orders.review_prompt_subtitle")}
              </p>
              <div className="flex items-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 text-amber-300 fill-amber-200/80" />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2"
              onClick={() => setOpen(true)}
            >
              <Star className="h-4 w-4 fill-white" />
              {t("store.review_leave")}
            </Button>
          </div>
        </div>
      </div>
      <SellerReviewModal
        open={open}
        onOpenChange={setOpen}
        sellerId={sellerId}
        sellerName={sellerName}
      />
    </>
  );
}
