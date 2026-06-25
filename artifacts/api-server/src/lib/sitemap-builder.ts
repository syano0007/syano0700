/**
 * Syano Sitemap Builder
 *
 * Generates all sitemap XML strings from the live database.
 * Uses an in-memory TTL cache to avoid hammering the DB on every crawler request.
 *
 * Sub-sitemaps:
 *   sitemap-pages.xml      — static / info pages
 *   sitemap-categories.xml — product category browse URLs
 *   sitemap-products.xml   — all in-stock product pages (up to 49k)
 *   sitemap-stores.xml     — approved seller store pages
 *   sitemap.xml            — sitemap index pointing to all four above
 *
 * Cache strategy:
 *   pages / index  → 5 min TTL  (rarely changes)
 *   categories     → 10 min TTL (changes when products are added)
 *   products       → 10 min TTL (highest churn)
 *   stores         → 15 min TTL (changes infrequently)
 */

import { db, productsTable, sellerApplicationsTable } from "@workspace/db";
import { gt, eq, and, isNotNull, sql } from "drizzle-orm";

const SITE = "https://syano.online";

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  xml: string;
  builtAt: number;
  expiresAt: number;
  rowCount: number;
  buildMs: number;
}

const cache = new Map<string, CacheEntry>();

const TTL: Record<string, number> = {
  index:      5 * 60 * 1_000,
  pages:      5 * 60 * 1_000,
  categories: 10 * 60 * 1_000,
  products:   10 * 60 * 1_000,
  stores:     15 * 60 * 1_000,
};

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.xml;
}

function setCached(key: string, xml: string, rowCount: number, buildMs: number): void {
  cache.set(key, {
    xml,
    builtAt: Date.now(),
    expiresAt: Date.now() + (TTL[key] ?? 10 * 60 * 1_000),
    rowCount,
    buildMs,
  });
}

// ─── XML helpers ─────────────────────────────────────────────────────────────

function escXml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function w3cDate(d: Date | string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!d) return today;
  try { return new Date(d).toISOString().slice(0, 10); }
  catch { return today; }
}

function urlEntry(
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: string,
  extras = "",
): string {
  return (
    `  <url>\n` +
    `    <loc>${escXml(loc)}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>${extras}\n` +
    `  </url>`
  );
}

function xmlHeader(comment: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${comment} -->\n`;
}

// ─── Static pages definition ─────────────────────────────────────────────────

interface StaticPage {
  path: string;
  priority: string;
  changefreq: string;
  hreflang?: boolean;
}

const STATIC_PAGES: StaticPage[] = [
  { path: "/",                    priority: "1.0",  changefreq: "daily",   hreflang: true },
  { path: "/products",            priority: "0.95", changefreq: "hourly" },
  { path: "/about",               priority: "0.70", changefreq: "monthly" },
  { path: "/about/story",         priority: "0.65", changefreq: "monthly" },
  { path: "/about/team",          priority: "0.60", changefreq: "monthly" },
  { path: "/contact",             priority: "0.65", changefreq: "monthly" },
  { path: "/help",                priority: "0.70", changefreq: "weekly"  },
  { path: "/shipping",            priority: "0.65", changefreq: "monthly" },
  { path: "/shipping/nationwide", priority: "0.60", changefreq: "monthly" },
  { path: "/payment-methods",     priority: "0.60", changefreq: "monthly" },
  { path: "/syano-guarantee",     priority: "0.65", changefreq: "monthly" },
  { path: "/loyalty",             priority: "0.60", changefreq: "monthly" },
  { path: "/seller/apply",        priority: "0.65", changefreq: "monthly" },
  { path: "/seller/how-to-sell",  priority: "0.65", changefreq: "monthly" },
  { path: "/seller/center",       priority: "0.60", changefreq: "monthly" },
  { path: "/seller/commission",   priority: "0.55", changefreq: "monthly" },
  { path: "/seller/terms",        priority: "0.50", changefreq: "monthly" },
  { path: "/seller/faq",          priority: "0.55", changefreq: "monthly" },
  { path: "/privacy-policy",      priority: "0.40", changefreq: "monthly" },
  { path: "/terms-of-use",        priority: "0.40", changefreq: "monthly" },
  { path: "/returns-policy",      priority: "0.45", changefreq: "monthly" },
  { path: "/cookies",             priority: "0.30", changefreq: "monthly" },
  { path: "/register",            priority: "0.40", changefreq: "monthly" },
  { path: "/login",               priority: "0.30", changefreq: "monthly" },
];

// ─── Builders ────────────────────────────────────────────────────────────────

/** sitemap-pages.xml — static informational pages */
export async function buildPagesXml(): Promise<string> {
  const cached = getCached("pages");
  if (cached) return cached;

  const t0  = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const entries = STATIC_PAGES.map((p) => {
    const hreflangBlock = p.hreflang
      ? `\n    <xhtml:link rel="alternate" hreflang="en"        href="${SITE}${p.path}" />` +
        `\n    <xhtml:link rel="alternate" hreflang="ar"        href="${SITE}${p.path}" />` +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.path}" />`
      : "";
    return urlEntry(`${SITE}${p.path}`, today, p.changefreq, p.priority, hreflangBlock);
  });

  const xml =
    xmlHeader(`Syano Pages Sitemap | ${STATIC_PAGES.length} pages | ${new Date().toISOString()}`) +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join("\n") + "\n" +
    `</urlset>`;

  setCached("pages", xml, STATIC_PAGES.length, Date.now() - t0);
  return xml;
}

/** sitemap-categories.xml — product category browse pages */
export async function buildCategoriesXml(): Promise<string> {
  const cached = getCached("categories");
  if (cached) return cached;

  const t0    = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .selectDistinct({ category: productsTable.category })
    .from(productsTable)
    .where(gt(productsTable.stock, 0));

  const categories = rows
    .map((r) => r.category)
    .filter(Boolean)
    .sort() as string[];

  const entries = categories.map((cat) =>
    urlEntry(
      `${SITE}/products?category=${encodeURIComponent(cat)}`,
      today, "daily", "0.85",
    ),
  );

  const buildMs = Date.now() - t0;
  const xml =
    xmlHeader(`Syano Category Sitemap | ${categories.length} categories | ${new Date().toISOString()} | ${buildMs}ms`) +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") + "\n" +
    `</urlset>`;

  setCached("categories", xml, categories.length, buildMs);
  return xml;
}

/** sitemap-products.xml — all active (in-stock) product pages */
export async function buildProductsXml(): Promise<string> {
  const cached = getCached("products");
  if (cached) return cached;

  const t0 = Date.now();

  // Single query — no N+1. Capped at 49k to stay within Google's 50k limit.
  const products = await db
    .select({
      id:        productsTable.id,
      name:      productsTable.name,
      imageUrl:  productsTable.imageUrl,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .where(gt(productsTable.stock, 0))
    .orderBy(sql`${productsTable.createdAt} DESC`)
    .limit(49_000);

  const entries = products.map((p) => {
    const lastmod    = w3cDate(p.createdAt);
    const imageBlock = p.imageUrl
      ? `\n    <image:image>` +
        `\n      <image:loc>${escXml(p.imageUrl)}</image:loc>` +
        `\n      <image:title>${escXml(p.name)}</image:title>` +
        `\n    </image:image>`
      : "";
    return urlEntry(`${SITE}/products/${p.id}`, lastmod, "weekly", "0.75", imageBlock);
  });

  const buildMs = Date.now() - t0;
  const xml =
    xmlHeader(`Syano Product Sitemap | ${products.length} products | ${new Date().toISOString()} | ${buildMs}ms`) +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.join("\n") + "\n" +
    `</urlset>`;

  setCached("products", xml, products.length, buildMs);
  return xml;
}

/** sitemap-stores.xml — approved seller store pages */
export async function buildStoresXml(): Promise<string> {
  const cached = getCached("stores");
  if (cached) return cached;

  const t0 = Date.now();

  const stores = await db
    .select({
      storeSlug: sellerApplicationsTable.storeSlug,
      storeName: sellerApplicationsTable.storeName,
      updatedAt: sellerApplicationsTable.updatedAt,
    })
    .from(sellerApplicationsTable)
    .where(
      and(
        eq(sellerApplicationsTable.status, "approved"),
        isNotNull(sellerApplicationsTable.storeSlug),
      ),
    )
    .limit(10_000);

  const entries = stores
    .filter((s) => s.storeSlug)
    .map((s) =>
      urlEntry(
        `${SITE}/store/${s.storeSlug!}`,
        w3cDate(s.updatedAt),
        "weekly",
        "0.80",
      ),
    );

  const buildMs = Date.now() - t0;
  const xml =
    xmlHeader(`Syano Store Sitemap | ${entries.length} stores | ${new Date().toISOString()} | ${buildMs}ms`) +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") + "\n" +
    `</urlset>`;

  setCached("stores", xml, entries.length, buildMs);
  return xml;
}

/** sitemap.xml — sitemap index referencing all sub-sitemaps */
export async function buildIndexXml(): Promise<string> {
  const cached = getCached("index");
  if (cached) return cached;

  const today = new Date().toISOString().slice(0, 10);

  const sitemapEntry = (file: string): string =>
    `  <sitemap>\n    <loc>${SITE}/${file}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`;

  const xml =
    xmlHeader(`Syano Sitemap Index | Generated: ${new Date().toISOString()}`) +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [
      sitemapEntry("sitemap-pages.xml"),
      sitemapEntry("sitemap-categories.xml"),
      sitemapEntry("sitemap-products.xml"),
      sitemapEntry("sitemap-stores.xml"),
    ].join("\n") + "\n" +
    `</sitemapindex>`;

  setCached("index", xml, 4, 0);
  return xml;
}

// ─── Cache inspection ────────────────────────────────────────────────────────

export interface CacheStats {
  key: string;
  ttlSeconds: number;
  rowCount: number;
  buildMs: number;
  builtAt: string;
}

export function getCacheStats(): CacheStats[] {
  const now = Date.now();
  return [...cache.entries()].map(([key, entry]) => ({
    key,
    ttlSeconds: Math.max(0, Math.round((entry.expiresAt - now) / 1000)),
    rowCount:   entry.rowCount,
    buildMs:    entry.buildMs,
    builtAt:    new Date(entry.builtAt).toISOString(),
  }));
}

/** Flush the entire cache (useful for admin-triggered refresh) */
export function flushCache(): void {
  cache.clear();
}
