import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslation } from "react-i18next";
import { applyDirection } from "@/i18n";

interface ServerSettings {
  theme?: string;
  language?: string;
  currency?: string;
}

async function fetchSettings(token: string): Promise<ServerSettings | null> {
  try {
    const res = await fetch("/api/user/settings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as ServerSettings;
  } catch {
    return null;
  }
}

async function pushSettings(token: string, settings: ServerSettings): Promise<void> {
  try {
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
  } catch {
    // Silently ignore — local state is always the source of truth for the UX
  }
}

function getLocalTheme(): string | null {
  try { return localStorage.getItem("theme"); } catch { return null; }
}

function getLocalLang(): string | null {
  try { return localStorage.getItem("marketplace_lang"); } catch { return null; }
}

/**
 * Settings sync — LOCAL IS ALWAYS THE SOURCE OF TRUTH.
 *
 * On login / page reload with token:
 *   - If localStorage already has a valid preference → keep it, push it to DB.
 *   - Only apply DB value when localStorage has NO preference for that setting.
 *
 * While authenticated: debounce any change and persist to DB.
 */
export function useSettingsSync() {
  const { token, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const { i18n } = useTranslation();

  const serverLoadedRef = useRef(false);
  const prevTokenRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On token appearance (login or page reload with stored token) ─────────────
  useEffect(() => {
    if (token && token !== prevTokenRef.current) {
      prevTokenRef.current = token;
      serverLoadedRef.current = false;

      void (async () => {
        const settings = await fetchSettings(token);

        if (settings) {
          const VALID_THEMES = ["light", "dark", "system"];
          const VALID_LANGS  = ["ar", "en"];

          // ── Theme: local wins ──────────────────────────────────────────────
          const localTheme = getLocalTheme();
          if (settings.theme && VALID_THEMES.includes(settings.theme)) {
            if (!localTheme || !VALID_THEMES.includes(localTheme)) {
              // No local pref → apply DB value
              setTheme(settings.theme);
            }
            // else: local preference exists and is valid → keep it (will push to DB below)
          }

          // ── Language: local wins ───────────────────────────────────────────
          const localLang = getLocalLang() || i18n.language;
          if (settings.language && VALID_LANGS.includes(settings.language)) {
            if (!localLang || !VALID_LANGS.includes(localLang)) {
              void i18n.changeLanguage(settings.language);
              applyDirection(settings.language);
              try { localStorage.setItem("marketplace_lang", settings.language); } catch {}
            }
          }

          // ── Currency: local wins ───────────────────────────────────────────
          if (settings.currency === "SYP" || settings.currency === "USD") {
            // currency context already reads from localStorage — only apply if not set
            const localCurrency = (() => {
              try { return localStorage.getItem("syano_currency"); } catch { return null; }
            })();
            if (!localCurrency) {
              setCurrency(settings.currency as "SYP" | "USD");
            }
          }
        }

        serverLoadedRef.current = true;
      })();
    } else if (!token) {
      prevTokenRef.current = null;
      serverLoadedRef.current = false;
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced save when settings change while authenticated ──────────────────
  useEffect(() => {
    if (!isAuthenticated || !token || !serverLoadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const lang = i18n.language;
    saveTimerRef.current = setTimeout(() => {
      void pushSettings(token, { theme: theme ?? "dark", language: lang, currency });
    }, 900);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [theme, i18n.language, currency, isAuthenticated, token]); // eslint-disable-line react-hooks/exhaustive-deps
}
