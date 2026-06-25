/**
 * TrackingMap.tsx — Leaflet/OpenStreetMap live courier tracking map (Phase A5 + A6.8)
 *
 * A6 upgrade:
 *  - Real road polyline (emerald, weight 5, opacity 0.9) when routeGeometry provided
 *  - Falls back to straight-line dashed trail when geometry unavailable
 *  - Trail shows historical courier positions (dashes)
 *  - Route shows planned road path (solid emerald)
 */

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix Leaflet's broken default-icon URLs in bundlers ───────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Custom DivIcons ──────────────────────────────────────────────────────────
function makeDivIcon(svg: string, size = 40): L.DivIcon {
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const COURIER_ICON = makeDivIcon(`
  <div style="
    width:40px;height:40px;border-radius:50%;
    background:linear-gradient(135deg,#1f5019,#1f5019);
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(5,150,105,.6);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
      <path d="M8 17.5h6M10 5l2 4h6l-1.5 6H8L5.5 9H3"/>
    </svg>
  </div>
`, 40);

const PICKUP_ICON = makeDivIcon(`
  <div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#d97706,#b45309);
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(217,119,6,.5);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>
`, 36);

const CUSTOMER_ICON = makeDivIcon(`
  <div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#2563eb,#1d4ed8);
    border:3px solid #fff;
    box-shadow:0 2px 8px rgba(37,99,235,.5);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  </div>
`, 36);

// ── TileLoadTracker: fires onFirstLoad once all initial tiles are ready ──────
function TileLoadTracker({ onFirstLoad }: { onFirstLoad: () => void }) {
  const firedRef = useRef(false);
  useMapEvents({
    load() {
      if (!firedRef.current) {
        firedRef.current = true;
        onFirstLoad();
      }
    },
  });
  return null;
}

// ── AutoPan: pans/zooms map when courier position changes ────────────────────
function AutoPan({ center }: { center: LatLngExpression | null }) {
  const map = useMap();
  const prevRef = useRef<LatLngExpression | null>(null);

  useEffect(() => {
    if (!center) return;
    const prev = prevRef.current;
    if (
      !prev ||
      (center as [number, number])[0] !== (prev as [number, number])[0] ||
      (center as [number, number])[1] !== (prev as [number, number])[1]
    ) {
      map.panTo(center, { animate: true, duration: 1.2 });
      prevRef.current = center;
    }
  }, [center, map]);

  return null;
}

// ── AutoFit: fits all route points into view when route first loads ───────────
function AutoFit({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || positions.length < 2) return;
    try {
      map.fitBounds(positions as [number, number][], { padding: [40, 40] });
      fittedRef.current = true;
    } catch {}
  }, [positions, map]);

  return null;
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface TrackingMapProps {
  courierLat:    number | null;
  courierLng:    number | null;
  pickupLat:     number | null;
  pickupLng:     number | null;
  pickupAddress: string;
  dropoffLat:    number | null;
  dropoffLng:    number | null;
  dropoffAddress:string;
  trail:         { lat: number; lng: number }[];
  routeGeometry: [number, number][] | null;  // A6.8 — real road polyline
  routeSource?:  "osrm" | "haversine" | null;
  routeStatus?:  string;
  className?:    string;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function TrackingMap({
  courierLat, courierLng,
  pickupLat, pickupLng, pickupAddress,
  dropoffLat, dropoffLng, dropoffAddress,
  trail, routeGeometry, routeSource, routeStatus,
  className = "h-[50vh] min-h-[320px] w-full",
}: TrackingMapProps) {

  const [tilesLoaded, setTilesLoaded] = useState(false);
  const handleFirstLoad = useCallback(() => setTilesLoaded(true), []);

  /* Safety net: force shimmer away within 800 ms of mount */
  useEffect(() => {
    if (tilesLoaded) return;
    const id = setTimeout(() => setTilesLoaded(true), 800);
    return () => clearTimeout(id);
  }, [tilesLoaded]);

  const defaultCenter: LatLngExpression = useMemo(() => {
    if (courierLat != null && courierLng != null) return [courierLat, courierLng];
    if (pickupLat  != null && pickupLng  != null) return [pickupLat,  pickupLng];
    if (dropoffLat != null && dropoffLng != null) return [dropoffLat, dropoffLng];
    return [36.2021, 37.1343]; // Aleppo city centre
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const courierPos: LatLngExpression | null = courierLat != null && courierLng != null
    ? [courierLat, courierLng] : null;

  const pickupPos: LatLngExpression | null = pickupLat != null && pickupLng != null
    ? [pickupLat, pickupLng] : null;

  const dropoffPos: LatLngExpression | null = dropoffLat != null && dropoffLng != null
    ? [dropoffLat, dropoffLng] : null;

  const trailPositions: LatLngExpression[] = trail.map((p) => [p.lat, p.lng]);

  // A6.8 — road route polyline (solid emerald, weight 5)
  const roadRoutePositions: LatLngExpression[] = useMemo(
    () => (routeGeometry ?? []).map(([lat, lng]) => [lat, lng] as LatLngExpression),
    [routeGeometry],
  );

  // Points to fit in view (route > trail > markers)
  const fitPositions: LatLngExpression[] = roadRoutePositions.length >= 2
    ? roadRoutePositions
    : [
        ...(courierPos ? [courierPos] : []),
        ...(pickupPos  ? [pickupPos]  : []),
        ...(dropoffPos ? [dropoffPos] : []),
      ];

  const isCompleted = routeStatus === "DELIVERED" || routeStatus === "FAILED" || routeStatus === "CANCELLED";
  const isOSRM = routeSource === "osrm";

  return (
    <div className={className} style={{ borderRadius: "0.75rem", overflow: "hidden", position: "relative" }}>
      <MapContainer
        center={defaultCenter}
        zoom={14}
        style={{ height: "100%", width: "100%", background: "#1a1a2e" }}
        zoomControl
        attributionControl={false}
      >
        {/* OpenStreetMap — maxNativeZoom prevents gray tiles on deep zoom */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          maxNativeZoom={19}
          minZoom={3}
          keepBuffer={12}
          updateWhenZooming={false}
          updateWhenIdle={false}
        />

        {/* Fires once when all initial tiles are fully loaded */}
        <TileLoadTracker onFirstLoad={handleFirstLoad} />

        {/* Auto-fit to route on first load */}
        {fitPositions.length >= 2 && <AutoFit positions={fitPositions} />}

        {/* Auto-pan to courier */}
        {courierPos && !isCompleted && <AutoPan center={courierPos} />}

        {/* A6.8 — Real road polyline (solid emerald, weight 5, opacity 0.9) */}
        {roadRoutePositions.length >= 2 && !isCompleted && (
          <Polyline
            positions={roadRoutePositions}
            pathOptions={{
              color:   "#1f5019",
              weight:  5,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {/* Historical trail (dashed, lighter — where courier has been) */}
        {trailPositions.length > 1 && (
          <Polyline
            positions={trailPositions}
            pathOptions={{ color: "#34d399", weight: 2, opacity: 0.5, dashArray: "5 5" }}
          />
        )}

        {/* Pickup marker */}
        {pickupPos && (
          <Marker position={pickupPos} icon={PICKUP_ICON} />
        )}

        {/* Dropoff / customer marker */}
        {dropoffPos && (
          <Marker position={dropoffPos} icon={CUSTOMER_ICON} />
        )}

        {/* Courier marker — only show when active and has GPS */}
        {courierPos && !isCompleted && (
          <Marker position={courierPos} icon={COURIER_ICON} />
        )}
      </MapContainer>

      {/* ── Tile-loading shimmer overlay ─────────────────────────────────
          Visible until TileLoadTracker fires onFirstLoad (tiles ready).
          CSS opacity transition fades it out — pointer-events:none so the
          map stays interactive while loading. Keyframe defined inline. */}
      <style>{`
        @keyframes syano-map-shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 800,
          pointerEvents: "none",
          opacity: tilesLoaded ? 0 : 1,
          transition: "opacity 0.65s ease",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {/* Dark shimmer gradient — matches map's #1a1a2e base */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(120deg, #0f172a 0%, #1e293b 40%, #1f5019 50%, #1e293b 60%, #0f172a 100%)",
          backgroundSize: "300% 100%",
          animation: "syano-map-shimmer 1.8s linear infinite",
        }} />

        {/* Emerald pulsing beacon — centred */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}>
          {/* Outer ping ring */}
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid #059669",
              opacity: 0.6,
              animation: "ping 1.2s cubic-bezier(0,0,.2,1) infinite",
            }} />
            {/* Inner solid dot */}
            <div style={{
              position: "absolute",
              inset: "30%",
              borderRadius: "50%",
              background: "#059669",
              boxShadow: "0 0 12px rgba(5,150,105,0.8)",
            }} />
          </div>
          {/* Label */}
          <span style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            fontFamily: "'Cairo', sans-serif",
            letterSpacing: "0.05em",
          }}>
            جارٍ تحميل الخريطة...
          </span>
        </div>
      </div>

      {/* Map legend */}
      <div style={{
        position: "absolute",
        bottom: 8, left: 8,
        zIndex: 1000,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(8px)",
        borderRadius: "0.5rem",
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 11,
        color: "#fff",
        pointerEvents: "none",
      }}>
        {courierPos && !isCompleted && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1f5019", display: "inline-block" }} />
            Courier
          </div>
        )}
        {pickupPos && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
            {pickupAddress?.slice(0, 20) || "Pickup"}
          </div>
        )}
        {dropoffPos && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
            {dropoffAddress?.slice(0, 20) || "Delivery"}
          </div>
        )}
        {/* Route source badge */}
        {roadRoutePositions.length >= 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, opacity: 0.7 }}>
            <span style={{ width: 16, height: 2, background: "#1f5019", borderRadius: 1, display: "inline-block" }} />
            <span>{isOSRM ? "Road route" : "Approx. route"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
