import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

interface StoreData {
  storeName: string;
  storeDescription: string | null;
  storeLogo: string | null;
  storeBanner: string | null;
  city: string | null;
  website: string | null;
}

function Field({
  label, value, onChange, placeholder, multiline = false, colors,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; multiline?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && { height: 100, textAlignVertical: "top" },
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
      />
    </View>
  );
}

export default function StoreSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState("");
  const [banner, setBanner] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${getBaseUrl()}/api/sellers/store-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as StoreData;
        setStoreName(data.storeName ?? "");
        setDescription(data.storeDescription ?? "");
        setLogo(data.storeLogo ?? "");
        setBanner(data.storeBanner ?? "");
        setCity(data.city ?? "");
        setWebsite(data.website ?? "");
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!storeName.trim()) { Alert.alert(t("seller_dash.store_name")); return; }
    setSaving(true);
    try {
      const r = await fetch(`${getBaseUrl()}/api/sellers/store-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeName: storeName.trim(),
          storeDescription: description.trim() || null,
          storeLogo: logo.trim() || null,
          storeBanner: banner.trim() || null,
          city: city.trim() || null,
          website: website.trim() || null,
        }),
      });
      if (r.ok) {
        Alert.alert(t("seller_dash.store_saved"));
      } else {
        Alert.alert("Failed to save settings");
      }
    } catch {
      Alert.alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.store_settings")}</Text>
          <View style={{ width: 36 }} />
        </View>

        <Field label={t("seller_dash.store_name")} value={storeName} onChange={setStoreName} placeholder="My Store" colors={colors} />
        <Field label={t("seller_dash.store_description")} value={description} onChange={setDescription} placeholder="Describe your store..." multiline colors={colors} />
        <Field label={t("seller_dash.store_logo")} value={logo} onChange={setLogo} placeholder="https://..." colors={colors} />
        <Field label={t("seller_dash.store_banner")} value={banner} onChange={setBanner} placeholder="https://..." colors={colors} />
        <Field label={t("seller_dash.store_city")} value={city} onChange={setCity} placeholder="Damascus, Aleppo..." colors={colors} />
        <Field label={t("seller_dash.store_website")} value={website} onChange={setWebsite} placeholder="https://..." colors={colors} />

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: saving ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{t("seller_dash.store_save")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  saveBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
});
