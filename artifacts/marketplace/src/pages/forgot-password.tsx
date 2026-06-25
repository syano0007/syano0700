import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Mail, KeyRound, Lock } from "lucide-react";
import TurnstileWidget, { type TurnstileHandle } from "@/components/TurnstileWidget";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tsToken, setTsToken] = useState("");
  const tsRef = useRef<TurnstileHandle>(null);

  async function handleSendCode() {
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          locale: i18n.language,
          turnstileToken: tsToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "TURNSTILE_INVALID") {
          tsRef.current?.reset();
          setTsToken("");
          throw new Error(
            isRtl
              ? "تعذر التحقق من الطلب. يرجى المحاولة مرة أخرى."
              : "Verification failed. Please try again.",
          );
        }
        throw new Error(data.error ?? t("auth.try_again"));
      }
      setStep(2);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!/^\d{6}$/.test(code)) {
      toast({ title: t("auth.code_6_digits"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("auth.try_again"));
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      toast({ title: t("auth.password_min_8"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("auth.passwords_dont_match"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("auth.try_again"));
      toast({ title: t("auth.password_reset_success") });
      setLocation("/login");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Step dots */}
          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Email + Turnstile ── */}
          {step === 1 && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{t("auth.forgot_password_title")}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("auth.forgot_password_subtitle")}</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={t("auth.email_placeholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                />
                <TurnstileWidget
                  ref={tsRef}
                  containerId="ts-fp-page"
                  onVerify={setTsToken}
                  onExpire={() => setTsToken("")}
                />
                <Button
                  className="w-full h-11 font-semibold"
                  onClick={handleSendCode}
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? t("auth.sending") : t("auth.send_reset_code")}
                </Button>
                <div className="text-center pt-1">
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    <BackIcon className="h-3.5 w-3.5" />
                    {t("auth.back_to_login")}
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: OTP code ── */}
          {step === 2 && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{t("auth.check_email")}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("auth.reset_code_sent", { email })}
                </p>
              </div>
              <div className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("auth.enter_reset_code")}
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  className="text-center tracking-[0.3em] text-xl h-14 font-mono"
                />
                <Button
                  className="w-full h-11 font-semibold"
                  onClick={handleVerifyCode}
                  disabled={isLoading || code.length !== 6}
                >
                  {isLoading ? t("auth.verifying") : t("auth.verify_code")}
                </Button>
                <div className="flex items-center justify-between text-sm pt-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    onClick={() => { setCode(""); setStep(1); }}
                  >
                    <BackIcon className="h-3.5 w-3.5" />
                    {t("auth.back_to_login")}
                  </button>
                  <button
                    type="button"
                    className="text-primary hover:underline disabled:opacity-50"
                    onClick={handleSendCode}
                    disabled={isLoading}
                  >
                    {t("auth.resend_code")}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 3: New password ── */}
          {step === 3 && (
            <>
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Lock className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{t("auth.create_new_password")}</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("auth.new_password_subtitle")}</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("auth.new_password")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("auth.confirm_password")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
                <Button
                  className="w-full h-11 font-semibold"
                  onClick={handleResetPassword}
                  disabled={isLoading || !newPassword || !confirmPassword}
                >
                  {isLoading ? t("auth.resetting") : t("auth.reset_password_btn")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
