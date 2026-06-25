/**
 * Courier Wallet — Phase A9
 * /courier/wallet
 *
 * Sections:
 *   - Balance card (available, pending, lifetime earnings, lifetime payouts)
 *   - Request Payout button + modal
 *   - Transaction history (paginated)
 *   - Payout history tab
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Wallet, ArrowDownCircle, TrendingUp, Clock, CheckCircle2,
  XCircle, RefreshCw, Truck, User, DollarSign, ChevronRight,
  History, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WalletData {
  id: number;
  courierId: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  lifetimePayouts: number;
  updatedAt: string;
}

interface WalletTx {
  id: number;
  orderId: number | null;
  amount: number;
  type: string;
  notes: string | null;
  description: string | null;
  balanceAfter: number | null;
  referenceType: string | null;
  createdAt: string;
}

interface PayoutRequest {
  id: number;
  amount: number;
  status: string;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function txTypeLabel(type: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    EARNING: t("wallet.type_earning"),
    delivery_fee: t("wallet.type_earning"),
    PAYOUT_REQUEST: t("wallet.type_payout_request"),
    PAYOUT_APPROVED: t("wallet.type_payout_approved"),
    PAYOUT_REJECTED: t("wallet.type_payout_rejected"),
    ADJUSTMENT: t("wallet.type_adjustment"),
  };
  return map[type] ?? type;
}

function txTypeColor(type: string) {
  if (type === "EARNING" || type === "delivery_fee" || type === "PAYOUT_REJECTED")
    return "text-emerald-600 dark:text-emerald-400";
  if (type === "PAYOUT_REQUEST" || type === "PAYOUT_APPROVED")
    return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function statusBadge(status: string, t: (k: string) => string) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: t("wallet.status_pending"),  cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" },
    APPROVED: { label: t("wallet.status_approved"), cls: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
    REJECTED: { label: t("wallet.status_rejected"), cls: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400" },
    PAID:     { label: t("wallet.status_paid"),     cls: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", s.cls)}>{s.label}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Nav ────────────────────────────────────────────────────────────────────────

function CourierNav({ active }: { active: string }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",           icon: Truck,        labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",    icon: CheckCircle2, labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings",   icon: DollarSign,   labelKey: "courier.nav_earnings" },
    { id: "wallet",    href: "/courier/wallet",     icon: Wallet,       labelKey: "wallet.nav" },
    { id: "profile",   href: "/courier/profile",    icon: User,         labelKey: "courier.nav_profile" },
  ] as const;
  return (
    <nav className="flex border-t bg-card shrink-0">
      {items.map(({ id, href, icon: Icon, labelKey }) => (
        <Link key={id} href={href} className={cn(
          "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
          active === id
            ? "text-emerald-600 dark:text-emerald-400 border-t-2 border-emerald-500"
            : "text-muted-foreground hover:text-foreground",
        )}>
          <Icon className="h-4 w-4" />
          {t(labelKey)}
        </Link>
      ))}
    </nav>
  );
}

// ── Payout Modal ───────────────────────────────────────────────────────────────

function PayoutModal({
  available,
  onClose,
  onSubmit,
  loading,
}: {
  available: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const parsed = parseFloat(amount || "0");
  const isValid = parsed > 0 && parsed <= available;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b">
          <h2 className="font-bold text-lg">{t("wallet.request_payout")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("wallet.available")}: <span className="font-bold text-emerald-600 dark:text-emerald-400" translate="no">{fmt(available)}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">{t("wallet.payout_amount")}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                autoFocus
              />
            </div>
            {parsed > available && (
              <p className="text-xs text-red-500 mt-1">{t("wallet.insufficient_balance")}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t("wallet.payout_min")}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => isValid && onSubmit(parsed)}
              disabled={!isValid || loading}
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t("wallet.confirm_payout")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CourierWallet() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  const [tab, setTab] = useState<"transactions" | "payouts">("transactions");
  const [txPage, setTxPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  // Wallet
  const { data: wallet, isLoading: loadingWallet, refetch: refetchWallet } = useQuery<WalletData>({
    queryKey: ["courier-wallet"],
    queryFn: () => fetch("/api/courier/wallet", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  // Transactions
  const { data: txData, isLoading: loadingTx } = useQuery<{ transactions: WalletTx[]; pagination: { total: number; pages: number } }>({
    queryKey: ["courier-wallet-transactions", txPage],
    queryFn: () => fetch(`/api/courier/wallet/transactions?page=${txPage}&limit=20`, { headers }).then((r) => r.json()),
    enabled: !!token && tab === "transactions",
    refetchInterval: 30_000,
  });

  // Payouts
  const { data: payoutData, isLoading: loadingPayouts } = useQuery<{ payouts: PayoutRequest[] }>({
    queryKey: ["courier-payouts"],
    queryFn: () => fetch("/api/courier/payouts", { headers }).then((r) => r.json()),
    enabled: !!token && tab === "payouts",
    refetchInterval: 30_000,
  });

  // Request payout mutation
  const { mutate: submitPayout, isPending: payoutLoading } = useMutation({
    mutationFn: (amount: number) =>
      fetch("/api/courier/payouts", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.ok) {
        toast({ title: t("wallet.payout_success") });
        setShowModal(false);
        qc.invalidateQueries({ queryKey: ["courier-wallet"] });
        qc.invalidateQueries({ queryKey: ["courier-wallet-transactions"] });
        qc.invalidateQueries({ queryKey: ["courier-payouts"] });
      } else {
        toast({ title: data.error ?? t("common.error"), variant: "destructive" });
      }
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const available = wallet?.availableBalance ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b bg-card shrink-0 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-500" />
            {t("wallet.title")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("wallet.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => { refetchWallet(); }}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Balance Card */}
        {loadingWallet && !wallet ? (
          <div className="h-52 bg-muted rounded-2xl animate-pulse" />
        ) : wallet ? (
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -top-6 -right-6 h-28 w-28 bg-white/10 rounded-full" />
            <div className="absolute -bottom-4 -left-4 h-20 w-20 bg-white/5 rounded-full" />
            <p className="text-sm font-semibold opacity-80 mb-1">{t("wallet.available")}</p>
            <p className="text-5xl font-black tracking-tight" translate="no">{fmt(wallet.availableBalance)}</p>
            {wallet.pendingBalance > 0 && (
              <p className="text-xs mt-1.5 opacity-80 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("wallet.pending")}: {fmt(wallet.pendingBalance)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20 text-sm">
              <div>
                <p className="opacity-70 text-xs">{t("wallet.lifetime_earnings")}</p>
                <p className="font-bold" translate="no">{fmt(wallet.lifetimeEarnings)}</p>
              </div>
              <div>
                <p className="opacity-70 text-xs">{t("wallet.lifetime_payouts")}</p>
                <p className="font-bold" translate="no">{fmt(wallet.lifetimePayouts)}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Request Payout Button */}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold text-base rounded-xl shadow"
          onClick={() => setShowModal(true)}
          disabled={!wallet || available <= 0}
        >
          <ArrowDownCircle className="h-5 w-5 mr-2" />
          {t("wallet.request_payout")}
          {wallet && available > 0 && (
            <span className="ml-2 text-xs opacity-80" translate="no">({fmt(available)})</span>
          )}
        </Button>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["transactions", "payouts"] as const).map((tid) => (
            <button
              key={tid}
              type="button"
              onClick={() => setTab(tid)}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors",
                tab === tid
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted",
              )}
            >
              {tid === "transactions" ? (
                <span className="flex items-center justify-center gap-1.5"><History className="h-3.5 w-3.5" /> {t("wallet.transaction_history")}</span>
              ) : (
                <span className="flex items-center justify-center gap-1.5"><Send className="h-3.5 w-3.5" /> {t("wallet.payout_history")}</span>
              )}
            </button>
          ))}
        </div>

        {/* Transactions Tab */}
        {tab === "transactions" && (
          <div className="space-y-2">
            {loadingTx && !txData && (
              [0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)
            )}
            {txData?.transactions.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("wallet.no_transactions")}</p>
              </div>
            )}
            {txData?.transactions.map((tx) => (
              <div key={tx.id} className="bg-card border rounded-xl p-3.5 flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                  tx.amount >= 0 ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-amber-100 dark:bg-amber-950/40",
                )}>
                  {tx.amount >= 0
                    ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    : <ArrowDownCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{txTypeLabel(tx.type, t)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", txTypeColor(tx.type))} translate="no">
                  {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
                </p>
              </div>
            ))}
            {/* Pagination */}
            {txData && txData.pagination.pages > 1 && (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setTxPage((p) => Math.max(1, p - 1))} disabled={txPage <= 1} className="flex-1">
                  ← {t("common.prev")}
                </Button>
                <span className="flex items-center text-xs text-muted-foreground px-2">
                  {txPage}/{txData.pagination.pages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setTxPage((p) => p + 1)} disabled={txPage >= txData.pagination.pages} className="flex-1">
                  {t("common.next")} →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Payouts Tab */}
        {tab === "payouts" && (
          <div className="space-y-2">
            {loadingPayouts && !payoutData && (
              [0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)
            )}
            {payoutData?.payouts.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("wallet.no_payouts")}</p>
              </div>
            )}
            {payoutData?.payouts.map((p) => (
              <div key={p.id} className="bg-card border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold" translate="no">{fmt(p.amount)}</p>
                  {statusBadge(p.status, t)}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                {p.rejectionReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3 shrink-0" /> {p.rejectionReason}
                  </p>
                )}
                {p.approvedAt && p.status === "APPROVED" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {t("wallet.approved_on")}: {formatDate(p.approvedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick link to performance */}
        <Link href="/courier/performance">
          <div className="bg-card border rounded-xl p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors cursor-pointer">
            <TrendingUp className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{t("courier.nav_performance")}</p>
              <p className="text-xs text-muted-foreground">{t("wallet.view_performance_hint")}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Bottom Nav */}
      <CourierNav active="wallet" />

      {/* Payout Modal */}
      {showModal && (
        <PayoutModal
          available={available}
          onClose={() => setShowModal(false)}
          onSubmit={submitPayout}
          loading={payoutLoading}
        />
      )}
    </div>
  );
}
