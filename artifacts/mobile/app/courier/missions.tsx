import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { t } from "../../src/i18n";

interface Assignment {
  id: number;
  orderId: number;
  status: "assigned" | "en_route_to_pickup" | "picked_up" | "en_route_to_delivery" | "delivered" | "failed";
  deliveryFee: number;
  yourCut: number;
  pickupAddress: string;
  deliveryAddress: string;
  customerName: string | null;
  distance: number | null;
}

const ACTION_BUTTONS: Record<string, Array<{ label: string; action: string; color: string }>> = {
  assigned: [{ label: "courier_dash.pickup", action: "pickup", color: "#3B82F6" }],
  en_route_to_pickup: [{ label: "courier_dash.pickup", action: "pickup", color: "#3B82F6" }],
  picked_up: [
    { label: "courier_dash.deliver", action: "deliver", color: "#10B981" },
    { label: "courier_dash.fail", action: "fail", color: "#EF4444" },
  ],
  en_route_to_delivery: [
    { label: "courier_dash.deliver", action: "deliver", color: "#10B981" },
    { label: "courier_dash.fail", action: "fail", color: "#EF4444" },
  ],
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  en_route_to_pickup: "En Route to Pickup",
  picked_up: "Picked Up",
  en_route_to_delivery: "In Delivery",
  delivered: "Delivered",
  failed: "Failed",
};

export default function CourierMissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { formatPrice } = useSettings();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [failModal, setFailModal] = useState<number | null>(null);
  const [failReason, setFailReason] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setAssignments((await r.json()) as Assignment[]);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const performAction = async (assignmentId: number, action: string, extra?: Record<string, unknown>) => {
    if (action === "fail") { setFailModal(assignmentId); return; }
    setActionLoading(assignmentId);
    try {
      const endpoint = action === "pickup" ? "pickup" :
                       action === "deliver" ? "deliver" : "fail-delivery";
      const r = await fetch(`${getBaseUrl()}/api/couriers/assignments/${assignmentId}/${endpoint}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: extra ? JSON.stringify(extra) : undefined,
      });
      if (r.ok) {
        void load(true);
      } else {
        const d = (await r.json()) as { error?: string };
        Alert.alert(d.error ?? "Action failed");
      }
    } catch { Alert.alert("Action failed"); }
    finally { setActionLoading(null); }
  };

  const handleFailSubmit = async () => {
    if (!failModal) return;
    if (!failReason.trim()) { Alert.alert("Please provide a reason"); return; }
    setActionLoading(failModal);
    setFailModal(null);
    try {
      const r = await fetch(`${getBaseUrl()}/api/couriers/assignments/${failModal}/fail-delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: failReason.trim() }),
      });
      if (r.ok) void load(true);
      else Alert.alert("Failed to report");
    } catch { Alert.alert("Failed to report"); }
    finally { setActionLoading(null); setFailReason(""); }
  };

  const active = assignments.filter((a) => !["delivered", "failed"].includes(a.status));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("courier_dash.missions")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : active.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="car-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("courier_dash.no_mission")}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>{t("courier_dash.waiting")}</Text>
          <Pressable
            style={[styles.goBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/courier/dashboard")}
          >
            <Text style={[styles.goBtnText, { color: colors.primaryForeground }]}>{t("courier_dash.dashboard")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={active}
          keyExtractor={(a) => String(a.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => {
            const actionBtns = ACTION_BUTTONS[item.status] ?? [];
            const statusColor = item.status === "delivered" ? "#10B981" : item.status === "failed" ? "#EF4444" : "#3B82F6";

            return (
              <View style={[styles.missionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.missionHeader}>
                  <Text style={[styles.missionId, { color: colors.foreground }]}>
                    {t("courier_dash.order_ref").replace("{{id}}", String(item.orderId))}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
                  </View>
                </View>

                <View style={styles.addressBlock}>
                  <View style={styles.addrRow}>
                    <View style={[styles.addrDot, { backgroundColor: "#10B981" }]} />
                    <Text style={[styles.addrText, { color: colors.foreground }]} numberOfLines={1}>{item.pickupAddress}</Text>
                  </View>
                  <View style={[styles.addrLine, { backgroundColor: colors.border }]} />
                  <View style={styles.addrRow}>
                    <View style={[styles.addrDot, { backgroundColor: "#EF4444" }]} />
                    <Text style={[styles.addrText, { color: colors.foreground }]} numberOfLines={1}>{item.deliveryAddress}</Text>
                  </View>
                </View>

                <View style={styles.missionMeta}>
                  {item.customerName && (
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      <Ionicons name="person-outline" size={12} /> {item.customerName}
                    </Text>
                  )}
                  <Text style={[styles.metaText, { color: colors.primary }]}>
                    {t("courier_dash.your_cut")}: {formatPrice(item.yourCut)}
                  </Text>
                </View>

                {actionBtns.length > 0 && (
                  <View style={styles.actionRow}>
                    {actionBtns.map((btn) => (
                      <Pressable
                        key={btn.action}
                        style={[styles.actionBtn, { backgroundColor: btn.color + (btn.action === "fail" ? "22" : ""), borderWidth: btn.action === "fail" ? 1 : 0, borderColor: btn.color }]}
                        onPress={() => performAction(item.id, btn.action)}
                        disabled={actionLoading === item.id}
                      >
                        {actionLoading === item.id ? (
                          <ActivityIndicator size="small" color={btn.action === "fail" ? btn.color : "#fff"} />
                        ) : (
                          <Text style={[styles.actionBtnText, { color: btn.action === "fail" ? btn.color : "#fff" }]}>
                            {t(btn.label as never)}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Fail Reason Modal */}
      <Modal visible={!!failModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFailModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setFailModal(null)} style={styles.backBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("courier_dash.fail")}</Text>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.modalLabel, { color: colors.foreground }]}>{t("courier_dash.fail_reason")}</Text>
            <TextInput
              style={[styles.failInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={failReason}
              onChangeText={setFailReason}
              placeholder={t("courier_dash.fail_reason_ph")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
            />
            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.destructive, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleFailSubmit}
            >
              <Text style={styles.submitBtnText}>{t("courier_dash.fail")}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14 },
  goBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  goBtnText: { fontSize: 15, fontWeight: "600" },
  missionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  missionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  missionId: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "600" },
  addressBlock: { gap: 4 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addrDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  addrLine: { width: 2, height: 16, marginLeft: 4 },
  addrText: { flex: 1, fontSize: 13 },
  missionMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center" },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  modalContainer: { flex: 1, padding: 16, gap: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, marginBottom: 4 },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700", marginLeft: 4 },
  modalLabel: { fontSize: 15, fontWeight: "600" },
  failInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 120, textAlignVertical: "top" },
  submitBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
