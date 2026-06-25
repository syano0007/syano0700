import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Store, CheckCircle, XCircle, Search, AlertTriangle, Clock,
  Download, ChevronLeft, ChevronRight, TrendingUp, Package,
  ShoppingCart, Star,
} from "lucide-react";
import type { SellerApplication } from "@workspace/api-client-react";

// ─── Application Status Badge ────────────────────────────────────────────────

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending:      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  under_review: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  approved:     "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary",
  rejected:     "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  suspended:    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const label = t(`admin.sellers_status_${status}`, { defaultValue: status });
  const cls = STATUS_BADGE_CLASSES[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Rate Badge ───────────────────────────────────────────────────────────────

function RateBadge({ value, isGood }: { value: number; isGood: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold",
      isGood
        ? "bg-primary/10 text-primary dark:bg-primary/10/20 dark:text-primary"
        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
    )}>
      {value}%
    </span>
  );
}

// ─── Seller Performance View ──────────────────────────────────────────────────

interface SellerPerf {
  id: number;
  name: string;
  email: string;
  storeName: string;
  storeSlug: string | null;
  sellerStatus: string;
  joinedAt: string;
  productCount: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  revenue: number;
  deliveryRate: number;
  cancellationRate: number;
  avgRating: number;
  reviewCount: number;
}

interface SellerListResponse {
  data: SellerPerf[];
  total: number;
  totalPages: number;
  page: number;
}

function SellerPerformanceView() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading } = useQuery<SellerListResponse>({
    queryKey: ["admin-sellers-performance", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/sellers/list?page=${page}&limit=${PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load sellers");
      return res.json();
    },
  });

  const sellers = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const handleExport = () => window.open("/api/admin/reports/export?type=sellers", "_blank");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} {t("admin.total_count")}</p>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> {t("admin.export_sellers_csv")}
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_store")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_products")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_orders")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_revenue")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_rating")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_delivery")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.sellers_col_cancel")}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-muted-foreground">{t("admin.col_joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && sellers.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{s.storeName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{s.storeName}</p>
                        <p className="text-[11px] text-muted-foreground truncate" translate="no">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Package className="h-3 w-3" />{s.productCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <ShoppingCart className="h-3 w-3" />{s.totalOrders}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums" translate="no">{formatCurrency(s.revenue)}</td>
                  <td className="px-4 py-3 text-end">
                    {s.reviewCount > 0 ? (
                      <span className="text-amber-500 text-xs font-bold">★ {s.avgRating.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <RateBadge value={s.deliveryRate} isGood={s.deliveryRate >= 70} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <RateBadge value={s.cancellationRate} isGood={s.cancellationRate <= 15} />
                  </td>
                  <td className="px-4 py-3 text-end text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(s.joinedAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
              {!isLoading && sellers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {t("admin.sellers_no_sellers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-sm text-muted-foreground">{t("admin.page_of", { page, totalPages })}</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <Button size="icon" variant="ghost" className="h-11 w-11" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Applications View ────────────────────────────────────────────────────────

const STATUS_TAB_VALUES = ["all", "pending", "under_review", "approved", "rejected", "suspended"] as const;

function ApplicationsView() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedApp, setSelectedApp] = useState<SellerApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const tabLabels: Record<string, string> = {
    all: t("admin.sellers_tab_all"),
    pending: t("admin.sellers_status_pending"),
    under_review: t("admin.sellers_status_under_review"),
    approved: t("admin.sellers_status_approved"),
    rejected: t("admin.sellers_status_rejected"),
    suspended: t("admin.sellers_status_suspended"),
  };

  const { data: applications = [], isLoading } = useQuery<SellerApplication[]>({
    queryKey: ["admin-seller-applications", activeTab],
    queryFn: async () => {
      const url = activeTab === "all" ? "/api/seller-applications" : `/api/seller-applications?status=${activeTab}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
  });

  const { data: allApps = [] } = useQuery<SellerApplication[]>({
    queryKey: ["admin-seller-applications", "all"],
    queryFn: async () => {
      const res = await fetch("/api/seller-applications", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const counts = (allApps as SellerApplication[]).reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes, rejectionReason }: { id: number; status: string; adminNotes?: string; rejectionReason?: string }) => {
      const res = await fetch(`/api/seller-applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, adminNotes, rejectionReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? t("common.error"));
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      const toastTitle = vars.status === "approved"
        ? t("admin.sellers_approved_toast")
        : t("admin.sellers_updated_toast", { status: t(`admin.sellers_status_${vars.status}`, { defaultValue: vars.status }) });
      toast({ title: toastTitle });
      queryClient.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sellers-performance"] });
      setSelectedApp(null);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const openDialog = (app: SellerApplication) => {
    setSelectedApp(app);
    setAdminNotes(app.adminNotes ?? "");
    setRejectionReason(app.rejectionReason ?? "");
  };

  const handleAction = (status: string) => {
    if (!selectedApp) return;
    reviewMutation.mutate({ id: selectedApp.id, status, adminNotes: adminNotes || undefined, rejectionReason: status === "rejected" || status === "suspended" ? rejectionReason || undefined : undefined });
  };

  return (
    <>
      <div className="flex gap-0 border-b mb-6 overflow-x-auto">
        {STATUS_TAB_VALUES.map((tabValue) => {
          const count = tabValue === "all" ? allApps.length : counts[tabValue] ?? 0;
          return (
            <button
              key={tabValue}
              onClick={() => setActiveTab(tabValue)}
              className={cn(
                "px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                activeTab === tabValue ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tabLabels[tabValue]}
              {count > 0 && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tabValue ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-[72px] bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16">
          <Store className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">{t("admin.sellers_empty")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab !== "all" ? t("admin.sellers_empty_status", { status: tabLabels[activeTab] }) : t("admin.sellers_empty_all")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(applications as SellerApplication[]).map((app) => (
            <div key={app.id} className="bg-card border rounded-xl px-4 py-3.5 flex items-center gap-3 hover:bg-accent/30 transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{app.storeName}</span>
                  <StatusBadge status={app.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {app.userName ?? "—"} ({app.userEmail ?? "—"}) · {app.city} · {app.category?.replace(/-/g, " ")}
                </p>
              </div>
              <div className="shrink-0 text-end hidden sm:block">
                <p className="text-xs text-muted-foreground">{format(new Date(app.createdAt), "MMM d, yyyy")}</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 min-h-[44px] text-xs" onClick={() => openDialog(app)}>
                {t("admin.sellers_review_btn")}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              {selectedApp?.storeName}
            </DialogTitle>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{t("admin.sellers_current_status")}</span>
                <StatusBadge status={selectedApp.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{t("admin.sellers_col_applicant")}</p>
                  <p className="font-semibold">{selectedApp.userName}</p>
                  <p className="text-muted-foreground text-xs">{selectedApp.userEmail}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{t("admin.sellers_col_location")}</p>
                  <p className="font-semibold">{selectedApp.city}</p>
                  {selectedApp.address && <p className="text-muted-foreground text-xs">{selectedApp.address}</p>}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{t("admin.sellers_col_category")}</p>
                  <p className="font-semibold capitalize">{selectedApp.category?.replace(/-/g, " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">{t("admin.sellers_col_phone")}</p>
                  <p className="font-semibold" translate="no">{selectedApp.phone}</p>
                </div>
              </div>

              {selectedApp.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{t("admin.sellers_col_description")}</p>
                  <p className="bg-muted/30 rounded-lg p-3 leading-relaxed">{selectedApp.description}</p>
                </div>
              )}
              {selectedApp.website && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{t("admin.sellers_col_website")}</p>
                  <a href={selectedApp.website} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">{selectedApp.website}</a>
                </div>
              )}
              {selectedApp.socialLinks && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{t("admin.sellers_col_social")}</p>
                  <p className="whitespace-pre-line text-xs">{selectedApp.socialLinks}</p>
                </div>
              )}
              {selectedApp.businessInfo && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{t("admin.sellers_col_business")}</p>
                  <p className="bg-muted/30 rounded-lg p-3 leading-relaxed">{selectedApp.businessInfo}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label className="text-xs font-semibold">
                    {t("admin.sellers_admin_notes_label")}{" "}
                    <span className="text-muted-foreground font-normal">{t("admin.sellers_admin_notes_hint")}</span>
                  </Label>
                  <Textarea placeholder={t("admin.sellers_admin_notes_placeholder")} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="mt-1 resize-none min-h-[70px]" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">
                    {t("admin.sellers_msg_label")}{" "}
                    <span className="text-muted-foreground font-normal">{t("admin.sellers_msg_hint")}</span>
                  </Label>
                  <Textarea placeholder={t("admin.sellers_msg_placeholder")} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="mt-1 resize-none min-h-[70px]" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => handleAction("under_review")} disabled={reviewMutation.isPending} className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {t("admin.sellers_action_review")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAction("suspended")} disabled={reviewMutation.isPending} className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/20">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("admin.sellers_action_suspend")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleAction("rejected")} disabled={reviewMutation.isPending} className="gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> {t("admin.sellers_action_reject")}
            </Button>
            <Button size="sm" onClick={() => handleAction("approved")} disabled={reviewMutation.isPending} className="gap-1.5 bg-primary hover:bg-primary text-white">
              <CheckCircle className="h-3.5 w-3.5" /> {t("admin.sellers_action_approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MainView = "applications" | "performance";

export default function AdminSellers() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [view, setView] = useState<MainView>("applications");

  const { data: allApps = [] } = useQuery<SellerApplication[]>({
    queryKey: ["admin-seller-applications", "all"],
    queryFn: async () => {
      const res = await fetch("/api/seller-applications", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const pendingCount = (allApps as SellerApplication[]).filter((a) => a.status === "pending").length;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("admin.nav_sellers")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.sellers_subtitle")}</p>
        </div>

        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-max min-w-full">
            <button
              onClick={() => setView("applications")}
              className={cn(
                "shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                view === "applications"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Store className="h-4 w-4 shrink-0" />
              {t("admin.sellers_apps_tab")}
              {pendingCount > 0 && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", view === "applications" ? "bg-rose-500 text-white" : "bg-rose-500/20 text-rose-600")}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setView("performance")}
              className={cn(
                "shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                view === "performance"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-4 w-4 shrink-0" />
              {t("admin.sellers_list_tab")}
            </button>
          </div>
        </div>

        {view === "applications" ? <ApplicationsView /> : <SellerPerformanceView />}
      </div>
    </AdminLayout>
  );
}
