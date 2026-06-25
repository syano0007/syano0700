import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { t } from "../../src/i18n";
import { getBaseUrl } from "@workspace/api-client-react";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    setError("");

    const trimmedName = name.trim();
    const trimmedId = identifier.trim();

    if (!trimmedName || !trimmedId || !password) {
      setError(t("auth.fill_all_fields"));
      return;
    }
    if (trimmedName.length < 2) {
      setError(t("auth.name_min"));
      return;
    }

    const isEmail = trimmedId.includes("@");
    if (isEmail) {
      if (!trimmedId.includes(".") || trimmedId.indexOf("@") === 0) {
        setError(t("auth.email_invalid"));
        return;
      }
    } else {
      if (trimmedId.replace(/\D/g, "").length < 5) {
        setError(t("auth.phone_invalid"));
        return;
      }
    }

    if (password.length < 8) {
      setError(t("auth.password_min"));
      return;
    }

    setIsLoading(true);
    try {
      const body: Record<string, string> = {
        name: trimmedName,
        password,
      };
      if (isEmail) body.email = trimmedId;
      else body.phone = trimmedId;

      const res = await fetch(`${getBaseUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({})) as { retryAfter?: number };
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(t("auth.rate_limited", { seconds: data.retryAfter ?? 60 }));
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const code = err.error ?? err.message ?? "";
        const msg =
          code === "Email already registered" || code === "email_taken"
            ? t("auth.email_taken")
            : code === "Phone number already registered" || code === "phone_taken"
            ? t("auth.phone_taken")
            : err.message ?? t("auth.try_again");
        setError(msg);
        return;
      }

      const data = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (data.token) {
        await login(data);
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t("auth.try_again"));
    } finally {
      setIsLoading(false);
    }
  }

  const topInset = Platform.OS === "web" ? 0 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 48, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
              <Text style={[styles.logoText, { color: colors.primaryForeground }]}>S</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t("auth.create_account")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t("auth.register_subtitle")}
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t("auth.full_name")}
              </Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("auth.name_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(""); }}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Email or Phone */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t("auth.identifier_label")}
              </Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  testID="identifier-input"
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("auth.identifier_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={identifier}
                  onChangeText={(v) => { setIdentifier(v); setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t("auth.password")}
              </Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  testID="password-input"
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("auth.password_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable
                  onPress={() => setShowPassword((p) => !p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {t("auth.password_min")}
              </Text>
            </View>

            {/* Error */}
            {!!error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <Pressable
              testID="register-btn"
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 },
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                  {t("auth.create_btn")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {t("auth.have_account")}{" "}
          </Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {t("auth.login_link")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  formSection: { gap: 24 },
  header: { alignItems: "center", gap: 10 },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  title: { fontSize: 26, fontWeight: "700" as const, textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 21 },
  form: { gap: 14 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" as const },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    height: 50,
  },
  input: { flex: 1, fontSize: 15 },
  hint: { fontSize: 12, marginTop: 2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  error: { flex: 1, fontSize: 13, lineHeight: 18 },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  submitText: { fontSize: 16, fontWeight: "700" as const },
  footer: { flexDirection: "row", justifyContent: "center", paddingTop: 28 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: "600" as const },
});
