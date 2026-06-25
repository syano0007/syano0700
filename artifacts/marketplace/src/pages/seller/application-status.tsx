import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw, Store,
  Pencil, Trash2,
} from "lucide-react";
import type { SellerApplication } from "@workspace/api-client-react";

const STATUS_ICONS = {
  draft:        Pencil,
  pending:      Clock,
  under_review: Search,
  approved:     CheckCircle2,
  rejected:     XCircle,
  suspended:    AlertTriangle,
} as const;

const STATUS_STYLES = {
  draft: {
    color:  "text-muted-foreground",
    bg:     "bg-muted/30",
    border: "border-border",
    pill:   "bg-muted text-muted-foreground border-border",
  },
  pending: {
    color:  "text-amber-500",
    bg:     "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800",
    pill:   "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  },
  under_review: {
    color:  "text-blue-500",
    bg:     "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    pill:   "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400",
  },
  approved: {
    color:  "text-green-500",
    bg:     "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    pill:   "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400",
  },
  rejected: {
    color:  "text-red-500",
    bg:     "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    pill:   "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  },
  suspended: {
    color:  "text-orange-500",
    bg:     "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800",
    pill:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
  },
} as const;

type KnownStatus = keyof typeof STATUS_STYLES;

export default function ApplicationStatus() {
  const { user, token, isAuthenticated, refreshAuth } = useAuth();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);

  const { data: application, isLoading, isFetching, refetch } = useQuery<SellerApplication | null>({
    queryKey: ["seller-application", "my"],
    queryFn: async () => {
      const res = await fetch("/api/seller-applications/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    if (user?.role === "seller") navigate("/seller/dashboard");
  }, [isAuthenticated, user]);

  // Only redirect when the query has fully settled (not mid-refetch).
  // Without the isFetching guard, a stale null in the cache while a fresh
  // refetch is in flight causes a bounce back to /seller/apply right after
  // a successful submission.
  useEffect(() => {
    if (!isLoading && !isFetching && application === null) navigate("/seller/apply");
  }, [application, isLoading, isFetching]);

  /* ── Withdraw mutation ────────────────────────────────────── */
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seller-applications/my", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to withdraw");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-application", "my"] });
      navigate("/seller/apply");
    },
    onError: (e: any) => {
      setWithdrawConfirm(false);
      alert(e.message);
    },
  });

  const handleActivate = async () => {
    await refreshAuth();
    navigate("/seller/dashboard");
  };

  // Show skeleton on initial load AND while fetching with no settled data yet
  // (covers the window right after navigation from the apply page).
  if (isLoading || application === undefined || (isFetching && application === null)) {
    return (
      <Layout>
        <div className="container py-12 max-w-lg mx-auto space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse w-48 mx-auto" />
          <div className="h-52 bg-muted rounded-2xl animate-pulse" />
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
        </div>
      </Layout>
    );
  }

  if (!application) return null;

  const status = application.status as KnownStatus;
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const Icon   = STATUS_ICONS[status]  ?? Clock;

  const label = t(`seller_status.status_${status}_label`, { defaultValue: status });
  const title = t(`seller_status.status_${status}_title`, {
    defaultValue: status === "draft"
      ? (lang === "ar" ? "مسودة — لم يُرسل بعد" : "Draft — Not Submitted Yet")
      : status,
  });
  const desc = t(`seller_status.status_${status}_desc`, {
    defaultValue: status === "draft"
      ? (lang === "ar"
          ? "لقد حفظت تقدمك. أكمل طلبك وأرسله للمراجعة."
          : "You have saved your progress. Complete your application and submit it for review.")
      : "",
  });

  const canWithdraw = status === "draft" || status === "pending";

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-lg mx-auto">
        <div className={`border rounded-2xl p-5 sm:p-8 text-center ${styles.bg} ${styles.border}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background shadow-sm mb-5">
            <Icon className={`h-8 w-8 ${styles.color}`} />
          </div>

          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border mb-4 ${styles.pill}`}>
            {label}
          </span>

          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>

          {status === "rejected" && application.rejectionReason && (
            <div className="mt-4 p-4 bg-background/80 rounded-xl text-sm text-start border">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {t("seller_status.reason_label")}
              </p>
              <p>{application.rejectionReason}</p>
            </div>
          )}

          {status === "suspended" && application.adminNotes && (
            <div className="mt-4 p-4 bg-background/80 rounded-xl text-sm text-start border">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">
                {t("seller_status.note_label")}
              </p>
              <p>{application.adminNotes}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            {/* Draft: Continue editing */}
            {status === "draft" && (
              <Link href="/seller/apply">
                <Button className="w-full h-11 text-base font-semibold gap-2">
                  <Pencil className="h-4 w-4" />
                  {t("seller.continue_app")}
                </Button>
              </Link>
            )}

            {/* Approved: Activate seller account */}
            {status === "approved" && (
              <Button className="w-full h-11 text-base font-semibold" onClick={handleActivate}>
                <Store className="h-4 w-4 me-2" />
                {t("seller_status.activate_btn")}
              </Button>
            )}

            {/* Rejected: Apply again */}
            {status === "rejected" && (
              <Link href="/seller/apply">
                <Button variant="outline" className="w-full">
                  {t("seller_status.apply_again")}
                </Button>
              </Link>
            )}

            {/* Pending/Under-review: Refresh */}
            {(status === "pending" || status === "under_review") && (
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2 mx-auto">
                <RefreshCw className="h-3.5 w-3.5" />
                {t("seller_status.refresh_btn")}
              </Button>
            )}

            {/* Draft or Pending: Withdraw */}
            {canWithdraw && (
              withdrawConfirm ? (
                <div className="mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-xl space-y-2">
                  <p className="text-sm text-destructive font-medium">
                    {t("seller.withdraw_confirm")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => withdrawMutation.mutate()}
                      disabled={withdrawMutation.isPending}
                    >
                      {withdrawMutation.isPending
                        ? t("seller.withdrawing")
                        : t("seller.yes_withdraw")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setWithdrawConfirm(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-destructive mx-auto mt-1"
                  onClick={() => setWithdrawConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("seller.withdraw")}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Application details (not shown for draft if storeName is empty) */}
        {application.storeName && (
          <div className="mt-5 bg-card border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3">{t("seller_status.your_application")}</h3>
            <dl className="space-y-2.5 text-sm">
              {application.storeName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("seller_status.store_name")}</dt>
                  <dd className="font-medium">{application.storeName}</dd>
                </div>
              )}
              {application.category && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("seller_status.category")}</dt>
                  <dd className="font-medium capitalize">{application.category?.replace(/-/g, " ")}</dd>
                </div>
              )}
              {application.city && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t("seller_status.city")}</dt>
                  <dd className="font-medium">{application.city}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("seller_status.submitted_on")}</dt>
                <dd className="font-medium">
                  {format(new Date(application.createdAt), "MMM d, yyyy")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-5">
          {t("seller_status.contact_text")}{" "}
          <a href="mailto:support@syano.online" className="text-primary hover:underline">
            support@syano.online
          </a>
        </p>
      </div>
    </Layout>
  );
}
