# PROJECT_STATE.md — SYANO (سوق سوريا)

## Project Identity
- **Name:** SYANO — سوق سوريا (Syria's First Comprehensive Online Marketplace)
- **Tagline:** "Get anything delivered to your doorstep in 5 taps. Trusted sellers in Aleppo."
- **Monorepo root:** `/home/runner/workspace`
- **Package manager:** pnpm workspaces

## LATEST VERIFIED CHECKPOINT
- **Date:** 2026-06-09
- **Recovery version:** Post-Migration Stable Build (v2)
- **TypeScript status:** 0 structural errors across api-server, marketplace, mobile
- **All services:** RUNNING
- **Official logo:** Installed and verified
- **Browser console:** Zero errors

## Overall Completion
- **Platform:** ~90% complete
- **Pending:** No active features — stable state

## Service Status (last verified 2026-06-09)
| Service | Status | Port |
|---|---|---|
| API Server | RUNNING | 8080 |
| Marketplace (Vite) | RUNNING | dynamic ($PORT) |
| Mobile (Expo/Metro) | RUNNING | dynamic ($PORT) |

## Architecture Summary
```
workspace/
├── artifacts/
│   ├── api-server/      Express v5 + TypeScript + esbuild (dev: build+start)
│   ├── marketplace/     React 18 + Vite + TanStack Query + Radix UI
│   ├── mobile/          Expo 54 + React Native + Expo Router
│   └── mockup-sandbox/  Vite component preview server (Canvas)
├── lib/
│   ├── db/              Drizzle ORM schema — composite TS project (emitDeclarationOnly)
│   ├── api-zod/         Zod validation schemas — composite TS project
│   ├── api-client-react/ Orval-generated React Query hooks — composite TS project
│   └── api-spec/        OpenAPI spec source
└── project-memory/      THIS DIRECTORY — persistent project state
```

## Official Branding
- **Official logo:** `artifacts/marketplace/src/assets/syano-logo.png` (canonical)
  - Design: Silver/metallic "S" with green neon glow on dark background, 500×500 RGBA PNG
  - Public URL: `artifacts/marketplace/public/syano-logo.png`
  - Mobile: `artifacts/mobile/assets/images/icon.png`
  - Used at: Navbar (×3), AdminLayout (×1), index.html JSON-LD
- **All PWA/manifest PNG icons** derived from the official logo

## Features Completed
- [x] Authentication (login, register, forgot-password, OTP reset, JWT, bcrypt)
- [x] Guest Cart (full flow, all entry points wired)
- [x] Seller Dashboard (orders, products, inventory, analytics, messaging)
- [x] Admin Dashboard (users, products, orders, logs, stats, suspension)
- [x] Customer Dashboard (orders, profile)
- [x] Notifications (SSE real-time + polling fallback)
- [x] Push Notifications (VAPID, service worker)
- [x] Messaging (conversations, SSE real-time, polling fallback)
- [x] Product Reviews
- [x] Seller Reviews
- [x] Store Follow system
- [x] Seller Applications (apply, draft, admin approval)
- [x] Product Variants (groups/options/values/images — full VariantBuilder)
- [x] Flash Sale support (flashSaleEnd in platform_settings)
- [x] Arabic RTL + i18n (en.json + ar.json, 1,837 lines each)
- [x] Google Translate protection (translate="no" on prices)
- [x] Account Suspension system
- [x] OTP verification system (disabled via flag, register returns token directly)
- [x] Seller store pages + branding
- [x] Search (pg_trgm full-text)
- [x] Sitemap
- [x] CSV export
- [x] Performance optimization pass (see PERFORMANCE_STATE.md)
- [x] Products page CSS grid layout (virtualizer removed)
- [x] Official logo installed (all locations, all icon sizes)

## Features Intentionally NOT Started
- [ ] None — workspace is in stable verified state

## Current Active Feature
**None** — awaiting next task.

## ⚠️ PERMANENT ROOT OWNER
- **Email:** `delewatiamer7@gmail.com` | **Password:** `00Amer00`
- Self-healing via `bootstrapRootAdmin()` on every API startup
- Never create another bootstrap admin. Legacy typo `delewaitamer7@gmail.com` is auto-removed.
- Protected from deletion via admin UI (403 guard in admin routes)

## Important Implementation Decisions
1. `lib/db`, `lib/api-zod`, `lib/api-client-react` use `exports: { ".": "./src/index.ts" }` — no runtime build step. Declarations built via `npx tsc --build lib/db lib/api-zod lib/api-client-react`.
2. `drizzle-kit push` requires TTY — use `echo "" | drizzle-kit push` or `executeSql` for additive migrations.
3. OTP verification DISABLED via `VERIFICATION_ENABLED` flag in auth.ts — register returns token directly.
4. manualChunks in vite.config.ts must use `/node_modules/pkg/` with slashes (pnpm embeds peer-dep versions in paths).
5. `vendor-react` and `vendor-radix` chunks must NOT be in same chunk (circular dep crash in production).
6. `AdminListUsersParams.q` was manually added — do NOT regenerate api.schemas.ts without preserving it.
7. Express v5: `req.params` values are `string | string[]` — always wrap with `String()` before `parseInt`.
8. TS7006 implicit-any warnings are pre-existing and accepted — do NOT rewrite code to fix them.
9. Products page uses CSS auto-fill/minmax grid — do NOT re-add useWindowVirtualizer (caused footer overlap).
10. Official logo is stored at `src/assets/syano-logo.png` as canonical source — always restore from there.

## Libraries Added Manually (never auto-remove)
- All orval-generated files in `lib/api-client-react/src/generated/` — manually extended
- `api.schemas.ts` — manually extended with: `q` on AdminListUsersParams, `isBestDeal`, `storeName`, `hasVariants`, `flashSale*` fields

## Files Requiring Special Care
- `lib/api-client-react/src/generated/api.schemas.ts` — manually extended, never overwrite
- `lib/api-client-react/src/generated/api.ts` — manually extended
- `artifacts/api-server/src/lib/run-migrations.ts` — additive only, never remove guards
- `artifacts/marketplace/src/i18n/en.json` — all translation keys must be preserved
- `artifacts/marketplace/src/i18n/ar.json` — all translation keys must be preserved
- `artifacts/marketplace/vite.config.ts` — manualChunks is fragile, test after any change
- `artifacts/marketplace/src/components/VariantBuilder.tsx` — DO NOT MODIFY (1,211 lines)
- `artifacts/marketplace/src/providers/NotificationProvider.tsx` — DO NOT MODIFY (243 lines)
- `artifacts/marketplace/src/assets/syano-logo.png` — OFFICIAL LOGO, DO NOT OVERWRITE

## Things That Must NEVER Be Regenerated Automatically
- OpenAPI spec (manually extended)
- Orval-generated API client (manually extended)
- Database schema (additive only — never drop columns or tables)
- Authentication logic (already working)
- Performance optimizations (already complete)
- Official logo (restore from src/assets/ if public copy missing)
