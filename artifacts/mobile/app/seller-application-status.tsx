import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import type { SellerApplication } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../src/i18n";

const STATUS_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; desc: string }> = {
  pending:      { icon: "time-outline",             color: "#F59E0B", title: "seller_status.pending",      desc: "seller_status.pending_desc" },
  under_review: { icon: "search-outline",           color: "#3B82F6", title: "seller_status.under_review", desc: "seller_status.under_review_desc" },
  approved:     { icon: "checkmark-circle-outline", color: "#10B981", title: "seller_status.approved",     desc: "seller_status.approved_desc" },
  rejected:     { icon: "close-circle-outline",     color: "#EF4444", title: "seller_status.rejected",     desc: "seller_status.rejected_desc" },
  suspended:    { icon: "lock-closed-outline",      color: "#EF4444", title: "seller_status.suspended",    desc: "seller_status.suspended_desc" },
};

export default function SellerApplicationStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, isAuthenticated } = useAuth();

  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    fetch(`${getBaseUrl()}/api/sellers/application`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.ok) {
          const data = (await r.json()) as SellerApplication;
          setApplication(data);
        } else if (r.status === 404) {
          router.replace("/seller-apply");
        } else {
          setError("Failed to load application");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [token, isAuthenticated]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !application) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.destructive }}>{error ?? "Application not found"}</Text>
        <Pressable onPress={() => router.push("/seller-apply")} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>{t("seller_apply.title")}</Text>
        </Pressable>
      </View>
    );
  }

  const status = application.status ?? "pending";
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Back */}
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: "flex-start", marginLeft: 16 }]}>
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>

      <View style={styles.content}>
        {/* Status Icon */}
        <View style={[styles.iconWrap, { backgroundColor: conf.color + "22" }]}>
          <Ionicons name={conf.icon} size={52} color={conf.color} />
        </View>

        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          {t("seller_status.title")}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: conf.color + "22" }]}>
          <Text style={[styles.statusBadgeText, { color: conf.color }]}>{t(conf.title as never)}</Text>
        </View>
        <Text style={[styles.statusDesc, { color: colors.mutedForeground }]}>
          {t(conf.desc as never)}
        </Text>

        {/* Store Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow label={t("seller_dash.store_name")} value={application.storeName} colors={colors} />
          {application.city && <InfoRow label={t("seller_apply.city")} value={application.city} colors={colors} />}
          {application.createdAt && (
            <InfoRow
              label={t("seller_status.applied")}
              value={new Date(application.createdAt).toLocaleDateString()}
              colors={colors}
            />
          )}
          {status === "rejected" && application.rejectionReason && (
            <InfoRow label={t("seller_status.rejection_reason")} value={application.rejectionReason} colors={colors} />
          )}
        </View>

        {/* Actions */}
        {status === "approved" && (
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("seller_status.go_dashboard")}</Text>
          </Pressable>
        )}
        {status === "rejected" && (
          <Pressable
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.replace("/seller-apply")}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("seller_apply.title")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8, gap: 8 },
  label: { fontSize: 13, flex: 1 },
  value: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
});

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
