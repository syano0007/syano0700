/**
 * SYANO — Embedding Backfill Script
 *
 * Generates vector embeddings for all products that don't have them yet.
 * Idempotent: only processes products WHERE embedding IS NULL.
 *
 * Run manually: pnpm --filter @workspace/api-server embed:generate
 * Called automatically at startup by run-migrations.ts when EMBEDDING_SERVICE_URL is set.
 */

import { pool } from "@workspace/db";

const EMBEDDING_SERVICE_URL = process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8001";
const BATCH_SIZE = 50;
const MODEL_NAME = "multilingual-e5-small";

interface ProductRow {
  id: number;
  name: string | null;
  name_ar: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  search_tokens: string | null;
}

function buildEmbeddingText(p: ProductRow): string {
  return [
    p.name_ar,
    p.name,
    p.category,
    p.subcategory,
    p.description?.slice(0, 500),
    p.search_tokens,
  ]
    .filter(Boolean)
    .join(" ");
}

async function waitForService(maxWaitMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`${EMBEDDING_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

export async function runEmbeddingBackfill(): Promise<void> {
  const serviceUrl = process.env["EMBEDDING_SERVICE_URL"];
  if (!serviceUrl) {
    console.log("[embeddings] EMBEDDING_SERVICE_URL not set — skipping backfill");
    return;
  }

  // Check pgvector availability first
  try {
    await pool.query(`SELECT NULL::vector(1)`);
  } catch {
    console.log("[embeddings] pgvector not available — skipping backfill");
    return;
  }

  const { rows: countRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM products WHERE embedding IS NULL`,
  );
  const toEmbed = parseInt(countRows[0]?.cnt ?? "0", 10);
  if (toEmbed === 0) {
    console.log("[embeddings] All products already embedded — skipping backfill");
    return;
  }

  console.log(`[embeddings] Starting embedding backfill for ${toEmbed} products...`);

  const ready = await waitForService();
  if (!ready) {
    console.error("[embeddings] Embedding service not reachable within 30s — backfill aborted");
    return;
  }

  const { rows: products } = await pool.query<ProductRow>(
    `SELECT id, name, name_ar, category, subcategory, description, search_tokens
     FROM products WHERE embedding IS NULL ORDER BY id`,
  );

  let embedded = 0;
  let failed = 0;
  const failedIds: number[] = [];
  const startTime = Date.now();

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    try {
      const resp = await fetch(`${EMBEDDING_SERVICE_URL}/embed/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts, type: "passage" }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = (await resp.json()) as { embeddings: number[][] };

      for (let j = 0; j < batch.length; j++) {
        const product = batch[j]!;
        const emb = data.embeddings[j];
        if (!emb) { failedIds.push(product.id); failed++; continue; }
        try {
          await pool.query(
            `UPDATE products
               SET embedding       = $1::vector,
                   embedding_model = $2,
                   embedded_at     = NOW()
             WHERE id = $3`,
            [`[${emb.join(",")}]`, MODEL_NAME, product.id],
          );
          embedded++;
        } catch (err) {
          console.error(`[embeddings] DB update failed for product ${product.id}:`, err);
          failedIds.push(product.id); failed++;
        }
      }
    } catch (err) {
      console.error(`[embeddings] Batch ${i}–${i + BATCH_SIZE} failed:`, err);
      for (const p of batch) { failedIds.push(p.id); failed++; }
    }

    const done = embedded + failed;
    if (done % 100 === 0 || i + BATCH_SIZE >= products.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = ((done / products.length) * 100).toFixed(1);
      const avgMs = done > 0 ? ((elapsed * 1000) / done).toFixed(0) : "?";
      console.log(`[embeddings] Embedded ${embedded}/${products.length} (${pct}%) — avg ${avgMs}ms/product`);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[embeddings] Backfill complete: ${embedded} products embedded in ${totalElapsed}s. Failed: ${failed}` +
    (failedIds.length > 0 ? ` (IDs: ${failedIds.slice(0, 20).join(", ")})` : ""),
  );
}

/** Generate embedding for a single newly-created product. Fire-and-forget. */
export async function generateSingleEmbedding(
  productId: number,
  embeddingText: string,
): Promise<void> {
  const serviceUrl = process.env["EMBEDDING_SERVICE_URL"];
  if (!serviceUrl) return;
  try {
    const resp = await fetch(`${serviceUrl}/embed/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: embeddingText }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as { embedding: number[] };
    if (!data.embedding?.length) return;
    await pool.query(
      `UPDATE products
         SET embedding       = $1::vector,
             embedding_model = $2,
             embedded_at     = NOW()
       WHERE id = $3`,
      [`[${data.embedding.join(",")}]`, MODEL_NAME, productId],
    );
    console.log(`[embeddings] Product ${productId} embedded`);
  } catch (err) {
    console.error(`[embeddings] generateSingleEmbedding(${productId}) failed:`, err);
  }
}

// ── Standalone script entry point ────────────────────────────────────────────
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].includes("generateEmbeddings") || process.argv[1].endsWith("embed:generate"));

if (isMain) {
  runEmbeddingBackfill()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
