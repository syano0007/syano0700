/**
 * Admin Courier Payout Center — Phase A9
 * /admin/courier-payouts
 *
 * Features:
 *   - Pending queue with approve / reject
 *   - Status tabs: ALL | PENDING | APPROVED | REJECTED
 *   - Courier search
 *   - Stats summary cards
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DollarSign, CheckCircle2, XCircle, Clock, Search, RefreshCw,
  ArrowLeft, User, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PayoutRow {
  id: number;
  courierId: number;
  courierName: string;
  courierEmail: string;
  courierPhone: string | null;
  amount: number;
  status: string;
  rejectionReason: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PayoutStats {
  PENDING?:  { count: number; total: number };
  APPROVED?: { count: number; total: number };
  REJECTED?: { count: number; total: number };
  PAID?:     { count: number; total: number };
}

interface AdminPayoutsResponse {
  payouts: PayoutRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  stats: PayoutStats;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(amount: number) { return `$${amount.toFixed(2)}`; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING:  "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    APPROVED: "bg-primary/10 dark:bg-primary/10/40 text-primary dark:text-primary",
    REJECTED: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400",
    PAID:     "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  };
  return <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", map[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}

// ── Reject Modal ───────────────────────────────────────────────────────────────

function RejectModal({
  payout,
  onClose,
  onSubmit,
  loading,
}: {
  payout: PayoutRow;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b">
          <h2 className="font-bold text-lg text-red-600 dark:text-red-400">{t("payout.confirm_reject")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {payout.courierName} — <span className="font-bold" translate="no">{fmt(payout.amount)}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("payout.rejection_reason")}</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("payout.rejection_reason_placeholder")}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => reason.trim() && onSubmit(reason.trim())}
              disabled={!reason.trim() || loading}
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              {t("payout.reject")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const TABS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
type Tab = typeof TABS[number];

export default function AdminCourierPayouts() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const [tab, setTab] = useState<Tab>("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<PayoutRow | null>(null);

  const statusParam = tab === "ALL" ? "" : tab;

  const { data, isLoading, refetch } = useQuery<AdminPayoutsResponse>({
    queryKey: ["admin-courier-payouts", tab, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusParam) params.set("status", statusParam);
      if (search.trim()) params.set("search", search.trim());
      return fetch(`/api/admin/courier-payouts?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/courier-payouts/${id}/approve`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.ok) {
        toast({ title: t("payout.approved_success") });
        qc.invalidateQueries({ queryKey: ["admin-courier-payouts"] });
      } else {
        toast({ title: d.error ?? t("common.error"), variant: "destructive" });
      }
    },
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      fetch(`/api/admin/courier-payouts/${id}/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.ok) {
        toast({ title: t("payout.rejected_success") });
        setRejectTarget(null);
        qc.invalidateQueries({ queryKey: ["admin-courier-payouts"] });
      } else {
        toast({ title: d.error ?? t("common.error"), variant: "destructive" });
      }
    },
  });

  const stats = data?.stats ?? {};
  const pendingCount = stats.PENDING?.count ?? 0;
  const pendingTotal = stats.PENDING?.total ?? 0;
  const approvedTotal = stats.APPROVED?.total ?? 0;
  const allCount = Object.values(stats).reduce((s, v) => s + (v?.count ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/admin">
            <button type="button" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {t("payout.title")}
            </h1>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                {pendingCount} {t("payout.pending_queue")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">{t("wallet.status_pending")}</span>
            </div>
            <p className="text-xl font-black text-amber-700 dark:text-amber-300" translate="no">{pendingCount}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 font-semibold" translate="no">{fmt(pendingTotal)}</p>
          </div>
          <div className="bg-primary/5 dark:bg-primary/10/20 border border-primary/20 dark:border-primary/20/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary dark:text-primary" />
              <span className="text-xs text-primary dark:text-primary font-semibold">{t("wallet.status_approved")}</span>
            </div>
            <p className="text-xl font-black text-primary dark:text-primary" translate="no">{stats.APPROVED?.count ?? 0}</p>
            <p className="text-xs text-primary dark:text-primary font-semibold" translate="no">{fmt(approvedTotal)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-700 dark:text-red-400 font-semibold">{t("wallet.status_rejected")}</span>
            </div>
            <p className="text-xl font-black text-red-700 dark:text-red-300" translate="no">{stats.REJECTED?.count ?? 0}</p>
            <p className="text-xs text-red-600 dark:text-red-500 font-semibold" translate="no">{fmt(stats.REJECTED?.total ?? 0)}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-semibold">{t("payout.all_time_payouts")}</span>
            </div>
            <p className="text-xl font-black" translate="no">{allCount}</p>
            <p className="text-xs text-muted-foreground font-semibold">{t("payout.total_requests")}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("payout.search_courier")}
            className="pl-9"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((tid) => {
            const count = tid === "ALL" ? allCount : (stats[tid]?.count ?? 0);
            return (
              <button
                key={tid}
                type="button"
                onClick={() => { setTab(tid); setPage(1); }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 border",
                  tab === tid
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted",
                )}
              >
                {tid}
                {count > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-bold",
                    tab === tid ? "bg-white/20" : "bg-muted text-muted-foreground",
                  )}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Payout List */}
        {isLoading && !data ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : data?.payouts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t("payout.no_requests")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.payouts.map((p) => (
              <div key={p.id} className="bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 dark:bg-primary/10/40 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary dark:text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{p.courierName}</p>
                      <p className="text-xs text-muted-foreground">{p.courierEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black" translate="no">{fmt(p.amount)}</p>
                    {statusBadge(p.status)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t("payout.requested")}: {formatDate(p.createdAt)}</p>

                {p.rejectionReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-3 flex items-center gap-1">
                    <XCircle className="h-3 w-3 shrink-0" /> {p.rejectionReason}
                  </p>
                )}
                {p.approvedAt && p.approvedByName && (
                  <p className="text-xs text-primary dark:text-primary mb-3 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {p.status === "APPROVED" ? t("payout.approved_by") : t("payout.actioned_by")}: {p.approvedByName} · {formatDate(p.approvedAt)}
                  </p>
                )}

                {p.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-primary hover:bg-primary/80 text-white"
                      onClick={() => approve(p.id)}
                      disabled={approving || rejecting}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      {t("payout.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => setRejectTarget(p)}
                      disabled={approving || rejecting}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      {t("payout.reject")}
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {data && data.pagination.pages > 1 && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex-1">
                  ← {t("common.prev")}
                </Button>
                <span className="flex items-center text-xs text-muted-foreground px-2">
                  {page}/{data.pagination.pages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.pages} className="flex-1">
                  {t("common.next")} →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          payout={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSubmit={(reason) => reject({ id: rejectTarget.id, reason })}
          loading={rejecting}
        />
      )}
    </div>
  );
}
