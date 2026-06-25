# CURRENT_TASK.md — SYANO (سوق سوريا)

## Status: STABLE — AWAITING NEXT TASK

The workspace is in a fully verified, stable state.
Latest checkpoint: 2026-06-11 — Recently Viewed Products + Product Wizard Inventory UX

---

## Last Completed Task: Recently Viewed Products + Product Wizard Inventory UX

**Goal:** Implement fully functional Recently Viewed Products (localStorage, guest + auth, homepage section) and improve Product Wizard inventory UX (hide confusing stock field when variants are enabled in new mode).

**Completed:** 2026-06-11

**Steps completed:**
1. ✅ `pnpm install` — 1,129 packages installed
2. ✅ Environment variables verified — all 10 present
3. ✅ Database schema: 22 tables confirmed
4. ✅ `variant_images` table created + added to run-migrations.ts
5. ✅ `reset_otp_*` columns (4) restored to users table
6. ✅ Root Owner bootstrapped (delewatiamer7@gmail.com, role=admin, active)
7. ✅ All auth endpoints verified
8. ✅ All services started (API on 8080, Marketplace Vite, Expo Metro)
9. ✅ Products page footer-overlap fixed (virtualizer removed, CSS grid)
10. ✅ Inter font restored (`public/fonts/inter-latin.woff2`, 73KB valid WOFF2)
11. ✅ Official SYANO logo installed (`syano-logo.png` — silver/green S)
12. ✅ All PWA/manifest PNG icons regenerated from official logo
13. ✅ Mobile icon installed (`artifacts/mobile/assets/images/icon.png`)
14. ✅ Platform settings restored (commission_rate=5, announcement="")
15. ✅ Real user accounts from backup restored (admin@syano.online, delewatiamer8@gmail.com)
16. ✅ Browser console: zero errors
17. ✅ All recovery documentation updated to permanent checkpoint

**Files modified during recovery:**
- `artifacts/marketplace/public/syano-logo.png` — official logo installed (500×500 RGBA)
- `artifacts/marketplace/src/assets/syano-logo.png` — canonical logo copy
- `artifacts/marketplace/public/favicon-16x16.png` — generated from official logo
- `artifacts/marketplace/public/favicon-32x32.png` — generated from official logo
- `artifacts/marketplace/public/favicon-48x48.png` — generated from official logo
- `artifacts/marketplace/public/apple-touch-icon.png` — generated from official logo
- `artifacts/marketplace/public/android-chrome-192x192.png` — generated from official logo
- `artifacts/marketplace/public/android-chrome-512x512.png` — generated from official logo
- `artifacts/marketplace/public/fonts/inter-latin.woff2` — Inter font restored
- `artifacts/mobile/assets/images/icon.png` — official logo installed
- `artifacts/api-server/src/lib/run-migrations.ts` — variant_images table added
- `lib/api-client-react/src/generated/api.schemas.ts` — AdminListUsersParams.q added
- Database: `variant_images` table created, reset_otp columns added, platform_settings restored

---

## Recovery History
| Date | Event |
|---|---|
| 2026-06-08 | Initial workspace migration recovery (pnpm, schema push, admin bootstrap) |
| 2026-06-09 | Full forensic audit: variant_images, font, logo, icons, data recovery, docs |

---

## When Starting Next Task

Read this file first, then:
1. Read `PROJECT_STATE.md` for feature inventory
2. Read `DATABASE_STATE.md` for current schema
3. Read `KNOWN_ISSUES.md` for open bugs
4. Read `API_STATE.md` for current API surface
5. Apply minimum necessary changes
6. Update all project-memory files after each milestone
