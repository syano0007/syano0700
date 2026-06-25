import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/features";
import type { AuthResponse } from "@workspace/api-client-react";

function maskIdentifier(id: string): string {
  if (id.includes("@")) {
    const [local, domain] = id.split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
  }
  if (id.length > 6) {
    return `${id.slice(0, 4)}${"*".repeat(id.length - 6)}${id.slice(-2)}`;
  }
  return `${id.slice(0, 2)}****`;
}

export default function VerifyPage() {
  const [, setLocation] = useLocation();
  const { login: setAuth } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const params = new URLSearchParams(window.location.search);
  const identifier = params.get("identifier") ?? "";
  const method = (params.get("method") as "email" | "phone") ?? (identifier.includes("@") ? "email" : "phone");
  const redirectTo = params.get("redirect") ?? "/";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!FEATURES.EMAIL_VERIFICATION_ENABLED && !FEATURES.PHONE_VERIFICATION_ENABLED) {
      setLocation("/");
    }
  }, [setLocation]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (!identifier) setLocation("/register");
  }, [identifier, setLocation]);

  const code = digits.join("");
  const isComplete = digits.every((d) => /\d/.test(d));

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError(null);
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && isComplete) void handleSubmit();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    setError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async () => {
    if (!isComplete || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.lockedUntil) setLockedUntil(new Date(data.lockedUntil));
        setAttemptsRemaining(data.attemptsRemaining ?? null);
        setError(data.error ?? t("verify.invalid_code"));
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }

      const authData = data as AuthResponse;
      setAuth(authData, true);
      toast({ title: t("verify.success_title"), description: t("verify.success_desc") });

      if (authData.user.role === "admin") setLocation("/admin");
      else if (authData.user.role === "seller") setLocation("/seller/dashboard");
      else setLocation(redirectTo);
    } catch {
      setError(t("verify.network_error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, locale: i18n.language }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      setAttemptsRemaining(null);
      setLockedUntil(null);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      toast({ title: t("verify.resent_title") });
    } catch {
      setError(t("verify.network_error"));
    } finally {
      setIsResending(false);
    }
  };

  if (!identifier) return null;

  return (
    <Layout>
      <div className="container flex-1 flex items-center justify-center py-12 md:py-16 px-4">
        <div className="w-full max-w-md bg-card border border-border p-7 md:p-8 rounded-2xl shadow-sm">

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl" aria-hidden="true">{method === "email" ? "✉️" : "📱"}</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {t("verify.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t(method === "email" ? "verify.sent_email" : "verify.sent_phone", {
                identifier: maskIdentifier(identifier),
              })}
            </p>
          </div>

          {/* OTP digit boxes */}
          <div
            className="flex justify-center gap-2 sm:gap-3 mb-6"
            dir="ltr"
            onPaste={handlePaste}
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                autoFocus={i === 0}
                aria-label={`Digit ${i + 1}`}
                className={cn(
                  "w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2",
                  "bg-background text-foreground transition-colors duration-150",
                  "focus:outline-none focus:ring-0",
                  error
                    ? "border-destructive focus:border-destructive"
                    : digit
                    ? "border-primary"
                    : "border-border focus:border-primary"
                )}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 text-center">
              <p className="text-destructive text-sm">{error}</p>
              {attemptsRemaining !== null && attemptsRemaining > 0 && (
                <p className="text-muted-foreground text-xs mt-1">
                  {t("verify.attempts_remaining", { count: attemptsRemaining })}
                </p>
              )}
              {lockedUntil && (
                <p className="text-muted-foreground text-xs mt-1">
                  {t("verify.locked_until", { time: lockedUntil.toLocaleTimeString() })}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full h-11 text-sm font-semibold"
            onClick={handleSubmit}
            disabled={!isComplete || isLoading || (lockedUntil ? lockedUntil > new Date() : false)}
          >
            {isLoading ? t("verify.verifying") : t("verify.verify_btn")}
          </Button>

          {/* Resend */}
          <div className="mt-5 text-center space-y-1">
            <p className="text-sm text-muted-foreground">{t("verify.no_code")}</p>
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("verify.resend_in", { seconds: countdown })}
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-sm text-primary hover:underline font-semibold disabled:opacity-50"
              >
                {isResending ? t("verify.resending") : t("verify.resend_btn")}
              </button>
            )}
          </div>

          {/* Wrong identifier */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            {t("verify.wrong_identifier")}{" "}
            <a href="/register" className="text-primary hover:underline font-medium">
              {t("verify.use_different")}
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
