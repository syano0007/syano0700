import { useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import {
  MapPin, Wifi, WifiOff, Package, Navigation, Gauge, Target,
  Clock, RefreshCw, AlertTriangle, CheckCircle2, Table2, Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CourierPin } from "@/components/AdminCourierMap";

const AdminCourierMap = lazy(() => import("@/components/AdminCourierMap"));

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveCourierRow {
  courierId: number;
  name: string;
  phone: string;
  vehicleType: string;
  availabilityStatus: "ONLINE" | "OFFLINE" | "BUSY";
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  source: string | null;
  lastLocationUpdateAt: string | null;
  isFresh: boolean;
  ageSeconds: number | null;
}

interface LiveLocationsResponse {
  total: number;
  online: number;
  busy: number;
  offline: number;
  withFreshLocation: number;
  withStaleLocation: number;
  withNoLocation: number;
  couriers: LiveCourierRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVAIL_CONFIG = {
  ONLINE:  { label: "Online",  labelAr: "متاح",    color: "text-primary bg-primary/80/10 border-primary/30", dot: "bg-primary/80",  icon: Wifi },
  OFFLINE: { label: "Offline", labelAr: "غير متاح", color: "text-gray-400 bg-gray-400/10 border-gray-500/30",         dot: "bg-gray-500",    icon: WifiOff },
  BUSY:    { label: "Busy",    labelAr: "مشغول",    color: "text-amber-400 bg-amber-400/10 border-amber-500/30",      dot: "bg-amber-400",   icon: Package },
} as const;

const VEHICLE_ICON: Record<string, string> = {
  motorcycle: "🏍",
  car:        "🚗",
  bicycle:    "🚲",
  van:        "🚐",
};

function formatAge(seconds: number | null, isAr: boolean): string {
  if (seconds === null) return isAr ? "—" : "—";
  if (seconds < 60) return isAr ? `منذ ${seconds}ث` : `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  return isAr ? `منذ ${m}د` : `${m}m ago`;
}

function formatCoord(val: number | null): string {
  if (val === null) return "—";
  return val.toFixed(5);
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.FC<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-card p-4 flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color + "/10")}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCourierLocations() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const isRtl = i18n.language === "ar";
  const [viewMode, setViewMode] = useState<"table" | "map">("table");

  void t;

  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<LiveLocationsResponse>({
    queryKey: ["admin", "couriers", "live-locations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/couriers/live-locations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch live locations");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const couriers = data?.couriers ?? [];
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  const mapPins: CourierPin[] = couriers
    .filter(c => c.lat !== null && c.lng !== null)
    .map(c => ({
      courierId:          c.courierId,
      name:               c.name,
      phone:              c.phone,
      vehicleType:        c.vehicleType,
      availabilityStatus: c.availabilityStatus,
      lat:                c.lat as number,
      lng:                c.lng as number,
      isFresh:            c.isFresh,
      ageSeconds:         c.ageSeconds,
      accuracy:           c.accuracy,
    }));

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {isRtl ? "مواقع المندوبين المباشرة" : "Live Courier Locations"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRtl ? "تحديث كل 10 ثوانٍ" : "Refreshes every 10 seconds"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                  viewMode === "table"
                    ? "bg-primary/10 text-primary"
                    : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10",
                )}
              >
                <Table2 className="w-3.5 h-3.5" />
                {isRtl ? "جدول" : "Table"}
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-s border-white/10",
                  viewMode === "map"
                    ? "bg-primary/10 text-primary"
                    : "bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10",
                )}
              >
                <Map className="w-3.5 h-3.5" />
                {isRtl ? "خريطة" : "Map"}
              </button>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              {isRtl ? `آخر تحديث: ${lastUpdate}` : `Updated: ${lastUpdate}`}
            </button>
          </div>
        </div>

        {/* ── Summary strip ────────────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard label={isRtl ? "إجمالي" : "Total"} value={data.total} color="text-gray-400" icon={MapPin} />
            <SummaryCard label={isRtl ? "متاح" : "Online"} value={data.online} color="text-primary" icon={Wifi} />
            <SummaryCard label={isRtl ? "مشغول" : "Busy"} value={data.busy} color="text-amber-400" icon={Package} />
            <SummaryCard label={isRtl ? "غير متاح" : "Offline"} value={data.offline} color="text-gray-400" icon={WifiOff} />
            <SummaryCard label={isRtl ? "موقع حديث" : "Fresh GPS"} value={data.withFreshLocation} color="text-primary" icon={CheckCircle2} />
            <SummaryCard label={isRtl ? "بدون موقع" : "No Location"} value={data.withNoLocation} color="text-red-400" icon={AlertTriangle} />
          </div>
        )}

        {/* ── Map view ─────────────────────────────────────────────────── */}
        {viewMode === "map" && (
          <div className="rounded-xl border border-white/5 bg-card overflow-hidden" style={{ height: 520 }}>
            {isLoading ? (
              <div className="h-full flex items-center justify-center bg-white/5 animate-pulse">
                <MapPin className="w-8 h-8 text-muted-foreground opacity-30" />
              </div>
            ) : (
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }>
                <AdminCourierMap couriers={mapPins} isRtl={isRtl} />
              </Suspense>
            )}
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────── */}
        {viewMode === "table" && (isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : couriers.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-card p-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {isRtl ? "لا يوجد مندوبون معتمدون" : "No approved couriers found"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[minmax(140px,1fr)_110px_110px_100px_90px_80px_80px_90px] gap-3 px-4 py-2.5 border-b border-white/5 text-xs text-muted-foreground font-medium">
              <span>{isRtl ? "المندوب" : "Courier"}</span>
              <span>{isRtl ? "الحالة" : "Status"}</span>
              <span>{isRtl ? "خط العرض" : "Latitude"}</span>
              <span>{isRtl ? "خط الطول" : "Longitude"}</span>
              <span>{isRtl ? "دقة (م)" : "Accuracy"}</span>
              <span>{isRtl ? "سرعة" : "Speed"}</span>
              <span>{isRtl ? "المصدر" : "Source"}</span>
              <span>{isRtl ? "الحداثة" : "Freshness"}</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-white/5">
              {couriers.map((c) => {
                const cfg = AVAIL_CONFIG[c.availabilityStatus] ?? AVAIL_CONFIG.OFFLINE;
                const StatusIcon = cfg.icon;

                return (
                  <div
                    key={c.courierId}
                    className="grid grid-cols-[minmax(140px,1fr)_110px_110px_100px_90px_80px_80px_90px] gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                  >
                    {/* Courier name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{VEHICLE_ICON[c.vehicleType] ?? "🚴"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium",
                        cfg.color,
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {isRtl ? cfg.labelAr : cfg.label}
                      </span>
                    </div>

                    {/* Lat */}
                    <p className="text-sm font-mono text-foreground/80">
                      {formatCoord(c.lat)}
                    </p>

                    {/* Lng */}
                    <p className="text-sm font-mono text-foreground/80">
                      {formatCoord(c.lng)}
                    </p>

                    {/* Accuracy */}
                    <div className="flex items-center gap-1 text-sm text-foreground/70">
                      {c.accuracy != null ? (
                        <>
                          <Target className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="font-mono">{c.accuracy.toFixed(0)}m</span>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>

                    {/* Speed */}
                    <div className="flex items-center gap-1 text-sm text-foreground/70">
                      {c.speed != null ? (
                        <>
                          <Gauge className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="font-mono">{c.speed.toFixed(1)}</span>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>

                    {/* Source */}
                    <p className="text-xs text-muted-foreground">
                      {c.source ?? (c.lat != null ? "GPS" : "—")}
                    </p>

                    {/* Freshness */}
                    {c.lat == null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-xs text-gray-400">
                        <AlertTriangle className="w-3 h-3" />
                        {isRtl ? "لا يوجد" : "No GPS"}
                      </span>
                    ) : c.isFresh ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
                        <Navigation className="w-3 h-3" />
                        {isRtl ? "حديث" : "Fresh"}
                      </span>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                          <Clock className="w-3 h-3" />
                          {isRtl ? "قديم" : "Stale"}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatAge(c.ageSeconds, isRtl)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <p className="text-xs text-muted-foreground text-center">
          {isRtl
            ? "يُعتبر الموقع حديثاً إذا تم تحديثه خلال آخر 60 ثانية"
            : "Location is considered fresh if updated within the last 60 seconds"}
        </p>

      </div>
    </AdminLayout>
  );
}
