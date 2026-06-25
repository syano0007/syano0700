import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Truck, ArrowLeft, User,
  Clock, CheckCircle2, XCircle, AlertTriangle, Star,
  Package, Loader2,
} from "lucide-react";

interface CourierDetail {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userCreatedAt: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, {
  color: string;
  icon: typeof Clock;
  iconClass: string;
  labelKey: string;
}> = {
  pending:   { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",   icon: Clock,         iconClass: "text-amber-500",  labelKey: "delivery.status_pending" },
  approved:  { color: "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary border-primary/20 dark:border-primary/20", icon: CheckCircle2, iconClass: "text-primary", labelKey: "delivery.status_approved" },
  rejected:  { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",               icon: XCircle,      iconClass: "text-red-500",    labelKey: "delivery.status_rejected" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800", icon: AlertTriangle, iconClass: "text-orange-500", labelKey: "delivery.status_suspended" },
};

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-3 border-b last:border-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide sm:w-40 shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-sm text-foreground", mono && "font-mono")}>{value ?? "—"}</span>
    </div>
  );
}

export default function AdminCourierApplicationDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actingStatus, setActingStatus] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: courier, isLoading, error } = useQuery<CourierDetail>({
    queryKey: ["admin-courier-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/couriers/${id}`, { headers });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!token && !!id,
    retry: false,
  });

  const updateCourier = async (status: string) => {
    if (!courier) return;
    setActingStatus(status);
    try {
      const res = await fetch(`/api/admin/couriers/${courier.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const key =
        status === "approved"
          ? courier.status === "suspended"
            ? "courier_applications.success_reactivated"
            : "courier_applications.success_approved"
          : status === "rejected"
          ? "courier_applications.success_rejected"
          : status === "suspended"
          ? "courier_applications.success_suspended"
          : "courier_applications.success_reactivated";
      toast({ title: t(key) });
      queryClient.invalidateQueries({ queryKey: ["admin-courier-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-couriers"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setActingStatus(null);
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(
      i18n.language === "ar" ? "ar-SY" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !courier) {
    return (
      <AdminLayout>
        <div className="p-4 md:p-8 max-w-2xl mx-auto text-center py-20">
          <AlertTriangle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4">{t("common.not_found", "Not Found")}</h2>
          <Button variant="ghost" onClick={() => navigate("/admin/courier-applications")}>
            <ArrowLeft className="h-4 w-4 me-2" /> {t("courier_applications.back")}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const cfg = STATUS_CONFIG[courier.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const isActing = !!actingStatus;

  return (
    <AdminLayout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-5 -ms-2 text-muted-foreground hover:text-foreground gap-1.5"
          onClick={() => navigate("/admin/courier-applications")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("courier_applications.back")}
        </Button>

        {/* Page Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary">
              {courier.userName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{courier.userName}</h1>
            <p className="text-sm text-muted-foreground" translate="no">{courier.userEmail}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <StatusIcon className={cn("h-4 w-4", cfg.iconClass)} />
              {t("courier_applications.section_status")}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn("text-sm font-bold px-3 py-1.5 rounded-full border", cfg.color)}>
                {t(`courier.status_${courier.status}`)}
              </span>
              {courier.status === "approved" && courier.active && (
                <span className="text-sm font-semibold px-3 py-1.5 rounded-full border bg-primary/5 text-primary dark:bg-primary/10/20 dark:text-primary border-primary/20 dark:border-primary/20">
                  {t("courier.status_online")}
                </span>
              )}
              {courier.status === "approved" && (
                <div className="flex items-center gap-3 ms-auto text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    {courier.completedDeliveries}
                  </span>
                  {courier.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {courier.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User Information */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
              <User className="h-4 w-4" />
              {t("courier_applications.section_user")}
            </h2>
            <InfoRow label={t("courier_applications.field_name")} value={courier.userName} />
            <InfoRow label={t("courier_applications.field_email")} value={<span translate="no">{courier.userEmail}</span>} mono />
            <InfoRow label={t("courier_applications.field_registered")} value={fmt(courier.userCreatedAt)} />
          </div>

          {/* Courier Information */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t("courier_applications.section_courier")}
            </h2>
            <InfoRow label={t("courier_applications.field_phone")} value={<span translate="no">{courier.phone}</span>} mono />
            <InfoRow label={t("courier_applications.field_vehicle")} value={t(`delivery.vehicle_${courier.vehicleType}`, courier.vehicleType)} />
            {courier.district && (
              <InfoRow label={t("courier_applications.field_district")} value={courier.district} />
            )}
            <InfoRow label={t("courier_applications.field_submitted")} value={fmt(courier.createdAt)} />
            <InfoRow label={t("courier_applications.field_updated")} value={fmt(courier.updatedAt)} />
            {courier.notes && (
              <InfoRow label={t("courier_applications.field_notes")} value={courier.notes} />
            )}
          </div>

          {/* Admin Actions */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("courier_applications.section_actions")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {/* Approve / Reactivate */}
              {(courier.status === "pending" || courier.status === "rejected" || courier.status === "suspended") && (
                <Button
                  className="gap-2 bg-primary hover:bg-primary/80 text-white"
                  disabled={isActing}
                  onClick={() => {
                    const key =
                      courier.status === "suspended"
                        ? "courier_applications.confirm_reactivate"
                        : "courier_applications.confirm_approve";
                    if (!confirm(t(key))) return;
                    updateCourier("approved");
                  }}
                >
                  {isActing && actingStatus === "approved" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {courier.status === "suspended"
                    ? t("courier_applications.action_reactivate")
                    : t("courier_applications.action_approve")}
                </Button>
              )}

              {/* Reject */}
              {courier.status === "pending" && (
                <Button
                  variant="outline"
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                  disabled={isActing}
                  onClick={() => {
                    if (!confirm(t("courier_applications.confirm_reject"))) return;
                    updateCourier("rejected");
                  }}
                >
                  {isActing && actingStatus === "rejected" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t("courier_applications.action_reject")}
                </Button>
              )}

              {/* Suspend */}
              {courier.status === "approved" && (
                <Button
                  variant="outline"
                  className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  disabled={isActing}
                  onClick={() => {
                    if (!confirm(t("courier_applications.confirm_suspend"))) return;
                    updateCourier("suspended");
                  }}
                >
                  {isActing && actingStatus === "suspended" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {t("courier_applications.action_suspend")}
                </Button>
              )}

              {courier.status === "rejected" && (
                <p className="text-xs text-muted-foreground self-center italic">
                  {t("courier.rejected_desc")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
