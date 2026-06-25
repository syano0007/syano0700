---
name: Artifact workflow dedup pattern
description: Replit auto-detects artifact/ subdirs as workflows; dedup fix + port rules (updated June 18, 2026).
---

# Artifact Workflow Dedup Pattern

## The Problem
Replit auto-detects every subdirectory of `artifacts/` as an "artifact workflow". If `.replit` also defines manual workflows with different names targeting the same ports, every import produces duplicates (one manually-named, one artifact-auto-detected).

**Symptom:** `API Server` (manual, port 8080) + `artifacts/api-server: API Server` (auto-detected). `Start application` (manual) + `artifacts/marketplace: web` (auto-detected, "Port already in use" because --port was forced). `tools/mockup-sandbox: Component Preview Server` shows as "finished" forever — harmless.

## Port Rules (Verified June 18, 2026)

| Service | Port rule |
|---|---|
| `artifacts/api-server: API Server` | MUST be 8080. `API_PORT=8080` in shared env; dev script: `PORT=${API_PORT:-8080}` |
| `artifacts/marketplace: web` | DO NOT FORCE PORT. Dev script: `vite --config vite.config.ts --host 0.0.0.0` (no --port flag) |
| `artifacts/mobile: expo` | DO NOT FORCE PORT. Replit assigns. |
| `Embedding Service` | MUST be 8000. `EMBEDDING_PORT=8000` in manual workflow command. |

**`PORT` shared env var must NOT exist** — if set, api-server reads it and binds to wrong port. Use `API_PORT=8080` instead.

## The Fix

### For service artifacts (api-server, marketplace, mobile)
- **Do NOT define manual workflow duplicates.** The artifact-detected workflows ARE the canonical ones.
- **Never force a port for marketplace or mobile** — the artifact system assigns ports; `--port XXXX` causes "Port already in use" conflicts.
- **Bake API port into dev script via API_PORT** — not `PORT` (global shared env).
- Artifact-managed workflows **cannot be overridden or deleted** via `configureWorkflow`/`removeWorkflow` — returns `PROHIBITED_ACTION`.

### Forbidden workflows — delete immediately if found:
- `Start application` — manual duplicate of marketplace
- `API Server` — manual duplicate of api-server (port 8080 conflict)
- Any manually-created Marketplace/Mobile/Web workflow

### For non-service tooling (mockup-sandbox)
- Lives in `tools/mockup-sandbox/` (not `artifacts/`) to prevent auto-detection.
- On-demand only, not auto-started. Port 9000.
- The old `artifacts/mockup-sandbox: Component Preview Server` shows "finished" forever — harmless.

## Final Clean State (June 18, 2026)
- `artifacts/api-server: API Server` — running, port 8080 ✅
- `artifacts/marketplace: web` — running, Replit-assigned port ✅
- `artifacts/mobile: expo` — running, Replit-assigned port ✅
- `Embedding Service` — running, port 8000 ✅ (sentence-transformers)
- `tools/mockup-sandbox: Component Preview Server` — finished (on-demand only, harmless)

## Secrets vs Shared Env (June 18, 2026)
- `ROOT_ADMIN_PASSWORD` → Replit Secrets tab (NOT .replit userenv)
- `VAPID_PRIVATE_KEY` → Replit Secrets tab (NOT .replit userenv)
- `VAPID_PUBLIC_KEY`, `VAPID_EMAIL`, `EMBEDDING_SERVICE_URL`, `API_PORT`, `CORS_ORIGIN`, `SITE_URL`, `VITE_SUPPORT_PHONE` → .replit [userenv.shared]

**Why:** Replit deduplicates by workflow name; the artifact system owns `artifacts/*: *` names. Marketplace/mobile must not force ports — Replit's artifact routing manages proxying. API must use API_PORT (not PORT) to avoid shared-env conflicts.
