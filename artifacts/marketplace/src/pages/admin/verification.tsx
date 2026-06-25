import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SellerTrustBadge, TrustScoreBar, type VerificationLevel } from "@/components/SellerTrustBadge";
import {
  Shield, ShieldCheck, Award, ShieldX, Store, RefreshCw, Search,
} from "lucide-react";
import { format } from "date-fns";

interface SellerVerificationRow {
  userId: number;
  name: string;
  email: string;
  isVerified: boolean;
  verificationLevel: string;
  verifiedAt: string | null;
  verificationMethod: string | null;
  trustScore: number | null;
  trustLevel: string;
  storeName: string | null;
  storeSlug: string | null;
  createdAt: string;
}

export default function AdminVerificationPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [verifyTarget, setVerifyTarget] = useState<SellerVerificationRow | null>(null);
  const [verifyLevel, setVerifyLevel] = useState<VerificationLevel>("basic");
  const [unverifyTarget, setUnverifyTarget] = useState<SellerVerificationRow | null>(null);
  const [recomputeId, setRecomputeId] = useState<number | null>(null);

  // ── Tier options (inside component so t() is in scope) ─────────────────────
  const VERIFY_TIERS: { value: VerificationLevel; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { value: "basic",    label: t("admin.tier_basic_label"),    desc: t("admin.tier_basic_desc"),    icon: Shield,      color: "text-blue-600" },
    { value: "verified", label: t("admin.tier_id_label"),       desc: t("admin.tier_id_desc"),       icon: ShieldCheck, color: "text-primary" },
    { value: "business", label: t("admin.tier_business_label"), desc: t("admin.tier_business_desc"), icon: Award,       color: "text-violet-600" },
  ];

  // ── Filter options (inside component so t() is in scope) ───────────────────
  const FILTER_OPTIONS = [
    { value: "all",        label: t("admin.filter_all_sellers") },
    { value: "verified",   label: t("admin.filter_verified") },
    { value: "unverified", label: t("admin.filter_unverified") },
    { value: "basic",      label: t("admin.filter_basic") },
    { value: "id_verified",label: t("admin.filter_id_verified") },
    { value: "business",   label: t("admin.filter_business") },
  ];

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: sellers = [], isLoading, refetch } = useQuery<SellerVerificationRow[]>({
    queryKey: ["admin-verification-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/sellers/verification", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!token,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async ({ id, level }: { id: number; level: VerificationLevel }) => {
      const res = await fetch(`/api/admin/sellers/${id}/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", level }),
      });
      if (!res.ok) throw new Error("Failed to verify");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("admin.toast_seller_verified") });
      setVerifyTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-verification-list"] });
    },
    onError: () => toast({ title: t("admin.toast_verify_failed"), variant: "destructive" }),
  });

  const unverifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/sellers/${id}/verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unverify" }),
      });
      if (!res.ok) throw new Error("Failed to unverify");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("admin.toast_unverified") });
      setUnverifyTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-verification-list"] });
    },
    onError: () => toast({ title: t("admin.toast_unverify_failed"), variant: "destructive" }),
  });

  const recomputeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/sellers/${id}/recompute-trust`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to recompute");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("admin.toast_trust_updated", { score: data.trustScore }) });
      setRecomputeId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-verification-list"] });
    },
    onError: () => toast({ title: t("admin.toast_recompute_failed"), variant: "destructive" }),
  });

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = sellers.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.storeName ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "verified"   && s.isVerified) ||
      (filter === "unverified" && !s.isVerified) ||
      (filter === "basic"      && s.verificationLevel === "basic") ||
      (filter === "id_verified"&& s.verificationLevel === "verified") ||
      (filter === "business"   && s.verificationLevel === "business");

    return matchesSearch && matchesFilter;
  });

  const verifiedCount   = sellers.filter((s) => s.isVerified).length;
  const unverifiedCount = sellers.filter((s) => !s.isVerified).length;
  const businessCount   = sellers.filter((s) => s.verificationLevel === "business").length;

  // ── Stats (inside render so t() works) ────────────────────────────────────
  const STATS = [
    { label: t("admin.stat_total_sellers"), value: sellers.length,  color: "text-foreground" },
    { label: t("admin.stat_verified"),       value: verifiedCount,   color: "text-primary" },
    { label: t("admin.stat_unverified"),     value: unverifiedCount, color: "text-amber-600" },
    { label: t("admin.stat_business_tier"),  value: businessCount,   color: "text-violet-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8 px-1 sm:px-2 pb-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-foreground leading-tight">
              {t("admin.verification_title")}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
              {t("admin.verification_desc")}
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-9 px-4">
              <RefreshCw className="h-3.5 w-3.5" />
              {t("admin.refresh")}
            </Button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm flex flex-col gap-2"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p className={`text-3xl font-black leading-none ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_sellers")}
              className="ps-10 h-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-3.5 py-2 rounded-lg font-medium border transition-colors ${
                  filter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Store className="h-10 w-10 opacity-25" />
              <p className="text-sm font-medium">{t("admin.no_sellers_found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-start px-6 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      {t("admin.col_seller")}
                    </th>
                    <th className="text-start px-6 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      {t("admin.col_verification")}
                    </th>
                    <th className="text-start px-6 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      {t("trust.trust_score")}
                    </th>
                    <th className="text-start px-6 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      {t("admin.col_verified_at")}
                    </th>
                    <th className="text-end px-6 py-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                      {t("admin.col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((seller, i) => {
                    const level = (seller.verificationLevel ?? "none") as VerificationLevel;
                    return (
                      <tr
                        key={seller.userId}
                        className={`hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        {/* Seller info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-sm font-black text-primary">
                                {seller.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground leading-snug">{seller.name}</p>
                              <p className="text-xs text-muted-foreground" translate="no">{seller.email}</p>
                              {seller.storeName && (
                                <p className="text-xs text-muted-foreground/70">{seller.storeName}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Verification badge */}
                        <td className="px-6 py-4">
                          {seller.isVerified && level !== "none" ? (
                            <SellerTrustBadge level={level} isVerified={seller.isVerified} size="sm" />
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              {t("admin.unverified")}
                            </span>
                          )}
                        </td>

                        {/* Trust score */}
                        <td className="px-6 py-4">
                          {seller.trustScore != null ? (
                            <div className="w-36">
                              <TrustScoreBar score={seller.trustScore} size="sm" />
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Verified at */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground" translate="no">
                            {seller.verifiedAt
                              ? format(new Date(seller.verifiedAt), "dd MMM yyyy")
                              : "—"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setRecomputeId(null);
                                recomputeMutation.mutate(seller.userId);
                              }}
                              disabled={recomputeMutation.isPending}
                              title={t("admin.tooltip_recompute")}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            {seller.isVerified ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setUnverifyTarget(seller)}
                                title={t("admin.tooltip_remove_verif")}
                              >
                                <ShieldX className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs gap-1.5"
                              onClick={() => { setVerifyTarget(seller); setVerifyLevel("basic"); }}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {seller.isVerified ? t("admin.change_tier") : t("admin.verify_action")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Verify dialog ── */}
      <Dialog open={!!verifyTarget} onOpenChange={() => setVerifyTarget(null)}>
        <DialogContent className="w-[90vw] sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader className="space-y-2 pb-2">
            <DialogTitle className="text-xl font-bold">
              {t("admin.verify_user_title")}
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("admin.verify_user_desc_name", { name: verifyTarget?.name })}
            </p>
          </DialogHeader>

          <RadioGroup
            value={verifyLevel}
            onValueChange={(v) => setVerifyLevel(v as VerificationLevel)}
            className="flex flex-col gap-3 py-2"
          >
            {VERIFY_TIERS.map((tier) => {
              const TIcon = tier.icon;
              return (
                <Label
                  key={tier.value}
                  htmlFor={`vtier-${tier.value}`}
                  className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    verifyLevel === tier.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <RadioGroupItem id={`vtier-${tier.value}`} value={tier.value} className="mt-0.5 shrink-0" />
                  <TIcon className={`h-5 w-5 mt-0.5 shrink-0 ${tier.color}`} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground leading-snug">{tier.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tier.desc}</p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>
              {t("admin.cancel")}
            </Button>
            <Button
              onClick={() => verifyTarget && verifyMutation.mutate({ id: verifyTarget.userId, level: verifyLevel })}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? t("admin.saving") : t("admin.verify_action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unverify confirmation ── */}
      <AlertDialog open={!!unverifyTarget} onOpenChange={() => setUnverifyTarget(null)}>
        <AlertDialogContent className="w-[90vw] rounded-2xl sm:max-w-md">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-xl font-bold">
              {t("admin.unverify_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {t("admin.unverify_confirm_desc", { name: unverifyTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => unverifyTarget && unverifyMutation.mutate(unverifyTarget.userId)}
            >
              {t("admin.remove_verification")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
