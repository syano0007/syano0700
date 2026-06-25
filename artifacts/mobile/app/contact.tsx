import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
import { useScreenLayout } from "@/hooks/useScreenLayout";
import { t } from "../src/i18n";

type FormField = "name" | "email" | "subject" | "message";

export default function ContactScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topPad } = useScreenLayout();

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  function validate() {
    const e: Partial<Record<FormField, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = t("contact.err_name");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = t("contact.err_email");
    if (!form.subject.trim()) e.subject = t("contact.err_subject");
    if (!form.message.trim() || form.message.trim().length < 10) e.message = t("contact.err_message");
    return e;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitted(true);
  }

  const PRIMARY = "#10B981";

  const channels = [
    { icon: "mail-outline" as const, label: t("contact.ch_email"), value: "hello@syano.online" },
    { icon: "call-outline" as const, label: t("contact.ch_whatsapp"), value: t("contact.phone_placeholder") },
    { icon: "location-outline" as const, label: t("contact.ch_location"), value: t("contact.ch_location_value") },
  ];

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
          {t("contact.hero_title")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {/* Contact channels */}
          <View style={styles.channelsSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("contact.channels_title")}
            </Text>
            {channels.map(({ icon, label, value }) => (
              <View key={label} style={[styles.channelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.channelIcon, { backgroundColor: PRIMARY + "22" }]}>
                  <Ionicons name={icon} size={18} color={PRIMARY} />
                </View>
                <View>
                  <Text style={[styles.channelLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.channelValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              </View>
            ))}

            {/* Seller support */}
            <View style={[styles.sellerCard, { backgroundColor: PRIMARY + "0D", borderColor: PRIMARY + "33" }]}>
              <View style={styles.sellerCardHeader}>
                <Ionicons name="storefront-outline" size={16} color={PRIMARY} />
                <Text style={[styles.sellerCardTitle, { color: PRIMARY }]}>
                  {t("contact.seller_support_title")}
                </Text>
              </View>
              <Text style={[styles.sellerCardDesc, { color: colors.mutedForeground }]}>
                {t("contact.seller_support_desc")}
              </Text>
              <Text style={[styles.sellerEmail, { color: PRIMARY }]}>sellers@syano.online</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("contact.form_title")}
            </Text>

            {submitted ? (
              <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="chatbubbles-outline" size={40} color={PRIMARY} />
                <Text style={[styles.successTitle, { color: colors.foreground }]}>
                  {t("contact.success_title")}
                </Text>
                <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
                  {t("contact.success_desc")}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 14 }}>
                {(["name", "email", "subject"] as FormField[]).map((field) => (
                  <View key={field}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                      {t(`contact.field_${field}` as any)}
                    </Text>
                    <TextInput
                      value={form[field]}
                      onChangeText={(v) => {
                        setForm((f) => ({ ...f, [field]: v }));
                        setErrors((e) => ({ ...e, [field]: undefined }));
                      }}
                      placeholder={t(`contact.placeholder_${field}` as any)}
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType={field === "email" ? "email-address" : "default"}
                      autoCapitalize={field === "email" ? "none" : "words"}
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.card,
                          borderColor: errors[field] ? "#EF4444" : colors.border,
                          color: colors.foreground,
                        },
                      ]}
                    />
                    {errors[field] && (
                      <Text style={styles.errorText}>{errors[field]}</Text>
                    )}
                  </View>
                ))}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    {t("contact.field_message")}
                  </Text>
                  <TextInput
                    value={form.message}
                    onChangeText={(v) => {
                      setForm((f) => ({ ...f, message: v }));
                      setErrors((e) => ({ ...e, message: undefined }));
                    }}
                    placeholder={t("contact.placeholder_message")}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={[
                      styles.textarea,
                      {
                        backgroundColor: colors.card,
                        borderColor: errors.message ? "#EF4444" : colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                  {errors.message && (
                    <Text style={styles.errorText}>{errors.message}</Text>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [styles.submitBtn, { backgroundColor: PRIMARY, opacity: pressed ? 0.85 : 1 }]}
                  onPress={handleSubmit}
                >
                  <Text style={styles.submitText}>{t("contact.submit_btn")}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  channelsSection: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  channelIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  channelLabel: { fontSize: 11, marginBottom: 2 },
  channelValue: { fontSize: 13, fontWeight: "600" },
  sellerCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  sellerCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sellerCardTitle: { fontSize: 13, fontWeight: "700" },
  sellerCardDesc: { fontSize: 13, lineHeight: 18 },
  sellerEmail: { fontSize: 13, fontWeight: "600" },
  formSection: { paddingHorizontal: 16, gap: 14 },
  successCard: {
    alignItems: "center",
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  successTitle: { fontSize: 18, fontWeight: "700" },
  successDesc: { fontSize: 14, textAlign: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 120,
  },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: 4 },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "#050505", fontSize: 15, fontWeight: "700" },
});
