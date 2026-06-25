/**
 * Courier Mission Workspace — (courier-tabs) home screen
 *
 * Map-first fullscreen operational screen. This is the courier's primary home.
 * States: LOADING → IDLE → OFFER → TO_PICKUP → TO_CUSTOMER → (success modal)
 *
 * Tab bar is accounted for in bottom panel padding via useScreenLayout().
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocationReporting } from "@/hooks/useLocationReporting";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t, getLocale } from "../../src/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourierProfile {
  status: "ONLINE" | "OFFLINE" | "BUSY";
  walletBalance: number;
  successRate: number;
  activeAssignments: number;
  totalDeliveries: number;
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
}

interface Assignment {
  id: number;
  orderId: number;
  missionId: number | null;
  status: "assigned" | "picked_up" | "out_for_delivery";
  shippingAddress: string;
  storeName: string | null;
  sellerPhone: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryFee: number | null;
  deliveryNotes: string | null;
}

interface TrackingData {
  missionId: number;
  missionStatus: string;
  routeStatus: string;
  pickupLocation: { lat: number | null; lng: number | null; address: string };
  deliveryLocation: { lat: number | null; lng: number | null; address: string };
  currentPosition: { lat: number; lng: number; recordedAt: string; freshness: string; ageSeconds: number | null } | null;
  freshness: string;
  route: {
    geometry?: number[][] | null;
    distanceKm: number | null;
    durationMinutes: number | null;
    source: "osrm" | "haversine" | null;
  } | null;
  eta: {
    distanceRemainingKm: number | null;
    estimatedTravelMinutes: number | null;
    confidence: string;
    legToPickupMinutes: number | null;
    legToCustomerMinutes: number | null;
    routeStatus: string;
    routeSource: "osrm" | "haversine" | null;
  };
  recentEvents: { eventType: string; occurredAt: string }[];
}

type WorkspaceState = "LOADING" | "IDLE" | "OFFER" | "TO_PICKUP" | "TO_CUSTOMER";

function deriveState(
  profile: CourierProfile | null,
  assignment: Assignment | null,
  offers: MissionOffer[],
): WorkspaceState {
  if (!profile) return "LOADING";
  if (assignment) {
    if (assignment.status === "assigned") return "TO_PICKUP";
    if (assignment.status === "picked_up" || assignment.status === "out_for_delivery") return "TO_CUSTOMER";
  }
  if (offers.length > 0) return "OFFER";
  return "IDLE";
}

// ─── Route status config ──────────────────────────────────────────────────────

const ROUTE_CFG: Record<string, { en: string; ar: string; color: string; icon: string }> = {
  GOING_TO_PICKUP:   { en: "Heading to store",    ar: "في الطريق للمتجر",  color: "#3b82f6", icon: "navigate-outline" },
  PICKED_UP:         { en: "Heading to customer", ar: "في الطريق للزبون",   color: "#8b5cf6", icon: "car-outline" },
  GOING_TO_CUSTOMER: { en: "Out for delivery",    ar: "في طريق التسليم",    color: "#10b981", icon: "bicycle-outline" },
  WAITING_PICKUP:    { en: "Starting mission",    ar: "بدء المهمة",         color: "#f59e0b", icon: "time-outline" },
  DELIVERED:         { en: "Delivered!",          ar: "تم التسليم!",         color: "#059669", icon: "checkmark-circle-outline" },
  FAILED:            { en: "Failed",              ar: "فشل",                color: "#ef4444", icon: "close-circle-outline" },
};

// ─── Leaflet map HTML ─────────────────────────────────────────────────────────

function buildMapHTML(dark: boolean): string {
  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const bg = dark ? "#0f2418" : "#e8f0e8";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${bg};}
.l-courier{width:22px;height:22px;background:#10b981;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.6);}
.l-pickup{width:20px;height:20px;background:#f59e0b;border:3px solid #fff;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.5);}
.l-delivery{width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.5);}
</style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  const map = L.map('map',{zoomControl:false,attributionControl:false});
  L.tileLayer('${tileUrl}',{maxZoom:19}).addTo(map);
  map.setView([36.2021,37.1343],13);
  let cm=null,pm=null,dm=null,rl=null;
  const mk=(cls)=>L.divIcon({className:cls,iconSize:[22,22],iconAnchor:[11,11]});
  window.updateMap=function(d){
    const pts=[];
    if(d.courier){
      const p=[d.courier.lat,d.courier.lng];
      if(!cm) cm=L.marker(p,{icon:mk('l-courier'),zIndexOffset:1000}).addTo(map); else cm.setLatLng(p);
      pts.push(p);
    }
    if(d.pickup){
      const p=[d.pickup.lat,d.pickup.lng];
      if(!pm) pm=L.marker(p,{icon:mk('l-pickup')}).addTo(map); else pm.setLatLng(p);
      pts.push(p);
    }
    if(d.delivery){
      const p=[d.delivery.lat,d.delivery.lng];
      if(!dm) dm=L.marker(p,{icon:mk('l-delivery')}).addTo(map); else dm.setLatLng(p);
      pts.push(p);
    }
    if(d.route && d.route.length>1){
      if(rl) map.removeLayer(rl);
      rl=L.polyline(d.route,{color:'#10b981',weight:5,opacity:0.9}).addTo(map);
    }
    if(d.fit && pts.length>0){
      try{map.fitBounds(L.latLngBounds(pts),{padding:[80,80],maxZoom:16,animate:true});}catch(e){}
    }
  };
  window.centerOn=function(lat,lng,z){map.setView([lat,lng],z||15,{animate:true});};
})();
</script>
</body>
</html>`;
}

// ─── Offer Countdown Panel ────────────────────────────────────────────────────

function OfferPanel({
  offer, colors, isRtl, accepting, bottomPad,
  onAccept, onDecline,
}: {
  offer: MissionOffer;
  colors: ReturnType<typeof useColors>;
  isRtl: boolean;
  accepting: boolean;
  bottomPad: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [secsLeft, setSecsLeft] = useState(
    Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      setSecsLeft(Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [offer.expiresAt]);

  const urgency = secsLeft <= 15;

  return (
    <View style={[offerSt.panel, {
      backgroundColor: urgency ? "#1c0505F0" : "#022c22F0",
      borderColor: urgency ? "#ef4444" : "#065f46",
      paddingBottom: bottomPad,
    }]}>
      {/* Countdown ring */}
      <View style={[offerSt.countdownRow]}>
        <View style={[offerSt.countdown, { borderColor: urgency ? "#ef4444" : "#10b981" }]}>
          <Text style={[offerSt.countdownNum, { color: urgency ? "#ef4444" : "#34d399" }]}>{secsLeft}</Text>
          <Text style={[offerSt.countdownLabel, { color: urgency ? "#fca5a5" : "#6ee7b7" }]}>sec</Text>
        </View>
        <View style={{ flex: 1, paddingStart: 16 }}>
          <Text style={[offerSt.offerTitle, { color: urgency ? "#fca5a5" : "#34d399" }]}>
            {t("workspace.new_offer") ?? "New Mission Offer!"}
          </Text>
          <Text style={[offerSt.offerRound, { color: urgency ? "#fca5a5" : "#6ee7b7" }]}>
            {`Round ${offer.round} • Mission #${offer.missionId}`}
          </Text>
        </View>
      </View>

      {/* Route preview */}
      <View style={offerSt.routeRow}>
        <View style={offerSt.routePoint}>
          <View style={[offerSt.dot, { backgroundColor: "#f59e0b" }]} />
          <View style={{ flex: 1 }}>
            <Text style={[offerSt.addrLabel, { color: urgency ? "#fca5a5" : "#6ee7b7" }]}>{t("workspace.pickup") ?? "Pickup"}</Text>
            <Text style={[offerSt.addrText, { color: "#fff" }]} numberOfLines={1}>{offer.pickupAddress}</Text>
          </View>
        </View>
        <View style={offerSt.routePoint}>
          <View style={[offerSt.dot, { backgroundColor: "#3b82f6" }]} />
          <View style={{ flex: 1 }}>
            <Text style={[offerSt.addrLabel, { color: urgency ? "#fca5a5" : "#6ee7b7" }]}>{t("workspace.delivery") ?? "Delivery"}</Text>
            <Text style={[offerSt.addrText, { color: "#fff" }]} numberOfLines={1}>{offer.dropoffAddress}</Text>
          </View>
        </View>
      </View>

      {/* CTA buttons */}
      <View style={offerSt.btnRow}>
        <Pressable style={[offerSt.declineBtn, { borderColor: colors.border }]} onPress={onDecline} disabled={accepting}>
          <Text style={[offerSt.declineTxt, { color: colors.mutedForeground }]}>{t("workspace.decline") ?? "Skip"}</Text>
        </Pressable>
        <Pressable style={[offerSt.acceptBtn, { backgroundColor: "#10b981", flex: 2 }]} onPress={onAccept} disabled={accepting}>
          {accepting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={offerSt.acceptTxt}>{t("workspace.accept") ?? "Accept Mission"}</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const offerSt = StyleSheet.create({
  panel:       { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1.5, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  countdownRow:{ flexDirection: "row", alignItems: "center", marginBottom: 16 },
  countdown:   { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  countdownNum:{ fontSize: 26, fontWeight: "900" },
  countdownLabel: { fontSize: 10, fontWeight: "600", marginTop: -4 },
  offerTitle:  { fontSize: 18, fontWeight: "800" },
  offerRound:  { fontSize: 12, fontWeight: "600", marginTop: 2 },
  routeRow:    { gap: 8, marginBottom: 16 },
  routePoint:  { flexDirection: "row", alignItems: "center", gap: 10 },
  dot:         { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  addrLabel:   { fontSize: 11, fontWeight: "600", marginBottom: 1 },
  addrText:    { fontSize: 14, fontWeight: "500" },
  btnRow:      { flexDirection: "row", gap: 10 },
  declineBtn:  { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  declineTxt:  { fontSize: 14, fontWeight: "600" },
  acceptBtn:   { borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  acceptTxt:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CourierWorkspaceScreen() {
  const colors      = useColors();
  const insets      = useSafeAreaInsets();
  const { tabBarHeight } = useScreenLayout();
  const { token }   = useAuth();
  const { formatPrice } = useSettings();
  const isRtl = getLocale() === "ar";
  const isDark = !colors.background.toLowerCase().startsWith("#f") && !colors.background.toLowerCase().startsWith("#e");

  const webViewRef   = useRef<WebView | null>(null);
  const prevMission  = useRef<number | null>(null);

  const [profile,    setProfile]    = useState<CourierProfile | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [offers,     setOffers]     = useState<MissionOffer[]>([]);
  const [tracking,   setTracking]   = useState<TrackingData | null>(null);
  const [toggling,   setToggling]   = useState(false);
  const [accepting,  setAccepting]  = useState(false);
  const [actLoading, setActLoading] = useState(false);
  const [showFail,   setShowFail]   = useState(false);
  const [failReason, setFailReason] = useState("");
  const [showSuccess,setShowSuccess]= useState(false);
  const [lastEarned, setLastEarned] = useState<number>(0);

  useLocationReporting({
    token,
    availabilityStatus: profile?.status ?? "OFFLINE",
    enabled: !!token,
  });

  const workspaceState = deriveState(profile, assignment, offers);

  // ─── Fetchers ───────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setProfile(await r.json());
    } catch {}
  }, [token]);

  const fetchOffers = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${getBaseUrl()}/api/courier/missions/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setOffers(await r.json());
    } catch {}
  }, [token]);

  const fetchAssignment = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data: Assignment[] = await r.json();
        const active = data.filter(a => ["assigned","picked_up","out_for_delivery"].includes(a.status));
        setAssignment(active.length > 0 ? active[0] : null);
      }
    } catch {}
  }, [token]);

  const pushMapUpdate = useCallback((td: TrackingData) => {
    if (!webViewRef.current) return;
    const fit = td.missionId !== prevMission.current;
    if (fit) prevMission.current = td.missionId;
    const payload = {
      courier:  td.currentPosition ? { lat: td.currentPosition.lat, lng: td.currentPosition.lng } : null,
      pickup:   td.pickupLocation.lat  ? { lat: td.pickupLocation.lat,  lng: td.pickupLocation.lng  } : null,
      delivery: td.deliveryLocation.lat ? { lat: td.deliveryLocation.lat, lng: td.deliveryLocation.lng } : null,
      route:    td.route?.geometry ?? null,
      fit,
    };
    webViewRef.current.injectJavaScript(`window.updateMap(${JSON.stringify(payload)});true;`);
  }, []);

  const fetchTracking = useCallback(async (missionId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`${getBaseUrl()}/api/tracking/${missionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const td: TrackingData = await r.json();
        setTracking(td);
        pushMapUpdate(td);
      }
    } catch {}
  }, [token, pushMapUpdate]);

  const pollAll = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchOffers(), fetchAssignment()]);
  }, [fetchProfile, fetchOffers, fetchAssignment]);

  // Main poll
  useEffect(() => {
    pollAll();
    const id = setInterval(pollAll, 5_000);
    return () => clearInterval(id);
  }, [pollAll]);

  // Tracking poll when we have a missionId
  useEffect(() => {
    const mid = assignment?.missionId ?? null;
    if (!mid) { setTracking(null); return; }
    fetchTracking(mid);
    const id = setInterval(() => fetchTracking(mid), 5_000);
    return () => clearInterval(id);
  }, [assignment?.missionId, fetchTracking]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const toggleOnline = async () => {
    if (!profile || toggling) return;
    const next = profile.status === "ONLINE" ? "OFFLINE" : "ONLINE";
    setToggling(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/courier/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next }),
      });
      if (r.ok) setProfile(p => p ? { ...p, status: next } : p);
    } catch {}
    setToggling(false);
  };

  const acceptOffer = async (offer: MissionOffer) => {
    setAccepting(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/courier/missions/offers/${offer.offerId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        await pollAll();
      } else {
        const d = await r.json().catch(() => ({}));
        Alert.alert(t("workspace.offer_error") ?? "Error", d.error ?? "Failed to accept offer");
      }
    } catch {}
    setAccepting(false);
  };

  const declineOffer = async (offerId: number) => {
    try {
      await fetch(`${getBaseUrl()}/api/courier/missions/offers/${offerId}/decline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchOffers();
    } catch {}
  };

  const doAction = async (action: "pickup" | "deliver" | "fail-delivery", extra?: Record<string, string>) => {
    if (!assignment || actLoading) return;
    setActLoading(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/assignments/${assignment.id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: extra ? JSON.stringify(extra) : undefined,
      });
      if (r.ok) {
        if (action === "deliver") {
          setLastEarned(assignment.deliveryFee ?? 0);
          setShowSuccess(true);
        }
        setAssignment(null);
        setTracking(null);
        await pollAll();
      } else {
        const d = await r.json().catch(() => ({}));
        Alert.alert(t("common.error") ?? "Error", d.error ?? "Action failed");
      }
    } catch {}
    setActLoading(false);
  };

  const navigate = (lat: number | null, lng: number | null, address?: string | null) => {
    if (lat && lng) {
      const url = Platform.OS === "ios"
        ? `maps://?daddr=${lat},${lng}`
        : `https://maps.google.com/?q=${lat},${lng}`;
      Linking.openURL(url);
    } else if (address) {
      const q = encodeURIComponent(address);
      Linking.openURL(`https://maps.google.com/?q=${q}`);
    }
  };

  const call = (phone: string | null) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  // ─── Derived display values ──────────────────────────────────────────────────

  const isOnline = profile?.status === "ONLINE";
  const isBusy   = profile?.status === "BUSY";
  const statusColor = isBusy ? "#f59e0b" : isOnline ? "#10b981" : "#6b7280";
  const statusText  = isBusy
    ? (t("workspace.busy")    ?? "Busy")
    : isOnline
    ? (t("workspace.online")  ?? "Online")
    : (t("workspace.offline") ?? "Offline");

  const eta     = tracking?.eta;
  const distKm  = tracking?.route?.distanceKm ?? eta?.distanceRemainingKm;
  const etaMins = eta?.estimatedTravelMinutes;

  const routeStatus = tracking?.routeStatus
    ?? (assignment?.status === "assigned" ? "GOING_TO_PICKUP" : "GOING_TO_CUSTOMER");
  const routeCfg = ROUTE_CFG[routeStatus] ?? ROUTE_CFG.WAITING_PICKUP;
  const routeText = isRtl ? routeCfg.ar : routeCfg.en;

  const isFreshGps = tracking?.freshness === "FRESH";
  const hasGps     = tracking?.currentPosition != null;

  const currentOffer = offers[0] ?? null;

  // Bottom padding: tab bar sits above safe area, panels need to clear it
  const panelBottomPad = tabBarHeight + 8;

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const s = StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.background },
    topBar:      {
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 14, paddingBottom: 12,
    },
    pill:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
    pillDot:     { width: 7, height: 7, borderRadius: 4 },
    pillText:    { fontSize: 12, fontWeight: "700" },
    toggleBtn:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
    toggleTxt:   { fontSize: 13, fontWeight: "700" },
    etaFloat:    {
      position: "absolute", top: 0, left: 14, right: 14, zIndex: 10,
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: "#022c22EE", borderRadius: 14, borderWidth: 1, borderColor: "#065f46",
    },
    etaRouteText:{ fontSize: 13, fontWeight: "700", flex: 1 },
    etaBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: "#064e3b" },
    etaBadgeTxt: { fontSize: 12, fontWeight: "800", color: "#34d399" },
    cardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    cardHeaderLabel: { fontSize: 13, fontWeight: "700" },
    gpsPill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
    gpsPillTxt:  { fontSize: 11, fontWeight: "700" },
    missionPanel:{
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 15,
      borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 16,
    },
    panelHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 14 },
    routeBar:    { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
    routeBarDot: { width: 10, height: 10, borderRadius: 5 },
    routeBarLine:{ flex: 1, height: 1 },
    routeBarLbl: { fontSize: 11, fontWeight: "600" },
    infoRow:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    infoIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    infoBlock:   { flex: 1 },
    infoLbl:     { fontSize: 11, fontWeight: "600", marginBottom: 1 },
    infoVal:     { fontSize: 15, fontWeight: "700" },
    infoAddr:    { fontSize: 12, marginTop: 1 },
    callBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    metaRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    metaTxt:     { fontSize: 12 },
    earningsBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
    earningsTxt: { fontSize: 12, fontWeight: "700", color: "#34d399" },
    actionRow:   { flexDirection: "row", gap: 8 },
    navBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: "#064e3b" },
    navTxt:      { color: "#34d399", fontSize: 14, fontWeight: "700" },
    confirmBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 15, borderRadius: 14 },
    confirmTxt:  { color: "#fff", fontSize: 14, fontWeight: "800" },
    failBtnTxt:  { fontSize: 14, fontWeight: "700" },
    idlePanel:   {
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 15,
      borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20,
    },
    idleIcon:    { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 },
    idleTitle:   { fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 6 },
    idleSubtitle:{ fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    statsRow:    { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: 16, borderTopWidth: 1 },
    statItem:    { alignItems: "center", gap: 2 },
    statVal:     { fontSize: 22, fontWeight: "900" },
    statLbl:     { fontSize: 11, fontWeight: "600" },
    statDiv:     { width: 1, height: 32 },
    modalWrap:   { flex: 1 },
    modalContainer: { flex: 1, padding: 20 },
    modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1 },
    modalTitle:  { flex: 1, fontSize: 18, fontWeight: "800", textAlign: "center" },
    modalLabel:  { fontSize: 14, fontWeight: "700", marginBottom: 8 },
    failInput:   { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 110, textAlignVertical: "top" },
    submitBtn:   { padding: 16, borderRadius: 14, alignItems: "center", marginTop: 16 },
    submitTxt:   { color: "#fff", fontSize: 16, fontWeight: "800" },
    overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
    successCard: { width: "100%", maxWidth: 360, borderRadius: 24, padding: 28, alignItems: "center" },
    successEmoji:{ fontSize: 56, marginBottom: 12 },
    successTitle:{ fontSize: 22, fontWeight: "900", marginBottom: 8, textAlign: "center" },
    successSub:  { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
    earningsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
    earningsAmt: { fontSize: 24, fontWeight: "900", color: "#34d399", flex: 1 },
    earnLbl:     { fontSize: 13, fontWeight: "600", color: "#6ee7b7" },
    continueBtn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
    continueTxt: { fontSize: 16, fontWeight: "800" },
  });

  const etaTop = insets.top + 64;

  return (
    <View style={s.root}>

      {/* ─── FULLSCREEN MAP ─────────────────────────────────────────────────── */}
      {Platform.OS !== "web" ? (
        <WebView
          ref={webViewRef}
          style={StyleSheet.absoluteFill}
          source={{ html: buildMapHTML(isDark) }}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: colors.card }]}>
          <Ionicons name="map-outline" size={72} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 15 }}>Map view available on mobile</Text>
        </View>
      )}

      {/* ─── TOP BAR ────────────────────────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={[s.pill, { backgroundColor: statusColor + "20", borderColor: statusColor + "50" }]}>
          <View style={[s.pillDot, { backgroundColor: statusColor }]} />
          <Text style={[s.pillText, { color: statusColor }]}>{statusText}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {hasGps && (
          <View style={[s.pill, { backgroundColor: isFreshGps ? "#064e3b" : "#78350f", borderColor: isFreshGps ? "#065f46" : "#92400e" }]}>
            <View style={[s.pillDot, { backgroundColor: isFreshGps ? "#10b981" : "#f59e0b" }]} />
            <Text style={[s.pillText, { color: isFreshGps ? "#34d399" : "#fbbf24" }]}>
              {isFreshGps ? "GPS" : "Weak GPS"}
            </Text>
          </View>
        )}

        {!isBusy && (
          <Pressable
            style={[s.toggleBtn, { backgroundColor: isOnline ? "#ef444422" : colors.primary }]}
            onPress={toggleOnline}
            disabled={toggling}
          >
            {toggling
              ? <ActivityIndicator size="small" color={isOnline ? "#ef4444" : colors.primaryForeground} />
              : <>
                  <Ionicons name={isOnline ? "power" : "power-outline"} size={14} color={isOnline ? "#ef4444" : colors.primaryForeground} />
                  <Text style={[s.toggleTxt, { color: isOnline ? "#ef4444" : colors.primaryForeground }]}>
                    {isOnline ? (t("workspace.go_offline") ?? "Go Offline") : (t("workspace.go_online") ?? "Go Online")}
                  </Text>
                </>
            }
          </Pressable>
        )}
      </View>

      {/* ─── ETA FLOAT ──────────────────────────────────────────────────────── */}
      {(workspaceState === "TO_PICKUP" || workspaceState === "TO_CUSTOMER") && (etaMins != null || distKm != null) && (
        <View style={[s.etaFloat, { top: etaTop }]}>
          <Ionicons name={routeCfg.icon as any} size={16} color={routeCfg.color} />
          <Text style={[s.etaRouteText, { color: routeCfg.color }]}>{routeText}</Text>
          {distKm != null && (
            <Text style={{ color: "#6ee7b7", fontSize: 12, fontWeight: "600" }}>{distKm} km</Text>
          )}
          {etaMins != null && (
            <View style={s.etaBadge}>
              <Text style={s.etaBadgeTxt}>{etaMins} min</Text>
            </View>
          )}
        </View>
      )}

      {/* ─── LOADING ────────────────────────────────────────────────────────── */}
      {workspaceState === "LOADING" && (
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* ─── IDLE PANEL ─────────────────────────────────────────────────────── */}
      {workspaceState === "IDLE" && (
        <View style={[s.idlePanel, { backgroundColor: colors.card + "EE", borderColor: colors.border, paddingBottom: panelBottomPad + 12 }]}>
          <View style={[s.idleIcon, { backgroundColor: isOnline ? "#10b98122" : "#6b728022" }]}>
            <Ionicons name={isOnline ? "radio-outline" : "power-outline"} size={28} color={isOnline ? "#10b981" : "#6b7280"} />
          </View>
          <Text style={[s.idleTitle, { color: colors.foreground }]}>
            {isOnline
              ? (t("workspace.waiting_title") ?? "Waiting for a mission")
              : (t("workspace.offline_title") ?? "You're offline")}
          </Text>
          <Text style={[s.idleSubtitle, { color: colors.mutedForeground }]}>
            {isOnline
              ? (t("workspace.waiting_desc") ?? "New mission offers will appear here automatically.")
              : (t("workspace.offline_desc") ?? "Go online to receive delivery requests.")}
          </Text>
          <View style={[s.statsRow, { borderTopColor: colors.border }]}>
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: colors.primary }]}>{formatPrice(profile?.walletBalance ?? 0)}</Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("workspace.wallet") ?? "Wallet"}</Text>
            </View>
            <View style={[s.statDiv, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: colors.foreground }]}>{((profile?.successRate ?? 0) * 100).toFixed(0)}%</Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("workspace.success") ?? "Success"}</Text>
            </View>
            <View style={[s.statDiv, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: colors.foreground }]}>{profile?.totalDeliveries ?? 0}</Text>
              <Text style={[s.statLbl, { color: colors.mutedForeground }]}>{t("workspace.deliveries") ?? "Deliveries"}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ─── OFFER PANEL ────────────────────────────────────────────────────── */}
      {workspaceState === "OFFER" && currentOffer && (
        <OfferPanel
          offer={currentOffer}
          colors={colors}
          isRtl={isRtl}
          accepting={accepting}
          bottomPad={panelBottomPad}
          onAccept={() => acceptOffer(currentOffer)}
          onDecline={() => declineOffer(currentOffer.offerId)}
        />
      )}

      {/* ─── ACTIVE MISSION PANEL ───────────────────────────────────────────── */}
      {(workspaceState === "TO_PICKUP" || workspaceState === "TO_CUSTOMER") && assignment && (
        <View style={[s.missionPanel, {
          backgroundColor: colors.card + "F5",
          borderColor: colors.border,
          paddingBottom: panelBottomPad + 8,
        }]}>
          <View style={s.panelHandle} />

          {/* Card header — courier label + GPS freshness */}
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <Ionicons name="bicycle-outline" size={16} color="#10b981" />
              <Text style={[s.cardHeaderLabel, { color: "#10b981" }]}>
                {t("workspace.courier_label") ?? "Courier"}
              </Text>
            </View>
            {hasGps && (
              <View style={[s.gpsPill, {
                backgroundColor: isFreshGps ? "#064e3b" : "#78350f",
                borderColor: isFreshGps ? "#065f46" : "#92400e",
              }]}>
                <View style={[s.pillDot, { backgroundColor: isFreshGps ? "#10b981" : "#f59e0b" }]} />
                <Text style={[s.gpsPillTxt, { color: isFreshGps ? "#34d399" : "#fbbf24" }]}>
                  {isFreshGps ? "GPS" : "Weak GPS"}
                </Text>
              </View>
            )}
          </View>

          <View style={s.routeBar}>
            <View style={[s.routeBarDot, { backgroundColor: "#f59e0b" }]} />
            <Text style={[s.routeBarLbl, { color: "#f59e0b" }]}>{t("workspace.store") ?? "Store"}</Text>
            <View style={[s.routeBarLine, { backgroundColor: colors.border }]} />
            <Text style={[s.routeBarLbl, { color: "#3b82f6" }]}>{t("workspace.customer") ?? "Customer"}</Text>
            <View style={[s.routeBarDot, { backgroundColor: "#3b82f6" }]} />
          </View>

          {assignment.storeName && (
            <View style={s.infoRow}>
              <View style={[s.infoIcon, { backgroundColor: "#f59e0b18" }]}>
                <Ionicons name="storefront-outline" size={18} color="#f59e0b" />
              </View>
              <View style={s.infoBlock}>
                <Text style={[s.infoLbl, { color: colors.mutedForeground }]}>{t("workspace.pickup_from") ?? "Pickup from"}</Text>
                <Text style={[s.infoVal, { color: colors.foreground }]}>{assignment.storeName}</Text>
              </View>
              <Pressable
                style={[s.callBtn, { backgroundColor: "#f59e0b18" }]}
                onPress={() => call(assignment.sellerPhone)}
                disabled={!assignment.sellerPhone}
              >
                <Ionicons name="call-outline" size={18} color={assignment.sellerPhone ? "#f59e0b" : colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          <View style={s.infoRow}>
            <View style={[s.infoIcon, { backgroundColor: "#3b82f618" }]}>
              <Ionicons name="person-outline" size={18} color="#3b82f6" />
            </View>
            <View style={s.infoBlock}>
              <Text style={[s.infoLbl, { color: colors.mutedForeground }]}>{t("workspace.deliver_to") ?? "Deliver to"}</Text>
              <Text style={[s.infoVal, { color: colors.foreground }]}>{assignment.customerName ?? "Customer"}</Text>
              <Text style={[s.infoAddr, { color: colors.mutedForeground }]} numberOfLines={1}>
                {assignment.shippingAddress}
              </Text>
            </View>
            <Pressable
              style={[s.callBtn, { backgroundColor: "#3b82f618" }]}
              onPress={() => call(assignment.customerPhone)}
              disabled={!assignment.customerPhone}
            >
              <Ionicons name="call-outline" size={18} color={assignment.customerPhone ? "#3b82f6" : colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={s.metaRow}>
            <Text style={[s.metaTxt, { color: colors.mutedForeground }]}>#{assignment.orderId}</Text>
            {assignment.deliveryFee != null && (
              <View style={[s.earningsBadge, { backgroundColor: "#10b98118" }]}>
                <Ionicons name="cash-outline" size={12} color="#10b981" />
                <Text style={s.earningsTxt}>{formatPrice(assignment.deliveryFee)}</Text>
              </View>
            )}
            {assignment.deliveryNotes && (
              <Text style={[s.metaTxt, { color: "#f59e0b", flex: 1 }]} numberOfLines={1}>
                📝 {assignment.deliveryNotes}
              </Text>
            )}
          </View>

          <View style={s.actionRow}>
            {workspaceState === "TO_PICKUP" && (
              <>
                <Pressable
                  style={s.navBtn}
                  onPress={() => navigate(
                    tracking?.pickupLocation.lat ?? null,
                    tracking?.pickupLocation.lng ?? null,
                    assignment.storeName,
                  )}
                >
                  <Ionicons name="navigate-outline" size={16} color="#34d399" />
                  <Text style={s.navTxt}>{t("workspace.navigate") ?? "Navigate"}</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmBtn, { backgroundColor: "#3b82f6" }]}
                  onPress={() => doAction("pickup")}
                  disabled={actLoading}
                >
                  {actLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.confirmTxt}>{t("workspace.mark_picked_up") ?? "Picked Up ✓"}</Text>
                  }
                </Pressable>
              </>
            )}

            {workspaceState === "TO_CUSTOMER" && (
              <>
                <Pressable
                  style={s.navBtn}
                  onPress={() => navigate(
                    tracking?.deliveryLocation.lat ?? null,
                    tracking?.deliveryLocation.lng ?? null,
                    assignment.shippingAddress,
                  )}
                >
                  <Ionicons name="navigate-outline" size={16} color="#34d399" />
                  <Text style={s.navTxt}>{t("workspace.navigate") ?? "Navigate"}</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmBtn, { backgroundColor: "#10b981" }]}
                  onPress={() => doAction("deliver")}
                  disabled={actLoading}
                >
                  {actLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.confirmTxt}>{t("workspace.delivered") ?? "Delivered ✓"}</Text>
                  }
                </Pressable>
                <Pressable
                  style={[s.confirmBtn, { backgroundColor: "#ef444418", borderWidth: 1, borderColor: "#ef4444" }]}
                  onPress={() => setShowFail(true)}
                  disabled={actLoading}
                >
                  <Text style={[s.failBtnTxt, { color: "#ef4444" }]}>{t("workspace.fail") ?? "Fail"}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* ─── FAIL DELIVERY MODAL ────────────────────────────────────────────── */}
      <Modal
        visible={showFail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFail(false)}
      >
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setShowFail(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {t("workspace.fail_title") ?? "Report Failed Delivery"}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={[s.modalLabel, { color: colors.foreground }]}>
              {t("workspace.fail_reason") ?? "Reason"}
            </Text>
            <TextInput
              style={[s.failInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={failReason}
              onChangeText={setFailReason}
              placeholder={t("workspace.fail_reason_ph") ?? "Describe what happened..."}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
            />

            <Pressable
              style={[s.submitBtn, { backgroundColor: "#ef4444", opacity: failReason.trim().length > 0 ? 1 : 0.4 }]}
              onPress={async () => {
                if (!failReason.trim()) return;
                setShowFail(false);
                await doAction("fail-delivery", { reason: failReason.trim() });
                setFailReason("");
              }}
              disabled={!failReason.trim()}
            >
              <Text style={s.submitTxt}>{t("workspace.fail_submit") ?? "Submit Report"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── SUCCESS MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={() => setShowSuccess(false)}>
        <View style={s.overlay}>
          <View style={[s.successCard, { backgroundColor: colors.card }]}>
            <Text style={s.successEmoji}>🎉</Text>
            <Text style={[s.successTitle, { color: colors.foreground }]}>
              {t("workspace.success_title") ?? "Delivery Complete!"}
            </Text>
            <Text style={[s.successSub, { color: colors.mutedForeground }]}>
              {t("workspace.success_desc") ?? "Great work! You're back online and ready for more missions."}
            </Text>
            {lastEarned > 0 && (
              <View style={[s.earningsRow, { backgroundColor: "#10b98118", borderColor: "#10b98140" }]}>
                <Ionicons name="cash-outline" size={22} color="#10b981" />
                <Text style={s.earningsAmt}>{formatPrice(lastEarned)}</Text>
                <Text style={s.earnLbl}>{t("workspace.earned") ?? "earned"}</Text>
              </View>
            )}
            <Pressable style={[s.continueBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSuccess(false)}>
              <Text style={[s.continueTxt, { color: colors.primaryForeground }]}>
                {t("workspace.continue") ?? "Continue"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
