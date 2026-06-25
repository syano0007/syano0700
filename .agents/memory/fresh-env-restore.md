---
name: Fresh environment restore steps
description: Exact sequence to restore SYANO from scratch when node_modules or DB are missing
---

# Fresh Environment Restore Steps

## Symptoms of a fresh/broken environment
- `node_modules missing` in workflow logs
- `relation "users" does not exist` in api-server logs
- `vite: not found` or `expo: not found` workflow errors

## Restore sequence

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Push full DB schema (creates all tables from scratch)
pnpm --filter @workspace/db exec drizzle-kit push --force

# 3. Build lib declaration files (required for TS checks)
npx tsc --build lib/db lib/api-zod lib/api-client-react

# 4. Restart workflows (api-server + marketplace)
# Use restart_workflow tool for each
```

## Why this order matters
- `drizzle-kit push --force` must run BEFORE the api-server starts — the server's `run-migrations.ts` does additive ALTER TABLE statements that require base tables to exist
- The lib tsc build only matters for type checking; the server and Vite both resolve TS directly at runtime/build-time

## Root owner
- Bootstrapped automatically on first api-server start
- Email: delewatiamer7@gmail.com
