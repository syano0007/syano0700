import app from "./app";
import { logger } from "./lib/logger";
import { runSearchStartup } from "./lib/search-startup";
import { runMigrations } from "./lib/run-migrations";
import { runStartupValidation } from "./lib/startup-validation";
import { bootstrapRootAdmin } from "./lib/bootstrap-admin";
import { bootstrapTestAccounts, bootstrapAISupportAgent } from "./lib/bootstrap-test-accounts";
import { bootstrapDemoMarketplaceData } from "./lib/bootstrap-demo-data";
import { runEmbeddingBackfill } from "./scripts/generateEmbeddings";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  await runMigrations();
  await runStartupValidation();
  await runSearchStartup();
  await bootstrapRootAdmin();
  await bootstrapTestAccounts();
  await bootstrapAISupportAgent();
  await bootstrapDemoMarketplaceData();

  const server = app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Non-blocking: generate embeddings for products that don't have them yet.
    // Runs after the server is already listening so it never delays startup.
    runEmbeddingBackfill().catch((err) =>
      logger.error({ err }, "[embeddings] Backfill error"),
    );
  });

  // ── STEP 8.1: Memory monitoring (dev only) ───────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    setInterval(() => {
      const mem = process.memoryUsage();
      logger.info(
        {
          heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
          rssMB:       Math.round(mem.rss       / 1024 / 1024),
        },
        "[MEM]",
      );
    }, 60_000);

    // ── STEP 5.3: Connection pool monitoring ─────────────────────────────
    setInterval(() => {
      logger.info(
        {
          total:   pool.totalCount,
          idle:    pool.idleCount,
          waiting: pool.waitingCount,
        },
        "[POOL]",
      );
    }, 5 * 60_000);
  }

  // ── STEP 8.3: Graceful shutdown ──────────────────────────────────────────
  const shutdown = async () => {
    logger.info("[SHUTDOWN] Closing server...");
    server.close(async () => {
      try {
        await pool.end();
        logger.info("[SHUTDOWN] DB pool closed. Done.");
      } catch {
        // ignore pool close errors on shutdown
      }
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("[SHUTDOWN] Forced exit after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => { shutdown().catch(() => process.exit(1)); });
  process.on("SIGINT",  () => { shutdown().catch(() => process.exit(1)); });
})();
