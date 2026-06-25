import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getBaseUrl } from "@workspace/api-client-react";
import { t } from "../src/i18n";

const VEHICLE_TYPES = [
  { key: "motorcycle", label: "v_motorcycle" as const },
  { key: "scooter",    label: "v_scooter"    as const },
  { key: "car",        label: "v_car"         as const },
  { key: "bicycle",    label: "v_bicycle"     as const },
] as const;

export default function CourierApplyScreen() {
  const colors = useColors();
  const { topPad } = useScreenLayout();
  const { token, isAuthenticated, isCourier } = useAuth();

  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("motorcycle");
  const [district, setDistrict] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isCourier) { router.replace("/courier/dashboard"); return; }
    if (!isAuthenticated) { setChecking(false); return; }
    fetch(`${getBaseUrl()}/api/couriers/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (r.ok) router.replace("/courier-application-status"); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [token, isAuthenticated, isCourier]);

  const handleSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert(t("courier_apply.phone_required")); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/couriers/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: phone.trim(), vehicleType, district: district.trim() || null }),
      });
      if (res.ok || res.status === 409) {
        Alert.alert(t("courier_apply.success"), t("courier_apply.success_desc"), [
          { text: "OK", onPress: () => router.replace("/courier-application-status") },
        ]);
      } else {
        const data = (await res.json()) as { error?: string };
        Alert.alert(data.error ?? t("courier_apply.error"));
      }
    } catch {
      Alert.alert(t("courier_apply.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Please sign in first</Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.replace("/(auth)/login")}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "600" }}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (checking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("courier_apply.title")}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t("courier_apply.subtitle")}</Text>
          </View>
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("courier_apply.phone")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("courier_apply.phone_ph")}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
          />
        </View>

        {/* Vehicle Type */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("courier_apply.vehicle")}</Text>
          <View style={styles.vehicleGrid}>
            {VEHICLE_TYPES.map((v) => {
              const selected = vehicleType === v.key;
              return (
                <Pressable
                  key={v.key}
                  style={[
                    styles.vehicleChip,
                    { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border },
                  ]}
                  onPress={() => setVehicleType(v.key)}
                >
                  <Text style={[styles.vehicleChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                    {t(`courier_apply.${v.label}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* District */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("courier_apply.district")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={district}
            onChangeText={setDistrict}
            placeholder={t("courier_apply.district_ph")}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: submitting ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 8 },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("courier_apply.submit")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 4 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginTop: 2 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  vehicleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vehicleChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  vehicleChipText: { fontSize: 13, fontWeight: "500" },
  btn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontWeight: "700" },
});
