import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getBaseUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../../src/i18n";

type VerificationLevel = "none" | "basic" | "verified" | "business";

const TIER_CONFIG: Record<VerificationLevel, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; label: string }> = {
  none:     { icon: "shield-outline",           color: "#6B7280", label: "Unverified" },
  basic:    { icon: "shield-outline",           color: "#3B82F6", label: "Basic" },
  verified: { icon: "shield-checkmark-outline", color: "#10B981", label: "ID Verified" },
  business: { icon: "ribbon-outline",           color: "#8B5CF6", label: "Business" },
};

function ScoreBar({ label, score, max, tip, isNegative, colors }: {
  label: string; score: number; max: number; tip?: string; isNegative?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const display = isNegative ? Math.abs(score) : score;
  const pct = max > 0 ? Math.min((display / max) * 100, 100) : 0;
  const barColor = isNegative
    ? "#EF4444"
    : pct >= 75 ? "#10B981"
    : pct >= 50 ? "#3B82F6"
    : pct >= 25 ? "#F59E0B"
    : "#6B7280";
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreLabelWrap}>
        <Text style={[styles.scoreLabel, { color: colors.foreground }]}>{label}</Text>
        {tip && <Text style={[styles.scoreTip, { color: colors.mutedForeground }]}>{tip}</Text>}
      </View>
      <View style={[styles.scoreTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.scoreBar, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.scoreNum, { color: isNegative ? "#EF4444" : colors.foreground }]}>
        {isNegative ? `-${display}` : score}/{max}
      </Text>
    </View>
  );
}

export default function SellerTrustScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();
  const { token, user } = useAuth();
  const sellerId = user?.id;

  const { data: trustData, isLoading, isError, refetch } = useQuery({
    queryKey: ["seller-trust", sellerId],
    queryFn: async () => {
      const res = await fetch(`${getBaseUrl()}/api/sellers/${sellerId}/trust`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sellerId && !!token,
  });

  const level = (trustData?.verificationLevel ?? "none") as VerificationLevel;
  const isVerified = trustData?.isVerified ?? false;
  const score = trustData?.liveBreakdown?.total ?? null;
  const components = trustData?.liveBreakdown?.components ?? null;

  const tier = TIER_CONFIG[level] ?? TIER_CONFIG.none;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("seller_trust.title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.destructive} />
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => refetch()}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>{t("common.loading")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Tier card */}
          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.tierIcon, { backgroundColor: tier.color + "22" }]}>
              <Ionicons name={tier.icon} size={32} color={tier.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
              <Text style={[styles.verifiedStatus, { color: isVerified ? "#10B981" : colors.mutedForeground }]}>
                {isVerified ? t("seller_trust.verified") : t("seller_trust.not_verified")}
              </Text>
            </View>
            {score !== null && (
              <View style={styles.scoreCircle}>
                <Text style={[styles.scoreBig, { color: colors.foreground }]}>{score}</Text>
                <Text style={[styles.scoreMax, { color: colors.mutedForeground }]}>/100</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>
              {t("seller_trust.page_desc")}
            </Text>
          </View>

          {/* Score breakdown */}
          {components && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t("seller_trust.breakdown")}
              </Text>
              <View style={{ gap: 14 }}>
                {Object.entries(components).map(([key, val]: [string, any]) => (
                  <ScoreBar
                    key={key}
                    label={key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    score={val?.score ?? 0}
                    max={val?.max ?? 100}
                    isNegative={val?.isNegative ?? false}
                    colors={colors}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Not verified CTA */}
          {!isVerified && (
            <View style={[styles.ctaCard, { backgroundColor: colors.primary + "0D", borderColor: colors.primary + "33" }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.ctaText, { color: colors.mutedForeground }]}>
                {t("seller_trust.contact_admin")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
  tierCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  tierIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tierLabel: { fontSize: 17, fontWeight: "800" },
  verifiedStatus: { fontSize: 13, marginTop: 4 },
  scoreCircle: { alignItems: "center" },
  scoreBig: { fontSize: 28, fontWeight: "900" },
  scoreMax: { fontSize: 12 },
  desc: { fontSize: 13, lineHeight: 19 },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreLabelWrap: { width: 110 },
  scoreLabel: { fontSize: 12, fontWeight: "600" },
  scoreTip: { fontSize: 10, marginTop: 1, lineHeight: 13 },
  scoreTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  scoreBar: { height: 8, borderRadius: 4 },
  scoreNum: { fontSize: 11, fontWeight: "700", width: 48, textAlign: "right" },
  ctaCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  ctaText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
