---
name: i18n language switch race condition fix
description: Async dynamic import in languageChanged caused raw keys to display on first language switch
---

## The Rule
Both locale bundles (en.json + ar.json) must be loaded via `Promise.all` before calling `i18n.init()`. The `languageChanged` event handler must never perform async work.

## Why
`i18n.changeLanguage()` is synchronous. It fires `languageChanged` and then React re-renders all `useTranslation()` components in the same tick. Any async bundle load inside the handler (even one that resolves in ~300ms) happens AFTER the render cycle has already completed with an empty resource store → raw keys displayed.

## How to apply
In `artifacts/marketplace/src/i18n/index.ts`:
- Use `Promise.all([import("./en.json"), import("./ar.json")])` before `i18n.init()`
- Pass `resources: { en: { translation: enBundle }, ar: { translation: arBundle } }` to init
- `languageChanged` handler: `applyDirection(lang)` only — no async imports

## Vite note
Both JSON files are statically bundled by Vite — no network round-trip at runtime. Combined ~210 KB uncompressed. Startup cost is negligible.
