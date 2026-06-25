import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../src/i18n";

interface CourierProfile {
  id: number;
  status: string;
  vehicleType: string;
  district: string | null;
  phone: string;
}

const STATUS_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; desc: string }> = {
  pending:  { icon: "time-outline",             color: "#F59E0B", title: "courier_status.pending",  desc: "courier_status.pending_desc" },
  approved: { icon: "checkmark-circle-outline", color: "#10B981", title: "courier_status.approved", desc: "courier_status.approved_desc" },
  rejected: { icon: "close-circle-outline",     color: "#EF4444", title: "courier_status.rejected", desc: "courier_status.rejected_desc" },
};

export default function CourierApplicationStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isAuthenticated, isCourier } = useAuth();

  const [profile, setProfile] = useState<CourierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCourier) { router.replace("/courier/dashboard"); return; }
    if (!isAuthenticated) { setLoading(false); return; }
    fetch(`${getBaseUrl()}/api/couriers/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.ok) {
          const data = (await r.json()) as CourierProfile;
          setProfile(data);
          if (data.status === "approved") router.replace("/courier/dashboard");
        } else if (r.status === 404) {
          router.replace("/courier-apply");
        } else {
          setError("Failed to load profile");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [token, isAuthenticated, isCourier]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.destructive }}>{error ?? "Profile not found"}</Text>
        <Pressable onPress={() => router.push("/courier-apply")} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>{t("courier_apply.title")}</Text>
        </Pressable>
      </View>
    );
  }

  const status = profile.status ?? "pending";
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { marginLeft: 16 }]}>
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: conf.color + "22" }]}>
          <Ionicons name={conf.icon} size={52} color={conf.color} />
        </View>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{t("courier_status.title")}</Text>
        <View style={[styles.statusBadge, { backgroundColor: conf.color + "22" }]}>
          <Text style={[styles.statusBadgeText, { color: conf.color }]}>{t(conf.title as never)}</Text>
        </View>
        <Text style={[styles.statusDesc, { color: colors.mutedForeground }]}>{t(conf.desc as never)}</Text>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow label={t("courier_apply.vehicle")} value={profile.vehicleType} colors={colors} />
          <InfoRow label={t("courier_apply.phone")} value={profile.phone} colors={colors} />
          {profile.district && <InfoRow label={t("courier_apply.district")} value={profile.district} colors={colors} />}
        </View>

        {status === "approved" && (
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.replace("/courier/dashboard")}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("courier_status.go_dashboard")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, gap: 8 }}>
      <Text style={{ fontSize: 13, color: colors.mutedForeground, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, flex: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  statusBadgeText: { fontSize: 14, fontWeight: "600" },
  statusDesc: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  infoCard: { width: "100%", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 4 },
  btn: { width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  btnText: { fontSize: 16, fontWeight: "700" },
});
