import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { t } from "../../../src/i18n";

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
  keyboardType?: "default" | "phone-pad" | "numeric" | "decimal-pad";
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
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function NewProductScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState("electronics");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t("seller_dash.product_name")); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert(t("seller_dash.price")); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || "",
        price: priceNum,
        stockQuantity: parseInt(stock, 10) || 1,
        category,
      };
      if (imageUrl.trim()) body.imageUrls = [imageUrl.trim()];

      const r = await fetch(`${getBaseUrl()}/api/sellers/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        Alert.alert(t("seller_dash.create_success"), "", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        const data = (await r.json()) as { error?: string };
        Alert.alert(data.error ?? t("seller_dash.error_save"));
      }
    } catch {
      Alert.alert(t("seller_dash.error_save"));
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("seller_dash.add_product")}</Text>
          <View style={{ width: 36 }} />
        </View>

        <Field label={t("seller_dash.product_name")} value={name} onChange={setName} placeholder={t("seller_dash.product_name_ph")} colors={colors} />
        <Field label={t("seller_dash.description")} value={description} onChange={setDescription} placeholder={t("seller_dash.description_ph")} multiline colors={colors} />
        <Field label={t("seller_dash.price")} value={price} onChange={setPrice} placeholder={t("seller_dash.price_ph")} keyboardType="decimal-pad" colors={colors} />

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Stock Quantity</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={stock}
            onChangeText={setStock}
            placeholder="1"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
          />
        </View>

        {/* Category Picker */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>{t("seller_dash.category")}</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => {
              const sel = cat === category;
              return (
                <Pressable
                  key={cat}
                  style={[styles.catChip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label="Image URL (optional)" value={imageUrl} onChange={setImageUrl} placeholder="https://..." colors={colors} />

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
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{t("seller_dash.save")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 13, fontWeight: "500" },
  saveBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4 },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
});
