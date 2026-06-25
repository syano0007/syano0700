---
name: Import & Recovery Hardening tools
description: Self-certifying toolchain added June 17 2026 — healthz enrichment, startup-validation, import:check, recovery:report, manifest generator
---

## Commands
- `pnpm import:check` — 10-section PASS/FAIL certification; exits 0 on PASS/WARN, 1 on FAIL
- `pnpm recovery:report` — generates RECOVERY_REPORT.md from live DB (no hardcoded values)
- `pnpm manifest:generate` — refreshes project.manifest.json with live table/product counts

## Files
- `scripts/src/import-check.ts` — 10 sections: node_modules, env vars, DB+tables, enums, columns, schema drift, seed data, embedding service, API healthz, source files
- `scripts/src/recovery-report.ts` — queries DB at runtime, writes RECOVERY_REPORT.md
- `scripts/src/generate-manifest.ts` — updates project.manifest.json database section from live DB
- `artifacts/api-server/src/lib/startup-validation.ts` — runs on every API boot after runMigrations(); validates 15 core tables, 7 courier tables, 3 enums, 11 critical columns; logs [startup-validation] line; never crashes server
- `artifacts/api-server/src/routes/health.ts` — enriched async healthz: live DB counts (tables, products, embeddings), courier table spot-check, embedding service ping (1s timeout)
- `project.manifest.json` — machine-readable project state; static fields preserved, database section refreshed by manifest:generate

## Patterns
- Scripts use top-level await with `type: module` in package.json; tsx handles this without tsconfig changes
- Template literals with backticks inside must use unicode escape (`\u0060`) or single quotes to avoid esbuild parse error
- healthz avoids JSON import assertions (`with { type: "json" }`) — inline static constants instead; esbuild JSON import assertions can be unpredictable
- startup-validation uses `pool.connect()` / `client.release()` pattern (not `db.execute`) for raw SQL checks

**Why:** A fresh GitHub import into a new Replit workspace had no self-certification path; an agent had to read markdown docs manually. These tools make the project machine-verifiable with one command.
