---
name: Lib packages need tsc build
description: Shared lib packages require tsc --build to generate dist declarations; no package-level build script exists
---

# Lib Packages Require `tsc --build`

**Rule:** After a fresh environment (or after changing any lib source file), run:
```bash
npx tsc --build lib/db lib/api-zod lib/api-client-react
```

**Why:** All three lib packages use TypeScript project references (`composite: true`, `emitDeclarationOnly: true`, `outDir: "dist"`). They do NOT have a `build` script in their `package.json`. Without their `dist/*.d.ts` files, the marketplace and api-server throw `TS6305: Output file has not been built from source file` for every import.

**How to apply:**
- Run after `pnpm install` in a fresh environment
- Run after editing any file in `lib/db/src/`, `lib/api-zod/src/`, or `lib/api-client-react/src/`
- The `pnpm --filter build` approach doesn't work — must use `npx tsc --build` directly

**Note:** The api-server actually builds at runtime via `build.mjs` (esbuild), so the missing d.ts only breaks static type-checking, not the running server. The marketplace (Vite) uses direct TypeScript source resolution at build time and works fine too. Only `tsc --noEmit` checks fail.
