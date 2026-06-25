/**
 * AdminDispatchCenter — Phase A8
 * Real-time view of all active missions. Allows admin to resolve reschedule requests,
 * view failure details, and monitor the full mission pipeline.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Truck, ChevronLeft, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, ClockIcon, Package,
  MapPin, User, AlertCircle, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────
interface DispatchMission {
  id: number;
  status: string;
  orderId: number;
  courierId: number | null;
  pickupAddress: string;
  dropoffAddress: string;
  deliverySize: string;
  createdAt: string;
  updatedAt: string;
  failureType: string | null;
  failureReason: string | null;
  rescheduleRequestedAt: string | null;
  rescheduleReason: string | null;
  courierName: string | null;
  courierPhone: string | null;
  courierLat: string | null;
  courierLng: string | null;
  courierLastLocationAt: string | null;
  gpsFreshness: "FRESH" | "WARNING" | "STALE" | "UNKNOWN";
  gpsAgeSeconds: number | null;
}

interface DispatchData {
  summary: Record<string, number>;
  missions: DispatchMission[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ASSIGNED:           "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ACCEPTED:           "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  PICKED_UP:          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  IN_TRANSIT:         "bg-primary/10 text-primary dark:bg-primary/10/40 dark:text-primary",
  FAILED:             "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  RESCHEDULE_REQUIRED:"bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const STATUS_ICONS: Record<string, typeof Truck> = {
  PENDING:            ClockIcon,
  ASSIGNED:           User,
  ACCEPTED:           CheckCircle2,
  PICKED_UP:          Package,
  IN_TRANSIT:         Truck,
  FAILED:             XCircle,
  RESCHEDULE_REQUIRED:ClockIcon,
};

function timeSince(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function MissionCard({ mission, token, onResolved }: {
  mission: DispatchMission;
  token: string;
  onResolved: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resolving, setResolving] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  const Icon = STATUS_ICONS[mission.status] ?? Truck;
  const colorCls = STATUS_COLOR[mission.status] ?? "bg-muted text-muted-foreground";

  const resolveReschedule = async (action: "reassign" | "cancel") => {
    setResolving(true);
    try {
      const res = await fetch(`/api/admin/delivery-missions/${mission.id}/reschedule`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      toast({ title: t("dispatch.reschedule_resolved") });
      qc.invalidateQueries({ queryKey: ["dispatch-center"] });
      onResolved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("common.error"), variant: "destructive" });
    } finally {
      setResolving(false);
      setShowResolve(false);
    }
  };

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 shadow-sm",
      mission.status === "RESCHEDULE_REQUIRED" && "border-orange-400 dark:border-orange-600",
      mission.status === "FAILED" && "border-red-300 dark:border-red-700",
    )}>
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", colorCls)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">#{mission.id}</span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase", colorCls)}>
              {mission.status.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-muted-foreground ms-auto">{timeSince(mission.updatedAt)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Order #{mission.orderId}</p>
        </div>
      </div>

      {/* Addresses */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mt-0.5 shrink-0">
            <Package className="h-2 w-2 text-amber-600" />
          </div>
          <p className="text-xs text-muted-foreground leading-tight">{mission.pickupAddress}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-0.5 shrink-0">
            <MapPin className="h-2 w-2 text-blue-600" />
          </div>
          <p className="text-xs text-muted-foreground leading-tight">{mission.dropoffAddress}</p>
        </div>
      </div>

      {/* Courier + GPS freshness */}
      {mission.courierName && (
        <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{mission.courierName}</span>
          {mission.courierPhone && (
            <a href={`tel:${mission.courierPhone}`} className="text-primary ml-1">
              {mission.courierPhone}
            </a>
          )}
          {mission.courierId && (
            <span className={cn(
              "ms-auto text-[10px] font-bold px-2 py-0.5 rounded-full",
              mission.gpsFreshness === "FRESH"   && "bg-primary/10 text-primary dark:bg-primary/10/40 dark:text-primary",
              mission.gpsFreshness === "WARNING"  && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              mission.gpsFreshness === "STALE"    && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
              mission.gpsFreshness === "UNKNOWN"  && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
            )}>
              GPS {mission.gpsFreshness}
              {mission.gpsAgeSeconds !== null && mission.gpsFreshness !== "FRESH" && ` ${mission.gpsAgeSeconds}s`}
            </span>
          )}
        </div>
      )}

      {/* Failure info */}
      {mission.status === "FAILED" && mission.failureType && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5 mb-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            {t("dispatch.failure_type")}: {mission.failureType.replace(/_/g, " ")}
          </p>
          {mission.failureReason && (
            <p className="text-xs text-muted-foreground mt-0.5">{mission.failureReason}</p>
          )}
        </div>
      )}

      {/* Reschedule info + resolve actions */}
      {mission.status === "RESCHEDULE_REQUIRED" && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-2.5 mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
              {t("dispatch.reschedule_requested")}
            </p>
          </div>
          {mission.rescheduleReason && (
            <p className="text-xs text-muted-foreground">{mission.rescheduleReason}</p>
          )}
          {!showResolve ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 border-orange-400 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-300 h-7 text-xs"
              onClick={() => setShowResolve(true)}
            >
              {t("dispatch.resolve_btn")}
            </Button>
          ) : (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/80 text-white h-7 text-xs"
                onClick={() => resolveReschedule("reassign")}
                disabled={resolving}
              >
                {resolving ? "…" : t("dispatch.reassign_btn")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 h-7 text-xs"
                onClick={() => resolveReschedule("cancel")}
                disabled={resolving}
              >
                {resolving ? "…" : t("dispatch.cancel_mission_btn")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* View ops link */}
      <Link href={`/admin/delivery-missions/${mission.id}`}>
        <div className="text-xs text-primary flex items-center gap-1 hover:underline">
          <Navigation className="h-3 w-3" />
          {t("dispatch.view_ops_link")}
        </div>
      </Link>
    </div>
  );
}

export default function AdminDispatchCenter() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading, refetch } = useQuery<DispatchData>({
    queryKey: ["dispatch-center"],
    queryFn: () => fetch("/api/admin/dispatch-center", {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const allStatuses = [
    "ALL", "PENDING", "ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "FAILED", "RESCHEDULE_REQUIRED",
  ];

  const filtered = data?.missions.filter(
    (m) => statusFilter === "ALL" || m.status === statusFilter,
  ) ?? [];

  const summaryOrder = ["PENDING", "ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "FAILED", "RESCHEDULE_REQUIRED"];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 pt-4 pb-3 flex items-center gap-3">
        <Link href="/admin" className="p-1 rounded-lg hover:bg-muted">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">{t("dispatch.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("dispatch.subtitle")}</p>
        </div>
        <button type="button" onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-muted">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Summary cards */}
        {data?.summary && (
          <div className="grid grid-cols-3 gap-2">
            {summaryOrder
              .filter((s) => (data.summary[s] ?? 0) > 0)
              .map((status) => {
                const Icon = STATUS_ICONS[status] ?? Truck;
                const colorCls = STATUS_COLOR[status] ?? "bg-muted text-muted-foreground";
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)}
                    className={cn(
                      "rounded-xl p-3 border text-center transition-all",
                      statusFilter === status
                        ? "ring-2 ring-emerald-500 bg-muted"
                        : "bg-card hover:bg-muted/50",
                    )}
                  >
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center mx-auto mb-1", colorCls)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-lg font-black">{data.summary[status]}</p>
                    <p className="text-[9px] text-muted-foreground uppercase truncate">
                      {status.replace(/_/g, " ")}
                    </p>
                  </button>
                );
              })}
          </div>
        )}

        {/* Status filter bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {allStatuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                statusFilter === s
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ALL" ? t("common.all") : s.replace(/_/g, " ")}
              {s !== "ALL" && data?.summary[s] ? ` (${data.summary[s]})` : ""}
            </button>
          ))}
        </div>

        {/* Mission list */}
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "ALL" ? t("dispatch.no_active_missions") : t("dispatch.no_missions_in_status")}
            </p>
          </div>
        )}

        {!isLoading && filtered.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            token={token ?? ""}
            onResolved={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}
