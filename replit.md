====================================================

STOP.

DO NOT ANALYZE THE CODEBASE.

DO NOT RUN WORKFLOWS.

DO NOT INSTALL PACKAGES.

DO NOT START RECOVERY.

FIRST READ:

SYANO_MASTER_RECOVERY.md

Read the ENTIRE file.

After reading it:

Follow it exactly.

If any instruction in this file conflicts with SYANO_MASTER_RECOVERY.md:

SYANO_MASTER_RECOVERY.md wins.

Recovery is NOT allowed until SYANO_MASTER_RECOVERY.md has been fully parsed.

====================================================

# IMPORTANT

The only source of truth is:

SYANO_MASTER_RECOVERY.md

Read it first.

Do not rely on any other recovery document.

---

# IMPORT RULE — MANDATORY EXECUTION SEQUENCE

When this project is imported into a new Replit workspace, an agent MUST execute
ALL of the following steps in order. Reading is not enough — every command below
must be run and must succeed before any other work begins.

## Step 1 — Install Node packages
```bash
pnpm install --no-frozen-lockfile
```

## Step 2 — Install Python packages (3 passes, in order)
```bash
# Pass 1 — core packages
pip install --user numpy fastapi uvicorn scikit-learn pydantic

# Pass 2 — PyTorch CPU wheel (explicit index required — do NOT use uv or pyproject)
pip install --user torch --index-url https://download.pytorch.org/whl/cpu

# Pass 3 — ML packages that depend on torch
pip install --user transformers sentence-transformers sentencepiece safetensors
```

## Step 3 — Build shared TypeScript libraries
```bash
npx tsc --build lib/db lib/api-zod lib/api-client-react
```

## Step 4 — Enable database extensions
Run in the database (executeSql or psql):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## Step 5 — Push schema (fresh DB only — skip if 44 tables already exist)
```bash
cd lib/db && pnpm run push-force
```

## Step 6 — Start workflows in this exact order
1. `artifacts/api-server: API Server`
2. `Embedding Service`
3. `artifacts/marketplace: web`
4. `artifacts/mobile: expo`

**WORKFLOW RULES (permanent):**
- Exactly 4 workflows must exist — no more, no fewer
- NEVER set PORT= on marketplace or mobile workflows
- Forbidden workflows (delete if found): `Start application`, `API Server` (manual), `Marketplace` (manual)

## Step 7 — Restart Embedding Service after Python packages are installed
The embedding service must be restarted AFTER sentence-transformers is installed
so it picks up the real model instead of falling back to TF-IDF+LSA.

## Step 8 — Verify full health
```bash
curl -s http://localhost:8080/api/healthz | python3 -m json.tool
# Must show: status=ok, tables=44, products=42, embeddings=42, embeddingBackend=sentence-transformers

curl -s http://localhost:8000/health
# Must show: backend=sentence-transformers, vector_dimensions=384
```

## Step 9 — Run TypeScript checks (all must be 0 errors)
```bash
npx tsc --build lib/db lib/api-zod lib/api-client-react
npx tsc --noEmit -p artifacts/api-server/tsconfig.json
npx tsc --noEmit -p artifacts/marketplace/tsconfig.json
npx tsc --noEmit -p artifacts/mobile/tsconfig.json
```

## Step 10 — Run import certification
```bash
pnpm import:check
# Must exit: PASS or PASS WITH WARNINGS
```

Only after all 10 steps are complete may any other work begin.

---

## User Preferences

- Write all visible text to users via i18n keys only (en.json + ar.json on web; artifacts/mobile/src/i18n/index.ts on mobile)
- RTL/LTR: use Tailwind logical classes (ms- not ml-, ps- not pl-, start- not left-)
- TypeScript strict: 0 errors mandatory, no `any`
- All DB changes additive only (no DROP, no ALTER existing columns)
- Never force PORT= on marketplace or mobile workflows
