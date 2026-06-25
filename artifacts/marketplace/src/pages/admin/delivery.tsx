import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Truck, MapPin, User, Package, CheckCircle2, AlertCircle,
  Plus, Pencil, Trash2, X, Star, Phone, Store, ShoppingBag,
  AlertTriangle, Activity, Clock, Search, TrendingUp, BarChart3,
  ChevronRight, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductSnap { name: string; quantity: number; }

interface DeliveryStats {
  readyForPickup: number;
  assigned: number;
  inTransit: number;
  deliveryFailed: number;
  deliveredToday: number;
  failedToday: number;
}

interface ReadyOrder {
  id: number;
  customerName: string;
  shippingAddress: string;
  customerPhone: string | null;
  city: string | null;
  deliveryFee: number | null;
  total: number;
  createdAt: string;
  sellerName: string | null;
  storeName: string | null;
  sellerPhone: string | null;
  zoneNameEn: string | null;
  zoneNameAr: string | null;
  products: ProductSnap[];
}
interface ActiveDelivery {
  assignmentId: number;
  orderId: number;
  assignmentStatus: string;
  assignedAt: string;
  pickedUpAt: string | null;
  courierName: string;
  courierPhone: string | null;
  courierRating: number | null;
  courierCompletedDeliveries: number;
  orderStatus: string;
  orderDate: string;
  shippingAddress: string;
  city: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryFee: number | null;
  total: number;
  storeName: string | null;
  failureReason: string | null;
  zoneNameEn: string | null;
  zoneNameAr: string | null;
  products: ProductSnap[];
}
interface CourierRow {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  status: string;
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
  activeAssignments: number;
  createdAt: string;
}
interface Zone {
  id: number;
  nameEn: string;
  nameAr: string;
  fee: number;
  active: boolean;
  createdAt: string;
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const COURIER_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved:  "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};
const ORDER_STATUS_COLORS: Record<string, string> = {
  courier_assigned:  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  picked_up:         "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  out_for_delivery:  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  delivery_failed:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ─── Zone form ─────────────────────────────────────────────────────────────────
function ZoneForm({ zone, onSave, onCancel, token }: {
  zone?: Zone | null;
  onSave: () => void;
  onCancel: () => void;
  token: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [nameEn, setNameEn] = useState(zone?.nameEn ?? "");
  const [nameAr, setNameAr] = useState(zone?.nameAr ?? "");
  const [fee, setFee] = useState(String(zone?.fee ?? "0"));
  const [active, setActive] = useState(zone?.active !== false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nameEn.trim() || !nameAr.trim()) { toast({ title: t("delivery.zone_name_en") + " required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const url = zone ? `/api/admin/delivery-zones/${zone.id}` : "/api/admin/delivery-zones";
      const method = zone ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nameEn: nameEn.trim(), nameAr: nameAr.trim(), fee: parseFloat(fee) || 0, active }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: t("delivery.zone_saved") });
      onSave();
    } catch (err: any) {
      toast({ title: err.message ?? t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("delivery.zone_name_en")}</label>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Aleppo Center" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("delivery.zone_name_ar")}</label>
          <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: حلب المركز" dir="rtl" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("delivery.zone_fee")}</label>
          <Input type="number" step="0.5" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              active ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform", active ? "translate-x-5" : "translate-x-0")} />
          </button>
          <span className="text-sm text-muted-foreground">{t("delivery.zone_active")}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "…" : t("delivery.save")}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("delivery.cancel")}</Button>
      </div>
    </div>
  );
}

// ─── Courier picker card ───────────────────────────────────────────────────────
function CourierPickerCard({ courier, selected, onClick }: {
  courier: CourierRow;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const isOverloaded = courier.activeAssignments >= 5;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-start p-3 rounded-xl border-2 transition-all",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted/30",
        isOverloaded && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{courier.userName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{t(`delivery.vehicle_${courier.vehicleType}`)}</span>
            {courier.district && <span className="text-[11px] text-muted-foreground">· {courier.district}</span>}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <span className={cn(
            "text-[11px] font-bold px-1.5 py-0.5 rounded-full",
            isOverloaded
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : courier.activeAssignments === 0
                ? "bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          )}>
            {courier.activeAssignments === 0
              ? t("delivery.courier_available")
              : isOverloaded
                ? t("delivery.courier_overloaded")
                : t("delivery.courier_active_n", { n: courier.activeAssignments })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
        <span>{courier.completedDeliveries} {t("delivery.col_deliveries")}</span>
        {courier.rating && (
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {courier.rating.toFixed(1)}
          </span>
        )}
        {courier.active && (
          <span className="text-primary dark:text-primary font-medium">{t("courier.status_online")}</span>
        )}
      </div>
    </button>
  );
}

// ─── Assign courier dialog ─────────────────────────────────────────────────────
function AssignCourierPanel({ order, couriers, onAssign, onCancel, token }: {
  order: ReadyOrder;
  couriers: CourierRow[];
  onAssign: () => void;
  onCancel: () => void;
  token: string;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [courierId, setCourierId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<"select" | "confirm">("select");
  const lang = i18n.language;

  const approved = couriers
    .filter((c) => c.status === "approved")
    .sort((a, b) => a.activeAssignments - b.activeAssignments);

  const filtered = search.trim()
    ? approved.filter((c) =>
        c.userName.toLowerCase().includes(search.toLowerCase()) ||
        (c.district ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : approved;

  const selected = approved.find((c) => c.id === courierId);
  const zoneName = lang === "ar" ? order.zoneNameAr : order.zoneNameEn;

  const handleAssign = async () => {
    if (!courierId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/assign-courier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courierId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast({ title: t("delivery.assign_success") });
      onAssign();
    } catch (err: any) {
      toast({ title: err.message ?? t("delivery.assign_error"), variant: "destructive" });
      setStep("select");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary shrink-0" />
            {t("delivery.assign_courier_title")}
            <span className="text-muted-foreground font-normal text-sm ms-1">#{order.id}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Order summary */}
        <div className="px-5 py-3 bg-muted/30 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold truncate">{order.customerName}</p>
              <p className="text-xs text-muted-foreground truncate">{order.shippingAddress}</p>
              {zoneName && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />{zoneName}
                </span>
              )}
            </div>
            <div className="text-end shrink-0">
              <p className="text-sm font-bold" translate="no">${order.total.toFixed(2)}</p>
              {order.deliveryFee != null && (
                <p className="text-xs text-primary dark:text-primary font-medium" translate="no">
                  +${order.deliveryFee.toFixed(2)} {t("delivery.col_fee")}
                </p>
              )}
            </div>
          </div>
        </div>

        {step === "select" ? (
          <>
            {/* Search */}
            <div className="px-5 pt-4 pb-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("delivery.search_courier")}
                  className="ps-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Courier list */}
            <div className="px-5 pb-3 max-h-64 overflow-y-auto space-y-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {t("delivery.no_couriers")}
                </p>
              ) : (
                filtered.map((c) => (
                  <CourierPickerCard
                    key={c.id}
                    courier={c}
                    selected={courierId === c.id}
                    onClick={() => setCourierId(c.id)}
                  />
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>{t("delivery.cancel")}</Button>
              <Button size="sm" disabled={!courierId} onClick={() => setStep("confirm")} className="gap-1.5">
                <ChevronRight className="h-3.5 w-3.5" />
                {t("delivery.next")}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation step */}
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("delivery.assign_to")}
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{selected?.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected ? t(`delivery.vehicle_${selected.vehicleType}`) : ""}
                      {selected?.district ? ` · ${selected.district}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {selected?.completedDeliveries} {t("delivery.col_deliveries")}
                      </span>
                      {selected?.rating && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {selected.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t("delivery.confirm_assign_desc")}</p>
            </div>

            <div className="px-5 pb-5 flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("select")}>{t("delivery.back")}</Button>
              <Button size="sm" onClick={handleAssign} disabled={assigning} className="gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                {assigning ? "…" : t("delivery.confirm_assign")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Product list chip row ─────────────────────────────────────────────────────
function ProductList({ products }: { products: ProductSnap[] }) {
  if (products.length === 0) return null;
  const shown = products.slice(0, 3);
  const rest = products.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {shown.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5">
          <ShoppingBag className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate max-w-[120px]">{p.name}</span>
          {p.quantity > 1 && <span className="font-semibold">×{p.quantity}</span>}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground px-1 py-0.5">+{rest}</span>}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: DeliveryStats }) {
  const { t } = useTranslation();
  const items = [
    { label: t("delivery.stats_ready"),          value: stats.readyForPickup,  cls: "text-amber-600 dark:text-amber-400" },
    { label: t("delivery.stats_assigned"),        value: stats.assigned,        cls: "text-violet-600 dark:text-violet-400" },
    { label: t("delivery.stats_in_transit"),      value: stats.inTransit,       cls: "text-indigo-600 dark:text-indigo-400" },
    { label: t("delivery.stats_delivered_today"), value: stats.deliveredToday,  cls: "text-primary dark:text-primary" },
    { label: t("delivery.stats_failed_today"),    value: stats.failedToday,     cls: "text-red-600 dark:text-red-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {items.map(({ label, value, cls }) => (
        <div key={label} className="bg-card border rounded-xl p-3 text-center shadow-sm">
          <p className={cn("text-2xl font-black", cls)}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDelivery() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const [tab, setTab] = useState<"ready" | "active" | "couriers" | "zones">("ready");
  const [assigningOrderId, setAssigningOrderId] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<Zone | null | "new">(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const headers = { Authorization: `Bearer ${token}` };

  const { data: stats } = useQuery<DeliveryStats>({
    queryKey: ["admin-delivery-stats"],
    queryFn: () => fetch("/api/admin/delivery/stats", { headers }).then((r) => r.json()),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: readyOrders = [], refetch: refetchReady } = useQuery<ReadyOrder[]>({
    queryKey: ["admin-delivery-ready"],
    queryFn: () => fetch("/api/admin/delivery/ready-orders", { headers }).then((r) => r.json()),
    enabled: !!token && tab === "ready",
    refetchInterval: 15_000,
  });

  const { data: activeDeliveries = [], refetch: refetchActive } = useQuery<ActiveDelivery[]>({
    queryKey: ["admin-delivery-active"],
    queryFn: () => fetch("/api/admin/delivery/active", { headers }).then((r) => r.json()),
    enabled: !!token && tab === "active",
    refetchInterval: 15_000,
  });

  const { data: couriers = [], refetch: refetchCouriers } = useQuery<CourierRow[]>({
    queryKey: ["admin-couriers"],
    queryFn: () => fetch("/api/admin/couriers", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const { data: zones = [], refetch: refetchZones } = useQuery<Zone[]>({
    queryKey: ["admin-delivery-zones"],
    queryFn: () => fetch("/api/admin/delivery-zones", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  // Client-side search + filter
  const filteredReady = useMemo(() => {
    const q = search.toLowerCase();
    return readyOrders.filter((o) =>
      !q ||
      String(o.id).includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.storeName?.toLowerCase().includes(q) ||
      o.sellerName?.toLowerCase().includes(q)
    );
  }, [readyOrders, search]);

  const filteredActive = useMemo(() => {
    const q = search.toLowerCase();
    return activeDeliveries.filter((d) => {
      const matchSearch = !q ||
        String(d.orderId).includes(q) ||
        d.customerName?.toLowerCase().includes(q) ||
        d.courierName?.toLowerCase().includes(q) ||
        d.storeName?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || d.assignmentStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [activeDeliveries, search, statusFilter]);

  const updateCourier = async (courierId: number, status: string) => {
    try {
      const res = await fetch(`/api/admin/couriers/${courierId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const label = status === "approved"
        ? t("delivery.courier_approved")
        : status === "rejected"
          ? t("delivery.courier_rejected")
          : status === "suspended"
            ? t("delivery.courier_suspended")
            : t("delivery.courier_reactivated");
      toast({ title: label });
      refetchCouriers();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const deleteZone = async (zoneId: number) => {
    if (!confirm(t("delivery.confirm_delete"))) return;
    try {
      await fetch(`/api/admin/delivery-zones/${zoneId}`, { method: "DELETE", headers });
      toast({ title: t("delivery.zone_deleted") });
      refetchZones();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const STATUS_FILTERS = [
    { key: "all",              label: t("delivery.filter_all") },
    { key: "assigned",         label: t("delivery.filter_assigned") },
    { key: "picked_up",        label: t("delivery.filter_picked_up") },
    { key: "out_for_delivery", label: t("delivery.filter_out_for_delivery") },
    { key: "delivery_failed",  label: t("delivery.filter_failed") },
  ];

  const TABS = [
    { key: "ready",    label: t("delivery.tab_ready"),    count: readyOrders.length },
    { key: "active",   label: t("delivery.tab_active"),   count: activeDeliveries.length },
    { key: "couriers", label: t("delivery.tab_couriers"), count: couriers.filter((c) => c.status === "approved").length },
    { key: "zones",    label: t("delivery.tab_zones"),    count: zones.length },
  ] as const;

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6" /> {t("delivery.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("delivery.subtitle")}</p>
        </div>

        {/* Stats bar */}
        {stats && <StatsBar stats={stats} />}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch(""); setStatusFilter("all"); }}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {label}
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === key ? "bg-white/20 text-white" : "bg-muted"
              )}>{count}</span>
            </button>
          ))}
        </div>

        {/* Search bar (ready + active tabs) */}
        {(tab === "ready" || tab === "active") && (
          <div className="mb-4 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("delivery.search_placeholder")}
                className="ps-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {tab === "active" && (
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                      statusFilter === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Ready for Pickup ──────────────────────────────────────── */}
        {tab === "ready" && (
          <div className="space-y-4">
            {filteredReady.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-card border rounded-2xl text-center">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">{search ? t("common.no_results") : t("delivery.ready_orders_empty")}</p>
              </div>
            ) : filteredReady.map((order) => (
              <div key={order.id} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                {/* Order header */}
                <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-base" translate="no">#{order.id}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary">
                      <MapPin className="h-3 w-3" /> {t("orders.status_ready_for_pickup")}
                    </span>
                    {(order.zoneNameEn || order.zoneNameAr) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <MapPin className="h-3 w-3" />
                        {lang === "ar" ? order.zoneNameAr : order.zoneNameEn}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end">
                      <span className="text-sm font-bold" translate="no">${order.total.toFixed(2)}</span>
                      {order.deliveryFee != null && (
                        <span className="text-xs text-muted-foreground block" translate="no">+${order.deliveryFee.toFixed(2)} {t("delivery.col_fee")}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
                      className="gap-1.5 shrink-0"
                    >
                      <User className="h-3.5 w-3.5" />
                      {t("delivery.assign")}
                    </Button>
                  </div>
                </div>

                {/* Body: 2 columns on sm+ */}
                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer info */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("delivery.section_customer")}</p>
                    <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-snug">{order.shippingAddress}</p>
                    </div>
                    {order.city && <p className="text-xs text-muted-foreground">{order.city}</p>}
                    {order.customerPhone && (
                      <a href={`tel:${order.customerPhone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" translate="no">
                        <Phone className="h-3 w-3" />{order.customerPhone}
                      </a>
                    )}
                    <span className="text-[11px] text-muted-foreground font-medium">{t("delivery.payment_cod")}</span>
                  </div>

                  {/* Seller info */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("delivery.section_seller")}</p>
                    {order.storeName ? (
                      <div className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-semibold">{order.storeName}</p>
                      </div>
                    ) : null}
                    {order.sellerName && <p className="text-xs text-muted-foreground">{order.sellerName}</p>}
                    {order.sellerPhone && (
                      <a href={`tel:${order.sellerPhone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" translate="no">
                        <Phone className="h-3 w-3" />{order.sellerPhone}
                      </a>
                    )}
                    {order.products.length > 0 && (
                      <div className="mt-1">
                        <p className="text-[11px] text-muted-foreground mb-0.5">{order.products.length} {t("delivery.product_count")}</p>
                        <ProductList products={order.products} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Assign panel */}
                {assigningOrderId === order.id && (
                  <AssignCourierPanel
                    order={order}
                    couriers={couriers}
                    token={token!}
                    onAssign={() => {
                      setAssigningOrderId(null);
                      refetchReady();
                      refetchActive();
                      queryClient.invalidateQueries({ queryKey: ["admin-couriers"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-delivery-stats"] });
                    }}
                    onCancel={() => setAssigningOrderId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Active Deliveries ─────────────────────────────────────── */}
        {tab === "active" && (
          <div className="space-y-4">
            {filteredActive.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-card border rounded-2xl text-center">
                <Truck className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">{search || statusFilter !== "all" ? t("common.no_results") : t("delivery.active_empty")}</p>
              </div>
            ) : filteredActive.map((d) => (
              <div key={d.assignmentId} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-base" translate="no">#{d.orderId}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-semibold",
                      ORDER_STATUS_COLORS[d.orderStatus] ?? "bg-muted text-muted-foreground"
                    )}>
                      {t(`orders.status_${d.orderStatus}`)}
                    </span>
                    {(d.zoneNameEn || d.zoneNameAr) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <MapPin className="h-3 w-3" />
                        {lang === "ar" ? d.zoneNameAr : d.zoneNameEn}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(d.orderDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="text-sm font-bold" translate="no">${d.total.toFixed(2)}</span>
                    {d.deliveryFee != null && (
                      <span className="text-xs text-muted-foreground block" translate="no">+${d.deliveryFee.toFixed(2)} {t("delivery.col_fee")}</span>
                    )}
                  </div>
                </div>

                {/* Failure reason banner */}
                {d.assignmentStatus === "delivery_failed" && d.failureReason && (
                  <div className="px-5 py-2.5 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-400">
                      <span className="font-semibold">{t("delivery.failure_reason")}: </span>
                      {d.failureReason}
                    </p>
                  </div>
                )}

                <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Customer */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("delivery.section_customer")}</p>
                    <p className="text-sm font-semibold">{d.customerName ?? "—"}</p>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-snug">{d.shippingAddress}</p>
                    </div>
                    {d.customerPhone && (
                      <a href={`tel:${d.customerPhone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" translate="no">
                        <Phone className="h-3 w-3" />{d.customerPhone}
                      </a>
                    )}
                    <span className="text-[11px] text-muted-foreground">{t("delivery.payment_cod")}</span>
                  </div>

                  {/* Seller */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("delivery.section_seller")}</p>
                    {d.storeName ? (
                      <div className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-semibold">{d.storeName}</p>
                      </div>
                    ) : <p className="text-xs text-muted-foreground">—</p>}
                    <ProductList products={d.products} />
                  </div>

                  {/* Courier */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("delivery.section_courier")}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-sm font-semibold">{d.courierName}</p>
                    </div>
                    {d.courierPhone && (
                      <a href={`tel:${d.courierPhone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" translate="no">
                        <Phone className="h-3 w-3" />{d.courierPhone}
                      </a>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      {d.courierRating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {d.courierRating.toFixed(1)}
                        </span>
                      )}
                      <span>· {d.courierCompletedDeliveries} {t("delivery.col_deliveries")}</span>
                    </div>
                    {d.pickedUpAt ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {t("orders.status_picked_up")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Activity className="h-3 w-3" /> {t("orders.status_courier_assigned")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Couriers ──────────────────────────────────────────────── */}
        {tab === "couriers" && (
          <div className="space-y-3">
            {couriers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-card border rounded-2xl text-center">
                <User className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">{t("delivery.couriers_empty")}</p>
              </div>
            ) : couriers.map((courier) => (
              <div key={courier.id} className="bg-card border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">{courier.userName}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold border", COURIER_STATUS_COLORS[courier.status])}>
                      {t(`delivery.status_${courier.status}`)}
                    </span>
                    {courier.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/5 text-primary dark:bg-primary/10/20 dark:text-primary border border-primary/20 dark:border-primary/20">
                        {t("courier.status_online")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground" translate="no">{courier.userEmail}</p>
                  {courier.phone && (
                    <a href={`tel:${courier.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5" translate="no">
                      <Phone className="h-3 w-3" />{courier.phone}
                    </a>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>{t(`delivery.vehicle_${courier.vehicleType}`)}</span>
                    {courier.district && <span>· {courier.district}</span>}
                    <span>· {courier.completedDeliveries} {t("delivery.col_deliveries")}</span>
                    {courier.rating && (
                      <span className="flex items-center gap-0.5">
                        · <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {courier.rating.toFixed(1)}
                      </span>
                    )}
                    {courier.activeAssignments > 0 && (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        · {courier.activeAssignments} {t("delivery.active_now")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {courier.status !== "approved" && courier.status !== "rejected" && (
                    <Button size="sm" variant="outline" className="border-primary/30 text-primary" onClick={() => updateCourier(courier.id, "approved")}>
                      {t("delivery.approve")}
                    </Button>
                  )}
                  {courier.status === "pending" && (
                    <Button size="sm" variant="outline" className="border-red-300 text-red-600" onClick={() => updateCourier(courier.id, "rejected")}>
                      {t("delivery.reject")}
                    </Button>
                  )}
                  {courier.status === "approved" && (
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => updateCourier(courier.id, "suspended")}>
                      {t("delivery.suspend")}
                    </Button>
                  )}
                  {courier.status === "suspended" && (
                    <Button size="sm" variant="outline" className="border-primary/30 text-primary" onClick={() => updateCourier(courier.id, "approved")}>
                      {t("delivery.approve")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Delivery Zones ────────────────────────────────────────── */}
        {tab === "zones" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setEditingZone("new")} className="gap-1.5">
                <Plus className="h-4 w-4" /> {t("delivery.add_zone")}
              </Button>
            </div>

            {editingZone === "new" && (
              <ZoneForm
                zone={null}
                token={token!}
                onSave={() => { setEditingZone(null); refetchZones(); }}
                onCancel={() => setEditingZone(null)}
              />
            )}

            {zones.length === 0 && editingZone !== "new" ? (
              <div className="flex flex-col items-center justify-center py-16 bg-card border rounded-2xl text-center">
                <MapPin className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-muted-foreground text-sm">{t("delivery.zones_empty")}</p>
              </div>
            ) : zones.map((zone) => (
              <div key={zone.id}>
                {editingZone !== "new" && editingZone?.id === zone.id ? (
                  <ZoneForm
                    zone={zone}
                    token={token!}
                    onSave={() => { setEditingZone(null); refetchZones(); }}
                    onCancel={() => setEditingZone(null)}
                  />
                ) : (
                  <div className="bg-card border rounded-xl px-5 py-3.5 flex items-center gap-4">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{lang === "ar" ? zone.nameAr : zone.nameEn}</p>
                        {!zone.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{lang === "ar" ? zone.nameEn : zone.nameAr}</p>
                    </div>
                    <span className="font-bold text-sm shrink-0" translate="no">${zone.fee.toFixed(2)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingZone(zone)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => deleteZone(zone.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
