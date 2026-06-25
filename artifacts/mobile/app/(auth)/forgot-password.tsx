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
import { getBaseUrl } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { t } from "../../src/i18n";

async function apiPost(path: string, body: object) {
  const res = await fetch(`${getBaseUrl()}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? t("auth.try_again"));
  return data;
}

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  async function handleSendCode() {
    setError("");
    if (!email.trim()) { setError(t("auth.fill_all_fields")); return; }
    setIsLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email: email.trim().toLowerCase() });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(2);
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("auth.try_again"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode() {
    setError("");
    if (!/^\d{6}$/.test(code)) { setError(t("auth.code_6_digits")); return; }
    setIsLoading(true);
    try {
      const data = await apiPost("/auth/verify-reset-otp", { email: email.trim().toLowerCase(), code });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("auth.try_again"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    if (newPassword.length < 8) { setError(t("auth.password_min_8")); return; }
    if (newPassword !== confirmPassword) { setError(t("auth.passwords_dont_match")); return; }
    setIsLoading(true);
    try {
      await apiPost("/auth/reset-password", { resetToken, password: newPassword });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(auth)/login");
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("auth.try_again"));
    } finally {
      setIsLoading(false);
    }
  }

  const stepIcons: Record<number, keyof typeof Ionicons.glyphMap> = {
    1: "mail-outline",
    2: "keypad-outline",
    3: "lock-closed-outline",
  };

  const stepTitles = [
    t("auth.forgot_password_title"),
    t("auth.check_email"),
    t("auth.create_new_password"),
  ];

  const stepSubtitles = [
    t("auth.forgot_password_subtitle"),
    `${t("auth.reset_code_sent")} ${email}`,
    t("auth.password_min_8"),
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name={stepIcons[step]} size={32} color={colors.primary} />
            </View>

            <View style={styles.stepDots}>
              {([1, 2, 3] as const).map((s) => (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: s <= step ? colors.primary : colors.border,
                      width: s === step ? 20 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              {stepTitles[step - 1]}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {stepSubtitles[step - 1]}
            </Text>
          </View>

          <View style={styles.form}>
            {step === 1 && (
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("auth.email_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onSubmitEditing={handleSendCode}
                />
              </View>
            )}

            {step === 2 && (
              <TextInput
                style={[
                  styles.codeInput,
                  { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
                ]}
                placeholder="• • • • • •"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                onSubmitEditing={handleVerifyCode}
              />
            )}

            {step === 3 && (
              <>
                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={t("auth.new_password")}
                    placeholderTextColor={colors.mutedForeground}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                  />
                  <Pressable onPress={() => setShowPassword((p) => !p)}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>

                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={t("auth.confirm_password")}
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    autoComplete="new-password"
                    onSubmitEditing={handleResetPassword}
                  />
                  <Pressable onPress={() => setShowConfirm((p) => !p)}>
                    <Ionicons
                      name={showConfirm ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
              </>
            )}

            {!!error && (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={step === 1 ? handleSendCode : step === 2 ? handleVerifyCode : handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                  {step === 1
                    ? (isLoading ? t("auth.sending") : t("auth.send_reset_code"))
                    : step === 2
                    ? (isLoading ? t("auth.verifying") : t("auth.verify_code"))
                    : (isLoading ? t("auth.resetting") : t("auth.reset_password_btn"))}
                </Text>
              )}
            </Pressable>

            {step === 2 && (
              <Pressable
                style={styles.resendBtn}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                <Text style={[styles.resendText, { color: colors.primary }]}>
                  {t("auth.resend_code")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.footerLink, { color: colors.mutedForeground }]}>
              ← {t("auth.back_to_login")}
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
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepDots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  title: { fontSize: 24, fontWeight: "700" as const, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  form: { gap: 12 },
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
  codeInput: {
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: 12,
  },
  error: { fontSize: 13, textAlign: "center" },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontWeight: "700" as const },
  resendBtn: { alignItems: "center", paddingTop: 4 },
  resendText: { fontSize: 14, fontWeight: "600" as const },
  footer: { flexDirection: "row", justifyContent: "center", paddingTop: 24 },
  footerLink: { fontSize: 14 },
});
