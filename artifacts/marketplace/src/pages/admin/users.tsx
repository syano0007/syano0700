import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  useAdminListUsers,
  useAdminDeleteUser,
  getAdminListUsersQueryKey,
  getAdminGetStatsQueryKey,
  type AdminUser,
} from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trash2, Search, Users, ChevronLeft, ChevronRight, ShieldCheck, ShieldOff, ShieldCheck as ShieldReactivate, Shield, Award, ShieldX, AlertCircle, RefreshCw } from "lucide-react";
import { SellerTrustBadge, type VerificationLevel } from "@/components/SellerTrustBadge";

const ROLE_COLORS: Record<string, string> = {
  customer: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  seller: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  admin: "bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20",
};

const ACCOUNT_STATUS_CLASSES: Record<string, string> = {
  active: "bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20",
  suspended: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  disabled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  blocked: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
};

const PAGE_SIZE = 20;

const VERIFY_TIERS: { value: VerificationLevel; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { value: "basic", label: "Basic Verified", description: "Phone/email confirmed. Standard verification.", icon: Shield, color: "text-blue-600" },
  { value: "verified", label: "ID Verified", description: "Government ID checked and confirmed.", icon: ShieldCheck, color: "text-primary" },
  { value: "business", label: "Business Verified", description: "Business license and commercial registration confirmed.", icon: Award, color: "text-violet-600" },
];

export default function AdminUsers() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AdminUser | null>(null);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);

  const [verifyTarget, setVerifyTarget] = useState<AdminUser | null>(null);
  const [verifyLevel, setVerifyLevel] = useState<VerificationLevel>("basic");
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [unverifyTarget, setUnverifyTarget] = useState<AdminUser | null>(null);
  const [unverifyingId, setUnverifyingId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useAdminListUsers({ page, limit: PAGE_SIZE });

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useAdminDeleteUser({
    mutation: {
      onSuccess: () => {
        toast({ title: t("admin.user_deleted") });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        setDeleteTarget(null);
      },
      onError: (err: Error) => {
        toast({ title: t("common.error"), description: err.message, variant: "destructive" });
        setDeleteTarget(null);
      },
    },
  });

  const handleVerifyUser = async () => {
    if (!verifyTarget) return;
    setVerifyingId(verifyTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${verifyTarget.id}/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ level: verifyLevel }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: t("admin.users_verified_title"), description: t("admin.users_verified_desc", { name: verifyTarget.name }) });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setVerifyTarget(null);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleUnverifyUser = async () => {
    if (!unverifyTarget) return;
    setUnverifyingId(unverifyTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${unverifyTarget.id}/unverify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: t("admin.user_unverified_title", "Verification removed"), description: unverifyTarget.name });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setUnverifyTarget(null);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setUnverifyingId(null);
    }
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspendingId(suspendTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${suspendTarget.id}/suspend`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason.trim() || undefined }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: t("admin.user_suspended"), description: suspendTarget.name });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSuspendingId(null);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    setReactivatingId(reactivateTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${reactivateTarget.id}/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: t("admin.user_reactivated"), description: reactivateTarget.name });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
      setReactivateTarget(null);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setReactivatingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" /> {t("admin.nav_users")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("admin.users_desc")}</p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {total} {t("admin.total_count")}
          </div>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("admin.search_users")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_name")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_email")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_role")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_verification")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_joined")}</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_status")}</th>
                  <th className="text-end px-4 py-3 font-semibold text-muted-foreground">{t("admin.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isError && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12">
                      <div className="flex flex-col items-center justify-center text-center gap-3">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                        <p className="font-semibold text-foreground text-sm">{t("common.error_title")}</p>
                        <p className="text-xs text-muted-foreground">{t("common.error_subtitle")}</p>
                        <button
                          onClick={() => refetch()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />{t("common.retry")}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {isLoading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && filtered.map((user) => {
                  const acctStatus = (user as any).accountStatus as string ?? "active";
                  const isSuspended = acctStatus !== "active";
                  const verificationLevel = ((user as any).verificationLevel ?? "none") as VerificationLevel;
                  const isVerified = (user as any).isVerified as boolean ?? false;
                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="font-medium text-foreground">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" translate="no">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${ROLE_COLORS[user.role] ?? "bg-muted text-muted-foreground"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isVerified && verificationLevel !== "none" ? (
                          <SellerTrustBadge level={verificationLevel} isVerified={isVerified} size="xs" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${ACCOUNT_STATUS_CLASSES[acctStatus] ?? "bg-muted text-muted-foreground border-border"}`}>
                          {t(`admin.status_${acctStatus}`, { defaultValue: acctStatus })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {user.role !== "admin" && (
                            isSuspended ? (
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => setReactivateTarget(user)}
                                disabled={reactivatingId === user.id}
                                title={t("admin.reactivate_account")}
                              >
                                <ShieldReactivate className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-orange-600 hover:bg-orange-500/10"
                                onClick={() => { setSuspendReason(""); setSuspendTarget(user); }}
                                disabled={suspendingId === user.id}
                                title={t("admin.suspend_account")}
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            )
                          )}
                          {user.role === "seller" && (
                            isVerified ? (
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
                                onClick={() => setUnverifyTarget(user)}
                                disabled={unverifyingId === user.id}
                                title={t("admin.unverify_user", "Remove verification")}
                              >
                                <ShieldX className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => { setVerifyLevel("basic"); setVerifyTarget(user); }}
                                disabled={verifyingId === user.id}
                                title={t("admin.verify_user")}
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            )
                          )}
                          {user.role !== "seller" && !user.isVerified && (
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => { setVerifyLevel("basic"); setVerifyTarget(user); }}
                              disabled={verifyingId === user.id}
                              title={t("admin.verify_user")}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon" variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && !filtered.length && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t("admin.no_results")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
              <span className="text-sm text-muted-foreground">
                {t("admin.page_of", { page, totalPages })}
              </span>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.delete_user_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.delete_user_desc", { name: deleteTarget?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("seller_products.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
            >
              {t("seller_products.confirm_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verify modal — tier selection */}
      <Dialog open={!!verifyTarget} onOpenChange={() => setVerifyTarget(null)}>
        <DialogContent className="w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t("admin.verify_user_title", "Verify Seller")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("admin.verify_user_desc_name", "Select verification tier for {{name}}:", { name: verifyTarget?.name })}
          </p>
          <RadioGroup value={verifyLevel} onValueChange={(v) => setVerifyLevel(v as VerificationLevel)} className="gap-3 mt-1">
            {VERIFY_TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <label
                  key={tier.value}
                  htmlFor={`tier-${tier.value}`}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${verifyLevel === tier.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
                >
                  <RadioGroupItem id={`tier-${tier.value}`} value={tier.value} className="mt-0.5" />
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tier.color}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tier.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>{t("seller_products.cancel")}</Button>
            <Button
              className="bg-primary hover:bg-primary/80 text-white"
              disabled={verifyingId !== null}
              onClick={handleVerifyUser}
            >
              <ShieldCheck className="h-4 w-4 me-1.5" />
              {t("admin.verify_user")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unverify confirmation */}
      <AlertDialog open={!!unverifyTarget} onOpenChange={() => setUnverifyTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.unverify_confirm_title", "Remove Verification?")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.unverify_confirm_desc", "This will remove the verification badge from {{name}}. Their trust score will be recalculated.", { name: unverifyTarget?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("seller_products.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleUnverifyUser}
            >
              {t("admin.unverify_user", "Remove Verification")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend modal */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent className="w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin.suspend_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("admin.suspend_confirm_desc", { name: suspendTarget?.name })}
          </p>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("admin.suspension_reason")}</Label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder={t("admin.suspension_reason_placeholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>{t("seller_products.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={suspendingId !== null}
              onClick={handleSuspend}
            >
              {t("admin.suspend_account")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate confirmation */}
      <AlertDialog open={!!reactivateTarget} onOpenChange={() => setReactivateTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.reactivate_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.reactivate_confirm_desc", { name: reactivateTarget?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("seller_products.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/80 text-white"
              onClick={handleReactivate}
            >
              {t("admin.reactivate_account")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
