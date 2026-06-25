/**
 * LocationMapModal.tsx — Hardened location picker
 *
 * Persistent mount: MapContainer is NEVER unmounted — CSS visibility toggling
 * keeps the Leaflet instance alive for instant re-opens (no tile reload).
 *
 * Layer 1: Warm earth-tone background (#e8e0d5) injected into document.head
 * Layer 2: CSS fade-in transitions on .leaflet-tile / .leaflet-layer
 * Layer 3: updateWhenZooming={false}
 * Layer 4: Dynamic keepBuffer (6 mobile / 10 desktop), updateWhenIdle={true}
 * Layer 5: Dual TileLayer crossfade — stale OSM layer stays 3 s on CartoDB switch
 * Layer 6: MapResizeObserver via ResizeObserver + invalidateSize
 *
 * AbortController: every Nominatim reverse-geocode request is aborted on rapid pan.
 * Geofence prefetch: on location confirm, 3×3 tile grid at zoom 13–16 is prefetched.
 */

import "leaflet/dist/leaflet.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Circle, MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import { X, MapPin, Loader2, Search, LocateFixed, AlertCircle, WifiOff } from "lucide-react";
import { useGetDeliveryZones } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "@/hooks/use-debounce";
import {
  ZONE_KEY, COORDS_KEY, ADDR_KEY, loadSavedCoords, loadSavedZoneId,
} from "@/lib/location-storage";
import {
  TILE_PROVIDERS,
  type TileProvider,
  injectMapHardeningCSS,
  getKeepBuffer,
  prefetchTilesAround,
  geocodeCache,
} from "@/lib/map-hardening";

/* ─────────────────────────────────────────────────────────────────── */
/* Constants                                                           */
/* ─────────────────────────────────────────────────────────────────── */
const ALEPPO: [number, number] = [36.2021047, 37.1342839];
const SYRIA_CATCHALL_ID = 999;

const SYRIA_LAT_MIN = 32.3;
const SYRIA_LAT_MAX = 37.4;
const SYRIA_LNG_MIN = 35.6;
const SYRIA_LNG_MAX = 42.4;

function isInsideSyriaBBox(lat: number, lng: number): boolean {
  return (
    lat >= SYRIA_LAT_MIN && lat <= SYRIA_LAT_MAX &&
    lng >= SYRIA_LNG_MIN && lng <= SYRIA_LNG_MAX
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ─────────────────────────────────────────────────────────────────── */
interface Zone { id: number; nameEn: string; nameAr: string; fee: number }

interface NominatimAddress {
  suburb?: string; neighbourhood?: string; city_district?: string;
  residential?: string; quarter?: string; borough?: string;
  county?: string; city?: string; town?: string; village?: string;
  state?: string; province?: string; region?: string;
  country?: string; country_code?: string;
}
interface NominatimResult {
  place_id: number; display_name: string;
  lat: string; lon: string; address?: NominatimAddress;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Part 1 — Smart Syrian Geocoding Resolver                            */
/* ─────────────────────────────────────────────────────────────────── */

function cleanStateToken(s: string): string {
  return s
    .replace(/محافظة\s*/gi, "").replace(/محافظه\s*/gi, "")
    .replace(/\s*Governorate/gi, "").replace(/\s*Province/gi, "")
    .trim();
}

function extractAddressParts(addr: NominatimAddress): string[] {
  const raw = [
    addr.state, addr.province, addr.region, addr.county,
    addr.city, addr.town, addr.village, addr.suburb,
    addr.neighbourhood, addr.quarter, addr.city_district,
    addr.residential, addr.borough,
  ].filter((s): s is string => !!s && s.trim().length > 0);

  const cleaned: string[] = [];
  for (const token of raw) {
    cleaned.push(token.trim().toLowerCase());
    const c = cleanStateToken(token).toLowerCase();
    if (c && c !== token.trim().toLowerCase()) cleaned.push(c);
  }
  return [...new Set(cleaned)];
}

function bestZoneMatch(addressParts: string[], zones: Zone[]): Zone | null {
  if (!zones.length || !addressParts.length) return null;
  let best: Zone | null = null;
  let bestScore = 0;
  for (const zone of zones) {
    if (zone.id === SYRIA_CATCHALL_ID) continue;
    const arLc = zone.nameAr.toLowerCase();
    const enLc = zone.nameEn.toLowerCase();
    let score = 0;
    for (const tok of addressParts) {
      if (!tok) continue;
      if (arLc === tok || enLc === tok) { score += 10; continue; }
      if (arLc.includes(tok) || tok.includes(arLc)) score += 5;
      if (enLc.includes(tok) || tok.includes(enLc)) score += 5;
    }
    if (score > bestScore) { bestScore = score; best = zone; }
  }
  return bestScore >= 4 ? best : null;
}

function resolveZone(parts: string[], zones: Zone[]): number | null {
  const match = bestZoneMatch(parts, zones);
  if (match) return match.id;
  const catchAll = zones.find(z => z.id === SYRIA_CATCHALL_ID);
  return catchAll ? catchAll.id : (zones[0]?.id ?? null);
}

/* ─────────────────────────────────────────────────────────────────── */
/* Inner Leaflet helpers                                               */
/* ─────────────────────────────────────────────────────────────────── */

/** Layer 6: ResizeObserver — fixes blank tiles on device rotation */
function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false } as Parameters<typeof map.invalidateSize>[0]);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/**
 * TileLoadTracker: fires onFirstLoad once Leaflet signals all initial tiles ready.
 * 80ms post-mount check handles the cached-tile race (tiles load before component
 * mounts → "load" event never fires — this catch handles that edge case).
 */
function TileLoadTracker({ onFirstLoad }: { onFirstLoad: () => void }) {
  const map = useMap();
  const firedRef = useRef(false);
  const fire = useCallback(() => {
    if (!firedRef.current) { firedRef.current = true; onFirstLoad(); }
  }, [onFirstLoad]);

  useMapEvents({ load: fire });

  useEffect(() => {
    const id = setTimeout(() => {
      if (!(map as unknown as Record<string, unknown>)["_loading"]) fire();
    }, 80);
    return () => clearTimeout(id);
  }, [map, fire]);

  return null;
}

function CenterTracker({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    move(e) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const c = e.target.getCenter();
        onMove(c.lat, c.lng);
      }, 200);
    },
  });
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return null;
}

function InvalidateSizeOnOpen() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function MapController({
  flyToTarget, onFlown,
}: { flyToTarget: [number, number] | null; onFlown: () => void }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!flyToTarget) return;
    if (prev.current &&
        prev.current[0] === flyToTarget[0] &&
        prev.current[1] === flyToTarget[1]) return;
    prev.current = flyToTarget;
    map.flyTo(flyToTarget, 15, { animate: true, duration: 1.5 });
    onFlown();
  }, [flyToTarget, map, onFlown]);
  return null;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main component                                                      */
/* ─────────────────────────────────────────────────────────────────── */
interface Props { open: boolean; onClose: () => void }

export function LocationMapModal({ open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { data: zones = [] } = useGetDeliveryZones();

  // ── Layer 1 + 2: inject hardening CSS once ───────────────────────────
  useEffect(() => { injectMapHardeningCSS(); }, []);

  // ── Layer 4: dynamic keepBuffer ──────────────────────────────────────
  const [keepBuffer, setKeepBuffer] = useState(() => getKeepBuffer());
  useEffect(() => {
    const handler = () => setKeepBuffer(getKeepBuffer());
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  // ── Layer 5: tile provider + crossfade ───────────────────────────────
  const [provider, setProvider]           = useState<TileProvider>("osm");
  const [staleProvider, setStaleProvider] = useState<TileProvider | null>(null);
  const [staleKey, setStaleKey]           = useState(0);
  const [isOffline, setIsOffline]         = useState(false);
  const errorCountRef = useRef(0);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTileError = useCallback((): void => {
    errorCountRef.current++;
    if (errorCountRef.current < 3) return;
    errorCountRef.current = 0;
    if (provider === "osm") {
      setStaleProvider("osm");
      setStaleKey((k) => k + 1);
      setProvider("carto");
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => setStaleProvider(null), 3000);
    } else {
      setIsOffline(true);
    }
  }, [provider]);

  useEffect(() => () => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (accuracyWarnTimer.current) clearTimeout(accuracyWarnTimer.current);
  }, []);

  /* Map state */
  const [center, setCenter]           = useState<[number, number]>(ALEPPO);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const handleFirstLoad = useCallback(() => setTilesLoaded(true), []);

  /* Zone / confirm state */
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [autoMatching, setAutoMatching]     = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [isOutsideSyria, setIsOutsideSyria] = useState(false);

  /* Geolocation state */
  type GeoStatus = "idle" | "loading" | "success" | "denied";
  const [geoStatus, setGeoStatus]                  = useState<GeoStatus>("idle");
  const [gpsAccuracy, setGpsAccuracy]              = useState<number | null>(null);
  const [gpsPosition, setGpsPosition]              = useState<[number, number] | null>(null);
  const [showAccuracyWarning, setShowAccuracyWarning] = useState(false);
  const accuracyWarnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Search state */
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchResults, setSearchResults]   = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchOpen, setSearchOpen]         = useState(false);
  const searchRef                           = useRef<HTMLDivElement>(null);
  const debouncedQuery                      = useDebounce(searchQuery, 500);
  const debouncedCenter                     = useDebounce(center, 300);

  /* AbortController ref for Nominatim reverse geocoding */
  const geocodeAbortRef = useRef<AbortController | null>(null);

  /* Reset on open — fly to saved position without remounting the map */
  useEffect(() => {
    if (!open) return;
    const saved = loadSavedCoords();
    const isSafeCoord = (c: { lat: number; lng: number } | null): c is { lat: number; lng: number } =>
      c != null && Math.abs(c.lat) > 0.001 && Math.abs(c.lng) > 0.001;
    const initialCenter: [number, number] = isSafeCoord(saved)
      ? [saved.lat, saved.lng]
      : ALEPPO;
    setCenter(initialCenter);
    setSelectedZoneId(loadSavedZoneId());
    setResolvedAddress("");
    setIsOutsideSyria(false);
    /*
      IMPORTANT: set flyToTarget instead of null — MapController.flyTo() handles
      navigation smoothly via Leaflet API without triggering a remount.
      Previously setMapKey incremented here, causing a double-mount (gray tiles bug).
    */
    setFlyToTarget(initialCenter);
    setSaving(false);
    setGeoStatus("idle");
    setGpsPosition(null);
    setGpsAccuracy(null);
    setShowAccuracyWarning(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    /* Reset shimmer so it shows fresh on every open */
    setTilesLoaded(false);
  }, [open]);

  /* Safety net: force shimmer away after 800 ms */
  useEffect(() => {
    if (!open || tilesLoaded) return;
    const id = setTimeout(() => setTilesLoaded(true), 800);
    return () => clearTimeout(id);
  }, [open, tilesLoaded]);

  /* Auto-geolocation on open */
  useEffect(() => {
    if (!open) return;
    if (!("geolocation" in navigator)) return;
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const target: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setFlyToTarget(target);
        setCenter(target);
        setGeoStatus("success");
        setGpsPosition(target);
        setGpsAccuracy(pos.coords.accuracy);
        if (pos.coords.accuracy > 100) {
          setShowAccuracyWarning(true);
          if (accuracyWarnTimer.current) clearTimeout(accuracyWarnTimer.current);
          accuracyWarnTimer.current = setTimeout(() => setShowAccuracyWarning(false), 4000);
        }
      },
      () => setGeoStatus("denied"),
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }, [open]);

  /* ESC key */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* Search outside-click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* Nominatim forward search (Syria-wide, debounced) */
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    const url = [
      "https://nominatim.openstreetmap.org/search",
      `?q=${encodeURIComponent(q)}`,
      `&format=json&countrycodes=sy&limit=6`,
      `&accept-language=${isRtl ? "ar,en" : "en,ar"}`,
      `&addressdetails=1`,
    ].join("");
    fetch(url, { headers: { "Accept-Language": isRtl ? "ar,en" : "en,ar" } })
      .then(r => r.json())
      .then((data: NominatimResult[]) => {
        setSearchResults(Array.isArray(data) ? data.slice(0, 6) : []);
        setSearchOpen(true);
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery, isRtl]);

  /* Part 1 + Geofencing — reverse geocode with AbortController + strict Syria validation */
  useEffect(() => {
    if (!zones.length) return;
    const [lat, lng] = debouncedCenter;

    /* ① Fast bounding-box pre-check — reject immediately if clearly outside */
    if (!isInsideSyriaBBox(lat, lng)) {
      setIsOutsideSyria(true);
      setSelectedZoneId(null);
      setResolvedAddress("");
      setAutoMatching(false);
      return;
    }

    /* ② Local geocode cache — 3 dp ≈ 111 m resolution, 30-min TTL */
    const cached = geocodeCache.get(lat, lng);
    if (cached) {
      setIsOutsideSyria(cached.isOutsideSyria);
      setSelectedZoneId(cached.zoneId);
      setResolvedAddress(cached.address);
      setAutoMatching(false);
      return;
    }

    /* Abort any in-flight request from a previous pan */
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    setAutoMatching(true);
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar,en&zoom=16`,
      { signal: controller.signal, headers: { "Accept-Language": "ar,en" } },
    )
      .then(r => r.json())
      .then((data: { address?: NominatimAddress; display_name?: string }) => {
        const addr = data.address;

        /* ③ Strict country_code check */
        const countryCode = addr?.country_code?.toLowerCase() ?? "";
        const countryName = addr?.country?.toLowerCase() ?? "";
        const isSyria =
          countryCode === "sy" ||
          countryName.includes("syria")  ||
          countryName.includes("سوريا") ||
          countryName.includes("سورية");

        if (!isSyria) {
          setIsOutsideSyria(true);
          setSelectedZoneId(null);
          setResolvedAddress("");
          geocodeCache.set(lat, lng, { zoneId: null, address: "", isOutsideSyria: true });
          return;
        }

        /* ④ Inside Syria — resolve governorate zone */
        setIsOutsideSyria(false);
        const parts = addr ? extractAddressParts(addr) : [];
        const zoneId = resolveZone(parts, zones);
        setSelectedZoneId(zoneId);

        let resolvedAddr = "";
        if (addr) {
          const shortParts = [
            addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district,
            cleanStateToken(addr.state || addr.city || addr.county || ""),
          ].filter(Boolean);
          resolvedAddr = shortParts.join("، ") || (data.display_name?.split(",")[0] ?? "");
        } else {
          resolvedAddr = data.display_name?.split(",")[0] ?? "";
        }
        setResolvedAddress(resolvedAddr);
        geocodeCache.set(lat, lng, { zoneId, address: resolvedAddr, isOutsideSyria: false });
      })
      .catch(err => {
        /* Ignore AbortError — it's intentional (rapid pan); keep previous state */
        if ((err as Error).name !== "AbortError") {
          /* Network error — keep previous zone/address state */
        }
      })
      .finally(() => setAutoMatching(false));

    return () => {
      controller.abort();
      setAutoMatching(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCenter, zones]);

  /* Cleanup abort controller on unmount */
  useEffect(() => () => { geocodeAbortRef.current?.abort(); }, []);

  /* Confirm handler — saves location + fires geofence tile prefetch */
  const handleConfirm = useCallback(() => {
    setSaving(true);
    try {
      localStorage.setItem(ZONE_KEY, JSON.stringify(selectedZoneId));
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat: center[0], lng: center[1] }));
      try {
        const existing = JSON.parse(localStorage.getItem(ADDR_KEY) || "{}");
        localStorage.setItem(ADDR_KEY, JSON.stringify({
          ...existing,
          zoneId: selectedZoneId,
          lat:    center[0],
          lng:    center[1],
          address: resolvedAddress,
        }));
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("syano:location-updated", {
        detail: { zoneId: selectedZoneId, lat: center[0], lng: center[1] },
      }));

      /* OPT-3: prefetch tile grid around confirmed location (non-blocking) */
      prefetchTilesAround(center[0], center[1]);

      onClose();
    } finally { setSaving(false); }
  }, [selectedZoneId, center, resolvedAddress, onClose]);

  /* Search result selection */
  const handleSelectResult = useCallback((result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (isNaN(lat) || isNaN(lng)) return;
    setFlyToTarget([lat, lng]);
    setCenter([lat, lng]);
    const addr = result.address;
    setSearchQuery(
      addr
        ? (addr.suburb || addr.neighbourhood || addr.quarter || result.display_name.split(",")[0])
        : result.display_name.split(",")[0],
    );
    setSearchResults([]);
    setSearchOpen(false);
  }, []);

  const handleMapMove = useCallback((lat: number, lng: number) => {
    setCenter([lat, lng]);
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const target: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setFlyToTarget(target);
        setCenter(target);
        setGeoStatus("success");
        setGpsPosition(target);
        setGpsAccuracy(pos.coords.accuracy);
        if (pos.coords.accuracy > 100) {
          setShowAccuracyWarning(true);
          if (accuracyWarnTimer.current) clearTimeout(accuracyWarnTimer.current);
          accuracyWarnTimer.current = setTimeout(() => setShowAccuracyWarning(false), 4000);
        }
      },
      () => setGeoStatus("denied"),
      { timeout: 8000, enableHighAccuracy: false },
    );
  }, []);

  /* Derived */
  const selectedZone    = zones.find(z => z.id === selectedZoneId) ?? null;
  const footerAddressLine = resolvedAddress
    || (selectedZone ? (isRtl ? selectedZone.nameAr : selectedZone.nameEn) : "");

  /* ── Part 2 — Noon-Style Floating Modal UI ─────────────────────── */
  const modal = (
    <div
      role={open ? "dialog" : undefined}
      aria-modal={open || undefined}
      aria-label={isRtl ? "تحديد موقعك" : "Select your location"}
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        open ? 9999 : -1,
        /* visibility:hidden preserves layout dimensions so Leaflet keeps
           tiles in memory — subsequent opens are instant (no tile reload) */
        visibility:    open ? "visible" : "hidden",
        opacity:       open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition:    "opacity 0.2s ease",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog shell */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div
          className="pointer-events-auto relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxWidth: "900px", height: "min(90vh, 680px)" }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Floating close button ─────────────────────────────── */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 z-[1100] h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            aria-label={isRtl ? "إغلاق" : "Close"}
          >
            <X className="h-4 w-4" />
          </button>

          {/* ── Map section ────────────────────────────────────────── */}
          <div className="relative flex-1 min-h-0">
            <MapContainer
              center={center}
              zoom={15}
              style={{ height: "100%", width: "100%", position: "absolute", inset: 0, zIndex: 0, background: "#e8e0d5" }}
              zoomControl={false}
              attributionControl={false}
              scrollWheelZoom={true}
              trackResize={true}
            >
              {/* Layer 5 — Stale TileLayer: stays 3 s during provider switch */}
              {staleProvider && (
                <TileLayer
                  key={`stale-${staleKey}`}
                  url={TILE_PROVIDERS[staleProvider]}
                  zIndex={1}
                  maxZoom={19}
                  maxNativeZoom={19}
                />
              )}

              {/* Layers 3 & 4 — Active TileLayer with dynamic keepBuffer */}
              <TileLayer
                key={provider}
                url={TILE_PROVIDERS[provider]}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                zIndex={2}
                maxZoom={19}
                maxNativeZoom={19}
                minZoom={3}
                keepBuffer={keepBuffer}
                updateWhenZooming={false}
                updateWhenIdle={true}
                eventHandlers={{ tileerror: handleTileError }}
              />

              <TileLoadTracker onFirstLoad={handleFirstLoad} />
              {/* Layer 6 */}
              <MapResizeObserver />
              <InvalidateSizeOnOpen />
              <CenterTracker onMove={handleMapMove} />
              <MapController flyToTarget={flyToTarget} onFlown={() => setFlyToTarget(null)} />

              {/* GPS accuracy ring — blue semi-transparent circle, radius = accuracy in metres */}
              {gpsPosition && gpsAccuracy !== null && (
                <Circle
                  center={gpsPosition}
                  radius={gpsAccuracy}
                  pathOptions={{ color: "#3b82f6", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.12 }}
                />
              )}
            </MapContainer>

            {/* ── GPS weak signal toast (auto-dismiss after 4 s) ───────── */}
            {showAccuracyWarning && (
              <div
                aria-live="polite"
                style={{
                  position:      "absolute",
                  top:           72,
                  left:          "50%",
                  transform:     "translateX(-50%)",
                  zIndex:        1001,
                  display:       "flex",
                  alignItems:    "center",
                  gap:           8,
                  background:    "rgba(234,179,8,0.96)",
                  backdropFilter:"blur(8px)",
                  color:         "#1c1917",
                  padding:       "8px 14px",
                  borderRadius:  "0.75rem",
                  fontSize:      12,
                  fontFamily:    "'Cairo', sans-serif",
                  fontWeight:    600,
                  boxShadow:     "0 4px 20px rgba(0,0,0,0.25)",
                  whiteSpace:    "nowrap",
                  pointerEvents: "none",
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                {isRtl
                  ? `إشارة GPS ضعيفة (±${Math.round(gpsAccuracy ?? 0)} م) — اضبط الدبوس يدوياً`
                  : `Weak GPS (±${Math.round(gpsAccuracy ?? 0)} m) — adjust pin manually`}
              </div>
            )}

            {/* ── Offline overlay ───────────────────────────────────── */}
            {isOffline && (
              <div style={{
                position:       "absolute",
                inset:          0,
                zIndex:         900,
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            12,
                background:     "rgba(248,250,252,0.95)",
                backdropFilter: "blur(4px)",
              }}>
                <WifiOff style={{ width: 36, height: 36, color: "#94a3b8" }} />
                <p style={{
                  color: "#475569", fontSize: 14,
                  fontFamily: "'Cairo', sans-serif", fontWeight: 600,
                }}>
                  {isRtl ? "الخريطة غير متاحة — تحقق من الاتصال" : "Map unavailable — check your connection"}
                </p>
              </div>
            )}

            {/* ── Frosted-glass tile-loading shimmer ─────────────────── */}
            <style>{`
              @keyframes syano-modal-shimmer {
                0%   { background-position: 200% center; }
                100% { background-position: -200% center; }
              }
            `}</style>
            <div
              aria-hidden="true"
              style={{
                position:      "absolute",
                inset:         0,
                zIndex:        500,
                pointerEvents: "none",
                opacity:       tilesLoaded ? 0 : 1,
                transition:    "opacity 0.6s ease",
                borderRadius:  "inherit",
                overflow:      "hidden",
              }}
            >
              <div style={{
                position:       "absolute",
                inset:          0,
                background:     "linear-gradient(120deg,#f8fafc 0%,#e2e8f0 40%,#d1fae5 50%,#e2e8f0 60%,#f8fafc 100%)",
                backgroundSize: "300% 100%",
                animation:      "syano-modal-shimmer 1.8s linear infinite",
              }} />

              <div style={{
                position:       "absolute",
                inset:          0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexDirection:  "column",
                gap:            14,
              }}>
                <div style={{ position: "relative", width: 52, height: 52 }}>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: "2px solid #059669", opacity: 0.5,
                    animation: "ping 1.2s cubic-bezier(0,0,.2,1) infinite",
                  }} />
                  <div style={{
                    position: "absolute", inset: "20%", borderRadius: "50%",
                    border: "1.5px solid #059669", opacity: 0.3,
                  }} />
                  <div style={{
                    position: "absolute", inset: "35%", borderRadius: "50%",
                    background: "#059669", boxShadow: "0 0 16px rgba(5,150,105,0.5)",
                  }} />
                </div>
                <span style={{
                  color: "#64748b", fontSize: 12,
                  fontFamily: "'Cairo', sans-serif", letterSpacing: "0.04em",
                }}>
                  {isRtl ? "جارٍ تحميل الخريطة..." : "Loading map..."}
                </span>
              </div>
            </div>

            {/* ── Floating top control row ────────────────────────────── */}
            <div className="absolute top-4 start-4 end-14 z-[1000] flex items-center gap-3">
              {/* Geolocate button */}
              <button
                type="button"
                onClick={handleGeolocate}
                disabled={geoStatus === "loading"}
                className={`shrink-0 flex items-center gap-1.5 h-11 ps-3 pe-4 rounded-xl border shadow-lg font-semibold text-sm transition-all whitespace-nowrap ${
                  geoStatus === "denied"
                    ? "bg-white border-red-200 text-red-500"
                    : geoStatus === "success"
                    ? "bg-white border-emerald-200 text-emerald-600"
                    : "bg-white border-gray-200 text-emerald-600 hover:border-emerald-300 hover:shadow-emerald-100"
                }`}
              >
                {geoStatus === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                ) : geoStatus === "denied" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{t("map.locate_me")}</span>
              </button>

              {/* Address search input */}
              <div ref={searchRef} className="flex-1 relative">
                <div className={`relative rounded-xl shadow-lg border transition-all bg-white ${
                  searchOpen && searchResults.length > 0
                    ? "border-emerald-400 rounded-b-none"
                    : "border-gray-200"
                }`}>
                  {searchLoading ? (
                    <Loader2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 animate-spin pointer-events-none" />
                  ) : (
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  )}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Escape") {
                        setSearchQuery("");
                        setSearchResults([]);
                        setSearchOpen(false);
                      }
                    }}
                    placeholder={isRtl
                      ? "ابحث عن موقعك، الحي، أو المبنى..."
                      : "Search your area, district, or building..."}
                    className="w-full h-11 ps-9 pe-3 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    style={{ fontFamily: "'Cairo', sans-serif" }}
                    dir={isRtl ? "rtl" : "ltr"}
                  />
                </div>

                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full start-0 end-0 bg-white border border-t-0 border-emerald-400 rounded-b-xl shadow-xl max-h-52 overflow-y-auto z-[1001]">
                    {searchResults.map(r => (
                      <button
                        key={r.place_id}
                        type="button"
                        onClick={() => handleSelectResult(r)}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-emerald-50 transition-colors text-start border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-gray-700 leading-snug line-clamp-2">
                          {r.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Custom Center Pin ───────────────────────────────────── */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 400 }}
            >
              <div className="flex flex-col items-center" style={{ transform: "translateY(-50%)" }}>
                <div
                  className="mb-2 px-3 py-1.5 rounded-full shadow-xl text-white text-xs font-bold whitespace-nowrap"
                  style={{ background: "#0a0a0a", fontFamily: "'Cairo', sans-serif", letterSpacing: "0.01em" }}
                >
                  {t("map.deliver_here")}
                </div>

                <div className="relative">
                  <svg
                    viewBox="0 0 24 24" width={52} height={52} fill="#059669"
                    style={{ display: "block", filter: "drop-shadow(0 4px 14px rgba(5,150,105,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.30))" }}
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                    <circle cx="12" cy="9" r="3" fill="white" />
                  </svg>
                  <div style={{
                    position: "absolute", bottom: -4,
                    insetInlineStart: "50%", transform: "translateX(-50%)",
                    width: 22, height: 7, borderRadius: "50%",
                    background: "radial-gradient(ellipse,rgba(5,150,105,0.30) 0%,transparent 70%)",
                  }} />
                </div>
              </div>
            </div>

            {/* Zone-matching readout */}
            {autoMatching && (
              <div
                className="absolute bottom-3 start-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-gray-200 shadow-sm"
                style={{ zIndex: 400 }}
              >
                <Loader2 className="h-3 w-3 animate-spin text-emerald-500 shrink-0" />
                <p className="text-[10px] text-gray-500">
                  {isRtl ? "جارٍ التعرف على المنطقة..." : "Resolving zone..."}
                </p>
              </div>
            )}

            {/* Provider badge */}
            {provider === "carto" && !isOffline && (
              <div
                className="absolute bottom-3 end-3 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-md px-2 py-1 border border-amber-200 shadow-sm"
                style={{ zIndex: 400 }}
              >
                <span className="text-[9px] text-amber-600 font-medium">fallback: CartoDB</span>
              </div>
            )}
          </div>

          {/* ── Part 3 — Sticky White Footer ───────────────────────────── */}
          <div className={`shrink-0 border-t px-5 py-4 flex items-center justify-between gap-4 transition-colors ${
            isOutsideSyria ? "bg-red-50 border-red-100" : "bg-white border-gray-100"
          }`}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isOutsideSyria ? "bg-red-100" : "bg-emerald-50"
              }`}>
                <MapPin className={`h-5 w-5 transition-colors ${
                  isOutsideSyria ? "text-red-500" : "text-emerald-600"
                }`} />
              </div>
              <div className="min-w-0">
                {isOutsideSyria ? (
                  <>
                    <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wide leading-none mb-0.5">
                      {isRtl ? "موقع غير مدعوم" : "Unsupported Location"}
                    </p>
                    <p className="text-sm font-semibold text-red-600 leading-snug" style={{ fontFamily: "'Cairo', sans-serif" }}>
                      {isRtl
                        ? "عذراً، التوصيل مدعوم فقط داخل الأراضي السورية حالياً"
                        : "Delivery is only available inside Syria"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">
                      {t("map.current_address_label")}
                    </p>
                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">
                      {footerAddressLine || t("map.locating_placeholder")}
                    </p>
                    {selectedZone && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {isRtl ? selectedZone.nameAr : selectedZone.nameEn}
                        {" · "}
                        {selectedZone.fee} {isRtl ? "ل.س" : "SYP"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !selectedZoneId || isOutsideSyria}
              className={`shrink-0 h-11 px-6 flex items-center justify-center gap-2 rounded-xl font-bold text-[15px] transition-all cursor-pointer ${
                isOutsideSyria
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isRtl ? "تأكيد الموقع" : "Confirm Location"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  /*
   * Always render via createPortal — never return null.
   * The CSS visibility/opacity/pointer-events controls visibility.
   * The Leaflet instance stays alive across open/close cycles,
   * making subsequent opens instant (tiles already in memory).
   */
  return createPortal(modal, document.body);
}
