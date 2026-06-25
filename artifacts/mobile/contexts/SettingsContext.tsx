import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";
import { setLocale } from "../src/i18n";

export type AppTheme = "light" | "dark" | "system";
export type AppLanguage = "ar" | "en";
export type AppCurrency = "SYP" | "USD";

const EXCHANGE_RATE = 14500;

interface SettingsContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  language: AppLanguage;
  setLanguage: (l: AppLanguage) => void;
  currency: AppCurrency;
  setCurrency: (c: AppCurrency) => void;
  isDark: boolean;
  isRtl: boolean;
  formatPrice: (usdAmount: number) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEYS = {
  theme: "app_settings_theme",
  language: "app_settings_language",
  currency: "app_settings_currency",
} as const;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();

  const [theme, setThemeState] = useState<AppTheme>("dark");
  const [language, setLanguageState] = useState<AppLanguage>("ar");
  const [currency, setCurrencyState] = useState<AppCurrency>("SYP");

  // Load persisted settings on mount
  useEffect(() => {
    void (async () => {
      try {
        const [t, l, c] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.theme),
          AsyncStorage.getItem(STORAGE_KEYS.language),
          AsyncStorage.getItem(STORAGE_KEYS.currency),
        ]);
        if (t === "light" || t === "dark" || t === "system") setThemeState(t);
        if (l === "ar" || l === "en") {
          setLanguageState(l);
          setLocale(l);
        }
        if (c === "SYP" || c === "USD") setCurrencyState(c);
      } catch {
        // AsyncStorage unavailable — keep defaults
      }
    })();
  }, []);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
    AsyncStorage.setItem(STORAGE_KEYS.theme, t).catch(() => {});
  }, []);

  const setLanguage = useCallback((l: AppLanguage) => {
    setLanguageState(l);
    setLocale(l);
    AsyncStorage.setItem(STORAGE_KEYS.language, l).catch(() => {});
  }, []);

  const setCurrency = useCallback((c: AppCurrency) => {
    setCurrencyState(c);
    AsyncStorage.setItem(STORAGE_KEYS.currency, c).catch(() => {});
  }, []);

  const isDark =
    theme === "system" ? systemScheme === "dark" : theme === "dark";

  const formatPrice = useCallback(
    (usdAmount: number): string => {
      if (currency === "SYP") {
        const syp = Math.round(usdAmount * EXCHANGE_RATE);
        return `${syp.toLocaleString("en-US")} ل.س`;
      }
      return `$${usdAmount.toFixed(2)}`;
    },
    [currency]
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      setTheme,
      language,
      setLanguage,
      currency,
      setCurrency,
      isDark,
      isRtl: language === "ar",
      formatPrice,
    }),
    [theme, setTheme, language, setLanguage, currency, setCurrency, isDark, formatPrice]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
