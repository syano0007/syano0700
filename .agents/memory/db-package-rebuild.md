---
name: DB package rebuild after schema change
description: After editing lib/db/src/schema/*.ts, stale compiled .d.ts files in lib/db/dist/ cause TS errors in the API server even though the source is correct.
---

## The Rule
After any edit to `lib/db/src/schema/*.ts`, always run:
```
npx tsc --build lib/db/tsconfig.json --force
```
to regenerate the declaration files in `lib/db/dist/`.

**Why:** The db package uses `composite: true` + `emitDeclarationOnly: true`. TypeScript project references (used by the API server via tsconfig.json `references`) read `.d.ts` files from `lib/db/dist/`, NOT the source `.ts` files. Stale `.d.ts` files shadow the updated source, causing "Property X does not exist on type" errors that disappear after a rebuild.

**How to apply:** Any time a DB schema column is added (additive migration). The `--force` flag ensures even up-to-date files are rebuilt, bypassing the incremental build cache.
