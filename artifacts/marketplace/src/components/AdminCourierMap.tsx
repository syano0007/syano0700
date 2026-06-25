/**
 * AdminCourierMap — clustered live-location map for the admin courier dashboard.
 *
 * Uses react-leaflet-cluster (MarkerClusterGroup) so that hundreds of courier
 * pins collapse into numbered clusters at low zoom, and expand cleanly at high zoom.
 *
 * Marker colour coding:
 *   Green   (primary)  → ONLINE + fresh GPS
 *   Amber              → BUSY  (or ONLINE + stale GPS)
 *   Gray               → OFFLINE or no GPS
 *
 * Tile stack: OSM primary → CartoDB fallback (same as LocationMapModal).
 * All markers are inline SVG DivIcons — zero external image dependencies.
 */

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import {
  injectMapHardeningCSS,
  getKeepBuffer,
  TILE_PROVIDERS,
} from "@/lib/map-hardening";

// ── Types (subset of LiveCourierRow used here) ───────────────────────────────

export interface CourierPin {
  courierId:          number;
  name:               string;
  phone:              string;
  vehicleType:        string;
  availabilityStatus: "ONLINE" | "OFFLINE" | "BUSY";
  lat:                number;
  lng:                number;
  isFresh:            boolean;
  ageSeconds:         number | null;
  accuracy:           number | null;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const ALEPPO: [number, number] = [36.2021, 37.1343];

// ── Marker factory ────────────────────────────────────────────────────────────

type PinVariant = "online" | "busy" | "offline";

const PIN_COLOR: Record<PinVariant, string> = {
  online:  "#22c55e",
  busy:    "#f59e0b",
  offline: "#6b7280",
};

function pinVariant(courier: CourierPin): PinVariant {
  if (courier.availabilityStatus === "OFFLINE") return "offline";
  if (courier.availabilityStatus === "BUSY")    return "busy";
  return courier.isFresh ? "online" : "busy";
}

function makeDivIcon(variant: PinVariant): L.DivIcon {
  const color = PIN_COLOR[variant];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38">
      <filter id="sd" x="-30%" y="-10%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)" />
      </filter>
      <path
        d="M14 1C8.477 1 4 5.477 4 11c0 7.2 10 25 10 25s10-17.8 10-25C24 5.477 19.523 1 14 1z"
        fill="${color}" filter="url(#sd)" stroke="#fff" stroke-width="1.5"
      />
      <circle cx="14" cy="11" r="4.5" fill="#fff" opacity="0.9" />
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [28, 38],
    iconAnchor: [14, 38],
    popupAnchor:[0, -36],
  });
}

// Pre-build the three icons (avoids recreating on every render)
const ICONS: Record<PinVariant, L.DivIcon> = {
  online:  makeDivIcon("online"),
  busy:    makeDivIcon("busy"),
  offline: makeDivIcon("offline"),
};

// ── MapInit hook ─────────────────────────────────────────────────────────────

function MapInit() {
  useEffect(() => { injectMapHardeningCSS(); }, []);
  return null;
}

// ── Popup content ─────────────────────────────────────────────────────────────

const VEHICLE_EMOJI: Record<string, string> = {
  motorcycle: "🏍",
  car:        "🚗",
  bicycle:    "🚲",
  van:        "🚐",
};

function CourierPopup({ c, isRtl }: { c: CourierPin; isRtl: boolean }) {
  const ageLabel = c.ageSeconds == null
    ? (isRtl ? "—" : "—")
    : c.ageSeconds < 60
      ? (isRtl ? `${c.ageSeconds} ث` : `${c.ageSeconds}s`)
      : (isRtl ? `${Math.floor(c.ageSeconds / 60)} د` : `${Math.floor(c.ageSeconds / 60)}m`);

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", minWidth: 170, lineHeight: 1.5 }}>
      <p style={{ fontWeight: 700, marginBottom: 2 }}>
        {VEHICLE_EMOJI[c.vehicleType] ?? "🚴"} {c.name}
      </p>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{c.phone}</p>
      {c.accuracy != null && (
        <p style={{ fontSize: 11, color: "#3b82f6" }}>
          {isRtl ? `دقة: ±${c.accuracy.toFixed(0)} م` : `Accuracy: ±${c.accuracy.toFixed(0)} m`}
        </p>
      )}
      <p style={{ fontSize: 11, color: c.isFresh ? "#22c55e" : "#f59e0b" }}>
        {c.isFresh
          ? (isRtl ? "موقع حديث" : "Fresh location")
          : (isRtl ? `قديم (${ageLabel})` : `Stale (${ageLabel})`)}
      </p>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface AdminCourierMapProps {
  couriers: CourierPin[];
  isRtl:    boolean;
}

export default function AdminCourierMap({ couriers, isRtl }: AdminCourierMapProps) {
  const keepBuffer = getKeepBuffer();

  const pinsWithLocation = couriers.filter(c => c.lat != null && c.lng != null);

  const mapCenter: [number, number] = pinsWithLocation.length > 0
    ? [
        pinsWithLocation.reduce((s, c) => s + c.lat, 0) / pinsWithLocation.length,
        pinsWithLocation.reduce((s, c) => s + c.lng, 0) / pinsWithLocation.length,
      ]
    : ALEPPO;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden" }}>
      <MapContainer
        center={mapCenter}
        zoom={11}
        style={{ height: "100%", width: "100%", background: "#e8e0d5" }}
        zoomControl={true}
        attributionControl={false}
        scrollWheelZoom={true}
        trackResize={true}
      >
        <MapInit />

        <TileLayer
          url={TILE_PROVIDERS.osm}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
          maxNativeZoom={19}
          minZoom={3}
          keepBuffer={keepBuffer}
          updateWhenZooming={false}
          updateWhenIdle={true}
        />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={60}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={true}
          zoomToBoundsOnClick={true}
        >
          {pinsWithLocation.map(c => (
            <Marker
              key={c.courierId}
              position={[c.lat, c.lng]}
              icon={ICONS[pinVariant(c)]}
            >
              <Popup>
                <CourierPopup c={c} isRtl={isRtl} />
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Legend */}
      <div style={{
        position:      "absolute",
        bottom:        12,
        insetInlineEnd: 12,
        zIndex:        800,
        background:    "rgba(18,18,21,0.88)",
        backdropFilter:"blur(8px)",
        border:        "1px solid rgba(255,255,255,0.08)",
        borderRadius:  "0.75rem",
        padding:       "8px 12px",
        display:       "flex",
        flexDirection: "column",
        gap:           5,
      }}>
        {(["online", "busy", "offline"] as PinVariant[]).map(v => (
          <div key={v} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#e2e8f0", fontFamily: "'Cairo', sans-serif" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: PIN_COLOR[v], flexShrink: 0 }} />
            {isRtl
              ? v === "online" ? "متاح / حديث" : v === "busy" ? "مشغول / قديم" : "غير متاح"
              : v === "online" ? "Online / fresh" : v === "busy" ? "Busy / stale" : "Offline"}
          </div>
        ))}
      </div>

      {pinsWithLocation.length === 0 && (
        <div style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          zIndex:         900,
          background:     "rgba(18,18,21,0.7)",
          color:          "#94a3b8",
          fontFamily:     "'Cairo', sans-serif",
          gap:            8,
        }}>
          <span style={{ fontSize: 32 }}>📍</span>
          <p style={{ fontSize: 14 }}>
            {isRtl ? "لا يوجد مندوبون بموقع محدد" : "No couriers with a known location"}
          </p>
        </div>
      )}
    </div>
  );
}
