---
name: Mobile ErrorFallback cascade crash
description: Root cause and fix for "useSettings must be used within SettingsProvider" crash in mobile app
---

# Mobile ErrorFallback Cascade Crash

## The Rule
`SettingsProvider` must always wrap `ErrorBoundary` in `_layout.tsx`. Never the reverse.

**Why:** `ErrorFallback.tsx` calls `useColors()` → `useSettings()`. When `ErrorBoundary` sits above `SettingsProvider`, any error inside the tree triggers `ErrorFallback` to render — but `ErrorFallback` is now outside `SettingsProvider`, so it immediately throws "useSettings must be used within SettingsProvider". This creates an infinite crash cascade: the new error triggers `ErrorBoundary` again, which renders `ErrorFallback` again, which crashes again.

**How to apply:** Root layout must always be:
```
SafeAreaProvider > SettingsProvider > ErrorBoundary > QueryClientProvider > ...
```
Never `ErrorBoundary` above `SettingsProvider`.

## Additional Fix Applied
Removed `// @refresh reset` from `SettingsContext.tsx`. This directive forced a new context object on every HMR update, causing consumers that held a reference to the old context to get `null` and throw. Only use `// @refresh reset` on plain screen components, never on context providers.

## Secondary Fixes
- Added missing `store/[slug]` to `Stack.Screen` registrations in root `_layout.tsx`
- Removed duplicate `seller/orders/[id]` registration
