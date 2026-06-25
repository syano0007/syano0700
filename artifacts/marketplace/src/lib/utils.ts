import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a bilingual notification text stored as JSON {en, ar} and return
 * the string for the given language. Falls back to the raw text for legacy
 * notifications that were stored as plain English strings.
 */
export function localizeNotif(text: string | null | undefined, lang: string): string {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return lang === "ar" ? (parsed.ar ?? parsed.en ?? text) : (parsed.en ?? text);
    }
  } catch {}
  return text;
}
