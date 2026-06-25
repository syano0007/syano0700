---
name: Embedding lifecycle
description: How product embeddings are generated on create/update; the PATCH gap bug and its fix.
---

## Rule
`POST /products` fires `generateSingleEmbedding` immediately (fire-and-forget). `PATCH /products/:id` did NOT re-embed — fixed to call `generateSingleEmbedding` when `searchAffected === true` (name/description/category/subcategory/nameAr changed).

**Why:** Stale vectors mean updated products score against their old text in semantic search. Any text mutation must re-embed.

**How to apply:** Any new route that mutates name/description/category/subcategory/nameAr must also call `generateSingleEmbedding(id, embText).catch(() => {})` fire-and-forget after the DB update.

## Error visibility
`generateSingleEmbedding` catch block was `catch { /* non-critical */ }` — completely silent. Changed to `catch (err) { console.error(...) }` so failures surface in API server logs.

## Backfill safety net
`runEmbeddingBackfill()` runs at every API startup and embeds any product with `embedding IS NULL`. This catches products that slipped through during a deployment window when the fire-and-forget failed silently.

## Embedding service endpoint
- Fire-and-forget single: `POST /embed/query` → `{ text }` → `{ embedding: number[] }`
- Batch backfill: `POST /embed/batch` → `{ texts, type }` → `{ embeddings: number[][] }`
- Both at `EMBEDDING_SERVICE_URL` (port 8000), sentence-transformers backend, 384-dim

## Verified end-to-end (June 20, 2026)
- POST → product 44 embedded immediately, `[embeddings] Product 44 embedded` in logs
- PATCH → product 44 re-embedded at new timestamp with new vector
- Semantic search → product 44 ranked #1 (score 0.9) for matching query
- Startup backfill → product 43 (missed by stale build) caught on next restart
