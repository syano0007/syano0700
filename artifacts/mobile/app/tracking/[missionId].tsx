/**
 * Mobile Tracking Screen — Phase A5.6
 *
 * Shows live ETA, courier info, and delivery timeline.
 * Opens the full interactive Leaflet map in the device browser via Linking.
 * Polls every 5 seconds when screen is focused.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Linking, RefreshControl, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { t, getLocale } from "../../src/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

const POLL_MS = 5_000;

const EVENT_LABELS: Record<string, { en: string; ar: string }> = {
  MISSION_ACCEPTED: { en: "Courier accepted order",    ar: "قبل الساعي الطلب" },
  PICKED_UP:        { en: "Order picked up",           ar: "تم استلام الطلب" },
  IN_TRANSIT:       { en: "Out for delivery",          ar: "في طريق التسليم" },
  DELIVERED:        { en: "Order delivered",           ar: "تم تسليم الطلب" },
  FAILED:           { en: "Delivery failed",           ar: "فشل التسليم" },
  CANCELLED:        { en: "Order cancelled",           ar: "تم إلغاء الطلب" },
  TRACKING_STARTED: { en: "Live tracking started",     ar: "بدأ التتبع المباشر" },
  TRACKING_STOPPED: { en: "Tracking ended",            ar: "انتهى التتبع" },
};

const ROUTE_STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  WAITING_PICKUP:    { en: "Waiting for courier",       ar: "انتظار الساعي",            color: "#f59e0b" },
  GOING_TO_PICKUP:   { en: "Courier heading to store",  ar: "الساعي في الطريق للمتجر",  color: "#0ea5e9" },
  PICKED_UP:         { en: "Order picked up",           ar: "تم استلام الطلب",          color: "#8b5cf6" },
  GOING_TO_CUSTOMER: { en: "On the way to you",         ar: "في الطريق إليك",            color: "#10b981" },
  DELIVERED:         { en: "Delivered!",                ar: "تم التسليم!",               color: "#059669" },
  FAILED:            { en: "Delivery failed",           ar: "فشل التسليم",              color: "#ef4444" },
  CANCELLED:         { en: "Cancelled",                 ar: "ملغى",                     color: "#6b7280" },
};

const FRESHNESS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  FRESH:   { en: "Live",         ar: "مباشر",        color: "#10b981" },
  WARNING: { en: "Signal weak",  ar: "إشارة ضعيفة",  color: "#f59e0b" },
  STALE:   { en: "Signal lost",  ar: "فُقدت الإشارة", color: "#ef4444" },
  UNKNOWN: { en: "No GPS",       ar: "لا GPS",        color: "#6b7280" },
};

function getBaseUrl(): string {
  if (Platform.OS === "web") return "";
  return "https://syanomarket.online";
}

interface TrackingData {
  missionId: number;
  missionStatus: string;
  routeStatus: string;
  pickupLocation: { lat: number | null; lng: number | null; address: string };
  deliveryLocation: { lat: number | null; lng: number | null; address: string };
  courier: { id: number; name: string; vehicleType: string | null; phone: string } | null;
  currentPosition: { lat: number; lng: number; recordedAt: string; freshness: string; ageSeconds: number | null } | null;
  freshness: string;
  ageSeconds: number | null;
  // A6.7 — real road route
  route: {
    distanceKm:      number | null;
    durationMinutes: number | null;
    source:          "osrm" | "haversine" | null;
  } | null;
  eta: {
    distanceRemainingKm: number | null;
    estimatedTravelMinutes: number | null;
    confidence: string;
    legToPickupKm: number | null;
    legToCustomerKm: number | null;
    legToPickupMinutes: number | null;
    legToCustomerMinutes: number | null;
    routeStatus: string;
    routeSource: "osrm" | "haversine" | null;
  };
  recentEvents: { eventType: string; occurredAt: string }[];
  lastUpdateAt: string | null;
}

export default function TrackingScreen() {
  const { missionId: rawId } = useLocalSearchParams<{ missionId: string }>();
  const missionId = parseInt(rawId ?? "0", 10);
  const colors = useColors();
  const isRtl = getLocale() === "ar";

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const token = await AsyncStorage.getItem("token");
      const base  = getBaseUrl();
      const res   = await fetch(`${base}/api/tracking/${missionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ac.signal,
      });
      if (!res.ok) {
        setError(res.status === 403 || res.status === 404 ? "not_found" : "server_error");
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") setError("network_error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [missionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), POLL_MS);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchData]);

  const openMapInBrowser = () => {
    const base = getBaseUrl();
    Linking.openURL(`${base}/tracking/${missionId}`);
  };

  const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.background },
    header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    backBtn:      { marginEnd: 12 },
    backText:     { fontSize: 13, color: colors.primary },
    headerTitle:  { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
    liveChip:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#064e3b", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
    liveText:     { fontSize: 11, fontWeight: "700", color: "#34d399" },
    liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34d399" },
    card:         { margin: 12, padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    statusRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
    statusDot:    { width: 12, height: 12, borderRadius: 6 },
    statusLabel:  { fontSize: 16, fontWeight: "700" },
    missionSub:   { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    etaCard:      { margin: 12, marginTop: 0, padding: 16, borderRadius: 16, backgroundColor: "#022c22", borderWidth: 1, borderColor: "#065f46" },
    etaLabel:     { fontSize: 13, color: "#6ee7b7", fontWeight: "600", marginBottom: 8 },
    etaNumber:    { fontSize: 44, fontWeight: "900", color: "#34d399" },
    etaUnit:      { fontSize: 18, color: "#6ee7b7", fontWeight: "600" },
    etaDist:      { fontSize: 13, color: "#6ee7b7", marginTop: 4 },
    etaLegs:      { flexDirection: "row", gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#065f46" },
    etaLegText:   { fontSize: 12, color: "#6ee7b7" },
    etaLegValue:  { fontSize: 13, fontWeight: "700", color: "#34d399" },
    mapBtn:       { margin: 12, marginTop: 0, padding: 14, borderRadius: 16, backgroundColor: "#059669", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
    mapBtnText:   { color: "#fff", fontWeight: "700", fontSize: 14 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
    infoRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
    infoCircle:   { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    infoLabel:    { fontSize: 11, color: colors.mutedForeground, marginBottom: 2 },
    infoValue:    { fontSize: 14, fontWeight: "600", color: colors.text },
    courierRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
    courierAvatar:{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#064e3b", alignItems: "center", justifyContent: "center" },
    courierInit:  { fontSize: 20, fontWeight: "700", color: "#34d399" },
    courierName:  { fontSize: 16, fontWeight: "700", color: colors.text },
    courierVehicle: { fontSize: 12, color: colors.mutedForeground, textTransform: "capitalize" },
    callBtn:      { marginStart: "auto", width: 40, height: 40, borderRadius: 20, backgroundColor: "#064e3b", alignItems: "center", justifyContent: "center" },
    freshnessChip:{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    freshnessDot: { width: 8, height: 8, borderRadius: 4 },
    freshnessText:{ fontSize: 12, color: colors.mutedForeground },
    eventRow:     { flexDirection: "row", gap: 12, marginBottom: 0 },
    eventDot:     { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    eventLine:    { width: 2, flex: 1, backgroundColor: colors.border, marginStart: 4, marginTop: 4 },
    eventLabel:   { fontSize: 14, fontWeight: "600", color: colors.text },
    eventTime:    { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    center:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    errorTitle:   { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 12, textAlign: "center" },
    errorDesc:    { fontSize: 14, color: colors.mutedForeground, marginTop: 8, textAlign: "center" },
    retryBtn:     { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: "#059669" },
    retryText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={[styles.errorDesc, { marginTop: 12 }]}>Loading tracking data…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40 }}>📍</Text>
        <Text style={styles.errorTitle}>
          {error === "not_found" ? t("tracking.not_found") : t("tracking.error")}
        </Text>
        <Text style={styles.errorDesc}>
          {error === "not_found" ? t("tracking.not_found_desc") : "Please check your connection."}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()}>
          <Text style={styles.retryText}>{t("tracking.retry")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 14 }}>{t("tracking.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const routeStatus = data.routeStatus ?? "WAITING_PICKUP";
  const statusCfg   = ROUTE_STATUS_LABELS[routeStatus] ?? ROUTE_STATUS_LABELS.WAITING_PICKUP;
  const freshCfg    = FRESHNESS_LABELS[data.freshness ?? "UNKNOWN"] ?? FRESHNESS_LABELS.UNKNOWN;
  const isCompleted = ["DELIVERED", "FAILED", "CANCELLED"].includes(routeStatus);
  const { eta, courier, recentEvents, pickupLocation, deliveryLocation } = data;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← {t("tracking.back")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("tracking.title")}
        </Text>
        {!isCompleted && (
          <View style={styles.liveChip}>
            <View style={[styles.liveDot]} />
            <Text style={styles.liveText}>{t("tracking.live")}</Text>
          </View>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#059669" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Status banner */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
                {isRtl ? statusCfg.ar : statusCfg.en}
              </Text>
              <Text style={styles.missionSub}>Mission #{missionId}</Text>
            </View>
            <View style={[styles.freshnessChip]}>
              <View style={[styles.freshnessDot, { backgroundColor: freshCfg.color }]} />
              <Text style={styles.freshnessText}>{isRtl ? freshCfg.ar : freshCfg.en}</Text>
            </View>
          </View>
        </View>

        {/* ETA card */}
        {!isCompleted && (
          <View style={styles.etaCard}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={styles.etaLabel}>{t("tracking.eta_title")}</Text>
              {data.route?.source && (
                <View style={{
                  marginStart: "auto",
                  paddingHorizontal: 8, paddingVertical: 2,
                  borderRadius: 99,
                  backgroundColor: data.route.source === "osrm" ? "#064e3b" : "#78350f",
                }}>
                  <Text style={{ fontSize: 10, color: data.route.source === "osrm" ? "#34d399" : "#fbbf24", fontWeight: "700" }}>
                    {data.route.source === "osrm" ? "Road route" : "Approx."}
                  </Text>
                </View>
              )}
            </View>
            {eta.estimatedTravelMinutes != null ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                  <Text style={styles.etaNumber}>{eta.estimatedTravelMinutes}</Text>
                  <Text style={[styles.etaUnit, { marginBottom: 8 }]}>{t("tracking.eta_minutes")}</Text>
                  {(data.route?.distanceKm ?? eta.distanceRemainingKm) != null && (
                    <Text style={[styles.etaDist, { marginStart: "auto", marginBottom: 8 }]}>
                      {data.route?.distanceKm ?? eta.distanceRemainingKm} {t("tracking.distance_km")}
                    </Text>
                  )}
                </View>
                {eta.legToPickupKm != null && eta.legToCustomerKm != null && (
                  <View style={styles.etaLegs}>
                    <View>
                      <Text style={styles.etaLegText}>{t("tracking.leg_pickup")}</Text>
                      <Text style={styles.etaLegValue}>{eta.legToPickupKm} km</Text>
                      {eta.legToPickupMinutes != null && (
                        <Text style={[styles.etaLegText, { marginTop: 1 }]}>{eta.legToPickupMinutes} min</Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.etaLegText}>{t("tracking.leg_customer")}</Text>
                      <Text style={styles.etaLegValue}>{eta.legToCustomerKm} km</Text>
                      {eta.legToCustomerMinutes != null && (
                        <Text style={[styles.etaLegText, { marginTop: 1 }]}>{eta.legToCustomerMinutes} min</Text>
                      )}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.etaDist}>{t("tracking.eta_loading")}</Text>
            )}
          </View>
        )}

        {/* View on map button */}
        <TouchableOpacity style={styles.mapBtn} onPress={openMapInBrowser}>
          <Text style={styles.mapBtnText}>🗺  View Live Map</Text>
        </TouchableOpacity>

        {/* Courier info */}
        {courier && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("tracking.courier_title")}</Text>
            <View style={styles.courierRow}>
              <View style={styles.courierAvatar}>
                <Text style={styles.courierInit}>{courier.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.courierName}>{courier.name}</Text>
                {courier.vehicleType ? (
                  <Text style={styles.courierVehicle}>{courier.vehicleType}</Text>
                ) : null}
              </View>
              {courier.phone ? (
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${courier.phone}`)}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Addresses */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.infoRow}>
            <View style={[styles.infoCircle, { backgroundColor: "#78350f" }]}>
              <Text>🏪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t("tracking.pickup_from")}</Text>
              <Text style={styles.infoValue}>{pickupLocation.address}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoCircle, { backgroundColor: "#1e3a5f" }]}>
              <Text>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t("tracking.delivery_to")}</Text>
              <Text style={styles.infoValue}>{deliveryLocation.address}</Text>
            </View>
          </View>
        </View>

        {/* Event timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("tracking.timeline_title")}</Text>
          {recentEvents.length === 0 ? (
            <Text style={styles.freshnessText}>{t("tracking.no_events")}</Text>
          ) : (
            recentEvents.map((ev, i) => {
              const label = EVENT_LABELS[ev.eventType];
              if (!label) return null;
              const isLatest = i === 0;
              return (
                <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 4 }}>
                  <View style={{ alignItems: "center", width: 18 }}>
                    <View style={[styles.eventDot, { backgroundColor: isLatest ? "#10b981" : "#374151" }]} />
                    {i < recentEvents.length - 1 && (
                      <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <Text style={[styles.eventLabel, { color: isLatest ? "#34d399" : colors.text }]}>
                      {isRtl ? label.ar : label.en}
                    </Text>
                    <Text style={styles.eventTime}>
                      {new Date(ev.occurredAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
