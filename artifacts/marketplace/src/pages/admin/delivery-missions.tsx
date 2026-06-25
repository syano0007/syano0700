import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Search, Package, User, Store, Truck,
  Clock, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Users, Ban, RadioTower, Play, Bell, CheckCheck,
  MapPin, Navigation, Bike,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryMission {
  id: number;
  orderId: number;
  sellerId: number;
  customerId: number;
  courierId: number | null;
  status: string;
  deliveryFee: string | null;
  deliverySize: string;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  sellerName: string | null;
  storeName: string | null;
  customerName: string | null;
  courierName: string | null;
  courierPhone: string | null;
}

interface MissionsResponse {
  data: DeliveryMission[];
  total: number;
  page: number;
  limit: number;
}

interface MissionOffer {
  id: number;
  courierId: number;
  status: string;
  round: number;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
  courierName: string | null;
  courierPhone: string | null;
}

interface DispatchAlert {
  id: number;
  missionId: number;
  type: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface OffersResponse {
  summary: {
    totalSent: number;
    accepted: number;
    declined: number;
    expired: number;
    cancelled: number;
    currentRound: number;
  };
  offers: MissionOffer[];
}

interface NearestCourier {
  courierId: number;
  distanceKm: number | null;
  name: string;
  phone: string;
  vehicleType: string;
  city: string;
  availabilityStatus: string;
}

interface NearestCouriersResponse {
  missionId: number;
  pickupLat: number;
  pickupLng: number;
  usingFallbackCoords: boolean;
  couriers: NearestCourier[];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: React.ElementType }> = {
  PENDING:          { label: "Pending",          labelAr: "في الانتظار",      color: "text-yellow-400 bg-yellow-400/10",    icon: Clock },
  SEARCHING:        { label: "Searching",         labelAr: "جارٍ البحث",       color: "text-sky-400 bg-sky-400/10",          icon: RadioTower },
  ASSIGNED:         { label: "Assigned",          labelAr: "تم التعيين",       color: "text-blue-400 bg-blue-400/10",        icon: Truck },
  ACCEPTED:         { label: "Accepted",          labelAr: "مقبولة",           color: "text-indigo-400 bg-indigo-400/10",    icon: CheckCircle2 },
  PICKED_UP:        { label: "Picked Up",         labelAr: "تم الاستلام",      color: "text-purple-400 bg-purple-400/10",    icon: Package },
  IN_TRANSIT:       { label: "In Transit",        labelAr: "في الطريق",        color: "text-orange-400 bg-orange-400/10",    icon: Truck },
  DELIVERED:        { label: "Delivered",         labelAr: "تم التسليم",       color: "text-primary bg-primary/80/10",  icon: CheckCircle2 },
  FAILED:           { label: "Failed",            labelAr: "فشل",              color: "text-red-400 bg-red-400/10",          icon: AlertCircle },
  CANCELLED:        { label: "Cancelled",         labelAr: "ملغاة",            color: "text-gray-400 bg-gray-400/10",        icon: XCircle },
  NO_COURIER_FOUND: { label: "No Courier Found",  labelAr: "لم يُعثر على مندوب", color: "text-rose-400 bg-rose-400/10",    icon: Ban },
};

const OFFER_STATUS_CONFIG: Record<string, { color: string; label: string; labelAr: string }> = {
  OFFERED:   { color: "text-sky-400 bg-sky-400/10",        label: "Offered",   labelAr: "معروضة" },
  ACCEPTED:  { color: "text-primary bg-primary/80/10",label: "Accepted",  labelAr: "مقبولة" },
  DECLINED:  { color: "text-red-400 bg-red-400/10",        label: "Declined",  labelAr: "مرفوضة" },
  EXPIRED:   { color: "text-gray-400 bg-gray-400/10",      label: "Expired",   labelAr: "منتهية" },
  CANCELLED: { color: "text-yellow-400 bg-yellow-400/10",  label: "Cancelled", labelAr: "ملغاة" },
};

const SIZE_LABELS: Record<string, { en: string; ar: string }> = {
  SMALL:  { en: "Small",  ar: "صغير" },
  MEDIUM: { en: "Medium", ar: "متوسط" },
  LARGE:  { en: "Large",  ar: "كبير" },
};

const COUNTER_STATUSES = [
  "PENDING", "SEARCHING", "ASSIGNED", "ACCEPTED",
  "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED",
  "CANCELLED", "NO_COURIER_FOUND",
] as const;

// ─── Dispatch Alerts Panel ───────────────────────────────────────────────────

function DispatchAlertsPanel({ token, isRtl }: { token: string; isRtl: boolean }) {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<number | null>(null);

  const { data: alerts = [], refetch } = useQuery<DispatchAlert[]>({
    queryKey: ["admin", "dispatch-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dispatch-alerts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const resolve = async (id: number) => {
    setResolving(id);
    try {
      await fetch(`/api/admin/dispatch-alerts/${id}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery-missions", "stats"] });
    } finally {
      setResolving(null);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-rose-500/20">
        <Bell className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-sm font-semibold text-rose-300">
          {isRtl
            ? `تنبيهات الإرسال (${alerts.length} غير محلولة)`
            : `Dispatch Alerts (${alerts.length} unresolved)`}
        </span>
      </div>
      <div className="divide-y divide-rose-500/10">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-rose-200">
                {isRtl ? `مهمة #${a.missionId}` : `Mission #${a.missionId}`}
              </p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">{a.message}</p>
              <p className="text-[10px] text-gray-600 mt-1">
                {new Date(a.createdAt).toLocaleString(isRtl ? "ar-SY" : "en-US")}
              </p>
            </div>
            <button
              onClick={() => resolve(a.id)}
              disabled={resolving === a.id}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {resolving === a.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <CheckCheck className="w-3 h-3" />}
              {isRtl ? "حلّ" : "Resolve"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Nearest Couriers Panel (Discovery Engine Test) ──────────────────────────

function NearestCouriersPanel({ missionId, token, isRtl }: {
  missionId: number;
  token: string;
  isRtl: boolean;
}) {
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<NearestCouriersResponse>({
    queryKey: ["admin", "nearest-couriers", missionId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/delivery-missions/${missionId}/nearest-couriers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load nearest couriers");
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });

  const VEHICLE_ICONS: Record<string, React.ElementType> = {
    motorcycle: Bike,
    car:        Truck,
    bicycle:    Bike,
  };

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2 pt-2 flex-wrap">
        <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="text-xs font-semibold text-sky-300">
          {isRtl ? "محرك اكتشاف المندوبين" : "Courier Discovery Engine"}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
          {isRtl ? "للقراءة فقط — مرحلة A1" : "Read-only — Phase A1"}
        </span>
        <div className="flex gap-2 ms-auto">
          {!enabled ? (
            <button
              onClick={() => setEnabled(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 transition-colors"
            >
              <Navigation className="w-3 h-3" />
              {isRtl ? "إيجاد أقرب المندوبين" : "Find Nearest Couriers"}
            </button>
          ) : (
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300 disabled:opacity-50 transition-colors"
            >
              {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {isRtl ? "تحديث" : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Not yet triggered */}
      {!enabled && (
        <p className="text-xs text-gray-500 italic">
          {isRtl
            ? "اضغط «إيجاد أقرب المندوبين» لتشغيل محرك الاكتشاف"
            : "Press «Find Nearest Couriers» to run the discovery engine"}
        </p>
      )}

      {/* Loading */}
      {enabled && isLoading && (
        <div className="flex items-center gap-2 py-3 text-gray-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {isRtl ? "جارٍ حساب المسافات..." : "Calculating distances..."}
        </div>
      )}

      {/* Results */}
      {enabled && data && (
        <div className="space-y-2">
          {/* Coords note */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <MapPin className="w-3 h-3 shrink-0" />
            {data.usingFallbackCoords
              ? (isRtl
                  ? `نقطة الاستلام: مركز حلب (${data.pickupLat.toFixed(4)}, ${data.pickupLng.toFixed(4)}) — إحداثيات افتراضية`
                  : `Pickup: Aleppo center (${data.pickupLat.toFixed(4)}, ${data.pickupLng.toFixed(4)}) — fallback coords`)
              : (isRtl
                  ? `نقطة الاستلام: (${data.pickupLat.toFixed(4)}, ${data.pickupLng.toFixed(4)})`
                  : `Pickup: (${data.pickupLat.toFixed(4)}, ${data.pickupLng.toFixed(4)})`)}
          </div>

          {/* Empty state */}
          {data.couriers.length === 0 && (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500 italic">
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              {isRtl
                ? "لا يوجد مندوبون متاحون الآن (يجب أن يكونوا متصلين وقابلين للتعيين)"
                : "No available couriers found (must be ONLINE and accepting deliveries)"}
            </div>
          )}

          {/* Courier rows */}
          {data.couriers.map((c, idx) => {
            const VehicleIcon = VEHICLE_ICONS[c.vehicleType] ?? Truck;
            return (
              <div
                key={c.courierId}
                className="flex items-center gap-3 rounded-lg bg-gray-900/60 border border-gray-800/60 px-3 py-2.5 text-xs flex-wrap"
              >
                {/* Rank */}
                <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-[10px] font-bold text-sky-300 shrink-0">
                  {idx + 1}
                </span>

                {/* Name + vehicle */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <VehicleIcon className="w-3 h-3 text-gray-500 shrink-0" />
                  <span className="text-gray-200 font-medium truncate">{c.name}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500 capitalize">{c.vehicleType}</span>
                </div>

                {/* Status badge */}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {c.availabilityStatus}
                </span>

                {/* Distance */}
                <div className="flex items-center gap-1 ms-auto shrink-0">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  {c.distanceKm != null ? (
                    <span className="text-sky-300 font-medium tabular-nums">
                      {c.distanceKm.toFixed(2)} km
                    </span>
                  ) : (
                    <span className="text-gray-600 italic">
                      {isRtl ? "لا توجد إحداثيات" : "No location"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Mission Offers Panel ─────────────────────────────────────────────────────

function MissionOffersPanel({ missionId, token, isRtl, onTrigger }: {
  missionId: number;
  token: string;
  isRtl: boolean;
  onTrigger: () => void;
}) {
  const [triggering, setTriggering] = useState(false);
  const { data, isLoading, refetch } = useQuery<OffersResponse>({
    queryKey: ["admin", "mission-offers", missionId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/delivery-missions/${missionId}/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load offers");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/admin/delivery-missions/${missionId}/trigger-assignment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { refetch(); onTrigger(); }
    } finally {
      setTriggering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-gray-400 text-sm">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {isRtl ? "جارٍ تحميل العروض..." : "Loading offers..."}
      </div>
    );
  }

  const { summary, offers } = data ?? { summary: null, offers: [] };

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
          {[
            { label: isRtl ? "الجولة" : "Round",     val: summary.currentRound },
            { label: isRtl ? "أُرسلت" : "Sent",       val: summary.totalSent },
            { label: isRtl ? "مقبولة" : "Accepted",   val: summary.accepted },
            { label: isRtl ? "مرفوضة" : "Declined",   val: summary.declined },
            { label: isRtl ? "منتهية" : "Expired",    val: summary.expired },
            { label: isRtl ? "ملغاة" : "Cancelled",   val: summary.cancelled },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-900/60 rounded-lg px-2 py-1.5 text-center">
              <p className="text-white font-bold text-base">{val}</p>
              <p className="text-gray-500 text-[10px] leading-tight">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          {triggering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {isRtl ? "تشغيل محرك التعيين" : "Trigger Assignment Engine"}
        </button>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {isRtl ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* Offer rows */}
      {offers.length === 0 ? (
        <p className="text-gray-500 text-xs italic py-2">
          {isRtl ? "لا توجد عروض بعد لهذه المهمة" : "No offers sent for this mission yet"}
        </p>
      ) : (
        <div className="space-y-1.5">
          {offers.map((o) => {
            const oCfg = OFFER_STATUS_CONFIG[o.status] ?? OFFER_STATUS_CONFIG.EXPIRED;
            return (
              <div key={o.id} className="flex items-center gap-3 rounded-lg bg-gray-900/50 px-3 py-2 text-xs flex-wrap">
                <span className="text-gray-500 font-mono w-5 text-center">R{o.round}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Truck className="w-3 h-3 text-gray-500 shrink-0" />
                  <span className="text-gray-200 truncate max-w-[120px]">{o.courierName ?? `#${o.courierId}`}</span>
                </div>
                <span className={cn("px-1.5 py-0.5 rounded font-medium text-[10px]", oCfg.color)}>
                  {isRtl ? oCfg.labelAr : oCfg.label}
                </span>
                {o.respondedAt && (
                  <span className="text-gray-600 text-[10px] ms-auto">
                    {new Date(o.respondedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDeliveryMissions() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isRtl = i18n.language === "ar";

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage]                 = useState(1);
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const { data, isLoading } = useQuery<MissionsResponse>({
    queryKey: ["admin", "delivery-missions", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/delivery-missions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch delivery missions");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const { data: statsData } = useQuery<Record<string, number>>({
    queryKey: ["admin", "delivery-missions", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/delivery-missions/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return {};
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const missions   = data?.data ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = search
    ? missions.filter((m) =>
        String(m.id).includes(search) ||
        String(m.orderId).includes(search) ||
        m.sellerName?.toLowerCase().includes(search.toLowerCase()) ||
        m.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        m.courierName?.toLowerCase().includes(search.toLowerCase())
      )
    : missions;

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {isRtl ? "مهام التوصيل" : "Delivery Missions"}
            </h1>
            <p className="text-sm text-gray-400">
              {isRtl ? "سجل مهام التوصيل + مراقبة التعيين" : "Mission log + assignment monitoring"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              placeholder={isRtl ? "بحث..." : "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setStatusFilter(""); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                !statusFilter
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-300",
              )}
            >
              {isRtl ? "الكل" : "All"}
            </button>
            {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  statusFilter === s
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-300",
                )}
              >
                {isRtl ? cfg.labelAr : cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status counter cards */}
        <div className="grid grid-cols-5 lg:grid-cols-10 gap-2">
          {COUNTER_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const StatusIcon = cfg.icon;
            const cnt = statsData?.[s] ?? 0;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(isActive ? "" : s); setPage(1); }}
                className={cn(
                  "rounded-xl border p-2.5 text-center flex flex-col items-center gap-1 transition-all",
                  isActive
                    ? "border-primary/40 bg-primary/10"
                    : "border-gray-800 bg-gray-900/60 hover:border-gray-700"
                )}
              >
                <StatusIcon className={cn("w-3.5 h-3.5", cfg.color.split(" ")[0])} />
                <p className={cn("text-base font-bold leading-none", isActive ? "text-primary" : cnt > 0 ? "text-white" : "text-gray-600")}>
                  {cnt}
                </p>
                <p className="text-[9px] text-gray-500 leading-tight text-center">
                  {isRtl ? cfg.labelAr : cfg.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Dispatch Alerts — shown when NO_COURIER_FOUND alerts exist */}
        <DispatchAlertsPanel token={token!} isRtl={isRtl} />

        {/* Stats summary */}
        <div className="text-sm text-gray-400">
          {isRtl ? `${total} مهمة` : `${total} mission${total !== 1 ? "s" : ""}`}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80">
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="px-4 py-3 font-medium whitespace-nowrap w-8"></th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "المعرّف" : "Mission ID"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "الطلب" : "Order ID"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "البائع" : "Seller"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "العميل" : "Customer"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "المندوب" : "Courier"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "الحجم" : "Size"}</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{isRtl ? "تاريخ الإنشاء" : "Created"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      {isRtl ? "جارٍ التحميل..." : "Loading..."}
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>{isRtl ? "لا توجد مهام توصيل بعد" : "No delivery missions yet"}</p>
                    </td>
                  </tr>
                )}
                {filtered.map((m) => {
                  const cfg        = STATUS_CONFIG[m.status] ?? STATUS_CONFIG["PENDING"];
                  const StatusIcon = cfg.icon;
                  const sizeLabel  = SIZE_LABELS[m.deliverySize] ?? { en: m.deliverySize, ar: m.deliverySize };
                  const createdAt  = new Date(m.createdAt).toLocaleDateString(
                    isRtl ? "ar-SY" : "en-US",
                    { year: "numeric", month: "short", day: "numeric" },
                  );
                  const isExpanded    = expandedId === m.id;
                  const isSearching   = m.status === "SEARCHING";
                  const isNoCourier   = m.status === "NO_COURIER_FOUND";
                  const isPending     = m.status === "PENDING";
                  const showOfferPanel = isExpanded;

                  return (
                    <>
                      <tr
                        key={m.id}
                        className={cn(
                          "hover:bg-gray-900/40 transition-colors",
                          isSearching && "bg-sky-900/5",
                          isNoCourier && "bg-rose-900/5",
                        )}
                      >
                        <td className="px-3 py-3">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title={isRtl ? "عرض العروض" : "View offers"}
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-primary font-medium">#{m.id}</td>
                        <td className="px-4 py-3 text-gray-300 font-mono">#{m.orderId}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="text-gray-200 truncate max-w-[120px]">{m.storeName ?? m.sellerName ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                            <span className="text-gray-200 truncate max-w-[120px]">{m.customerName ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {m.courierName ? (
                            <div className="flex items-center gap-2">
                              <Truck className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              <span className="text-gray-200 truncate max-w-[100px]">{m.courierName}</span>
                            </div>
                          ) : isSearching ? (
                            <div className="flex items-center gap-1.5 text-sky-400">
                              <RadioTower className="w-3.5 h-3.5 animate-pulse" />
                              <span className="text-xs">{isRtl ? "جارٍ البحث..." : "Searching..."}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs italic">{isRtl ? "غير معيّن" : "Unassigned"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium", cfg.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {isRtl ? cfg.labelAr : cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{isRtl ? sizeLabel.ar : sizeLabel.en}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{createdAt}</td>
                      </tr>
                      {showOfferPanel && (
                        <tr key={`offers-${m.id}`} className="bg-gray-950/60">
                          <td colSpan={9} className="border-t border-gray-800/60">
                            <div className="border-s-2 border-primary/30 ms-6">
                              <div className="px-4 pt-3 pb-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Users className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-semibold text-primary">
                                    {isRtl ? "سجل عروض التعيين" : "Assignment Offers Log"}
                                  </span>
                                  {isSearching && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                                      <RadioTower className="w-2.5 h-2.5 animate-pulse" />
                                      {isRtl ? "جارٍ البحث الآن" : "Searching now"}
                                    </span>
                                  )}
                                  {isNoCourier && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                      {isRtl ? "يحتاج تعيين يدوي" : "Needs manual assignment"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <MissionOffersPanel
                                missionId={m.id}
                                token={token!}
                                isRtl={isRtl}
                                onTrigger={() => {
                                  queryClient.invalidateQueries({ queryKey: ["admin", "delivery-missions"] });
                                }}
                              />
                              {/* Divider */}
                              <div className="border-t border-gray-800/60 mx-4" />
                              {/* Discovery Engine Test Panel */}
                              <NearestCouriersPanel
                                missionId={m.id}
                                token={token!}
                                isRtl={isRtl}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              {isRtl ? "السابق" : "Prev"}
            </button>
            <span className="text-sm text-gray-400">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              {isRtl ? "التالي" : "Next"}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
