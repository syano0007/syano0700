---
name: Global Settings System
description: Theme/Language/Currency persistence architecture — backend API, frontend sync hook, mobile context
---

## Architecture

### DB
Three columns added to `users` table via `run-migrations.ts` (idempotent):
- `preferred_theme VARCHAR(10) DEFAULT 'dark'`
- `preferred_language VARCHAR(5) DEFAULT 'ar'`
- `preferred_currency VARCHAR(3) DEFAULT 'SYP'`

No Drizzle schema changes — columns accessed via raw `db.execute(sql`...`)` in auth.ts.

### Backend API (artifacts/api-server/src/routes/auth.ts)
- `GET /api/user/settings` → `{ theme, language, currency }` (requireAuth)
- `PATCH /api/user/settings` → validates against allowlists, updates individual columns, returns `{ ok: true }`

### Marketplace Frontend
- Theme: `next-themes` `useTheme()` — `setTheme()` persists to localStorage automatically
- Language: `i18n.changeLanguage(lang)` + `applyDirection(lang)` — localStorage key `marketplace_lang`
- Currency: `CurrencyContext.setCurrency()` — localStorage key `marketplace_currency`
- Sync hook: `src/hooks/useSettingsSync.ts` — `useSettingsSync()` hook, mounted as `<SettingsSyncEffect />` in `App.tsx` inside AuthProvider+CurrencyProvider+ThemeProvider
  - On token appearance: fetches server settings, applies all three
  - `hasLoadedRef` prevents premature save (avoids overwriting server with stale localStorage)
  - On change while authenticated: 900ms debounce → PATCH /api/user/settings

### Mobile (artifacts/mobile)
- `contexts/SettingsContext.tsx` — full theme/language/currency context with AsyncStorage
  - Keys: `app_settings_theme`, `app_settings_language`, `app_settings_currency`
  - `isDark` = computed from theme + `useColorScheme()` (system fallback)
  - `formatPrice(usdAmount)` — currency-aware formatter with 14500 SYP/USD rate
  - `setLanguage()` also calls `setLocale()` from `src/i18n/index.ts`
- `app/_layout.tsx` — `<SettingsProvider>` wraps entire tree (before QueryClientProvider and AuthProvider)
- `hooks/useColors.ts` — reads `isDark` from `useSettings()` instead of `useColorScheme()`

**Why:** `useColors()` must be inside `SettingsProvider` — it now throws if not in provider. Since `SettingsProvider` is outermost, this is safe. `ErrorBoundary` component does NOT use `useColors()` so there's no provider-escape issue.

## Persistence Flow
1. Guest: localStorage only
2. Login: server settings fetched → applied (overrides localStorage)
3. Change while auth'd: debounced PATCH to server + localStorage
4. Logout: localStorage retained, no reset

## Common Pitfalls
- Do not call `useSettings()` from any component rendered OUTSIDE `SettingsProvider` (currently only ErrorBoundary, which doesn't use it)
- `hasLoadedRef.current` must be `false` at login time to prevent race condition where debounced save fires before server response
- Mobile: `AsyncStorage.getItem()` is async — settings load AFTER first render; defaults (dark/ar/SYP) show briefly
