import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";
import { useLocationReporting } from "@/hooks/useLocationReporting";

interface CourierStats {
  status: "ONLINE" | "OFFLINE" | "BUSY";
  walletBalance: number;
  successRate: number;
  activeAssignments: number;
  totalDeliveries: number;
  pendingOffers: number;
}

// Shape returned by GET /api/courier/missions/offers
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

function StatCard({ icon, label, value, color, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[stCard.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[stCard.icon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[stCard.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[stCard.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const stCard = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4, alignItems: "center" },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 16, fontWeight: "700" },
  label: { fontSize: 11, textAlign: "center" },
});

export default function CourierDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [stats, setStats] = useState<CourierStats | null>(null);
  const [offers, setOffers] = useState<MissionOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [accepting, setAccepting] = useState<number | null>(null);
  const offerPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A3.4 — Automatic GPS location reporting based on availability status
  useLocationReporting({
    token,
    availabilityStatus: stats?.status ?? "OFFLINE",
    enabled: !!token,
  });

  const fetchOffers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${getBaseUrl()}/api/courier/missions/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setOffers((await res.json()) as MissionOffer[]);
    } catch { /* ignore */ }
  }, [token]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const profileRes = await fetch(`${getBaseUrl()}/api/couriers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profileRes.ok) setStats((await profileRes.json()) as CourierStats);
      await fetchOffers();
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, fetchOffers]);

  // Initial load
  useEffect(() => { void load(); }, [load]);

  // Poll offers every 5 seconds (same cadence as web dashboard)
  useEffect(() => {
    offerPollRef.current = setInterval(() => { void fetchOffers(); }, 5000);
    return () => { if (offerPollRef.current) clearInterval(offerPollRef.current); };
  }, [fetchOffers]);

  const toggleStatus = async () => {
    if (!stats) return;
    const newStatus = stats.status === "ONLINE" ? "OFFLINE" : "ONLINE";
    setToggling(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/courier/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) setStats((prev) => prev ? { ...prev, status: newStatus } : prev);
      else Alert.alert(t("courier_dash.toggle_error") ?? "Failed to update status");
    } catch { Alert.alert(t("courier_dash.toggle_error") ?? "Failed to update status"); }
    finally { setToggling(false); }
  };

  const handleAcceptOffer = async (offer: MissionOffer) => {
    setAccepting(offer.offerId);
    try {
      const r = await fetch(`${getBaseUrl()}/api/courier/missions/offers/${offer.offerId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        Alert.alert(t("courier_dash.offer_accepted_toast"), "Head to the pickup location.", [
          { text: "OK", onPress: () => router.push("/courier/missions") },
        ]);
        void load(true);
      } else {
        const d = (await r.json()) as { error?: string };
        Alert.alert(d.error ?? "Failed to accept offer");
      }
    } catch { Alert.alert("Failed to accept offer"); }
    finally { setAccepting(null); }
  };

  const handleDeclineOffer = async (offerId: number) => {
    try {
      await fetch(`${getBaseUrl()}/api/courier/missions/offers/${offerId}/decline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      void fetchOffers();
    } catch { /* ignore */ }
  };

  const isOnline = stats?.status === "ONLINE";
  const isBusy = stats?.status === "BUSY";

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("courier_dash.title")}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: isOnline || isBusy ? "#10B98122" : "#EF444422" }]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? "#10B981" : isBusy ? "#F59E0B" : "#EF4444" }]} />
            <Text style={[styles.statusText, { color: isOnline ? "#10B981" : isBusy ? "#F59E0B" : "#EF4444" }]}>
              {isBusy ? t("courier_dash.status_busy") ?? "Busy" : isOnline ? t("courier_dash.status_online") : t("courier_dash.status_offline")}
            </Text>
          </View>
        </View>
        {!isBusy && (
          <Pressable
            style={[styles.toggleBtn, { backgroundColor: isOnline ? "#EF444422" : colors.primary }]}
            onPress={toggleStatus}
            disabled={toggling}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={isOnline ? "#EF4444" : colors.primaryForeground} />
            ) : (
              <Text style={[styles.toggleBtnText, { color: isOnline ? "#EF4444" : colors.primaryForeground }]}>
                {isOnline ? t("courier_dash.go_offline") : t("courier_dash.go_online")}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard icon="wallet-outline" label={t("courier_dash.wallet")} value={formatPrice(stats?.walletBalance ?? 0)} color="#10B981" colors={colors} />
          <StatCard icon="checkmark-circle-outline" label={t("courier_dash.success_rate")} value={`${((stats?.successRate ?? 0) * 100).toFixed(0)}%`} color="#3B82F6" colors={colors} />
          <StatCard icon="car-outline" label="Deliveries" value={String(stats?.totalDeliveries ?? 0)} color="#8B5CF6" colors={colors} />
        </View>

        {/* Quick Nav */}
        <View style={styles.quickNav}>
          <Pressable
            style={[styles.quickNavBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/courier/missions")}
          >
            <Ionicons name="car-outline" size={22} color={colors.primary} />
            <Text style={[styles.quickNavLabel, { color: colors.foreground }]}>{t("courier_dash.missions")}</Text>
            {(stats?.activeAssignments ?? 0) > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{stats?.activeAssignments}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.quickNavBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/courier/history")}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
            <Text style={[styles.quickNavLabel, { color: colors.foreground }]}>{t("courier_dash.history")}</Text>
          </Pressable>
        </View>

        {/* Mission Offers */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("courier_dash.offers")}</Text>
            {offers.length > 0 && (
              <View style={[styles.offerBadge, { backgroundColor: "#F59E0B" }]}>
                <Text style={styles.offerBadgeText}>{offers.length}</Text>
              </View>
            )}
          </View>
          {offers.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="hourglass-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("courier_dash.waiting")}</Text>
            </View>
          ) : (
            <View style={styles.offersList}>
              {offers.map((offer) => (
                <OfferCard
                  key={offer.offerId}
                  offer={offer}
                  colors={colors}
                  onAccept={() => handleAcceptOffer(offer)}
                  onDecline={() => handleDeclineOffer(offer.offerId)}
                  accepting={accepting === offer.offerId}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── OfferCard with live countdown ───────────────────────────────────────────

function OfferCard({ offer, colors, onAccept, onDecline, accepting }: {
  offer: MissionOffer;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const tick = setInterval(() => {
      const s = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
    }, 1000);
    return () => clearInterval(tick);
  }, [offer.expiresAt]);

  const isExpired = secondsLeft <= 0;
  const urgencyColor = secondsLeft <= 15 ? "#EF4444" : secondsLeft <= 30 ? "#F59E0B" : "#10B981";
  const borderColor = isExpired
    ? colors.border
    : secondsLeft <= 15
      ? "#EF4444AA"
      : "#F59E0BAA";

  const sizeLabel: Record<string, string> = { SMALL: "📦 S", MEDIUM: "📦 M", LARGE: "📦 L" };

  return (
    <View style={[styles.offerCard, { backgroundColor: colors.card, borderColor }]}>
      {/* Header: Mission ID + countdown */}
      <View style={styles.offerHeader}>
        <View>
          <Text style={[styles.offerId, { color: colors.foreground }]}>
            {t("courier_dash.order_ref").replace("{{id}}", String(offer.missionId))}
          </Text>
          <Text style={[styles.offerRound, { color: colors.mutedForeground }]}>
            {"Round"} {offer.round} · {sizeLabel[offer.deliverySize] ?? offer.deliverySize}
          </Text>
        </View>
        <View style={[styles.countdown, { backgroundColor: urgencyColor + "22" }]}>
          <Ionicons name="timer-outline" size={13} color={isExpired ? colors.mutedForeground : urgencyColor} />
          <Text style={[styles.countdownText, { color: isExpired ? colors.mutedForeground : urgencyColor }]}>
            {isExpired ? "—" : `${secondsLeft}s`}
          </Text>
        </View>
      </View>

      {/* Reward line — no fake amount per spec */}
      <View style={[styles.rewardRow, { backgroundColor: "#10B98111", borderColor: "#10B98133" }]}>
        <Ionicons name="cash-outline" size={14} color="#10B981" />
        <Text style={[styles.rewardText, { color: "#10B981" }]}>
          {t("courier_dash.your_cut")}
        </Text>
      </View>

      {/* Addresses */}
      <View style={styles.offerAddresses}>
        <View style={styles.offerAddr}>
          <Ionicons name="location-outline" size={14} color="#10B981" />
          <Text style={[styles.offerAddrText, { color: colors.foreground }]} numberOfLines={2}>
            {offer.pickupAddress || "—"}
          </Text>
        </View>
        <View style={styles.addrDivider} />
        <View style={styles.offerAddr}>
          <Ionicons name="navigate-outline" size={14} color="#EF4444" />
          <Text style={[styles.offerAddrText, { color: colors.foreground }]} numberOfLines={2}>
            {offer.dropoffAddress || "—"}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {isExpired ? (
        <View style={[styles.expiredBanner, { backgroundColor: colors.muted }]}>
          <Text style={[styles.expiredText, { color: colors.mutedForeground }]}>
            {t("courier_dash.offer_expired")}
          </Text>
        </View>
      ) : (
        <View style={styles.offerActions}>
          <Pressable style={[styles.declineBtn, { borderColor: "#EF4444" }]} onPress={onDecline} disabled={accepting}>
            <Text style={styles.declineText}>{t("courier_dash.reject")}</Text>
          </Pressable>
          <Pressable style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={onAccept} disabled={accepting}>
            {accepting
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>{t("courier_dash.accept")}</Text>
            }
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  statusIndicator: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4, alignSelf: "flex-start" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  toggleBtnText: { fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10 },
  quickNav: { flexDirection: "row", gap: 10 },
  quickNavBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  quickNavLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  badge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  offerBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  offerBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14 },
  offersList: { gap: 12 },
  // Offer card
  offerCard: { borderRadius: 16, borderWidth: 2, padding: 14, gap: 10 },
  offerHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  offerId: { fontSize: 15, fontWeight: "700" },
  offerRound: { fontSize: 11, marginTop: 2 },
  countdown: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  countdownText: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  rewardText: { fontSize: 13, fontWeight: "600" },
  offerAddresses: { gap: 8 },
  offerAddr: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  offerAddrText: { flex: 1, fontSize: 13, lineHeight: 18 },
  addrDivider: { height: 1, backgroundColor: "#88888822", marginHorizontal: 4 },
  offerActions: { flexDirection: "row", gap: 10 },
  declineBtn: { flex: 1, paddingVertical: 11, borderRadius: 11, borderWidth: 1.5, alignItems: "center" },
  declineText: { fontSize: 14, fontWeight: "600", color: "#EF4444" },
  acceptBtn: { flex: 2, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
  acceptText: { fontSize: 14, fontWeight: "700" },
  expiredBanner: { paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  expiredText: { fontSize: 13, fontStyle: "italic" },
});
