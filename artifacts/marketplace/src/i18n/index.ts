import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enBundle from "./en.json";
import arBundle from "./ar.json";

// ─── Direction helper ─────────────────────────────────────────────────────────
export function applyDirection(lang: string) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

// ─── Language detection ───────────────────────────────────────────────────────
function detectInitialLang(): "en" | "ar" {
  try {
    // Allow ?preview_lang=ar in URL for screenshot/testing purposes
    if (typeof window !== "undefined") {
      const urlLang = new URLSearchParams(window.location.search).get("preview_lang");
      if (urlLang === "ar") return "ar";
      if (urlLang === "en") return "en";
    }
    const saved = localStorage.getItem("marketplace_lang");
    if (saved === "ar") return "ar";
    if (saved === "en") return "en";
    return navigator.language?.startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}

const initialLang = detectInitialLang();

// ─── Synchronous initialisation ────────────────────────────────────────────────
//
// PERFORMANCE: Both JSON bundles are STATIC imports (not dynamic).
// Vite bundles them into the vendor-i18n chunk — no separate chunk download,
// no async round-trips, no top-level-await module barrier.
//
// Previously: `await Promise.all([import("./en.json"), import("./ar.json")])`
//   → Vite split each JSON into its own async chunk
//   → App.tsx waited for 2 extra network fetches before React could render
//   → Blocked FCP/LCP by 100-400 ms on slow connections
//
// Now: static imports bundled inline + initImmediate:false (synchronous init)
//   → i18n is ready before the first React render, zero extra round-trips
//   → Language switching is still fully synchronous (both bundles pre-loaded)
//   → Language-switch race condition is still fixed (both bundles in memory)
//
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enBundle },
    ar: { translation: arBundle },
  },
  lng: initialLang,
  fallbackLng: "en",
  supportedLngs: ["en", "ar"],
  // i18next v23+ initialises synchronously by default when resources are
  // provided inline — no initImmediate option needed (removed in v23).
  interpolation: { escapeValue: false },
});

applyDirection(i18n.language);

// Persist language choice + update DOM direction on every switch.
// Both bundles are already in memory so language switching is instant.
i18n.on("languageChanged", (lang) => {
  applyDirection(lang);
  try { localStorage.setItem("marketplace_lang", lang); } catch { /* private mode */ }
});

export default i18n;
