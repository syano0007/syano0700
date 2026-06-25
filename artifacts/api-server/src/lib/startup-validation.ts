/**
 * Startup Validation — runs immediately after migrations on every API boot.
 *
 * Checks that every critical table, enum, and column exists before the server
 * starts accepting requests. Logs exact diagnostics on failure but does NOT
 * crash — a missing optional table is a WARNING, a missing core table is an ERROR.
 *
 * Exit codes are reserved for truly unrecoverable states (missing users table).
 */
import { pool } from "@workspace/db";
import { type PoolClient } from "pg";
import { logger } from "./logger";

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

async function queryExists(
  client: PoolClient,
  sql: string,
): Promise<boolean> {
  try {
    const res = await client.query<{ exists: boolean }>(sql);
    return res.rows[0]?.exists === true;
  } catch {
    return false;
  }
}

async function queryCount(
  client: PoolClient,
  sql: string,
): Promise<number> {
  try {
    const res = await client.query<{ count: string }>(sql);
    return parseInt(res.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function runStartupValidation(): Promise<void> {
  const client = await pool.connect();
  const result: ValidationResult = { ok: true, errors: [], warnings: [] };

  try {
    // ── 1. Critical core tables ──────────────────────────────────────────────
    const coreTables = [
      "users", "products", "orders", "cart_items", "order_items",
      "notifications", "conversations", "messages",
    ];
    for (const table of coreTables) {
      const exists = await queryExists(client, `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) AS exists
      `);
      if (!exists) {
        result.errors.push(`CRITICAL: table '${table}' missing — run migrations`);
        result.ok = false;
      }
    }

    // ── 2. Courier V3.3 tables ───────────────────────────────────────────────
    const courierTables = [
      "couriers", "courier_assignments", "courier_wallet_transactions",
      "delivery_zones", "delivery_missions", "mission_offers", "dispatch_alerts",
    ];
    for (const table of courierTables) {
      const exists = await queryExists(client, `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) AS exists
      `);
      if (!exists) {
        result.errors.push(`Courier table '${table}' missing — run migrations`);
        result.ok = false;
      }
    }

    // ── 3. notification_type enum (32 values required) ───────────────────────
    const notifCount = await queryCount(client,
      `SELECT COUNT(*)::text AS count FROM unnest(enum_range(NULL::notification_type))`
    );
    if (notifCount < 32) {
      result.errors.push(`notification_type enum: ${notifCount}/32 values — run ALTER TYPE migration`);
      result.ok = false;
    }

    // ── 4. order_status enum (15 values required) ────────────────────────────
    const orderStatusCount = await queryCount(client,
      `SELECT COUNT(*)::text AS count FROM unnest(enum_range(NULL::order_status))`
    );
    if (orderStatusCount < 15) {
      result.errors.push(`order_status enum: ${orderStatusCount}/15 values — run ALTER TYPE migration`);
      result.ok = false;
    }

    // ── 5. delivery_mission_status enum ─────────────────────────────────────
    const missionStatusCount = await queryCount(client,
      `SELECT COUNT(*)::text AS count FROM unnest(enum_range(NULL::delivery_mission_status))`
    );
    if (missionStatusCount < 7) {
      result.warnings.push(`delivery_mission_status enum: ${missionStatusCount} values (expected ≥7)`);
    }

    // ── 6. Critical columns (migration-added) ────────────────────────────────
    const criticalColumns: Array<[string, string]> = [
      ["users", "account_status"],
      ["users", "trust_score"],
      ["users", "verification_level"],
      ["users", "preferred_theme"],
      ["users", "preferred_language"],
      ["users", "preferred_currency"],
      ["orders", "delivery_fee"],
      ["orders", "zone_id"],
      ["conversations", "type"],
      ["products", "sales_count"],
      ["couriers", "availability_status"],
      // delivery_missions extended columns (V3.3)
      ["delivery_missions", "proof_image_url"],
      ["delivery_missions", "confirmed_by_courier"],
      ["delivery_missions", "failure_type"],
      ["delivery_missions", "failure_reason"],
      ["delivery_missions", "reschedule_requested_at"],
      ["delivery_missions", "reschedule_reason"],
      ["delivery_missions", "reschedule_requested_by"],
    ];
    for (const [table, col] of criticalColumns) {
      const exists = await queryExists(client, `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${table}' AND column_name = '${col}'
        ) AS exists
      `);
      if (!exists) {
        result.errors.push(`Column '${table}.${col}' missing — run migrations`);
        result.ok = false;
      }
    }

    // ── 7. Embedding infrastructure ──────────────────────────────────────────
    const embeddingColExists = await queryExists(client, `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'embedding'
      ) AS exists
    `);
    if (!embeddingColExists) {
      result.warnings.push("products.embedding column missing — semantic search disabled (TF-IDF will be used)");
    }

    // ── 8. Delivery zones seeded ──────────────────────────────────────────────
    const zoneCount = await queryCount(client,
      `SELECT COUNT(*)::text AS count FROM delivery_zones`
    );
    if (zoneCount === 0) {
      result.warnings.push("delivery_zones table is empty — checkout zone picker will show no options");
    }

    // ── 9. search_synonyms table ──────────────────────────────────────────────
    const synonymsExists = await queryExists(client, `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'search_synonyms'
      ) AS exists
    `);
    if (!synonymsExists) {
      result.warnings.push("search_synonyms table missing — synonym expansion disabled");
    }

    // ── Report ────────────────────────────────────────────────────────────────
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        logger.error(`[startup-validation] ${err}`);
      }
    }
    if (result.warnings.length > 0) {
      for (const warn of result.warnings) {
        logger.warn(`[startup-validation] ${warn}`);
      }
    }
    if (result.ok) {
      logger.info(`[startup-validation] All ${coreTables.length + courierTables.length} tables OK, enums OK, critical columns OK`);
    } else {
      logger.error(
        { errorCount: result.errors.length },
        "[startup-validation] Schema validation failed — some features may not work correctly",
      );
    }
  } finally {
    client.release();
  }
}
