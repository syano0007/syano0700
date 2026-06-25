import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { t } from "../../src/i18n";
import { getBaseUrl } from "@workspace/api-client-react";

WebBrowser.maybeCompleteAuthSession();

/* Client ID is public (appears in OAuth redirect URLs) — OK to inline */
const GOOGLE_WEB_CLIENT_ID =
  "345038238714-85pmrf2d863vf3ck406umnmmot72u8s9.apps.googleusercontent.com";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /* ── Google auth setup ── */
  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      const params = response.params as { id_token?: string; access_token?: string };
      const idToken = params.id_token ?? params.access_token;
      if (idToken) {
        handleGoogleToken(idToken);
      } else {
        setError(t("auth.google_error"));
      }
    } else if (response?.type === "error") {
      setError(t("auth.google_error"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  async function handleGoogleToken(idToken: string) {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await fetch(`${getBaseUrl()}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, rememberMe: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? t("auth.google_error"));
      }
      const data = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(data);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof Error ? err.message : t("auth.google_error"));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGooglePress() {
    setError("");
    try {
      await promptAsync();
    } catch {
      setError(t("auth.google_error"));
    }
  }

  async function handleLogin() {
    setError("");
    const trimmed = identifier.trim();
    const pass = password.trim();

    if (!trimmed || !pass) {
      setError(t("auth.fill_all_fields"));
      return;
    }

    const isEmail = trimmed.includes("@");
    if (isEmail) {
      if (!trimmed.includes(".") || trimmed.indexOf("@") === 0) {
        setError(t("auth.email_invalid"));
        return;
      }
    } else {
      if (trimmed.replace(/\D/g, "").length < 5) {
        setError(t("auth.phone_invalid"));
        return;
      }
    }

    setIsLoading(true);
    try {
      const body: Record<string, string> = { password: pass };
      if (isEmail) body.email = trimmed;
      else body.phone = trimmed;

      const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const seconds: number = (data as { retryAfter?: number }).retryAfter ?? 60;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(t("auth.rate_limited", { seconds }));
        return;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({})) as { error?: string; verified?: boolean };
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (data.error === "ACCOUNT_SUSPENDED") {
          Alert.alert(t("auth.suspended_title"), t("auth.suspended_desc"));
          return;
        }
        setError(t("auth.invalid_credentials"));
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const code = err.error ?? "";
        const msg =
          code === "USER_NOT_FOUND"
            ? t("auth.no_account_found")
            : code === "INVALID_PASSWORD"
            ? t("auth.incorrect_password")
            : err.message ?? t("auth.invalid_credentials");
        setError(msg);
        return;
      }

      const data = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await login(data);
      router.replace("/(tabs)");
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
              {t("auth.welcome_back")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t("auth.login_subtitle")}
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>

            {/* Google button */}
            <Pressable
              style={({ pressed }) => [
                styles.googleBtn,
                { borderColor: colors.border, opacity: pressed || googleLoading ? 0.75 : 1 },
              ]}
              onPress={handleGooglePress}
              disabled={googleLoading || isLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" size="small" />
              ) : (
                <View style={styles.googleBtnInner}>
                  {/* Google G icon */}
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={[styles.googleBtnText, { color: "#1f1f1f" }]}>
                    {t("auth.google_signin")}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                {t("auth.or_continue_with")}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Identifier field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t("auth.identifier_label")}
              </Text>
              <View
                style={[
                  styles.inputWrap,
                  { borderColor: error && !identifier ? colors.destructive : colors.border, backgroundColor: colors.card },
                ]}
              >
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
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

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={[styles.label, { color: colors.foreground }]}>
                  {t("auth.password")}
                </Text>
                <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                  <Text style={[styles.forgotLink, { color: colors.mutedForeground }]}>
                    {t("auth.forgot_password")}
                  </Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.inputWrap,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  testID="password-input"
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={t("auth.password_placeholder")}
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
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
              testID="login-btn"
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.85 : 1 },
              ]}
              onPress={handleLogin}
              disabled={isLoading || googleLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                  {t("auth.login_btn")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {t("auth.no_account")}{" "}
          </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {t("auth.signup_link")}
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
  googleBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  googleBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  googleIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500" as const, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" as const },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotLink: { fontSize: 12 },
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
