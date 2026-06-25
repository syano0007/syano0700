/**
 * CourierWorkspace — Web-First Courier Experience (Phases W1–W10)
 *
 * FULLSCREEN MAP-FIRST layout (UX redesign — behavior unchanged):
 *   - Map fills entire available workspace (flex-1, w-full h-full)
 *   - Floating glass status card overlays map from bottom-end corner
 *   - Offer cards overlay map from top (unchanged)
 *   - GPS badge + status badge + refresh live in the floating card header
 *   - Smooth max-height transition between idle (compact) and active (expanded) states
 *   - All APIs, polling, GPS reporting, mission lifecycle — 100% preserved
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBrowserLocation } from "@/hooks/useBrowserLocation";
import { cn } from "@/lib/utils";
import {
  Truck, Package, CheckCircle2, MapPin, Phone,
  User, Store, ShoppingBag, AlertTriangle,
  Wifi, WifiOff, Timer, Bell, Navigation,
  History, DollarSign, Settings, RefreshCw,
  AlertCircle, LocateFixed, LocateOff,
  RotateCcw, ShieldAlert, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TrackingMap = lazy(() => import("@/components/TrackingMap"));

// ─── Types ────────────────────────────────────────────────────────────────────
interface CourierProfile {
  id: number;
  status: "pending" | "approved" | "suspended";
  active: boolean;
  phone: string;
  vehicleType: string;
  district: string | null;
  rating: number | null;
  completedDeliveries: number;
}
interface CourierAvailability {
  courierId: number;
  availabilityStatus: "ONLINE" | "OFFLINE" | "BUSY";
  isAcceptingDeliveries: boolean;
  lastAvailabilityChangeAt: string | null;
  canReceiveMission: boolean;
}
interface ProductSnap { name: string; quantity: number; unitPrice: number; }
interface Assignment {
  id: number;
  orderId: number;
  missionId: number | null;
  status: string;
  assignedAt: string;
  pickedUpAt: string | null;
  orderStatus: string;
  orderDate: string;
  shippingAddress: string;
  city: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryNotes: string | null;
  deliveryFee: number | null;
  total: number;
  storeName: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  zoneNameEn: string | null;
  zoneNameAr: string | null;
  products: ProductSnap[];
  notes: string | null;
}
interface MissionOffer {
  offerId: number;
  missionId: number;
  round: number;
  offeredAt: string;
  expiresAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliverySize: string;
  missionStatus: string;
}
interface TrackingData {
  missionId: number;
  orderId: number;
  status: string;
  courierLat: number | null;
  courierLng: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  dropoffAddress: string;
  isFresh: boolean;
  freshnessStatus: "FRESH" | "WARNING" | "STALE";
  ageSeconds: number;
  eta: { distanceKm: number | null; etaMinutes: number | null; confidence: string } | null;
  routeGeometry: [number, number][] | null;
  routeSource: "osrm" | "haversine" | null;
}
interface TrailPoint { lat: number; lng: number; recordedAt: string; }

const FAILURE_REASONS = [
  "courier.failure_unavailable",
  "courier.failure_wrong_address",
  "courier.failure_rejected",
  "courier.failure_unreachable",
  "courier.failure_other",
] as const;

// ─── GPS Status Badge ─────────────────────────────────────────────────────────
function GpsBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const isActive = status === "active";
  return (
    <div className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
      isActive
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        : "bg-muted text-muted-foreground",
    )}>
      {isActive
        ? <LocateFixed className="h-2.5 w-2.5" />
        : <LocateOff className="h-2.5 w-2.5" />
      }
      {isActive ? t("courier.gps_active") : t("courier.gps_inactive")}
    </div>
  );
}

// ─── Offer Card Overlay (floats above map from the top) ───────────────────────
function OfferOverlay({ offers, token, onResponded }: {
  offers: MissionOffer[];
  token: string;
  onResponded: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [acting, setActing] = useState<Record<number, "accept" | "decline">>({});

  const respond = async (offerId: number, action: "accept" | "decline") => {
    setActing((prev) => ({ ...prev, [offerId]: action }));
    try {
      const res = await fetch(`/api/courier/missions/offers/${offerId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      toast({ title: action === "accept" ? t("courier.offer_accepted_toast") : t("courier.offer_declined_toast") });
      onResponded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("courier.offer_error_toast");
      toast({ title: msg, variant: "destructive" });
    } finally {
      setActing((prev) => { const n = { ...prev }; delete n[offerId]; return n; });
    }
  };

  return (
    <div className="absolute top-3 start-3 end-3 z-[1000] space-y-2 pointer-events-none">
      {offers.map((offer) => (
        <OfferCard
          key={offer.offerId}
          offer={offer}
          acting={acting[offer.offerId] ?? null}
          onAccept={() => respond(offer.offerId, "accept")}
          onDecline={() => respond(offer.offerId, "decline")}
        />
      ))}
    </div>
  );
}

function OfferCard({ offer, acting, onAccept, onDecline }: {
  offer: MissionOffer;
  acting: "accept" | "decline" | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [offer.expiresAt, secondsLeft]);

  const isExpired = secondsLeft <= 0;
  const isDanger  = secondsLeft <= 5;
  const isWarning = secondsLeft <= 15;

  const ringCls = isExpired  ? "ring-1 ring-gray-500/20 opacity-60"
    : isDanger   ? "ring-2 ring-red-500/60 animate-pulse"
    : isWarning  ? "ring-2 ring-amber-500/50"
    : "ring-2 ring-emerald-500/30";

  const timerCls = isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500";

  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-md border rounded-2xl overflow-hidden shadow-2xl pointer-events-auto",
        ringCls,
      )}
      style={{ animation: "slideDown 0.25s ease-out" }}
    >
      <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-sm">{t("courier.offer_banner_title")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("courier.offer_mission_id", { id: offer.missionId })} · {t("courier.offer_round", { round: offer.round })}
            </p>
          </div>
        </div>
        <div className={cn("font-black text-2xl tabular-nums flex items-center gap-1", timerCls)}>
          <Timer className="h-4 w-4 opacity-70" />
          {isExpired ? "—" : `${secondsLeft}s`}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Store className="h-2.5 w-2.5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("courier.offer_pickup_area")}</p>
            <p className="text-sm leading-snug">{offer.pickupAddress || "—"}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <MapPin className="h-2.5 w-2.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("courier.offer_dropoff_area")}</p>
            <p className="text-sm leading-snug">{offer.dropoffAddress || "—"}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex gap-2">
        {isExpired ? (
          <p className="text-xs text-muted-foreground italic w-full text-center py-1">{t("courier.offer_expired")}</p>
        ) : (
          <>
            <Button
              onClick={onAccept}
              disabled={!!acting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-transform"
              size="sm"
            >
              {acting === "accept" ? t("courier.offer_accepting") : t("courier.offer_accept")}
            </Button>
            <Button
              onClick={onDecline}
              disabled={!!acting}
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 active:scale-95 transition-transform"
              size="sm"
            >
              {acting === "decline" ? t("courier.offer_declining") : t("courier.offer_decline")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Failure Modal ────────────────────────────────────────────────────────────
function FailureModal({ orderId, onConfirm, onCancel, acting }: {
  orderId: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  acting: boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("");
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
          <h3 className="font-bold text-base">{t("courier.failure_modal_title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("courier.failure_modal_desc", { id: orderId })}</p>
        <div className="space-y-2">
          {FAILURE_REASONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(t(key))}
              className={cn(
                "w-full text-start text-sm px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98]",
                selected === t(key)
                  ? "border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                  : "border-border bg-muted/30 hover:bg-muted/60",
              )}
            >{t(key)}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || acting}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white active:scale-95 transition-transform"
          >
            {acting ? "…" : t("courier.failure_confirm_btn")}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1 active:scale-95 transition-transform">{t("common.cancel")}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Compact Idle Panels (for floating card — horizontal layout) ───────────────

function CompactOfflinePanel({ onGoOnline, toggling }: {
  onGoOnline: () => void;
  toggling: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">{t("courier.map_offline")}</p>
        <p className="text-xs text-muted-foreground truncate">{t("courier.offline_hint")}</p>
      </div>
      <Button
        onClick={onGoOnline}
        disabled={toggling}
        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 active:scale-95 transition-transform"
        size="sm"
      >
        {toggling ? "…" : t("courier.go_online")}
      </Button>
    </div>
  );
}

function CompactWaitingPanel({ onGoOffline, toggling, gpsStatus, onRequestGps }: {
  onGoOffline: () => void;
  toggling: boolean;
  gpsStatus: string;
  onRequestGps: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300 leading-tight">{t("courier.map_online")}</p>
          <p className="text-xs text-muted-foreground truncate">{t("courier.waiting_for_offer")}</p>
        </div>
        <Button
          onClick={onGoOffline}
          disabled={toggling}
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 shrink-0 active:scale-95 transition-transform"
          size="sm"
        >
          {toggling ? "…" : t("courier.go_offline")}
        </Button>
      </div>
      {gpsStatus !== "active" && gpsStatus !== "requesting" && (
        <button
          type="button"
          onClick={onRequestGps}
          className="text-xs text-primary underline underline-offset-2 ps-1"
        >
          {t("courier.enable_gps")}
        </button>
      )}
    </div>
  );
}

// ─── Pickup Panel (for floating card — all logic unchanged) ────────────────────
function PickupPanel({ assignment, token, onAction }: {
  assignment: Assignment;
  token: string;
  onAction: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [acting, setActing] = useState(false);

  const doAction = async (endpoint: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/couriers/assignments/${assignment.id}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onAction();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.error");
      toast({ title: msg, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const isAssigned = assignment.orderStatus === "courier_assigned";
  const isPickedUp = assignment.orderStatus === "picked_up";

  return (
    <div className="px-3 pb-3 space-y-3">
      {/* Status banner */}
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t("courier.phase_pickup")}</span>
        <span className="text-xs text-muted-foreground ms-auto" translate="no">#{assignment.orderId}</span>
      </div>

      {/* Store info */}
      <div className="bg-muted/40 rounded-xl p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("courier.pickup_section")}</p>
        {assignment.storeName && (
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{assignment.storeName}</span>
          </div>
        )}
        {assignment.sellerPhone && (
          <a href={`tel:${assignment.sellerPhone}`} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
            <Phone className="h-3.5 w-3.5" />{assignment.sellerPhone}
          </a>
        )}
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-sm text-muted-foreground">{assignment.shippingAddress}</span>
        </div>
        {(assignment.zoneNameEn || assignment.zoneNameAr) && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {i18n.language === "ar" ? assignment.zoneNameAr : assignment.zoneNameEn}
          </span>
        )}
        {assignment.products.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {assignment.products.slice(0, 3).map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                <ShoppingBag className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[90px]">{p.name}</span>
                {p.quantity > 1 && <span className="font-semibold">×{p.quantity}</span>}
              </span>
            ))}
            {assignment.products.length > 3 && (
              <span className="text-[11px] text-muted-foreground px-1">+{assignment.products.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Navigate */}
      <a
        href={`https://www.openstreetmap.org/directions?to=${encodeURIComponent(assignment.shippingAddress)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-9 border rounded-xl text-sm font-medium hover:bg-muted transition-colors active:scale-[0.98]"
      >
        <Navigation className="h-4 w-4" />
        {t("courier.navigate_to_pickup")}
      </a>

      {/* Primary action */}
      {isAssigned && (
        <Button
          onClick={() => doAction("pickup")}
          disabled={acting}
          className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm gap-2 active:scale-[0.98] transition-transform"
        >
          <Package className="h-4 w-4" />
          {acting ? "…" : t("courier.mark_pickup")}
        </Button>
      )}
      {isPickedUp && (
        <Button
          onClick={() => doAction("start-delivery")}
          disabled={acting}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm gap-2 active:scale-[0.98] transition-transform"
        >
          <Truck className="h-4 w-4" />
          {acting ? "…" : t("courier.mark_out_for_delivery")}
        </Button>
      )}
    </div>
  );
}

// ─── Delivery Panel (A8: proof-confirm gate + reschedule + safety) ─────────────
function DeliveryPanel({ assignment, token, onAction }: {
  assignment: Assignment;
  token: string;
  onAction: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [acting, setActing]                     = useState(false);
  const [showFailModal, setShowFailModal]         = useState(false);
  const [showRescheduleModal, setShowReschedule]  = useState(false);
  const [rescheduleReason, setRescheduleReason]  = useState("");
  const [showSafetyModal, setShowSafety]          = useState(false);
  const [safetyType, setSafetyType]              = useState("");
  const [safetyNote, setSafetyNote]              = useState("");

  const missionId = assignment.missionId;

  const doAssignmentAction = async (endpoint: string, body?: object) => {
    setActing(true);
    try {
      const res = await fetch(`/api/couriers/assignments/${assignment.id}/${endpoint}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onAction();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("common.error"), variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const doProofAndDeliver = async () => {
    setActing(true);
    try {
      if (missionId) {
        const proofRes = await fetch(`/api/courier/missions/${missionId}/proof`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!proofRes.ok) {
          const d = await proofRes.json();
          throw new Error(d.error ?? t("common.error"));
        }
      }
      const res = await fetch(`/api/couriers/assignments/${assignment.id}/deliver`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      onAction();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("common.error"), variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const doReschedule = async () => {
    if (!missionId || !rescheduleReason.trim()) return;
    setActing(true);
    try {
      const res = await fetch(`/api/courier/missions/${missionId}/reschedule`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rescheduleReason: rescheduleReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      toast({ title: t("ops.reschedule_sent") });
      setShowReschedule(false);
      setRescheduleReason("");
      onAction();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("common.error"), variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const doSafetyEvent = async () => {
    if (!missionId || !safetyType) return;
    setActing(true);
    try {
      const res = await fetch(`/api/courier/missions/${missionId}/safety-event`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ incidentType: safetyType, note: safetyNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("common.error"));
      toast({ title: t("ops.safety_sent") });
      setShowSafety(false);
      setSafetyType("");
      setSafetyNote("");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("common.error"), variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const SAFETY_TYPES = [
    { id: "ROAD_HAZARD",        label: t("ops.safety_road_hazard") },
    { id: "VEHICLE_ACCIDENT",   label: t("ops.safety_vehicle_accident") },
    { id: "THREAT_OR_ASSAULT",  label: t("ops.safety_threat") },
    { id: "THEFT",              label: t("ops.safety_theft") },
    { id: "MEDICAL_EMERGENCY",  label: t("ops.safety_medical") },
    { id: "OTHER",              label: t("ops.safety_other") },
  ];

  return (
    <>
      {showFailModal && (
        <FailureModal
          orderId={assignment.orderId}
          onConfirm={(reason) => { setShowFailModal(false); doAssignmentAction("fail-delivery", { failureReason: reason }); }}
          onCancel={() => setShowFailModal(false)}
          acting={acting}
        />
      )}

      {/* Reschedule modal */}
      {showRescheduleModal && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base">{t("ops.reschedule_title")}</h3>
            <button type="button" onClick={() => setShowReschedule(false)} className="p-1 rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t("ops.reschedule_hint")}</p>
          <textarea
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
            placeholder={t("ops.reschedule_placeholder")}
            className="flex-1 resize-none rounded-xl border bg-muted/40 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            maxLength={400}
          />
          <Button
            onClick={doReschedule}
            disabled={acting || !rescheduleReason.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RotateCcw className="h-4 w-4 me-2" />
            {acting ? "…" : t("ops.reschedule_submit")}
          </Button>
        </div>
      )}

      {/* Safety event modal */}
      {showSafetyModal && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base text-red-600 dark:text-red-400">{t("ops.safety_title")}</h3>
            <button type="button" onClick={() => setShowSafety(false)} className="p-1 rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t("ops.safety_hint")}</p>
          <div className="space-y-2 mb-3">
            {SAFETY_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSafetyType(id)}
                className={cn(
                  "w-full text-start px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors",
                  safetyType === id
                    ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "border-border hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={safetyNote}
            onChange={(e) => setSafetyNote(e.target.value)}
            placeholder={t("ops.safety_note_placeholder")}
            className="resize-none rounded-xl border bg-muted/40 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
            rows={2}
            maxLength={300}
          />
          <Button
            onClick={doSafetyEvent}
            disabled={acting || !safetyType}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <ShieldAlert className="h-4 w-4 me-2" />
            {acting ? "…" : t("ops.safety_submit")}
          </Button>
        </div>
      )}

      <div className="px-3 pb-3 space-y-3">
        {/* Status banner */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t("courier.phase_delivery")}</span>
          <span className="text-xs text-muted-foreground ms-auto" translate="no">#{assignment.orderId}</span>
        </div>

        {/* Customer info */}
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("courier.delivery_section")}</p>
          {assignment.customerName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm">{assignment.customerName}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">{assignment.shippingAddress}</p>
          </div>
          {assignment.city && <p className="text-xs text-muted-foreground">{assignment.city}</p>}
          {(assignment.zoneNameEn || assignment.zoneNameAr) && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {i18n.language === "ar" ? assignment.zoneNameAr : assignment.zoneNameEn}
            </span>
          )}
          {assignment.customerPhone && (
            <a href={`tel:${assignment.customerPhone}`} className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
              <Phone className="h-3.5 w-3.5" />{assignment.customerPhone}
            </a>
          )}
          {assignment.deliveryNotes && (
            <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-2.5 py-1.5">{assignment.deliveryNotes}</p>
          )}
        </div>

        {/* Navigate */}
        <a
          href={`https://www.openstreetmap.org/directions?to=${encodeURIComponent(assignment.shippingAddress)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-9 border rounded-xl text-sm font-medium hover:bg-muted transition-colors active:scale-[0.98]"
        >
          <Navigation className="h-4 w-4" />
          {t("courier.navigate_to_customer")}
        </a>

        {/* Primary: confirm + deliver */}
        <Button
          onClick={doProofAndDeliver}
          disabled={acting}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2 active:scale-[0.98] transition-transform"
        >
          <CheckCircle2 className="h-4 w-4" />
          {acting ? "…" : t("courier.mark_delivered")}
        </Button>

        {/* Secondary actions row */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => setShowFailModal(true)}
            disabled={acting}
            variant="outline"
            className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 active:scale-[0.98] transition-transform text-xs"
            size="sm"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("courier.mark_failed")}
          </Button>
          <Button
            onClick={() => setShowReschedule(true)}
            disabled={acting || !missionId}
            variant="outline"
            className="gap-1.5 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 active:scale-[0.98] transition-transform text-xs"
            size="sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("ops.reschedule_btn")}
          </Button>
          <Button
            onClick={() => setShowSafety(true)}
            disabled={acting || !missionId}
            variant="outline"
            className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 active:scale-[0.98] transition-transform text-xs"
            size="sm"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("ops.safety_btn")}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Courier Nav (bottom docked) ───────────────────────────────────────────────
function CourierNav({ active }: { active: "workspace" | "history" | "earnings" | "profile" }) {
  const { t } = useTranslation();
  const items = [
    { id: "workspace", href: "/courier",          icon: Truck,       labelKey: "courier.nav_workspace" },
    { id: "history",   href: "/courier/history",   icon: History,     labelKey: "courier.nav_history" },
    { id: "earnings",  href: "/courier/earnings",  icon: DollarSign,  labelKey: "courier.nav_earnings" },
    { id: "profile",   href: "/courier/profile",   icon: Settings,    labelKey: "courier.nav_profile" },
  ] as const;
  return (
    <nav className="flex border-t bg-card/95 backdrop-blur-md shrink-0">
      {items.map(({ id, href, icon: Icon, labelKey }) => (
        <Link key={id} href={href} className={cn(
          "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors active:scale-95",
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

// ─── Main Workspace ───────────────────────────────────────────────────────────
export default function CourierWorkspace() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [availToggling, setAvailToggling] = useState(false);

  const headers = { Authorization: `Bearer ${token ?? ""}` };

  // ── Profile ────────────────────────────────────────────────────────────────
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
    error: profileError,
  } = useQuery<CourierProfile>({
    queryKey: ["courier-profile"],
    queryFn: async () => {
      const res = await fetch("/api/couriers/profile", { headers });
      if (res.status === 404) throw new Error("no_profile");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  // ── Availability ───────────────────────────────────────────────────────────
  const { data: availability, refetch: refetchAvailability } = useQuery<CourierAvailability>({
    queryKey: ["courier-availability"],
    queryFn: async () => {
      const res = await fetch("/api/courier/availability", { headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!token && profile?.status === "approved",
    refetchInterval: 15_000,
  });

  // ── Active assignments ─────────────────────────────────────────────────────
  const { data: assignments = [], refetch: refetchAssignments } = useQuery<Assignment[]>({
    queryKey: ["courier-assignments"],
    queryFn: () => fetch("/api/couriers/assignments", { headers }).then((r) => r.json()),
    enabled: !!token && profile?.status === "approved",
    refetchInterval: 10_000,
  });

  // ── Mission offers ─────────────────────────────────────────────────────────
  const { data: missionOffers = [], refetch: refetchOffers } = useQuery<MissionOffer[]>({
    queryKey: ["courier-mission-offers"],
    queryFn: async () => {
      const res = await fetch("/api/courier/missions/offers", { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && profile?.status === "approved",
    refetchInterval: 5_000,
  });

  // ── Active assignment (first one) ──────────────────────────────────────────
  const activeAssignment = assignments.length > 0 ? assignments[0] : null;
  const missionId = activeAssignment?.missionId ?? null;

  // ── Live tracking data (for map markers) ──────────────────────────────────
  const { data: trackingData } = useQuery<TrackingData>({
    queryKey: ["courier-tracking", missionId],
    queryFn: async () => {
      const res = await fetch(`/api/tracking/${missionId}`, { headers });
      if (!res.ok) throw new Error("tracking unavailable");
      return res.json();
    },
    enabled: !!token && !!missionId,
    refetchInterval: 8_000,
  });

  // ── Trail ──────────────────────────────────────────────────────────────────
  const { data: trailRaw = [] } = useQuery<TrailPoint[]>({
    queryKey: ["courier-trail", missionId],
    queryFn: async () => {
      const res = await fetch(`/api/tracking/${missionId}/positions`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token && !!missionId,
    refetchInterval: 10_000,
  });

  const trail = trailRaw.map((p) => ({ lat: p.lat, lng: p.lng }));

  // ── Browser GPS (W6) ───────────────────────────────────────────────────────
  const avStatus = availability?.availabilityStatus ?? "OFFLINE";
  const gpsEnabled = !!token && profile?.status === "approved" && avStatus !== "OFFLINE";

  const { location: gpsLocation, status: gpsStatus, requestPermission } = useBrowserLocation({
    enabled: gpsEnabled,
    token:   token ?? null,
  });

  // ── Availability toggle ────────────────────────────────────────────────────
  const toggleAvailability = async (targetStatus: "ONLINE" | "OFFLINE") => {
    setAvailToggling(true);
    try {
      const res = await fetch("/api/courier/availability", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      refetchAvailability();
      toast({
        title: targetStatus === "ONLINE"
          ? t("courier_availability.toggle_on")
          : t("courier_availability.toggle_off"),
      });
    } catch {
      toast({ title: t("courier_availability.toggle_error"), variant: "destructive" });
    } finally {
      setAvailToggling(false);
    }
  };

  const handleRefreshAll = () => {
    refetchProfile();
    refetchAvailability();
    refetchAssignments();
    refetchOffers();
    queryClient.invalidateQueries({ queryKey: ["courier-tracking"] });
    queryClient.invalidateQueries({ queryKey: ["courier-trail"] });
  };

  // ── Determine courier lat/lng for map ──────────────────────────────────────
  const courierLat = gpsLocation?.lat ?? trackingData?.courierLat ?? null;
  const courierLng = gpsLocation?.lng ?? trackingData?.courierLng ?? null;

  // ── Guard states ───────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-sm px-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
        <CourierNav active="workspace" />
      </div>
    );
  }

  if (profileError && (profileError as Error)?.message !== "no_profile") {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">{t("common.error_title")}</p>
          <Button variant="outline" onClick={() => refetchProfile()} className="gap-2">
            <RefreshCw className="h-4 w-4" />{t("common.retry")}
          </Button>
        </div>
        <CourierNav active="workspace" />
      </div>
    );
  }

  if ((profileError as Error)?.message === "no_profile" || !profile) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <Truck className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">{t("courier.apply_title")}</p>
          <p className="text-sm text-muted-foreground">{t("courier.apply_subtitle")}</p>
          <Link href="/courier/apply">
            <Button>{t("courier.submit_apply")}</Button>
          </Link>
        </div>
        <CourierNav active="workspace" />
      </div>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Truck className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-bold text-lg">{t("courier.pending_title")}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{t("courier.pending_desc")}</p>
        </div>
        <CourierNav active="workspace" />
      </div>
    );
  }

  if (profile.status === "suspended") {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Truck className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <p className="font-bold text-lg">{t("courier.suspended_title")}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{t("courier.suspended_desc")}</p>
        </div>
        <CourierNav active="workspace" />
      </div>
    );
  }

  // ── State flags ────────────────────────────────────────────────────────────
  const isOffline = avStatus === "OFFLINE";
  const isOnline  = avStatus === "ONLINE";
  const isBusy    = avStatus === "BUSY";

  const isPickupPhase = activeAssignment
    && (activeAssignment.orderStatus === "courier_assigned" || activeAssignment.orderStatus === "picked_up");
  const isDeliveryPhase = activeAssignment
    && activeAssignment.orderStatus === "out_for_delivery";

  const routeStatus = trackingData?.status ?? (activeAssignment ? "ACTIVE" : undefined);

  const isIdleState = isOffline || (isOnline && !activeAssignment);
  const isActiveState = isBusy && (isPickupPhase || isDeliveryPhase);

  const statusBadgeCls = isOnline
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    : isBusy
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-muted text-muted-foreground";

  const statusLabel = isOnline
    ? t("courier_availability.status_online")
    : isBusy
    ? t("courier_availability.status_busy")
    : t("courier_availability.status_offline");

  // ── Fullscreen map-first layout ────────────────────────────────────────────
  return (
    <>
      {/* CSS keyframe for offer card slide-in */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">

        {/* ── MAP — fills all space above the bottom nav ── */}
        <div className="relative flex-1 min-h-0">
          <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" />}>
            <TrackingMap
              courierLat={courierLat}
              courierLng={courierLng}
              pickupLat={trackingData?.pickupLat ?? null}
              pickupLng={trackingData?.pickupLng ?? null}
              pickupAddress={trackingData?.pickupAddress ?? activeAssignment?.storeName ?? ""}
              dropoffLat={trackingData?.dropoffLat ?? null}
              dropoffLng={trackingData?.dropoffLng ?? null}
              dropoffAddress={trackingData?.dropoffAddress ?? activeAssignment?.shippingAddress ?? ""}
              trail={trail}
              routeGeometry={trackingData?.routeGeometry ?? null}
              routeSource={trackingData?.routeSource ?? null}
              routeStatus={routeStatus}
              className="w-full h-full"
            />
          </Suspense>

          {/* Offer cards — float from top (unchanged position) */}
          {missionOffers.length > 0 && (
            <OfferOverlay
              offers={missionOffers}
              token={token!}
              onResponded={() => {
                refetchOffers();
                refetchAvailability();
                refetchAssignments();
              }}
            />
          )}

          {/* ── Floating status card ── */}
          <div
            className={cn(
              "absolute bottom-3 end-3 z-[999]",
              "w-[min(88vw,420px)]",
              "bg-card/95 backdrop-blur-md border rounded-2xl shadow-2xl overflow-hidden",
              "transition-all duration-300 ease-in-out",
            )}
          >
            {/* Card header: workspace name + status + GPS + refresh */}
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/30">
              <Truck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="font-bold text-xs flex-1 truncate">{t("courier.workspace_title")}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", statusBadgeCls)}>
                {statusLabel}
              </span>
              <GpsBadge status={gpsStatus} />
              <button
                type="button"
                onClick={handleRefreshAll}
                className="p-1 rounded-lg hover:bg-muted transition-colors shrink-0 active:rotate-180 transition-transform duration-300"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Card body — compact for idle, scrollable for active */}
            <div
              className="overflow-y-auto transition-all duration-300 ease-in-out"
              style={{ maxHeight: isIdleState ? "120px" : "62vh" }}
            >
              {isOffline && (
                <CompactOfflinePanel
                  onGoOnline={() => toggleAvailability("ONLINE")}
                  toggling={availToggling}
                />
              )}
              {isOnline && !activeAssignment && (
                <CompactWaitingPanel
                  onGoOffline={() => toggleAvailability("OFFLINE")}
                  toggling={availToggling}
                  gpsStatus={gpsStatus}
                  onRequestGps={requestPermission}
                />
              )}
              {isBusy && isPickupPhase && activeAssignment && (
                <div className="pt-3">
                  <PickupPanel
                    assignment={activeAssignment}
                    token={token!}
                    onAction={() => {
                      refetchAssignments();
                      refetchAvailability();
                      queryClient.invalidateQueries({ queryKey: ["courier-tracking"] });
                      queryClient.invalidateQueries({ queryKey: ["courier-earnings"] });
                    }}
                  />
                </div>
              )}
              {isBusy && isDeliveryPhase && activeAssignment && (
                <div className="pt-3">
                  <DeliveryPanel
                    assignment={activeAssignment}
                    token={token!}
                    onAction={() => {
                      refetchAssignments();
                      refetchAvailability();
                      queryClient.invalidateQueries({ queryKey: ["courier-tracking"] });
                      queryClient.invalidateQueries({ queryKey: ["courier-earnings"] });
                    }}
                  />
                </div>
              )}
              {isBusy && !isPickupPhase && !isDeliveryPhase && !activeAssignment && (
                <div className="flex items-center gap-3 px-3 py-3">
                  <Truck className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="font-semibold text-sm">{t("courier.map_busy")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom courier nav (docked) ── */}
        <CourierNav active="workspace" />
      </div>
    </>
  );
}
