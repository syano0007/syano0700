---
name: i18n inline pattern rules
description: Rules for correct vs incorrect i18n patterns in this codebase; prevents recurring lang==="ar" ternary bugs.
---

## The rule

Every user-visible string must go through `t("section.key")`. The `lang === "ar" ? "Arabic" : "English"` ternary in JSX is always a bug.

**Why:** The codebase uses react-i18next. Strings not going through `t()` break when the language switches and are invisible to translation tooling. The pattern also appears in two known bad forms:

### Bad form 1 — inline JSX ternary
```tsx
// WRONG
{lang === "ar" ? "حفظ كمسودة" : "Save as Draft"}

// RIGHT
{t("seller.save_draft")}
```

### Bad form 2 — module-level constant with hardcoded labels
```tsx
// WRONG (at module level, outside component)
const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", statuses: [...] },
];

// RIGHT — use a key, translate at render inside component
const TAB_KEYS = [
  { key: "all", labelKey: "orders.tab_all" },
  { key: "active", labelKey: "orders.tab_active", statuses: [...] },
];
// Inside component:
const tabs = TAB_KEYS.map(tab => ({ ...tab, label: t(tab.labelKey) }));
```

## What is NOT a bug

- `lang === "ar" ? "ar-SY" : "en-GB"` — locale code for date formatting
- `lang === "ar" ? "en" : "ar"` — language code argument for `switchLanguage()`
- `t("key", { defaultValue: ... })` — t() fallback is fine
- `lang === "ar" ? cat.ar : cat.en` — category names from DB, not i18n strings

## How to apply

When scanning for i18n bugs, grep for `lang === "ar" ? "` (with opening quote after `?`). Each hit that shows Arabic text as a string literal is a bug requiring a new i18n key + t() call.
