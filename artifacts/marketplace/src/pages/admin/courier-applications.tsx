import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Truck, User, Star, ChevronRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Loader2,
} from "lucide-react";

interface CourierRow {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
  notes: string | null;
  createdAt: string;
}

type TabKey = "pending" | "approved" | "rejected" | "suspended";

const STATUS_CONFIG: Record<TabKey, {
  color: string;
  icon: typeof Clock;
  iconClass: string;
}> = {
  pending:   { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",   icon: Clock,         iconClass: "text-amber-500" },
  approved:  { color: "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary border-primary/20 dark:border-primary/20", icon: CheckCircle2,  iconClass: "text-primary" },
  rejected:  { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",               icon: XCircle,       iconClass: "text-red-500" },
  suspended: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800", icon: AlertTriangle,  iconClass: "text-orange-500" },
};

export default function AdminCourierApplications() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("pending");
  const [actingId, setActingId] = useState<number | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: couriers = [], isLoading, refetch } = useQuery<CourierRow[]>({
    queryKey: ["admin-couriers"],
    queryFn: () => fetch("/api/admin/couriers", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const filtered = couriers.filter((c) => c.status === tab);

  const TABS: { key: TabKey; label: string }[] = [
    { key: "pending",   label: t("courier_applications.tab_pending") },
    { key: "approved",  label: t("courier_applications.tab_approved") },
    { key: "rejected",  label: t("courier_applications.tab_rejected") },
    { key: "suspended", label: t("courier_applications.tab_suspended") },
  ];

  const counts: Record<TabKey, number> = {
    pending:   couriers.filter((c) => c.status === "pending").length,
    approved:  couriers.filter((c) => c.status === "approved").length,
    rejected:  couriers.filter((c) => c.status === "rejected").length,
    suspended: couriers.filter((c) => c.status === "suspended").length,
  };

  const updateCourier = async (courierId: number, status: string) => {
    setActingId(courierId);
    try {
      const res = await fetch(`/api/admin/couriers/${courierId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const successKey = `courier_applications.success_${status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "suspended" ? "suspended" : "reactivated"}`;
      toast({ title: t(successKey) });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-sidebar-badges"] });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const emptyKeys: Record<TabKey, string> = {
    pending:   "courier_applications.empty_pending",
    approved:  "courier_applications.empty_approved",
    rejected:  "courier_applications.empty_rejected",
    suspended: "courier_applications.empty_suspended",
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            {t("courier_applications.page_title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("courier_applications.page_subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {label}
              {counts[key] > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  tab === key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card border rounded-2xl text-center">
            <Truck className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">{t(emptyKeys[tab])}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((courier) => {
              const cfg = STATUS_CONFIG[courier.status] ?? STATUS_CONFIG.pending;
              const isActing = actingId === courier.id;

              return (
                <div
                  key={courier.id}
                  className="bg-card border rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-base font-bold text-primary">
                          {courier.userName?.charAt(0)?.toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-sm text-foreground">{courier.userName}</p>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            cfg.color
                          )}>
                            {t(`courier.status_${courier.status}`)}
                          </span>
                          {courier.status === "approved" && courier.active && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary/5 text-primary dark:bg-primary/10/20 dark:text-primary border-primary/20 dark:border-primary/20">
                              {t("courier.status_online")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate" translate="no">{courier.userEmail}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{t(`delivery.vehicle_${courier.vehicleType}`)}</span>
                          {courier.district && <span>· {courier.district}</span>}
                          {courier.status === "approved" && (
                            <span>· {t("courier_applications.field_deliveries")}: {courier.completedDeliveries}</span>
                          )}
                          {courier.rating != null && (
                            <span className="flex items-center gap-0.5">
                              · <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {courier.rating.toFixed(1)}
                            </span>
                          )}
                          <span>· {new Date(courier.createdAt).toLocaleDateString(i18n.language === "ar" ? "ar-SY" : "en-US")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {/* Approve */}
                      {(courier.status === "pending" || courier.status === "rejected" || courier.status === "suspended") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary/30 text-primary hover:bg-primary/5 dark:border-primary/20 dark:text-primary"
                          disabled={isActing}
                          onClick={() => {
                            const key = courier.status === "suspended"
                              ? "courier_applications.confirm_reactivate"
                              : "courier_applications.confirm_approve";
                            if (!confirm(t(key))) return;
                            updateCourier(courier.id, "approved");
                          }}
                        >
                          {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                            courier.status === "suspended"
                              ? t("courier_applications.action_reactivate")
                              : t("courier_applications.action_approve")
                          )}
                        </Button>
                      )}
                      {/* Reject */}
                      {courier.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                          disabled={isActing}
                          onClick={() => {
                            if (!confirm(t("courier_applications.confirm_reject"))) return;
                            updateCourier(courier.id, "rejected");
                          }}
                        >
                          {t("courier_applications.action_reject")}
                        </Button>
                      )}
                      {/* Suspend */}
                      {courier.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                          disabled={isActing}
                          onClick={() => {
                            if (!confirm(t("courier_applications.confirm_suspend"))) return;
                            updateCourier(courier.id, "suspended");
                          }}
                        >
                          {t("courier_applications.action_suspend")}
                        </Button>
                      )}
                      {/* View Details */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => navigate(`/admin/courier-applications/${courier.id}`)}
                      >
                        {t("courier_applications.view_details")}
                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
