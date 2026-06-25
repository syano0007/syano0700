---
name: Vite manualChunks circular dependency crash
description: Assigning @radix-ui and recharts to separate vendor chunks while also having a vendor-react chunk causes a Rollup circular chunk dependency that makes React === undefined at runtime in production.
---

## The Rule

Never assign `@radix-ui` or `recharts`/`d3-*` to separate `manualChunks` vendor chunks when `vendor-react` is also a manual chunk. Rollup places shared helper modules (used by both react-dom internals and Radix/recharts) into whichever manually-named chunk it picks — if it picks `vendor-radix` or `vendor-charts`, `vendor-react` must import from that chunk, while that chunk also imports `vendor-react` → circular.

**Why:** In ESM circular dependencies, when module A imports module B which imports module A, module A's exports may be uninitialized (live bindings, but not yet assigned) when module B runs. Code that executes at module top level (e.g. `const M = F ? r.useLayoutEffect : r.useEffect`) crashes with `Cannot read properties of undefined (reading 'useLayoutEffect')` because `r` (= React namespace from vendor-react) is still `undefined`.

**How to apply:** In `vite.config.ts` `manualChunks`, omit `@radix-ui` and `recharts`/`d3-*`. Let Rollup auto-chunk them — Rollup creates shared chunks that only *import* `vendor-react` (one-way, safe). vendor-react stays a pure leaf node. Verify after every build: `grep -o 'from"\./vendor-[^"]*"' dist/public/assets/vendor-react-*.js` must return nothing.

## Symptoms
- Works perfectly in development (Vite esbuild dev server, not Rollup)
- White screen in production with `Uncaught TypeError: Cannot read properties of undefined (reading 'useLayoutEffect')`
- All assets return HTTP 200, API works, code is identical between dev and prod

## Fixed in
`artifacts/marketplace/vite.config.ts` — removed `if (id.includes("@radix-ui")) return "vendor-radix"` and `if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts"` from `manualChunks`.
