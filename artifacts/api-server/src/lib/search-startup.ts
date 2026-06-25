import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Run once at server startup to configure PostgreSQL for fast multilingual search:
 *
 *  Phase 1 (pg_trgm + Arabic normalizer + trigram indexes)  — unchanged from V1
 *  Phase 2 (full-text search infrastructure)  — NEW
 *    • fts_vector tsvector column with A/B/C/D weight tiers
 *    • GIN index for fast @@ operator
 *    • BEFORE INSERT/UPDATE trigger keeps fts_vector current automatically
 *
 * Weight tiers
 *   A — products.name, products.name_ar   (highest relevance)
 *   B — products.category, subcategory    (category intent)
 *   C — products.search_tokens            (dialect + brand expansions)
 *   D — first 240 chars of description   (long-tail fallback)
 */
export async function runSearchStartup(): Promise<void> {
  const client = await pool.connect();
  try {
    /* ── Phase 1: pg_trgm + Arabic SQL normalizer + legacy columns & indexes ── */
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE OR REPLACE FUNCTION normalize_ar(input text)
      RETURNS text
      LANGUAGE sql IMMUTABLE STRICT
      AS $fn$
        SELECT
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(input),
                  '[\\u064B-\\u065F\\u0670\\u0640]', '', 'g'
                ),
                '[\\u0622\\u0623\\u0625\\u0671]', '\\u0627', 'g'
              ),
              '\\u0649', '\\u064A', 'g'
            ),
            '\\u0629', '\\u0647', 'g'
          )
      $fn$;

      ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ar       text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS search_tokens text;

      CREATE INDEX IF NOT EXISTS products_name_trgm   ON products USING gin(name          gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS products_namar_trgm  ON products USING gin(name_ar       gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS products_tokens_trgm ON products USING gin(search_tokens gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS products_cat_trgm    ON products USING gin(category      gin_trgm_ops);
    `);

    await client.query(`
      UPDATE products
      SET search_tokens = lower(
        name || ' ' ||
        COALESCE(name_ar, '') || ' ' ||
        category || ' ' ||
        COALESCE(subcategory, '') || ' ' ||
        substring(description for 150)
      )
      WHERE search_tokens IS NULL;
    `);

    logger.info("Search startup phase 1 complete: pg_trgm + trigram indexes");

    /* ── Phase 2: full-text search vector ────────────────────────────────────── */
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS fts_vector tsvector;
    `);

    /* GIN index on the stored tsvector — makes @@ operator O(log n) */
    await client.query(`
      CREATE INDEX IF NOT EXISTS products_fts_gin
        ON products USING gin(fts_vector);
    `);

    /*
     * Auto-update function: rebuilds fts_vector whenever a product row
     * is inserted or the indexed text columns are updated.
     * Uses 'simple' dictionary: no stemming, just lowercasing + tokenising.
     * This is deliberate: Arabic has no PG native stemmer so 'simple' is
     * the correct choice — our NLP pipeline handles normalisation upstream.
     */
    await client.query(`
      CREATE OR REPLACE FUNCTION products_fts_rebuild()
      RETURNS trigger
      LANGUAGE plpgsql AS
      $$
      BEGIN
        NEW.fts_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.name, '')),                    'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.name_ar, '')),                 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.category, '')),                'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.subcategory, '')),             'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.search_tokens, '')),           'C') ||
          setweight(to_tsvector('simple', coalesce(substring(NEW.description for 240), '')), 'D');
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS products_fts_trig ON products;
      CREATE TRIGGER products_fts_trig
        BEFORE INSERT OR UPDATE OF name, name_ar, category, subcategory,
                                   search_tokens, description
        ON products
        FOR EACH ROW EXECUTE FUNCTION products_fts_rebuild();
    `);

    /* Back-fill any rows that pre-date the trigger */
    await client.query(`
      UPDATE products
      SET fts_vector =
        setweight(to_tsvector('simple', coalesce(name, '')),                    'A') ||
        setweight(to_tsvector('simple', coalesce(name_ar, '')),                 'A') ||
        setweight(to_tsvector('simple', coalesce(category, '')),                'B') ||
        setweight(to_tsvector('simple', coalesce(subcategory, '')),             'B') ||
        setweight(to_tsvector('simple', coalesce(search_tokens, '')),           'C') ||
        setweight(to_tsvector('simple', coalesce(substring(description for 240), '')), 'D')
      WHERE fts_vector IS NULL;
    `);

    logger.info("Search startup phase 2 complete: fts_vector column + GIN index + trigger");

    /* ── Search-analytics table ───────────────────────────────────────────── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS search_queries (
        query         TEXT PRIMARY KEY,
        count         INTEGER NOT NULL DEFAULT 1,
        last_searched TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS search_queries_count_idx ON search_queries (count DESC);
    `);

    logger.info("Search startup: search_queries table ready");

    /* ── Phase 3: query_logs table (Step 4 — typed autocomplete analytics) ── */
    await client.query(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id           SERIAL PRIMARY KEY,
        query        TEXT NOT NULL,
        lang         VARCHAR(2) DEFAULT 'ar',
        result_count INTEGER,
        clicked      BOOLEAN DEFAULT false,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS query_logs_created_idx ON query_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS query_logs_query_idx   ON query_logs (query);
    `);

    logger.info("Search startup phase 3 complete: query_logs table ready");
  } catch (err) {
    logger.warn({ err }, "Search startup non-fatal warning — app continues");
  } finally {
    client.release();
  }
}
