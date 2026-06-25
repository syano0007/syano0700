/**
 * /tracking/:missionId — Live Delivery Tracking Page (Phase A5)
 *
 * - 5-second polling of /api/tracking/:missionId
 * - Leaflet/OSM map via lazy-loaded TrackingMap component
 * - ETA panel, courier info, event timeline
 * - Role-aware: customer/seller/admin all see same page; API enforces ownership
 */

import { useState, useEffect, useRef, lazy, Suspense, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Truck, Clock, Zap, Navigation, Phone,
  AlertCircle, RefreshCw, CheckCircle2, XCircle, Package, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Lazy-load map to avoid loading Leaflet CSS during SSR / initial paint
const TrackingMap = lazy(() => import("@/components/TrackingMap"));

// ── Polling interval (ms) ───────────────────────────────────────────────────
const POLL_MS = 5_000;

// ── RouteStatus helpers ─────────────────────────────────────────────────────
type RouteStatus =
  | "WAITING_PICKUP" | "GOING_TO_PICKUP" | "PICKED_UP"
  | "GOING_TO_CUSTOMER" | "DELIVERED" | "FAILED" | "CANCELLED";

const STATUS_CONFIG: Record<RouteStatus, { label: string; labelAr: string; color: string; icon: React.ElementType }> = {
  WAITING_PICKUP:      { label: "Waiting for courier",       labelAr: "انتظار الساعي",         color: "text-amber-500",   icon: Clock },
  GOING_TO_PICKUP:     { label: "Courier heading to store",  labelAr: "الساعي في الطريق للمتجر", color: "text-sky-500",     icon: Truck },
  PICKED_UP:           { label: "Order picked up",           labelAr: "تم استلام الطلب",        color: "text-violet-500",  icon: Package },
  GOING_TO_CUSTOMER:   { label: "On the way to you",         labelAr: "في الطريق إليك",          color: "text-emerald-500", icon: Navigation },
  DELIVERED:           { label: "Delivered",                 labelAr: "تم التسليم",             color: "text-emerald-600", icon: CheckCircle2 },
  FAILED:              { label: "Delivery failed",           labelAr: "فشل التسليم",            color: "text-red-500",     icon: XCircle },
  CANCELLED:           { label: "Cancelled",                 labelAr: "ملغى",                   color: "text-muted-foreground", icon: XCircle },
};

const FRESHNESS_CONFIG = {
  FRESH:   { dot: "bg-emerald-500", pulse: true,  label: "Live" },
  WARNING: { dot: "bg-amber-400",   pulse: false, label: "Signal weak" },
  STALE:   { dot: "bg-red-500",     pulse: false, label: "Signal lost" },
  UNKNOWN: { dot: "bg-muted-foreground", pulse: false, label: "No GPS" },
};

const EVENT_LABELS: Record<string, { en: string; ar: string }> = {
  MISSION_ACCEPTED:  { en: "Order accepted by courier",   ar: "قبل الساعي الطلب" },
  PICKED_UP:         { en: "Order picked up from store",  ar: "تم استلام الطلب من المتجر" },
  IN_TRANSIT:        { en: "Out for delivery",            ar: "في طريق التسليم" },
  DELIVERED:         { en: "Order delivered",             ar: "تم تسليم الطلب" },
  FAILED:            { en: "Delivery failed",             ar: "فشل التسليم" },
  CANCELLED:         { en: "Order cancelled",             ar: "تم إلغاء الطلب" },
  TRACKING_STARTED:  { en: "Live tracking started",       ar: "بدأ التتبع المباشر" },
  TRACKING_STOPPED:  { en: "Tracking ended",              ar: "انتهى التتبع" },
  POSITION_UPDATED:  { en: "Location updated",            ar: "تم تحديث الموقع" },
  MISSION_OFFERED:   { en: "Mission offered to courier",  ar: "عُرضت المهمة على الساعي" },
};

// ── Tracking data shapes (mirrors API) ──────────────────────────────────────
interface TrackingData {
  missionId:       number;
  missionStatus:   string;
  routeStatus:     RouteStatus;
  pickupLocation:  { lat: number | null; lng: number | null; address: string };
  deliveryLocation:{ lat: number | null; lng: number | null; address: string };
  session:         { id: number; isActive: boolean; startedAt: string; positionCount: number } | null;
  courier:         { id: number; name: string; vehicleType: string | null; phone: string } | null;
  currentPosition: { lat: number; lng: number; heading: number | null; speed: number | null; recordedAt: string; freshness: string; ageSeconds: number | null } | null;
  freshness:       string;
  ageSeconds:      number | null;
  // A6.7 — real road route
  route: {
    geometry:        [number, number][] | null;
    distanceKm:      number | null;
    durationMinutes: number | null;
    source:          "osrm" | "haversine" | null;
  } | null;
  eta: {
    distanceRemainingKm:    number | null;
    estimatedTravelMinutes: number | null;
    confidence:             string;
    note:                   string;
    legToPickupKm:          number | null;
    legToCustomerKm:        number | null;
    legToPickupMinutes:     number | null;
    legToCustomerMinutes:   number | null;
    routeStatus:            RouteStatus;
    routeSource:            "osrm" | "haversine" | null;
  };
  recentEvents:    { eventType: string; occurredAt: string; payload: unknown }[];
  lastUpdateAt:    string | null;
}

interface Position { lat: number; lng: number }

// ── Custom hook: polling + trail ──────────────────────────────────────────────
function useTrackingPolling(missionId: number, token: string | null) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [trail, setTrail] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!token) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`/api/tracking/${missionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) setError("not_found");
        else setError("server_error");
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
      setLastFetch(Date.now());

      // Fetch position trail (last 30 points)
      const posRes = await fetch(`/api/tracking/${missionId}/positions?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      });
      if (posRes.ok) {
        const posJson = await posRes.json();
        const positions = (posJson.positions ?? posJson ?? []).map((p: { lat: string; lng: string }) => ({
          lat: parseFloat(String(p.lat)),
          lng: parseFloat(String(p.lng)),
        }));
        setTrail(positions.reverse()); // API returns newest first, Leaflet needs oldest first
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") setError("network_error");
    } finally {
      setLoading(false);
    }
  }, [missionId, token]);

  useEffect(() => {
    fetchTracking();
    const interval = setInterval(fetchTracking, POLL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchTracking]);

  return { data, trail, loading, error, lastFetch, refetch: fetchTracking };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrackingPage() {
  const { missionId: rawId } = useParams<{ missionId: string }>();
  const missionId = parseInt(rawId ?? "0", 10);
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const { token } = useAuth();

  const { data, trail, loading, error, lastFetch, refetch } = useTrackingPolling(missionId, token);

  const routeStatus = data?.routeStatus ?? "WAITING_PICKUP";
  const statusCfg = STATUS_CONFIG[routeStatus] ?? STATUS_CONFIG.WAITING_PICKUP;
  const StatusIcon = statusCfg.icon;
  const freshnessCfg = FRESHNESS_CONFIG[(data?.freshness as keyof typeof FRESHNESS_CONFIG) ?? "UNKNOWN"];
  const isCompleted = routeStatus === "DELIVERED" || routeStatus === "FAILED" || routeStatus === "CANCELLED";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm">Loading tracking data…</p>
        </div>
      </Layout>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold">
            {error === "not_found" ? "Tracking Not Available" : "Could not load tracking"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {error === "not_found"
              ? "This delivery cannot be tracked, or you don't have access."
              : "There was a problem loading tracking data. Please try again."}
          </p>
          <div className="flex gap-3 mt-2">
            <Link href="/orders">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> My Orders
              </Button>
            </Link>
            <Button onClick={refetch} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const { courier, currentPosition, eta, recentEvents, pickupLocation, deliveryLocation } = data;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm" className={cn("gap-1.5 -ms-2", isRtl && "flex-row-reverse")}>
              <ArrowLeft className={cn("h-4 w-4", isRtl && "rotate-180")} />
              My Orders
            </Button>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            {/* Live pulse indicator */}
            {!isCompleted && (
              <div className="flex items-center gap-1.5 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 rounded-full px-3 py-1 text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={refetch} className="gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Status banner */}
        <div className={cn(
          "rounded-2xl border p-4 flex items-center gap-3",
          isCompleted
            ? routeStatus === "DELIVERED"
              ? "bg-emerald-950/20 border-emerald-800/40"
              : "bg-red-950/20 border-red-900/30"
            : "bg-card border-border"
        )}>
          <div className={cn(
            "h-11 w-11 rounded-full flex items-center justify-center shrink-0",
            isCompleted
              ? routeStatus === "DELIVERED" ? "bg-emerald-900/40" : "bg-red-900/30"
              : "bg-primary/10"
          )}>
            <StatusIcon className={cn("h-5 w-5", statusCfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-bold text-base", statusCfg.color)}>
              {isRtl ? statusCfg.labelAr : statusCfg.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Mission #{missionId}</p>
          </div>
          {/* GPS freshness badge */}
          {!isCompleted && (
            <div className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", {
              "bg-emerald-900/30 text-emerald-400 border-emerald-800/50": data.freshness === "FRESH",
              "bg-amber-900/30 text-amber-400 border-amber-800/50":   data.freshness === "WARNING",
              "bg-red-900/30 text-red-400 border-red-900/50":         data.freshness === "STALE",
              "bg-muted text-muted-foreground border-border":          data.freshness === "UNKNOWN",
            })}>
              <span className={cn("h-2 w-2 rounded-full", freshnessCfg.dot, freshnessCfg.pulse && "animate-pulse")} />
              {freshnessCfg.label}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-border bg-muted relative" style={{ height: "50vh", minHeight: 300 }}>
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          }>
            <TrackingMap
              courierLat={currentPosition?.lat ?? null}
              courierLng={currentPosition?.lng ?? null}
              pickupLat={pickupLocation.lat}
              pickupLng={pickupLocation.lng}
              pickupAddress={pickupLocation.address}
              dropoffLat={deliveryLocation.lat}
              dropoffLng={deliveryLocation.lng}
              dropoffAddress={deliveryLocation.address}
              trail={trail}
              routeGeometry={data.route?.geometry ?? null}
              routeSource={data.route?.source ?? null}
              routeStatus={routeStatus}
              className="h-full w-full"
            />
          </Suspense>
          {/* No GPS overlay */}
          {!currentPosition && !isCompleted && (
            <div className="absolute bottom-0 start-0 end-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-end gap-2 pointer-events-none">
              <Radio className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300 font-medium">
                Waiting for courier GPS signal…
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: ETA + Courier info */}
          <div className="space-y-4">

            {/* ETA card */}
            {!isCompleted && (
              <div className={cn(
                "rounded-2xl border p-4",
                eta.confidence === "UNAVAILABLE"
                  ? "bg-card border-border"
                  : "bg-emerald-950/20 border-emerald-800/40"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-semibold text-sm text-emerald-300">Estimated Arrival</h3>
                  {eta.confidence !== "UNAVAILABLE" && (
                    <span className={cn(
                      "ms-auto text-xs px-2 py-0.5 rounded-full font-medium",
                      eta.confidence === "HIGH"   && "bg-emerald-900/40 text-emerald-400",
                      eta.confidence === "MEDIUM" && "bg-sky-900/40 text-sky-400",
                      eta.confidence === "LOW"    && "bg-amber-900/40 text-amber-400",
                    )}>
                      {eta.confidence === "HIGH" ? "High accuracy" : eta.confidence === "MEDIUM" ? "Estimated" : "Approximate"}
                    </span>
                  )}
                </div>

                {eta.estimatedTravelMinutes != null ? (
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-emerald-400 tabular-nums">{eta.estimatedTravelMinutes}</span>
                    <span className="text-lg text-emerald-500 font-semibold mb-1">min</span>
                    {(data.route?.distanceKm ?? eta.distanceRemainingKm) != null && (
                      <span className="text-sm text-muted-foreground mb-1 ms-auto">
                        {data.route?.distanceKm ?? eta.distanceRemainingKm} km
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Calculating route…</p>
                )}

                {/* Route source badge */}
                {data.route?.source && (
                  <div className="mt-1 mb-1">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      data.route.source === "osrm"
                        ? "bg-emerald-900/40 text-emerald-400"
                        : "bg-amber-900/40 text-amber-400",
                    )}>
                      {data.route.source === "osrm" ? "Real road route" : "Approximate route"}
                    </span>
                  </div>
                )}

                {/* Two-leg breakdown */}
                {eta.legToPickupKm != null && eta.legToCustomerKm != null && (
                  <div className="mt-3 pt-3 border-t border-emerald-900/40 flex gap-4 text-xs text-muted-foreground">
                    <div>
                      <span className="text-amber-400 font-medium">To store:</span>{" "}
                      <span>{eta.legToPickupKm} km</span>
                      {eta.legToPickupMinutes != null && (
                        <span className="text-muted-foreground"> · {eta.legToPickupMinutes} min</span>
                      )}
                    </div>
                    <div>
                      <span className="text-blue-400 font-medium">To you:</span>{" "}
                      <span>{eta.legToCustomerKm} km</span>
                      {eta.legToCustomerMinutes != null && (
                        <span className="text-muted-foreground"> · {eta.legToCustomerMinutes} min</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Courier info */}
            {courier && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Your Courier</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center shrink-0">
                    <span className="text-emerald-400 font-bold text-lg">{courier.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-base">{courier.name}</p>
                    {courier.vehicleType && (
                      <p className="text-xs text-muted-foreground capitalize">{courier.vehicleType}</p>
                    )}
                  </div>
                  {courier.phone && (
                    <a
                      href={`tel:${courier.phone}`}
                      className="ms-auto h-9 w-9 rounded-full bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center text-emerald-400 hover:bg-emerald-900/50 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
                {currentPosition && (
                  <div className="text-xs text-muted-foreground border-t pt-2 flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", freshnessCfg.dot)} />
                    Last update: {new Date(currentPosition.recordedAt).toLocaleTimeString()}
                    {currentPosition.speed != null && currentPosition.speed > 0 && (
                      <span className="ms-auto">{Math.round(currentPosition.speed)} km/h</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Addresses */}
            <div className="rounded-2xl border bg-card p-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-900/30 border border-amber-800/50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Pickup from</p>
                  <p className="font-medium text-sm leading-snug">{pickupLocation.address}</p>
                </div>
              </div>
              <div className="ms-4 h-6 border-s-2 border-dashed border-border" />
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">Delivering to</p>
                  <p className="font-medium text-sm leading-snug">{deliveryLocation.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: event timeline */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Delivery Timeline</h3>
              {lastFetch > 0 && (
                <span className="ms-auto text-xs text-muted-foreground">
                  Updated {new Date(lastFetch).toLocaleTimeString()}
                </span>
              )}
            </div>
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
                <Clock className="h-8 w-8" />
                <p className="text-sm">No events yet</p>
              </div>
            ) : (
              <div className="space-y-0">
                {recentEvents.map((ev, i) => {
                  const label = EVENT_LABELS[ev.eventType];
                  if (!label) return null;
                  const isLatest = i === 0;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "h-3 w-3 rounded-full mt-1 shrink-0 border-2",
                          isLatest ? "bg-emerald-500 border-emerald-400" : "bg-muted-foreground/30 border-border"
                        )} />
                        {i < recentEvents.length - 1 && (
                          <div className="w-0.5 bg-border flex-1 my-1" style={{ minHeight: 20 }} />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <p className={cn("text-sm font-medium leading-snug", isLatest && "text-emerald-400")}>
                          {isRtl ? label.ar : label.en}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(ev.occurredAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
