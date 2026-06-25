/**
 * Syano Dynamic Sitemap Routes
 *
 * Mounted at the ROOT level of the Express app (not under /api).
 * Accessible in dev via the Vite proxy: /sitemap*.xml → API server.
 * Accessible directly at the API server's internal port for monitoring.
 *
 * Routes:
 *   GET /sitemap.xml             → sitemap index (references all sub-sitemaps)
 *   GET /sitemap-index.xml       → alias for sitemap.xml
 *   GET /sitemap-pages.xml       → static / info pages
 *   GET /sitemap-categories.xml  → product category browse pages
 *   GET /sitemap-products.xml    → all active product pages
 *   GET /sitemap-stores.xml      → approved seller store pages
 *   GET /sitemap-cache           → cache TTL status (internal debugging)
 *   POST /sitemap-flush          → flush cache (internal use)
 */

import { Router, type Request, type Response } from "express";
import {
  buildIndexXml,
  buildPagesXml,
  buildCategoriesXml,
  buildProductsXml,
  buildStoresXml,
  getCacheStats,
  flushCache,
} from "../lib/sitemap-builder";
import { logger } from "../lib/logger";

const sitemapRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendXml(res: Response, xml: string): void {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // Cache at CDN / reverse proxy for 10 minutes; allow stale for 1 min during revalidation
  res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=60");
  res.setHeader("Vary", "Accept-Encoding");
  // Sitemaps are data files, not web pages — they should not appear in search results
  res.setHeader("X-Robots-Tag", "noindex");
  res.send(xml);
}

async function serveMap(
  res: Response,
  name: string,
  builder: () => Promise<string>,
): Promise<void> {
  const t0 = Date.now();
  try {
    const xml    = await builder();
    const ms     = Date.now() - t0;
    const cached = ms < 5; // <5ms means it came from cache
    logger.info({ sitemap: name, ms, cached }, "sitemap served");
    sendXml(res, xml);
  } catch (err) {
    logger.error({ err, sitemap: name }, "sitemap generation failed");
    res.status(503)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<!-- Sitemap temporarily unavailable. Please retry in a few minutes. -->\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      );
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/** Master sitemap index — submit this URL to Google Search Console */
sitemapRouter.get("/sitemap.xml", (_req: Request, res: Response) => {
  return serveMap(res, "index", buildIndexXml);
});

sitemapRouter.get("/sitemap-index.xml", (_req: Request, res: Response) => {
  return serveMap(res, "index", buildIndexXml);
});

sitemapRouter.get("/sitemap-pages.xml", (_req: Request, res: Response) => {
  return serveMap(res, "pages", buildPagesXml);
});

sitemapRouter.get("/sitemap-categories.xml", (_req: Request, res: Response) => {
  return serveMap(res, "categories", buildCategoriesXml);
});

sitemapRouter.get("/sitemap-products.xml", (_req: Request, res: Response) => {
  return serveMap(res, "products", buildProductsXml);
});

sitemapRouter.get("/sitemap-stores.xml", (_req: Request, res: Response) => {
  return serveMap(res, "stores", buildStoresXml);
});

/** Cache inspection endpoint — internal only (do not expose publicly) */
sitemapRouter.get("/sitemap-cache", (_req: Request, res: Response) => {
  res.json({
    entries: getCacheStats(),
    note: "ttlSeconds = seconds until cache entry expires and DB is re-queried",
  });
});

/** Manual cache flush — internal only */
sitemapRouter.post("/sitemap-flush", (_req: Request, res: Response) => {
  flushCache();
  logger.info("sitemap cache flushed via POST /sitemap-flush");
  res.json({ ok: true, message: "Sitemap cache flushed. Next request will re-query DB." });
});

export default sitemapRouter;
