import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { t } from "../src/i18n";

export default function OrderSuccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { orderId, total } = useLocalSearchParams<{ orderId: string; total: string }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 150,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Animated checkmark */}
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.iconOuter, { backgroundColor: colors.primary + "15" }]}>
            <View style={[styles.iconInner, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={40} color={colors.primaryForeground} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>{t("order_success.title")}</Text>
          {orderId && (
            <Text style={[styles.orderNum, { color: colors.mutedForeground }]}>
              Order <Text style={{ color: colors.foreground, fontWeight: "700" as const }}>#{orderId}</Text> {t("order_success.confirmed")}
            </Text>
          )}
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t("order_success.subtitle")}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.detailsCard, { opacity: fadeAnim, backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row label={t("order_success.order_total")} value={total ? `$${parseFloat(total).toFixed(2)}` : "—"} colors={colors} bold />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label={t("order_success.payment")} value={t("order_success.cod")} colors={colors} />
          <Row label={t("order_success.est_delivery")} value={t("order_success.est_delivery_range")} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.codNote}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={[styles.codText, { color: colors.mutedForeground }]}>
              {t("order_success.cod_note")}
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.buttons, { opacity: fadeAnim, paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.replace("/(tabs)/orders" as Href)}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.primaryForeground} />
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            {t("order_success.track_order")}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
          onPress={() => router.replace("/(tabs)" as Href)}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            {t("order_success.continue_shopping")}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Row({ label, value, colors, bold }: { label: string; value: string; colors: ReturnType<typeof useColors>; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground, fontWeight: bold ? "700" : "500" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, gap: 24 },
  iconWrap: { alignItems: "center", justifyContent: "center" },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { alignItems: "center", gap: 8 },
  heading: { fontSize: 28, fontWeight: "800" as const },
  orderNum: { fontSize: 15 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 300 },
  detailsCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13 },
  divider: { height: 1 },
  codNote: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  codText: { fontSize: 12, flex: 1, lineHeight: 18 },
  buttons: { paddingHorizontal: 24, gap: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700" as const },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" as const },
});
