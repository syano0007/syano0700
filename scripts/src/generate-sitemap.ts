/**
 * Syano Marketplace — Sitemap Index Generator
 *
 * Generates all five sitemap files into artifacts/marketplace/public/:
 *
 *   sitemap.xml              → sitemap index (submit this to Google Search Console)
 *   sitemap-pages.xml        → static / informational pages
 *   sitemap-categories.xml   → product category browse pages
 *   sitemap-products.xml     → all in-stock product pages (up to 49k, with image metadata)
 *   sitemap-stores.xml       → approved seller store pages
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run sitemap:generate
 *
 * Runs automatically before every production build via the marketplace
 * package.json "prebuild" hook.
 *
 * Limits:
 *   Google supports ≤50,000 URLs per sitemap and ≤50 MB uncompressed.
 *   Products are capped at 49,000. If the catalogue grows beyond that,
 *   paginate sitemap-products.xml into sitemap-products-1.xml, sitemap-products-2.xml, etc.
 *   and add extra <sitemap> entries to sitemap.xml.
 */

import { db, productsTable, sellerApplicationsTable } from "@workspace/db";
import { gt, eq, and, isNotNull, sql } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE       = (process.env.SITE_URL ?? "https://syano.online").replace(/\/+$/, "");
const PUBLIC_DIR = resolve(__dirname, "../../artifacts/marketplace/public");
const TODAY      = new Date().toISOString().slice(0, 10);
const TS         = new Date().toISOString();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escXml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

function w3cDate(d: Date | string | null | undefined): string {
  if (!d) return TODAY;
  try { return new Date(d).toISOString().slice(0, 10); }
  catch { return TODAY; }
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

function write(filename: string, xml: string): void {
  const dest = resolve(PUBLIC_DIR, filename);
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(dest, xml, "utf-8");
  const kb = (Buffer.byteLength(xml, "utf-8") / 1024).toFixed(1);
  console.log(`  ✓ ${filename.padEnd(32)} ${kb} KB`);
}

// ─── Static pages ─────────────────────────────────────────────────────────────

interface StaticPage {
  path: string;
  priority: string;
  changefreq: string;
  hreflang?: boolean;
}

const STATIC_PAGES: StaticPage[] = [
  { path: "/",                    priority: "1.0",  changefreq: "daily",   hreflang: true },
  { path: "/products",            priority: "0.95", changefreq: "hourly"  },
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

// ─── Sub-sitemap generators ───────────────────────────────────────────────────

function buildPagesXml(): string {
  const entries = STATIC_PAGES.map((p) => {
    const hreflangBlock = p.hreflang
      ? `\n    <xhtml:link rel="alternate" hreflang="en"        href="${SITE}${p.path}" />` +
        `\n    <xhtml:link rel="alternate" hreflang="ar"        href="${SITE}${p.path}" />` +
        `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${p.path}" />`
      : "";
    return urlEntry(`${SITE}${p.path}`, TODAY, p.changefreq, p.priority, hreflangBlock);
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Syano Pages Sitemap | ${STATIC_PAGES.length} pages | Generated: ${TS} -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    entries.join("\n") + "\n" +
    `</urlset>\n`
  );
}

function buildCategoriesXml(categories: string[]): string {
  const entries = categories.map((cat) =>
    urlEntry(
      `${SITE}/products?category=${encodeURIComponent(cat)}`,
      TODAY, "daily", "0.85",
    ),
  );

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Syano Category Sitemap | ${categories.length} categories | Generated: ${TS} -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") + "\n" +
    `</urlset>\n`
  );
}

interface ProductRow {
  id: number;
  name: string;
  imageUrl: string | null;
  createdAt: Date;
}

function buildProductsXml(products: ProductRow[]): string {
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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Syano Product Sitemap | ${products.length} products | Generated: ${TS} -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    entries.join("\n") + "\n" +
    `</urlset>\n`
  );
}

interface StoreRow {
  storeSlug: string | null;
  updatedAt: Date;
}

function buildStoresXml(stores: StoreRow[]): string {
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

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Syano Store Sitemap | ${entries.length} stores | Generated: ${TS} -->\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") + "\n" +
    `</urlset>\n`
  );
}

function buildIndexXml(): string {
  const sitemapEntry = (file: string): string =>
    `  <sitemap>\n    <loc>${SITE}/${file}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- Syano Sitemap Index | Generated: ${TS} | Submit this URL to Google Search Console -->\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [
      sitemapEntry("sitemap-pages.xml"),
      sitemapEntry("sitemap-categories.xml"),
      sitemapEntry("sitemap-products.xml"),
      sitemapEntry("sitemap-stores.xml"),
    ].join("\n") + "\n" +
    `</sitemapindex>\n`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function generate(): Promise<void> {
  console.log(`\n🗺  Generating sitemap index architecture for ${SITE}`);
  console.log(`   Output → ${PUBLIC_DIR}/\n`);

  // ── Parallel DB queries ──────────────────────────────────────────────────

  const [products, catRows, stores] = await Promise.all([
    db
      .select({
        id:        productsTable.id,
        name:      productsTable.name,
        imageUrl:  productsTable.imageUrl,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .where(gt(productsTable.stock, 0))
      .orderBy(sql`${productsTable.createdAt} DESC`)
      .limit(49_000),

    db
      .selectDistinct({ category: productsTable.category })
      .from(productsTable)
      .where(gt(productsTable.stock, 0)),

    db
      .select({
        storeSlug: sellerApplicationsTable.storeSlug,
        updatedAt: sellerApplicationsTable.updatedAt,
      })
      .from(sellerApplicationsTable)
      .where(
        and(
          eq(sellerApplicationsTable.status, "approved"),
          isNotNull(sellerApplicationsTable.storeSlug),
        ),
      )
      .limit(10_000),
  ]);

  const categories = catRows.map((r) => r.category).filter(Boolean).sort() as string[];

  // ── Write all files ───────────────────────────────────────────────────────

  write("sitemap-pages.xml",      buildPagesXml());
  write("sitemap-categories.xml", buildCategoriesXml(categories));
  write("sitemap-products.xml",   buildProductsXml(products));
  write("sitemap-stores.xml",     buildStoresXml(stores));
  write("sitemap.xml",            buildIndexXml());   // write index last

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalUrls = STATIC_PAGES.length + categories.length + products.length + stores.filter((s) => s.storeSlug).length;

  console.log(`\n✓ All sitemaps written`);
  console.log(`  • sitemap-pages.xml       ${STATIC_PAGES.length} pages`);
  console.log(`  • sitemap-categories.xml  ${categories.length} categories`);
  console.log(`  • sitemap-products.xml    ${products.length} products`);
  console.log(`  • sitemap-stores.xml      ${stores.filter((s) => s.storeSlug).length} stores`);
  console.log(`  ────────────────────────────────`);
  console.log(`  • sitemap.xml             index → 4 sub-sitemaps`);
  console.log(`  • Total indexable URLs:   ${totalUrls}\n`);
}

// ─── Fallback (DB unavailable at build time) ─────────────────────────────────

function writeFallback(): void {
  console.warn("   Writing static fallback sitemaps (static pages only)...");
  try {
    write("sitemap-pages.xml",      buildPagesXml());
    write("sitemap-categories.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`);
    write("sitemap-products.xml",   `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"></urlset>\n`);
    write("sitemap-stores.xml",     `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`);
    write("sitemap.xml",            buildIndexXml());
    console.log("✓ Fallback sitemaps written");
  } catch (e) {
    console.error("✗ Could not write fallback sitemaps:", e);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

generate()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.warn(`\n⚠  Sitemap generation failed: ${err.message}`);
    writeFallback();
    process.exit(0); // Never fail the build — a missing sitemap is not critical.
  });
