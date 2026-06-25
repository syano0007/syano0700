---
name: Semantic Search + Cache Layer Phase 8
description: Architecture decisions for the semantic search + in-memory LRU cache added to the SYANO search pipeline in June 2026. Phase 8 COMPLETE — hybrid mode active with TF-IDF fallback embedder.
---

## Status: COMPLETE (June 15, 2026)

All 12 verification steps passed. Hybrid mode (`embeddingServiceAvailable: true`, `pgvectorAvailable: true`) confirmed via `/api/admin/search/cache`.

## Embedding Service (artifacts/embedding-service/)

**HuggingFace model download is blocked by Replit firewall (SIGTERM kills the process).** Do NOT attempt to load `intfloat/multilingual-e5-small` or any other HuggingFace model — it will always fail.

**Solution:** Lightweight TF-IDF + LSA fallback in `main.py`:
- `TfidfVectorizer(analyzer='char_wb', ngram_range=(2,4))` — works natively for Arabic + English, no download
- `TruncatedSVD(n_components=384)` — same dimensionality as multilingual-e5-small
- L2 normalization via `sklearn.preprocessing.normalize` — unit vectors for cosine similarity
- Seed corpus: 233 bilingual Arabic/English product terms covering all marketplace categories
- Startup time: ~558ms (fits TF-IDF on seed corpus at launch)
- Same API shape: `GET /health`, `POST /embed/query`, `POST /embed/batch`
- Response includes `"backend": "tfidf-lsa"` field

**Endpoints:**
- `GET /health` → `{"status":"ok","model":"multilingual-e5-small","vector_dimensions":384,"backend":"tfidf-lsa"}`
- `POST /embed/query` → `{"embedding":[...],"dimensions":384,"processing_ms":9}`
- `POST /embed/batch` → `{"embeddings":[[...],...],"count":N,"processing_ms":2}`

**Workflow:** `artifacts/embedding-service: Embedding Service` — persistent, started via `cd artifacts/embedding-service && python3 main.py`

**Env var:** `EMBEDDING_SERVICE_URL=http://localhost:8001` set in shared environment

## Cache Layer (searchCache.ts)

- `artifacts/api-server/src/services/searchCache.ts` — 500-entry LRU, O(1) get/set via doubly-linked list + Map
- Cache key: `MD5(normalizeArabic(raw) + "|" + sortBy + "|" + JSON.stringify(filters))`
- TTL tiers: 1 min (sale/new_arrivals), 10 min (fallback L4), 5 min all others
- Admin endpoints: `GET /api/admin/search/cache` (stats + embeddingServiceAvailable + pgvectorAvailable), `DELETE /api/admin/search/cache` (flush)
- `searchCache.invalidate()` called on: product create/update/delete/discount, reindex route
- Response includes `X-Cache: HIT | MISS` header
- LRU cache: 13ms cached vs 27ms cold (from API logs)

## Semantic Search Infrastructure

- `EMBEDDING_SERVICE_URL` env var controls activation; 2-second hard timeout on all calls
- `_embeddingServiceAvailable` and `_pgvectorAvailable` flags probed at startup + every 35s interval in search.ts
- 42/42 products embedded at startup via `runEmbeddingBackfill()` (called from run-migrations.ts when env var is set)
- Backfill script: `pnpm --filter @workspace/api-server embed:generate`

## Reciprocal Rank Fusion (RRF)

- Weights: FTS=0.65, semantic=0.35, k=60
- Reorders existing FTS results only — additive, never replaces FTS
- Activated when: `_embeddingServiceAvailable && _pgvectorAvailable && raw.length >= 4`
- `searchMode: "hybrid" | "fts_only"` + `semanticResultCount` in API response

## DB Schema

- `embedding` (vector(384)), `embedding_model` (text), `embedded_at` (timestamp) on `products` table
- IVFFlat index: `products_embedding_ivfflat` (lists=10, probes=3)
- pgvector cosine similarity confirmed working: AirPods → MacBook 0.47 (both Apple ✅)

## Verification Results (June 15, 2026)

| Check | Result |
|-------|--------|
| embeddingServiceAvailable | true |
| pgvectorAvailable | true |
| Products embedded | 42/42 |
| TypeScript errors | 0 |
| Embed service latency | 9ms query, 2ms batch |
| pgvector cosine (AirPods→MacBook) | 0.47 |
| Arabic search (عطر رجالي) | correct perfumes |
| Embedding service startup | 558ms |

## Frontend (search/index.tsx)

- `apiEngineMode` variable extracted from `searchData?.searchMode`
- Violet "Smart search ✨" badge shown when `apiEngineMode === "hybrid"`
- i18n keys: `search.semantic.smartSearch`, `search.semantic.hybridTooltip`
