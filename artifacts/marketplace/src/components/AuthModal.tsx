import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal, type AuthView } from "@/contexts/AuthModalContext";
import { useToast } from "@/hooks/use-toast";
import type { AuthResponse } from "@workspace/api-client-react";
import {
  X, Eye, EyeOff, Mail, KeyRound, Lock,
  ChevronLeft, ChevronRight, User, Phone,
} from "lucide-react";
import TurnstileWidget, { type TurnstileHandle } from "@/components/TurnstileWidget";

/* ─── Google Identity Services types ───────────────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (fn?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void) => void;
          renderButton: (parent: HTMLElement, options: {
            type?: "standard" | "icon";
            size?: "large" | "medium" | "small";
            theme?: "outline" | "filled_blue" | "filled_black";
            text?: string;
            shape?: "rectangular" | "pill" | "circle" | "square";
            width?: number;
          }) => void;
          cancel: () => void;
        };
      };
    };
    FB?: {
      init: (cfg: { appId: string; version: string; xfbml: boolean; cookie: boolean }) => void;
      login: (
        callback: (r: { authResponse?: { accessToken: string }; status: string }) => void,
        opts?: { scope: string }
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let _cachedClientId: string | null | undefined = undefined;
async function getGoogleClientId(): Promise<string | null> {
  if (_cachedClientId !== undefined) return _cachedClientId as string | null;
  try {
    const res = await fetch("/api/auth/google-client-id");
    if (!res.ok) { _cachedClientId = null; return null; }
    const d = await res.json() as { clientId?: string };
    _cachedClientId = d.clientId ?? null;
    return _cachedClientId as string | null;
  } catch {
    _cachedClientId = null;
    return null;
  }
}

/* ─── GOOGLE SIGN-IN BUTTON ─────────────────────────────────────────────── */
function GoogleSignInButton({
  rememberMe = true,
  onError,
}: {
  rememberMe?: boolean;
  onError?: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const { login: setAuth } = useAuth();
  const { close } = useAuthModal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);

  const handleCredential = useCallback(async (credential: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: credential, rememberMe }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? t("auth.google_error"));
      }
      const data: AuthResponse = await res.json();
      setAuth(data, rememberMe);
      toast({ title: t("auth.login_success") });
      close();
      if (data.user.role === "admin") navigate("/admin");
      else if (data.user.role === "seller") navigate("/seller/dashboard");
      else if (data.user.role === "courier") navigate("/courier");
      else navigate("/");
    } catch (err: unknown) {
      onError?.(err instanceof Error ? err.message : t("auth.google_error"));
    } finally {
      setLoading(false);
    }
  }, [rememberMe, close, navigate, setAuth, t, toast, onError]);

  const handleClick = useCallback(async () => {
    if (loading) return;
    const clientId = await getGoogleClientId();
    if (!clientId) {
      onError?.(t("auth.google_error"));
      return;
    }
    if (!window.google?.accounts?.id) {
      onError?.(t("auth.google_error"));
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (r) => handleCredential(r.credential),
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Primary: use renderButton popup flow (reliable across all browsers).
    // Render Google's button into a hidden div, then click it programmatically.
    // This avoids One Tap suppression, which silently blocks prompt() in many
    // browser/iframe contexts.
    const container = hiddenRef.current;
    if (container) {
      container.innerHTML = "";
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        size: "large",
        theme: "outline",
      });
      const rendered = container.querySelector("div[role=button]") as HTMLElement | null;
      if (rendered) {
        rendered.click();
        return;
      }
    }

    // Fallback: One Tap prompt (may be suppressed, but better than nothing)
    window.google.accounts.id.prompt((n) => {
      if (n?.isNotDisplayed() || n?.isSkippedMoment()) {
        onError?.(t("auth.google_error"));
      }
    });
  }, [loading, handleCredential, onError, t]);

  return (
    <>
      {/* Hidden container for Google's rendered button — clicked programmatically */}
      <div ref={hiddenRef} className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true" />
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-input bg-white hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-[#1f1f1f] text-sm font-semibold transition-all duration-150 shadow-sm"
      >
        {loading ? (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-[#4285F4] animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.251 17.64 11.943 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
        )}
        {loading ? t("auth.google_loading") : t("auth.google_signin")}
      </button>
    </>
  );
}

/* ─── FACEBOOK SDK LOADER ───────────────────────────────────────────────────── */
let _fbAppIdCache: string | null | undefined = undefined;
async function getFacebookAppId(): Promise<string | null> {
  if (_fbAppIdCache !== undefined) return _fbAppIdCache;
  try {
    const res = await fetch("/api/auth/facebook-app-id");
    if (!res.ok) { _fbAppIdCache = null; return null; }
    const d = await res.json() as { appId?: string };
    _fbAppIdCache = d.appId ?? null;
    return _fbAppIdCache;
  } catch {
    _fbAppIdCache = null;
    return null;
  }
}

let _fbSdkLoaded = false;
let _fbSdkPromise: Promise<void> | null = null;
function loadFBSDK(appId: string): Promise<void> {
  if (_fbSdkLoaded && window.FB) return Promise.resolve();
  if (_fbSdkPromise) return _fbSdkPromise;
  _fbSdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, version: "v21.0", xfbml: false, cookie: false });
      _fbSdkLoaded = true;
      resolve();
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.onerror = () => { _fbSdkPromise = null; reject(new Error("Facebook SDK failed to load")); };
      document.head.appendChild(s);
    }
  });
  return _fbSdkPromise;
}

/* ─── FACEBOOK SIGN-IN BUTTON ───────────────────────────────────────────────── */
// Returns null (renders nothing) when FACEBOOK_LOGIN_ENABLED=false on the server.
// All Facebook code is preserved — set the flag to "true" to re-activate.
function FacebookSignInButton({
  rememberMe = true,
  onError,
}: {
  rememberMe?: boolean;
  onError?: (msg: string) => void;
}) {
  const { t } = useTranslation();
  const { login: setAuth } = useAuth();
  const { close } = useAuthModal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);
  // null = still checking | false = disabled | string = enabled with appId
  const [appId, setAppId] = useState<string | false | null>(null);

  useEffect(() => {
    getFacebookAppId().then(id => {
      setAppId(id ?? false);
      if (id) loadFBSDK(id).catch(() => {});
    });
  }, []);

  // Hidden until we confirm the feature is enabled server-side
  if (appId === null || appId === false) return null;

  const handleClick = useCallback(async () => {
    if (loading || !appId) return;
    // appId is already loaded from state (component only renders when it's a string)
    // Re-load SDK as a safety measure in case it wasn't ready yet
    try {
      await loadFBSDK(appId);
    } catch {
      onError?.(t("auth.facebook_error"));
      return;
    }

    if (!window.FB) { onError?.(t("auth.facebook_error")); return; }

    setLoading(true);

    window.FB.login(async (response) => {
      if (!response.authResponse?.accessToken) {
        setLoading(false);
        return; // user cancelled — no error shown
      }
      try {
        const res = await fetch("/api/auth/facebook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: response.authResponse.accessToken, rememberMe }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? t("auth.facebook_error"));
        }
        const data: AuthResponse = await res.json();
        setAuth(data, rememberMe);
        toast({ title: t("auth.login_success") });
        close();
        if (data.user.role === "admin") navigate("/admin");
        else if (data.user.role === "seller") navigate("/seller/dashboard");
        else if (data.user.role === "courier") navigate("/courier");
        else navigate("/");
      } catch (err: unknown) {
        onError?.(err instanceof Error ? err.message : t("auth.facebook_error"));
      } finally {
        setLoading(false);
      }
    }, { scope: "email" });
  }, [loading, appId, onError, t, setAuth, close, navigate, toast, rememberMe]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 flex items-center justify-center gap-3 rounded-xl bg-[#1877F2] hover:bg-[#1565D8] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-150 shadow-sm"
    >
      {loading ? (
        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )}
      {loading ? t("auth.facebook_loading") : t("auth.facebook_signin")}
    </button>
  );
}

function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[0.75rem] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

/* ─── tiny helpers ─────────────────────────────────────────────────────── */
function InputField({
  label, id, type = "text", value, onChange, placeholder, autoComplete, autoFocus,
  rightSlot, disabled,
}: {
  label?: string; id: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  autoComplete?: string; autoFocus?: boolean;
  rightSlot?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="block text-[0.8125rem] font-semibold text-foreground/80">{label}</label>}
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          className="w-full h-11 rounded-xl border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors disabled:opacity-50"
          style={{ paddingInlineEnd: rightSlot ? "2.75rem" : undefined }}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 end-0 flex items-center pe-3">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  label, id, value, onChange, placeholder, autoComplete, autoFocus, disabled,
}: {
  label?: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; autoFocus?: boolean; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const Icon = show ? EyeOff : Eye;
  return (
    <InputField
      label={label} id={id} type={show ? "text" : "password"} value={value}
      onChange={onChange} placeholder={placeholder}
      autoComplete={autoComplete} autoFocus={autoFocus} disabled={disabled}
      rightSlot={
        <button type="button" onClick={() => setShow(s => !s)}
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Hide password" : "Show password"}>
          <Icon className="h-4 w-4" />
        </button>
      }
    />
  );
}

/* ─── LOGIN VIEW ────────────────────────────────────────────────────────── */
function LoginView({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { t, i18n } = useTranslation();
  const { login: setAuth } = useAuth();
  const { close } = useAuthModal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isRtl = i18n.language === "ar";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [tsToken, setTsToken]       = useState("");
  const [tsEnabled, setTsEnabled]   = useState(false);
  const tsRef = useRef<TurnstileHandle>(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) return;
    setLoading(true);
    try {
      const id = identifier.trim();
      const isEmail = id.includes("@");
      const body = { ...(isEmail ? { email: id } : { phone: id }), password, turnstileToken: tsToken };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        throw new Error(t("auth.rate_limited", { seconds: d.retryAfter ?? 60 }));
      }
      if (res.status === 403) {
        const d = await res.json();
        if (d.verified === false) {
          close();
          const method = d.method ?? (isEmail ? "email" : "phone");
          navigate(`/verify?identifier=${encodeURIComponent(id)}&method=${method}`);
          return;
        }
        if (d.error === "ACCOUNT_SUSPENDED") {
          toast({ title: t("auth.suspended_title"), description: t("auth.suspended_desc"), variant: "destructive" });
          close();
          setTimeout(() => navigate("/account-suspended"), 1200);
          return;
        }
        throw new Error(d.message || t("auth.invalid_credentials"));
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err.error ?? "";
        if (code === "TURNSTILE_INVALID") {
          tsRef.current?.reset();
          setTsToken("");
          throw new Error(isRtl ? "تعذر التحقق من الطلب. يرجى المحاولة مرة أخرى." : "Verification failed. Please try again.");
        }
        throw new Error(
          code === "USER_NOT_FOUND" ? t("auth.no_account_found") :
          code === "INVALID_PASSWORD" ? t("auth.incorrect_password") :
          err.message || t("auth.invalid_credentials")
        );
      }

      const data: AuthResponse = await res.json();
      setAuth(data, rememberMe);
      toast({ title: t("auth.login_success") });
      close();

      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirect");
      if (data.user.role === "admin") navigate("/admin");
      else if (data.user.role === "seller") navigate("/seller/dashboard");
      else if (data.user.role === "courier") navigate("/courier");
      else navigate(redirectTo || "/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("auth.invalid_credentials");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [identifier, password, tsToken, rememberMe, close, navigate, setAuth, t, toast, isRtl]);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center space-y-1 mb-2">
        <h2 className="text-[1.375rem] font-bold tracking-tight text-foreground">
          {isRtl ? "مرحباً بعودتك" : "Welcome back"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRtl ? "سجّل دخولك للمتابعة في التسوق على سيانو" : "Sign in to continue shopping on SYANO"}
        </p>
      </div>

      <GoogleSignInButton rememberMe={rememberMe} onError={setError} />
      <FacebookSignInButton rememberMe={rememberMe} onError={setError} />
      <OrDivider label={t("auth.or_continue_with")} />

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <InputField
        id="am-identifier" label={isRtl ? "البريد الإلكتروني / الهاتف" : "Email or Phone"}
        value={identifier} onChange={setIdentifier}
        placeholder={isRtl ? "email@example.com" : "email@example.com"}
        autoComplete="username email" autoFocus disabled={loading}
      />
      <PasswordField
        id="am-password" label={isRtl ? "كلمة المرور" : "Password"}
        value={password} onChange={setPassword}
        placeholder={isRtl ? "كلمة المرور" : "Password"}
        autoComplete="current-password" disabled={loading}
      />

      <div className="flex items-center justify-between" dir={isRtl ? "rtl" : "ltr"}>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary" />
          <span className="text-[0.8125rem] text-foreground/70">{isRtl ? "تذكرني" : "Remember me"}</span>
        </label>
        <button type="button" onClick={() => onSwitch("forgot")}
          className="text-[0.8125rem] font-medium text-primary hover:text-primary/80 transition-colors">
          {isRtl ? "نسيت كلمة المرور؟" : "Forgot password?"}
        </button>
      </div>

      <TurnstileWidget
        ref={tsRef}
        containerId="ts-login"
        onVerify={setTsToken}
        onExpire={() => setTsToken("")}
        onEnabled={setTsEnabled}
      />
      <button
        type="submit" disabled={loading || !identifier.trim() || !password || (tsEnabled && !tsToken)}
        className="w-full h-11 rounded-xl bg-primary hover:bg-primary/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all duration-150 shadow-md shadow-primary/20">
        {loading ? (isRtl ? "جارٍ تسجيل الدخول..." : "Signing in…") : (isRtl ? "تسجيل الدخول" : "Log In")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {isRtl ? "ليس لديك حساب؟ " : "Don't have an account? "}
        <button type="button" onClick={() => onSwitch("register")}
          className="font-semibold text-primary hover:text-primary/80 transition-colors">
          {isRtl ? "إنشاء حساب" : "Sign Up"}
        </button>
      </p>
    </form>
  );
}

/* ─── REGISTER VIEW ─────────────────────────────────────────────────────── */
function RegisterView({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { t, i18n } = useTranslation();
  const { login: setAuth } = useAuth();
  const { close } = useAuthModal();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isRtl = i18n.language === "ar";

  const [name, setName]             = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [terms, setTerms]           = useState(false);
  const [rememberMe]                = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [tsToken, setTsToken]       = useState("");
  const [tsEnabled, setTsEnabled]   = useState(false);
  const tsRef = useRef<TurnstileHandle>(null);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !identifier.trim() || !password) return;
    if (password !== confirm) {
      setError(t("auth.passwords_dont_match"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.password_min_8"));
      return;
    }
    if (!terms) {
      setError(isRtl ? "يجب الموافقة على الشروط والأحكام" : "You must accept the terms to continue");
      return;
    }
    setLoading(true);
    try {
      const id = identifier.trim();
      const isEmail = id.includes("@");
      const body: Record<string, unknown> = { name: name.trim(), password, turnstileToken: tsToken };
      if (isEmail) body.email = id; else body.phone = id;

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        throw new Error(t("auth.rate_limited", { seconds: d.retryAfter ?? 60 }));
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err.error ?? "";
        if (code === "TURNSTILE_INVALID") {
          tsRef.current?.reset();
          setTsToken("");
          throw new Error(isRtl ? "تعذر التحقق من الطلب. يرجى المحاولة مرة أخرى." : "Verification failed. Please try again.");
        }
        throw new Error(
          code === "Email already registered" ? t("auth.email_taken") :
          code === "Phone number already registered" ? t("auth.phone_taken") :
          err.message || t("auth.try_again")
        );
      }

      const data = await res.json();
      toast({ title: t("auth.account_created") });

      if (data.pendingVerification) {
        close();
        const method = data.method ?? (id.includes("@") ? "email" : "phone");
        navigate(`/verify?identifier=${encodeURIComponent(id)}&method=${method}`);
        return;
      }
      if (data.token) {
        setAuth(data, rememberMe);
        close();
        navigate("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.try_again"));
    } finally {
      setLoading(false);
    }
  }, [name, identifier, password, confirm, terms, tsToken, rememberMe, close, navigate, setAuth, t, toast, isRtl]);

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="text-center space-y-1 mb-1">
        <h2 className="text-[1.375rem] font-bold tracking-tight text-foreground">
          {isRtl ? "إنشاء حساب جديد" : "Create your account"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRtl ? "انضم إلى سيانو وابدأ التسوق" : "Join SYANO and start shopping"}
        </p>
      </div>

      <GoogleSignInButton rememberMe onError={setError} />
      <FacebookSignInButton rememberMe onError={setError} />
      <OrDivider label={t("auth.or_continue_with")} />

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      <InputField
        id="am-reg-name" label={isRtl ? "الاسم الكامل" : "Full Name"}
        value={name} onChange={setName}
        placeholder={isRtl ? "أدخل اسمك الكامل" : "Your full name"}
        autoComplete="name" autoFocus disabled={loading}
      />
      <InputField
        id="am-reg-id" label={isRtl ? "البريد الإلكتروني / الهاتف" : "Email or Phone"}
        value={identifier} onChange={setIdentifier}
        placeholder="email@example.com"
        autoComplete="username email" disabled={loading}
      />
      <PasswordField
        id="am-reg-pass" label={isRtl ? "كلمة المرور" : "Password"}
        value={password} onChange={setPassword}
        placeholder={isRtl ? "8 أحرف على الأقل" : "At least 8 characters"}
        autoComplete="new-password" disabled={loading}
      />
      <PasswordField
        id="am-reg-confirm" label={isRtl ? "تأكيد كلمة المرور" : "Confirm Password"}
        value={confirm} onChange={setConfirm}
        placeholder={isRtl ? "أعد كلمة المرور" : "Re-enter password"}
        autoComplete="new-password" disabled={loading}
      />

      <label className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
        <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0" />
        <span className="text-[0.8125rem] text-foreground/70 leading-snug">
          {isRtl
            ? <>أوافق على <button type="button" onClick={() => window.open("/terms-of-use","_blank")} className="text-primary font-semibold underline-offset-2 hover:underline">الشروط والأحكام</button> وسياسة الخصوصية</>
            : <>I agree to the <button type="button" onClick={() => window.open("/terms-of-use","_blank")} className="text-primary font-semibold underline-offset-2 hover:underline">Terms of Service</button> and Privacy Policy</>
          }
        </span>
      </label>

      <TurnstileWidget
        ref={tsRef}
        containerId="ts-register"
        onVerify={setTsToken}
        onExpire={() => setTsToken("")}
        onEnabled={setTsEnabled}
      />
      <button
        type="submit"
        disabled={loading || !name.trim() || !identifier.trim() || !password || !confirm || !terms || (tsEnabled && !tsToken)}
        className="w-full h-11 rounded-xl bg-primary hover:bg-primary/80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all duration-150 shadow-md shadow-primary/20">
        {loading ? (isRtl ? "جارٍ الإنشاء..." : "Creating…") : (isRtl ? "إنشاء الحساب" : "Create Account")}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {isRtl ? "لديك حساب؟ " : "Already have an account? "}
        <button type="button" onClick={() => onSwitch("login")}
          className="font-semibold text-primary hover:text-primary/80 transition-colors">
          {isRtl ? "تسجيل الدخول" : "Log In"}
        </button>
      </p>
    </form>
  );
}

/* ─── FORGOT PASSWORD VIEW ──────────────────────────────────────────────── */
function ForgotView({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { t, i18n } = useTranslation();
  const { close } = useAuthModal();
  const { toast } = useToast();
  const isRtl = i18n.language === "ar";
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [resetToken, setResetToken]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [loading, setLoading]         = useState(false);
  const [tsToken, setTsToken]         = useState("");
  const [tsEnabled, setTsEnabled]     = useState(false);
  const tsRef = useRef<TurnstileHandle>(null);

  async function sendCode() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), locale: i18n.language, turnstileToken: tsToken }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === "TURNSTILE_INVALID") {
          tsRef.current?.reset();
          setTsToken("");
          throw new Error(isRtl ? "تعذر التحقق من الطلب. يرجى المحاولة مرة أخرى." : "Verification failed. Please try again.");
        }
        throw new Error(d.error ?? t("auth.try_again"));
      }
      setStep(2);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(code)) {
      toast({ title: t("auth.code_6_digits"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? t("auth.try_again"));
      setResetToken(d.resetToken);
      setStep(3);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function resetPassword() {
    if (newPassword.length < 8) { toast({ title: t("auth.password_min_8"), variant: "destructive" }); return; }
    if (newPassword !== confirmPwd) { toast({ title: t("auth.passwords_dont_match"), variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? t("auth.try_again"));
      toast({ title: t("auth.password_reset_success") });
      close();
      onSwitch("login");
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : t("auth.try_again"), variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {([1, 2, 3] as const).map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-[1.25rem] font-bold text-foreground">{t("auth.forgot_password_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.forgot_password_subtitle")}</p>
          </div>
          <InputField
            id="am-fp-email" value={email} onChange={setEmail}
            placeholder={t("auth.email_placeholder")}
            autoComplete="email" autoFocus disabled={loading}
          />
          <TurnstileWidget
            ref={tsRef}
            containerId="ts-forgot"
            onVerify={setTsToken}
            onExpire={() => setTsToken("")}
            onEnabled={setTsEnabled}
          />
          <button onClick={sendCode} disabled={loading || !email.trim() || (tsEnabled && !tsToken)}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-50 text-white text-sm font-bold transition-all duration-150">
            {loading ? t("auth.sending") : t("auth.send_reset_code")}
          </button>
          <div className="text-center">
            <button onClick={() => onSwitch("login")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
              <BackIcon className="h-3.5 w-3.5" /> {t("auth.back_to_login")}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-[1.25rem] font-bold text-foreground">{t("auth.check_email")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.reset_code_sent", { email })}</p>
          </div>
          <InputField
            id="am-fp-code" value={code} onChange={setCode}
            placeholder={t("auth.enter_reset_code")}
            autoComplete="one-time-code" autoFocus disabled={loading}
          />
          <button onClick={verifyCode} disabled={loading || !code}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-50 text-white text-sm font-bold transition-all duration-150">
            {loading ? t("auth.verifying") : t("auth.verify_code")}
          </button>
          <div className="text-center">
            <button onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
              <BackIcon className="h-3.5 w-3.5" /> {isRtl ? "العودة" : "Back"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-[1.25rem] font-bold text-foreground">{t("auth.create_new_password")}</h2>
            <p className="text-sm text-muted-foreground">{t("auth.new_password_subtitle")}</p>
          </div>
          <PasswordField
            id="am-fp-new" value={newPassword} onChange={setNewPassword}
            placeholder={t("auth.new_password")}
            autoComplete="new-password" autoFocus disabled={loading}
          />
          <PasswordField
            id="am-fp-confirm" value={confirmPwd} onChange={setConfirmPwd}
            placeholder={t("auth.confirm_password")}
            autoComplete="new-password" disabled={loading}
          />
          <button onClick={resetPassword} disabled={loading || !newPassword || !confirmPwd}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/80 disabled:opacity-50 text-white text-sm font-bold transition-all duration-150">
            {loading ? t("auth.resetting") : t("auth.reset_password")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── MODAL SHELL ───────────────────────────────────────────────────────── */
export function AuthModal() {
  const { view, close, openLogin, openRegister, openForgotPassword } = useAuthModal();
  const [rendered, setRendered]   = useState(false);
  const [visible, setVisible]     = useState(false);
  const overlayRef                = useRef<HTMLDivElement>(null);
  const panelRef                  = useRef<HTMLDivElement>(null);

  const isOpen = view !== null;

  /* mount / unmount with animation */
  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return undefined;
    } else {
      setVisible(false);
      const t = setTimeout(() => setRendered(false), 280);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /* ESC key */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  /* body scroll lock — iOS-safe: save scrollY + position:fixed trick */
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      const prevTop      = document.body.style.top;
      const prevWidth    = document.body.style.width;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top      = `-${scrollY}px`;
      document.body.style.width    = "100%";
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.position = prevPosition;
        document.body.style.top      = prevTop;
        document.body.style.width    = prevWidth;
        window.scrollTo(0, scrollY);
      };
    }
    return undefined;
  }, [isOpen]);

  /* focus trap */
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    const panel = panelRef.current;
    const focusableSelectors = [
      "a[href]", "button:not([disabled])", "input:not([disabled])",
      "textarea:not([disabled])", "select:not([disabled])", "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [visible, view]);

  /* auto-focus first input after open */
  useEffect(() => {
    if (!visible || !panelRef.current) return;
    const timer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, button");
      first?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [visible, view]);

  const handleSwitch = (next: AuthView) => {
    if (next === "login") openLogin();
    else if (next === "register") openRegister();
    else if (next === "forgot") openForgotPassword();
    else close();
  };

  if (!rendered) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999] flex items-end md:items-center justify-center"
      style={{
        background: visible ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(3px)" : "none",
        transition: "background 0.25s ease, backdrop-filter 0.25s ease",
      }}
      onClick={e => { if (e.target === overlayRef.current) close(); }}
    >
      <div
        ref={panelRef}
        data-auth-panel
        className="relative w-full md:w-auto md:min-w-[440px] md:max-w-[490px] bg-card border border-border shadow-2xl rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{
          transform: visible
            ? "translateY(0) scale(1)"
            : "translateY(100%) scale(1)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.26s cubic-bezier(0.34,1.1,0.64,1), opacity 0.22s ease",
        }}
      >
        {/* Desktop uses scale animation, mobile uses translateY */}
        <style>{`
          @media (min-width: 768px) {
            [data-auth-panel] {
              transform: ${visible ? "scale(1)" : "scale(0.95)"} !important;
              opacity: ${visible ? 1 : 0} !important;
              transition: transform 0.22s cubic-bezier(0.34,1.1,0.64,1), opacity 0.2s ease !important;
            }
          }
        `}</style>

        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 md:pt-5">
          <div className="flex items-center gap-2">
            <img src="/syano-logo.png" alt="SYANO" className="h-7 w-7 object-contain" loading="eager" />
            <span className="text-[0.8125rem] font-black tracking-[0.22em] uppercase text-foreground">SYANO</span>
          </div>
          <button onClick={close}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mx-5" />

        {/* Content */}
        <div className="px-5 pt-5 pb-6 md:pb-7 overflow-y-auto overflow-x-hidden max-h-[85vh] md:max-h-[600px]">
          {view === "login"    && <LoginView    onSwitch={handleSwitch} />}
          {view === "register" && <RegisterView onSwitch={handleSwitch} />}
          {view === "forgot"   && <ForgotView   onSwitch={handleSwitch} />}
        </div>
      </div>
    </div>
  );
}

/* ─── URL-param initializer (place inside Router) ───────────────────────── */
export function AuthModalInitializer() {
  const { openLogin, openRegister, openForgotPassword } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    if (auth === "login")  openLogin();
    if (auth === "signup") openRegister();
    if (auth === "forgot") openForgotPassword();
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
