import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { cn } from "@/lib/utils";
import {
  Truck, Wifi, WifiOff, Clock, Package, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveMission {
  missionId: number;
  orderId: number;
  status: string;
}

interface CourierAvailabilityRow {
  id: number;
  name: string;
  phone: string;
  vehicleType: string;
  availabilityStatus: "ONLINE" | "OFFLINE" | "BUSY";
  isAcceptingDeliveries: boolean;
  lastAvailabilityChangeAt: string | null;
  completedDeliveries: number;
  activeMission: ActiveMission | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

const AVAIL_CONFIG = {
  ONLINE:  { label: "Online",  labelAr: "متاح",      color: "text-primary bg-primary/80/10 border-primary/30", dot: "bg-primary/80", icon: Wifi },
  OFFLINE: { label: "Offline", labelAr: "غير متاح",  color: "text-gray-400 bg-gray-400/10 border-gray-500/30",         dot: "bg-gray-500",   icon: WifiOff },
  BUSY:    { label: "Busy",    labelAr: "مشغول",      color: "text-amber-400 bg-amber-400/10 border-amber-500/30",      dot: "bg-amber-400",  icon: Package },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCourierAvailability() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const isRtl = i18n.language === "ar";

  const { data: couriers = [], isLoading } = useQuery<CourierAvailabilityRow[]>({
    queryKey: ["admin", "couriers", "availability"],
    queryFn: async () => {
      const res = await fetch("/api/admin/couriers/availability", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch courier availability");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const onlineCount  = couriers.filter((c) => c.availabilityStatus === "ONLINE").length;
  const busyCount    = couriers.filter((c) => c.availabilityStatus === "BUSY").length;
  const offlineCount = couriers.filter((c) => c.availabilityStatus === "OFFLINE").length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {isRtl ? "توافر المندوبين" : "Courier Availability"}
            </h1>
            <p className="text-sm text-gray-400">
              {isRtl ? "نظرة عامة على حالة توافر المندوبين المعتمدين" : "Real-time availability of all approved couriers"}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: isRtl ? "متاحون" : "Online",  value: onlineCount,  cls: "text-primary" },
            { label: isRtl ? "مشغولون" : "Busy",   value: busyCount,    cls: "text-amber-400" },
            { label: isRtl ? "غير متاح" : "Offline", value: offlineCount, cls: "text-gray-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
              <p className={cn("text-3xl font-bold", s.cls)}>{s.value}</p>
              <p className="text-sm text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80">
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {isRtl ? "المندوب" : "Courier"}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {isRtl ? "الحالة" : "Status"}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {isRtl ? "يقبل المهام" : "Accepting Deliveries"}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {isRtl ? "آخر تغيير" : "Last Status Change"}
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {isRtl ? "المهمة النشطة" : "Active Mission"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      {isRtl ? "جارٍ التحميل..." : "Loading..."}
                    </td>
                  </tr>
                )}
                {!isLoading && couriers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>{isRtl ? "لا يوجد مندوبون معتمدون بعد" : "No approved couriers yet"}</p>
                    </td>
                  </tr>
                )}
                {couriers.map((c) => {
                  const cfg = AVAIL_CONFIG[c.availabilityStatus] ?? AVAIL_CONFIG.OFFLINE;
                  const StatusIcon = cfg.icon;
                  const lastChange = c.lastAvailabilityChangeAt
                    ? new Date(c.lastAvailabilityChangeAt).toLocaleString(isRtl ? "ar-SY" : "en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })
                    : "—";

                  return (
                    <tr key={c.id} className="hover:bg-gray-900/40 transition-colors">
                      {/* Courier */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                              <Truck className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-950", cfg.dot)} />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{c.name}</p>
                            <p className="text-gray-500 text-xs">{c.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border", cfg.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {isRtl ? cfg.labelAr : cfg.label}
                        </span>
                      </td>

                      {/* Accepting deliveries */}
                      <td className="px-4 py-3">
                        {c.isAcceptingDeliveries ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isRtl ? "نعم" : "Yes"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {isRtl ? "لا" : "No"}
                          </span>
                        )}
                      </td>

                      {/* Last change */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="whitespace-nowrap">{lastChange}</span>
                        </div>
                      </td>

                      {/* Active mission */}
                      <td className="px-4 py-3">
                        {c.activeMission ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                            <Package className="w-3.5 h-3.5" />
                            {isRtl ? `مهمة #${c.activeMission.missionId}` : `Mission #${c.activeMission.missionId}`}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600 italic">
                            {isRtl ? "لا توجد" : "None"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-600 text-center">
          {isRtl ? "يتحدث كل 15 ثانية" : "Auto-refreshes every 15 seconds"}
        </p>
      </div>
    </AdminLayout>
  );
}
