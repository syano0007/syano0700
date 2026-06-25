import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "../../src/i18n";

interface HeroBanner {
  id: number;
  titleEn: string;
  titleAr: string;
  subtitleEn: string | null;
  subtitleAr: string | null;
  desktopImage: string;
  mobileImage: string | null;
  ctaLabelEn: string | null;
  ctaLabelAr: string | null;
  ctaUrl: string | null;
  active: boolean;
  sortOrder: number;
  impressions: number;
  clicks: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface BannerForm {
  titleEn: string;
  titleAr: string;
  desktopImage: string;
  ctaLabelEn: string;
  ctaLabelAr: string;
  ctaUrl: string;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: BannerForm = {
  titleEn: "",
  titleAr: "",
  desktopImage: "",
  ctaLabelEn: "",
  ctaLabelAr: "",
  ctaUrl: "",
  active: true,
  sortOrder: "0",
};

export default function AdminHeroBannersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  const authHeaders = { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/admin/banners`, { headers: authHeaders });
      if (res.ok) setBanners(await res.json() as HeroBanner[]);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(banner: HeroBanner) {
    setEditId(banner.id);
    setForm({
      titleEn: banner.titleEn,
      titleAr: banner.titleAr,
      desktopImage: banner.desktopImage,
      ctaLabelEn: banner.ctaLabelEn ?? "",
      ctaLabelAr: banner.ctaLabelAr ?? "",
      ctaUrl: banner.ctaUrl ?? "",
      active: banner.active,
      sortOrder: String(banner.sortOrder),
    });
    setFormError("");
    setShowModal(true);
  }

  async function saveBanner() {
    if (!form.titleEn.trim() || !form.titleAr.trim() || !form.desktopImage.trim()) {
      setFormError("Title (EN + AR) and Image URL are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = {
        titleEn: form.titleEn.trim(),
        titleAr: form.titleAr.trim(),
        desktopImage: form.desktopImage.trim(),
        ctaLabelEn: form.ctaLabelEn.trim() || null,
        ctaLabelAr: form.ctaLabelAr.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
        active: form.active,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      };
      if (editId != null) {
        await fetch(`${getBaseUrl()}/api/admin/banners/${editId}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify(body),
        });
      } else {
        await fetch(`${getBaseUrl()}/api/admin/banners`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
        });
      }
      setShowModal(false);
      await load();
    } catch {
      setFormError("Failed to save banner. Please try again.");
    }
    setSaving(false);
  }

  async function toggleActive(banner: HeroBanner) {
    try {
      await fetch(`${getBaseUrl()}/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ active: !banner.active }),
      });
      setBanners((prev) => prev.map((b) => b.id === banner.id ? { ...b, active: !b.active } : b));
    } catch { /* silent */ }
  }

  async function deleteBanner(id: number) {
    setDeletingId(id);
    try {
      await fetch(`${getBaseUrl()}/api/admin/banners/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      setBanners((prev) => prev.filter((b) => b.id !== id));
    } catch { /* silent */ }
    setDeletingId(null);
  }

  function ctr(b: HeroBanner) {
    return b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(1) : "0.0";
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("admin_dash.hero_banners")}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          onPress={openCreate}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={banners}
        keyExtractor={(b) => String(b.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{t("admin_dash.no_banners")}</Text>
              <Pressable
                style={({ pressed }) => [styles.addBtnLarge, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
                onPress={openCreate}
              >
                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>{t("admin_dash.add_banner")}</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.active ? colors.primary + "44" : colors.border }]}>
            {/* Image preview */}
            {item.desktopImage ? (
              <Image
                source={{ uri: item.desktopImage }}
                style={styles.bannerImg}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.bannerImgPlaceholder, { backgroundColor: colors.muted }]}>
                <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
              </View>
            )}

            <View style={styles.cardBody}>
              {/* Title + status */}
              <View style={styles.titleRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.titleEn, { color: colors.foreground }]} numberOfLines={1}>{item.titleEn}</Text>
                  <Text style={[styles.titleAr, { color: colors.mutedForeground }]} numberOfLines={1}>{item.titleAr}</Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: item.active ? "#10B98122" : "#EF444422", borderColor: item.active ? "#10B98144" : "#EF444444" }]}>
                  <Text style={[styles.activeBadgeText, { color: item.active ? "#10B981" : "#EF4444" }]}>
                    {item.active ? t("admin_dash.banner_active") : t("admin_dash.banner_inactive")}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Ionicons name="eye-outline" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.impressions.toLocaleString()}</Text>
                </View>
                <View style={styles.stat}>
                  <Ionicons name="hand-left-outline" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.clicks.toLocaleString()}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statText, { color: colors.primary, fontWeight: "700" as const }]}>CTR {ctr(item)}%</Text>
                </View>
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>Sort: {item.sortOrder}</Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => toggleActive(item)}
                >
                  <Ionicons
                    name={item.active ? "eye-off-outline" : "eye-outline"}
                    size={14}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>
                    {item.active ? "Deactivate" : "Activate"}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary + "22", opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => openEdit(item)}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>{t("admin_dash.edit_banner")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.actionBtn, { backgroundColor: "#EF444422", opacity: pressed || deletingId === item.id ? 0.7 : 1 }]}
                  onPress={() => deleteBanner(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>{t("admin_dash.delete")}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editId != null ? t("admin_dash.edit_banner") : t("admin_dash.add_banner")}
            </Text>
            <Pressable
              onPress={() => setShowModal(false)}
              style={[styles.modalClose, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formScroll}>
            <FormField label={t("admin_dash.title_en") + " *"} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.titleEn}
                onChangeText={(v) => setForm((f) => ({ ...f, titleEn: v }))}
                placeholder="Title in English"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
            <FormField label={t("admin_dash.title_ar") + " *"} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.titleAr}
                onChangeText={(v) => setForm((f) => ({ ...f, titleAr: v }))}
                placeholder="العنوان بالعربية"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
            <FormField label={t("admin_dash.image_url") + " *"} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.desktopImage}
                onChangeText={(v) => setForm((f) => ({ ...f, desktopImage: v }))}
                placeholder="https://..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
              />
            </FormField>
            <FormField label={t("admin_dash.cta_label_en")} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.ctaLabelEn}
                onChangeText={(v) => setForm((f) => ({ ...f, ctaLabelEn: v }))}
                placeholder="e.g. Shop Now"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
            <FormField label={t("admin_dash.cta_label_ar")} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.ctaLabelAr}
                onChangeText={(v) => setForm((f) => ({ ...f, ctaLabelAr: v }))}
                placeholder="مثال: تسوق الآن"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
            <FormField label={t("admin_dash.cta_url")} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.ctaUrl}
                onChangeText={(v) => setForm((f) => ({ ...f, ctaUrl: v }))}
                placeholder="https://..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="url"
              />
            </FormField>
            <FormField label={t("admin_dash.banner_sort")} colors={colors}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={form.sortOrder}
                onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </FormField>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.foreground }]}>{t("admin_dash.active")}</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                trackColor={{ true: colors.primary }}
                thumbColor={form.active ? "#fff" : colors.mutedForeground}
              />
            </View>

            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Text style={{ color: "#EF4444", fontSize: 13 }}>{formError}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 },
              ]}
              onPress={saveBanner}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{t("admin_dash.save")}</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FormField({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: colors.mutedForeground, fontWeight: "600" as const, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" as const },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15 },
  addBtnLarge: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  addBtnText: { fontSize: 15, fontWeight: "600" as const },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  bannerImg: { width: "100%", height: 130 },
  bannerImgPlaceholder: { width: "100%", height: 130, alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 14, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleEn: { fontSize: 15, fontWeight: "700" as const },
  titleAr: { fontSize: 13 },
  activeBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  activeBadgeText: { fontSize: 11, fontWeight: "600" as const },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" as const },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" as const },
  modalClose: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  formScroll: { padding: 20, paddingBottom: 40 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  switchLabel: { fontSize: 14, fontWeight: "500" as const },
  errorBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16 },
  saveBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700" as const },
});
