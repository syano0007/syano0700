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

const CATEGORIES = [
  "electronics", "clothing", "food", "books", "home",
  "beauty", "sports", "toys", "jewelry", "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronics", clothing: "Clothing", food: "Food & Drink",
  books: "Books", home: "Home & Garden", beauty: "Beauty",
  sports: "Sports", toys: "Toys", jewelry: "Jewelry", other: "Other",
};

function Field({
  label, value, onChange, placeholder, multiline = false,
  keyboardType = "default", colors,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; multiline?: boolean;
  keyboardType?: "default" | "phone-pad";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={fStyles.field}>
      <Text style={[fStyles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[
          fStyles.input,
          multiline && { height: 100, textAlignVertical: "top" },
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const fStyles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
});

export default function SellerApplyScreen() {
  const colors = useColors();
  const { topPad } = useScreenLayout();
  const { token, isAuthenticated } = useAuth();

  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setChecking(false); return; }
    fetch(`${getBaseUrl()}/api/sellers/application`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.ok) router.replace("/seller-application-status");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [token, isAuthenticated]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async () => {
    if (!storeName.trim() || storeName.trim().length < 2) {
      Alert.alert(t("seller_apply.name_min")); return;
    }
    if (!phone.trim()) {
      Alert.alert(t("seller_apply.phone_required")); return;
    }
    if (!city.trim()) {
      Alert.alert(t("seller_apply.city_required")); return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert(t("seller_apply.categories_required")); return;
    }
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert(t("seller_apply.desc_min")); return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/sellers/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeName: storeName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          categories: selectedCategories,
          description: description.trim(),
        }),
      });
      if (res.ok || res.status === 409) {
        Alert.alert(t("seller_apply.success"), t("seller_apply.success_desc"), [
          { text: "OK", onPress: () => router.replace("/seller-application-status") },
        ]);
      } else {
        const data = (await res.json()) as { error?: string };
        Alert.alert(data.error ?? t("seller_apply.error"));
      }
    } catch {
      Alert.alert(t("seller_apply.error"));
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_apply.title")}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t("seller_apply.subtitle")}</Text>
          </View>
        </View>

        {/* Form */}
        <Field label={t("seller_apply.store_name")} value={storeName} onChange={setStoreName} placeholder={t("seller_apply.store_name_ph")} colors={colors} />
        <Field label={t("seller_apply.phone")} value={phone} onChange={setPhone} placeholder={t("seller_apply.phone_ph")} keyboardType="phone-pad" colors={colors} />
        <Field label={t("seller_apply.city")} value={city} onChange={setCity} placeholder={t("seller_apply.city_ph")} colors={colors} />

        {/* Categories */}
        <View style={fStyles.field}>
          <Text style={[fStyles.label, { color: colors.foreground }]}>{t("seller_apply.categories")}</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat);
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text style={[styles.catChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label={t("seller_apply.description")} value={description} onChange={setDescription} placeholder={t("seller_apply.description_ph")} multiline colors={colors} />

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: submitting ? colors.muted : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t("seller_apply.submit")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginTop: 2 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  categoriesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: "500" },
  btn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontWeight: "700" },
});
