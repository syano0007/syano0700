/**
 * /admin/routing — OSRM Routing Engine Diagnostics (Phase A6.12)
 *
 * Admin-only tool to:
 *  - Test routes between any two or three coordinates
 *  - View OSRM response time + cache stats
 *  - Preview the road route on a Leaflet map
 */

import { useState, useRef, lazy, Suspense } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  MapPin, Zap, Clock, AlertCircle, CheckCircle2,
  Navigation, RefreshCw, Route, Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TrackingMap = lazy(() => import("@/components/TrackingMap"));

interface RouteResult {
  success: boolean;
  responseMs: number;
  fallback: boolean;
  route: {
    distanceKm:      number;
    durationMinutes: number;
    distanceMeters:  number;
    durationSeconds: number;
    geometryPoints:  number;
    geometry:        [number, number][];
    source:          string;
    legs?: { distanceMeters: number; durationSeconds: number }[];
  } | null;
  cache: {
    size: number;
    entries: { missionId: number; ageMs: number; source: string }[];
  };
}

// Default Aleppo test coordinates
const ALEPPO_PRESETS = [
  { label: "Aleppo Old City → University", latA: 36.1987, lngA: 37.1590, latB: 36.2190, lngB: 37.1351 },
  { label: "Aleppo Central → Aziziyah",   latA: 36.2021, lngA: 37.1343, latB: 36.1893, lngB: 37.1491 },
  { label: "Suleimaniyah → Midan",         latA: 36.2068, lngA: 37.1255, latB: 36.1845, lngB: 37.1432 },
];

export default function AdminRoutingPage() {
  const { token } = useAuth();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  const [latA, setLatA] = useState("36.2021");
  const [lngA, setLngA] = useState("37.1343");
  const [latB, setLatB] = useState("36.1987");
  const [lngB, setLngB] = useState("37.1590");
  const [latC, setLatC] = useState("");
  const [lngC, setLngC] = useState("");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [osrmStatus, setOsrmStatus] = useState<{ reachable: boolean; responseMs: number } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const mapKey = useRef(0);

  const calculate = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    mapKey.current++;

    try {
      const body: Record<string, string> = { latA, lngA, latB, lngB };
      if (latC && lngC) { body.latC = latC; body.lngC = lngC; }

      const res = await fetch("/api/admin/routing/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/routing/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOsrmStatus(data.osrm);
    } catch {
      setOsrmStatus({ reachable: false, responseMs: -1 });
    } finally {
      setStatusLoading(false);
    }
  };

  const applyPreset = (p: typeof ALEPPO_PRESETS[0]) => {
    setLatA(String(p.latA));
    setLngA(String(p.lngA));
    setLatB(String(p.latB));
    setLngB(String(p.lngB));
    setLatC(""); setLngC("");
  };

  const pA = { lat: parseFloat(latA), lng: parseFloat(lngA) };
  const pB = { lat: parseFloat(latB), lng: parseFloat(lngB) };
  const pC = latC && lngC ? { lat: parseFloat(latC), lng: parseFloat(lngC) } : null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Route className="h-6 w-6 text-primary" />
              Routing Engine Diagnostics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              OSRM real-road routing — test routes, verify geometry, inspect cache
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={statusLoading}
            className="gap-2"
          >
            {statusLoading
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />}
            Check OSRM
          </Button>
        </div>

        {/* OSRM status banner */}
        {osrmStatus && (
          <div className={cn(
            "rounded-xl border p-3 flex items-center gap-3 text-sm",
            osrmStatus.reachable
              ? "bg-primary/10/20 border-primary/20/40 text-primary"
              : "bg-red-950/20 border-red-900/40 text-red-400",
          )}>
            {osrmStatus.reachable
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>
              OSRM {osrmStatus.reachable ? "reachable" : "unreachable"}{" "}
              — {osrmStatus.responseMs} ms
            </span>
            <span className="ms-auto text-xs opacity-60">router.project-osrm.org</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input form */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Route Inputs
              </h2>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {ALEPPO_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Point A */}
              <div>
                <label className="text-xs text-amber-400 font-semibold flex items-center gap-1 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> Point A (start)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={latA} onChange={(e) => setLatA(e.target.value)}
                    placeholder="Latitude"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    value={lngA} onChange={(e) => setLngA(e.target.value)}
                    placeholder="Longitude"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Point B */}
              <div>
                <label className="text-xs text-primary font-semibold flex items-center gap-1 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" /> Point B (end / waypoint)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={latB} onChange={(e) => setLatB(e.target.value)}
                    placeholder="Latitude"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    value={lngB} onChange={(e) => setLngB(e.target.value)}
                    placeholder="Longitude"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Point C (optional) */}
              <div>
                <label className="text-xs text-blue-400 font-semibold flex items-center gap-1 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" /> Point C (optional — 3-leg route)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={latC} onChange={(e) => setLatC(e.target.value)}
                    placeholder="Latitude (optional)"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    value={lngC} onChange={(e) => setLngC(e.target.value)}
                    placeholder="Longitude (optional)"
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <Button
                onClick={calculate}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/80 text-white gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                {loading ? "Calculating…" : "Calculate Route"}
              </Button>

              {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </p>
              )}
            </div>

            {/* Results */}
            {result && (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Route Result
                </h2>

                {result.route ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-primary/10/20 border border-primary/20/40 p-3 text-center">
                        <p className="text-2xl font-black text-primary">{result.route.distanceKm}</p>
                        <p className="text-xs text-primary mt-0.5">km distance</p>
                      </div>
                      <div className="rounded-xl bg-primary/10/20 border border-primary/20/40 p-3 text-center">
                        <p className="text-2xl font-black text-primary">{result.route.durationMinutes}</p>
                        <p className="text-xs text-primary mt-0.5">min ETA</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {result.route.geometryPoints} geometry points
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {result.responseMs} ms OSRM response
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        Source: <span className={result.route.source === "osrm" ? "text-primary" : "text-amber-400"}>
                          {result.route.source}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 shrink-0" />
                        Cache: {result.cache.size} entries
                      </div>
                    </div>

                    {result.route.legs && result.route.legs.length > 1 && (
                      <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground mb-2">Per-leg breakdown:</p>
                        {result.route.legs.map((leg, i) => (
                          <div key={i} className="flex justify-between">
                            <span>Leg {i + 1}</span>
                            <span>
                              {Math.round((leg.distanceMeters / 1000) * 100) / 100} km ·{" "}
                              {Math.max(1, Math.round(leg.durationSeconds / 60))} min
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    OSRM unavailable — fallback mode active
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Map preview */}
          <div className="rounded-2xl overflow-hidden border border-border" style={{ minHeight: 420, position: "relative" }}>
            {result?.route?.geometry ? (
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              }>
                <TrackingMap
                  key={mapKey.current}
                  courierLat={pA.lat}
                  courierLng={pA.lng}
                  pickupLat={pB.lat}
                  pickupLng={pB.lng}
                  pickupAddress="Point B"
                  dropoffLat={pC?.lat ?? null}
                  dropoffLng={pC?.lng ?? null}
                  dropoffAddress={pC ? "Point C" : ""}
                  trail={[]}
                  routeGeometry={result.route.geometry}
                  routeSource={(result.route.source as "osrm" | "haversine") ?? null}
                  routeStatus="GOING_TO_PICKUP"
                  className="h-full w-full"
                />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <MapPin className="h-10 w-10 opacity-30" />
                <p className="text-sm">Calculate a route to see the map preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
