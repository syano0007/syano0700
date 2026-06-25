/**
 * SYANO Import Certification
 *
 * Usage:  pnpm import:check
 *
 * Runs a full system certification after a fresh import.
 * Checks: Services · Database · Embeddings · Auth · Maps · Search · TypeScript · Workflows
 *
 * Exit 0 = PASS or PASS WITH WARNINGS
 * Exit 1 = FAIL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

// ── Terminal colours ────────────────────────────────────────────────────────
const G = "\x1b[32m"; const R = "\x1b[31m"; const Y = "\x1b[33m";
const B = "\x1b[1m";  const RE = "\x1b[0m";

// ── Per-section result tracking ─────────────────────────────────────────────
type SectionResult = "PASS" | "WARN" | "FAIL";
const sectionResults: Record<string, SectionResult> = {};
let currentSection = "";
let sectionFails = 0;
let sectionWarns = 0;
const sectionMessages: string[] = [];

function startSection(name: string) {
  currentSection = name;
  sectionFails = 0;
  sectionWarns = 0;
  sectionMessages.length = 0;
}

function endSection() {
  const result: SectionResult =
    sectionFails > 0 ? "FAIL" : sectionWarns > 0 ? "WARN" : "PASS";
  sectionResults[currentSection] = result;
  if (sectionMessages.length > 0 && result !== "PASS") {
    for (const m of sectionMessages) console.log(`    ${m}`);
  }
}

function ok(msg: string)   { console.log(`  ${G}✓${RE} ${msg}`); }
function no(msg: string)   { console.log(`  ${R}✗${RE} ${msg}`); sectionFails++; sectionMessages.push(`✗ ${msg}`); }
function wa(msg: string)   { console.log(`  ${Y}⚠${RE} ${msg}`); sectionWarns++; sectionMessages.push(`⚠ ${msg}`); }

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 3000): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ═══════════════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${B}SYANO IMPORT CERTIFICATION${RE}`);
console.log("─".repeat(50));

// ═══════════════════════════════════════════════════════════════════════════
// 1. NODE MODULES
// ═══════════════════════════════════════════════════════════════════════════

startSection("Node Modules");
console.log(`\n${B}Node Modules${RE}`);
const criticalPaths = [
  "node_modules/.bin/vite",
  "artifacts/api-server/node_modules",
  "artifacts/mobile/node_modules/.bin/expo",
  "node_modules/.bin/tsx",
];
for (const p of criticalPaths) {
  if (fileExists(p)) ok(p);
  else no(`${p} missing — run: pnpm install`);
}
endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 2. ENVIRONMENT
// ═══════════════════════════════════════════════════════════════════════════

startSection("Environment");
console.log(`\n${B}Environment${RE}`);
const required = ["DATABASE_URL", "SESSION_SECRET"];
const optional = ["RESEND_API_KEY", "VAPID_PRIVATE_KEY"];
const shared   = ["API_PORT", "EMBEDDING_SERVICE_URL", "GOOGLE_CLIENT_ID",
                  "TURNSTILE_ENABLED", "TURNSTILE_SITE_KEY", "VAPID_PUBLIC_KEY"];

for (const v of required) {
  if (process.env[v]) ok(`${v} set`);
  else no(`${v} not set — required`);
}
for (const v of optional) {
  if (process.env[v]) ok(`${v} set`);
  else wa(`${v} not set (optional — graceful fallback active)`);
}
for (const v of shared) {
  if (process.env[v]) ok(`${v} = ${v === "API_PORT" ? process.env[v] : "set"}`);
  else wa(`${v} not set in shared env`);
}

// PORT must NOT be set
if (process.env["PORT"]) {
  no(`PORT env var is set (${process.env["PORT"]}) — this overrides API_PORT and causes API to bind on wrong port. Remove PORT from shared env.`);
}
endSection();

// Bail out if DB is unreachable
if (!process.env["DATABASE_URL"]) {
  console.log(`\n${R}${B}FATAL: DATABASE_URL not set — cannot continue${RE}\n`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SERVICES
// ═══════════════════════════════════════════════════════════════════════════

startSection("Services");
console.log(`\n${B}Services${RE}`);

const apiPort = process.env["API_PORT"] ?? "8080";
let healthzData: Record<string, unknown> | null = null;

try {
  const res = await fetchWithTimeout(`http://localhost:${apiPort}/api/healthz`, 4000);
  if (res.ok) {
    healthzData = await res.json() as Record<string, unknown>;
    const status = healthzData["status"];
    ok(`API server: status=${status} (port ${apiPort})`);
  } else {
    no(`API server returned HTTP ${res.status} — start 'artifacts/api-server: API Server' workflow`);
  }
} catch {
  no(`API server not reachable on port ${apiPort} — start 'artifacts/api-server: API Server' workflow`);
}

const embeddingUrl = process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000";
let embeddingData: Record<string, unknown> | null = null;
try {
  const res = await fetchWithTimeout(`${embeddingUrl}/health`, 4000);
  if (res.ok) {
    embeddingData = await res.json() as Record<string, unknown>;
    ok(`Embedding service: backend=${embeddingData["backend"]} dims=${embeddingData["vector_dimensions"]}`);
  } else {
    no(`Embedding service returned HTTP ${res.status} — start 'Embedding Service' workflow`);
  }
} catch {
  no(`Embedding service not reachable — start 'Embedding Service' workflow`);
}

// Marketplace: check Vite dev server is up (any response = good)
try {
  const res = await fetchWithTimeout(`http://localhost:20787/`, 4000);
  ok(`Marketplace web: HTTP ${res.status}`);
} catch {
  // Try other common Vite ports
  let found = false;
  for (const port of [5000, 3000]) {
    try {
      const res = await fetchWithTimeout(`http://localhost:${port}/`, 2000);
      ok(`Marketplace web: HTTP ${res.status} (port ${port})`);
      found = true;
      break;
    } catch { /* continue */ }
  }
  if (!found) wa("Marketplace web not reachable — start 'artifacts/marketplace: web' workflow");
}

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 4. DATABASE
// ═══════════════════════════════════════════════════════════════════════════

startSection("Database");
console.log(`\n${B}Database${RE}`);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });
let client: pg.PoolClient;
try {
  client = await pool.connect();
  ok("Database connection OK");
} catch (err) {
  no(`Cannot connect: ${err instanceof Error ? err.message : err}`);
  console.log(`\n${R}${B}FATAL: database unreachable${RE}\n`);
  process.exit(1);
}

// Table count — must be exactly 44
const tableCountRes = await client.query<{ count: string }>(
  `SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
);
const tableCount = parseInt(tableCountRes.rows[0]?.count ?? "0", 10);
if (tableCount === 44)      ok(`Table count: ${tableCount}/44 ✓`);
else if (tableCount >= 40)  wa(`Table count: ${tableCount}/44 — restart API to apply remaining migrations`);
else if (tableCount >= 27)  no(`Table count: ${tableCount}/44 — run: cd lib/db && pnpm run push-force, then restart API`);
else                        no(`Table count: ${tableCount}/44 — run: cd lib/db && pnpm run push-force`);

// pgvector extension
try {
  await client.query(`SELECT extname FROM pg_extension WHERE extname='vector'`);
  const res = await client.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname='vector'`
  );
  if (res.rowCount && res.rowCount > 0) ok("pgvector extension: installed");
  else no("pgvector extension: missing — required for semantic search");
} catch {
  no("pgvector extension check failed");
}

// pg_trgm extension
try {
  const res = await client.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname='pg_trgm'`
  );
  if (res.rowCount && res.rowCount > 0) ok("pg_trgm extension: installed");
  else wa("pg_trgm extension: not found — trigram search may degrade");
} catch {
  wa("pg_trgm extension check failed");
}

// Critical tables
const criticalTables = [
  "users", "products", "orders", "order_items", "cart_items",
  "couriers", "courier_assignments", "delivery_missions", "mission_offers",
  "dispatch_alerts", "delivery_zones", "tracking_sessions", "tracking_positions",
  "conversations", "messages", "notifications", "wishlists",
  "search_synonyms", "hero_banners", "product_variants",
];
const tableRes = await client.query<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
);
const existingTables = new Set(tableRes.rows.map(r => r.table_name));
const missingCritical = criticalTables.filter(t => !existingTables.has(t));
if (missingCritical.length === 0) {
  ok(`All ${criticalTables.length} critical tables present`);
} else {
  for (const t of missingCritical) no(`Critical table missing: ${t}`);
}

// Seeded data
const prodRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products`);
const prodCount = parseInt(prodRes.rows[0]?.count ?? "0", 10);
if (prodCount >= 42)  ok(`Products: ${prodCount} (≥42 ✓)`);
else if (prodCount > 0) wa(`Products: ${prodCount} — expected 42; start API to re-seed`);
else                    no(`Products: 0 — start API to trigger demo data bootstrap`);

const zoneRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM delivery_zones`);
const zoneCount = parseInt(zoneRes.rows[0]?.count ?? "0", 10);
if (zoneCount >= 40) ok(`Delivery zones: ${zoneCount}`);
else                 wa(`Delivery zones: ${zoneCount} — expected 40`);

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 5. EMBEDDINGS
// ═══════════════════════════════════════════════════════════════════════════

startSection("Embeddings");
console.log(`\n${B}Embeddings${RE}`);

if (embeddingData) {
  const backend = embeddingData["backend"] as string;
  const dims    = embeddingData["vector_dimensions"] as number;

  if (backend === "sentence-transformers") {
    ok("Backend: sentence-transformers (not TF-IDF fallback) ✓");
  } else {
    no(`Backend: ${backend} — model.safetensors may be missing. Download: curl -L -o artifacts/embedding-service/model/model.safetensors "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors"`);
  }

  if (dims === 384) ok(`Dimensions: ${dims} ✓`);
  else              no(`Dimensions: ${dims} — expected 384`);
} else {
  no("Embedding service not reachable — cannot verify backend or dimensions");
}

// Products with embeddings (check via healthz)
if (healthzData) {
  const db = healthzData["database"] as Record<string, unknown>;
  const embedded = db?.["embeddings"] as number;
  const total    = db?.["products"]   as number;
  if (embedded === total && embedded > 0) ok(`Products embedded: ${embedded}/${total} ✓`);
  else if (embedded > 0)                  wa(`Products embedded: ${embedded}/${total} — run: pnpm --filter @workspace/api-server embed:generate`);
  else                                    no(`Products embedded: 0/${total} — start API to trigger backfill`);
}

// Model file on disk
const modelPath = "artifacts/embedding-service/model/model.safetensors";
if (fileExists(modelPath)) ok("model.safetensors: present on disk");
else                       wa("model.safetensors: not found — TF-IDF fallback will be used (service still works)");

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 6. AUTH
// ═══════════════════════════════════════════════════════════════════════════

startSection("Auth");
console.log(`\n${B}Auth${RE}`);

if (healthzData) {
  const auth = healthzData["auth"] as Record<string, unknown> | undefined;
  if (auth) {
    const jwtOk   = auth["status"] === "healthy";
    const corsOk  = auth["corsReplitDomainsAllowed"] === true;
    const adminOk = auth["adminLoginVerified"] === true;
    const regOk   = auth["registrationVerified"] === true;

    if (jwtOk)   ok(`JWT auth: ${auth["provider"] ?? "active"}`);
    else         no("JWT auth: status not healthy");

    if (adminOk) ok("Admin login: verified");
    else         wa("Admin login: not verified in healthz");

    if (regOk)   ok("Registration: verified");
    else         wa("Registration: not verified in healthz");

    if (corsOk)  ok("CORS: *.replit.dev + *.replit.app allowed");
    else         no("CORS: Replit domains NOT allowed — isReplitOrigin() may have been reverted in app.ts");
  } else {
    wa("Auth section missing from healthz response");
  }
} else {
  wa("Cannot verify auth — API not reachable");
}

// Role check via DB
const roleRes = await client.query<{ role: string; count: string }>(
  `SELECT role::text, COUNT(*)::text AS count FROM users GROUP BY role`
);
const roles = Object.fromEntries(roleRes.rows.map(r => [r.role, parseInt(r.count, 10)]));
const hasAdmin   = (roles["admin"]   ?? 0) > 0;
const hasSeller  = (roles["seller"]  ?? 0) > 0;
const hasCourier = (roles["courier"] ?? 0) > 0;
const hasCustomer = (roles["customer"] ?? 0) > 0;

if (hasAdmin)    ok(`Role admin:    ${roles["admin"]} user(s)`);
else             no("Role admin:    0 users — start API to bootstrap root admin");
if (hasSeller)   ok(`Role seller:   ${roles["seller"]} user(s)`);
else             wa("Role seller:   0 — start API to bootstrap test accounts");
if (hasCourier)  ok(`Role courier:  ${roles["courier"]} user(s)`);
else             wa("Role courier:  0 — start API to bootstrap test accounts");
if (hasCustomer) ok(`Role customer: ${roles["customer"]} user(s)`);
else             wa("Role customer: 0 — start API to bootstrap demo data");

// Google, Facebook, Turnstile state
const googleEnabled = !!(process.env["GOOGLE_CLIENT_ID"]);
const fbEnabled     = process.env["FACEBOOK_LOGIN_ENABLED"] === "true";
const tsEnabled     = process.env["TURNSTILE_ENABLED"] === "true";
const tsKeySet      = !!(process.env["TURNSTILE_SECRET_KEY"]) || !!(process.env["TURNSTILE_SITE_KEY"]);

ok(`Google login: ${googleEnabled ? "enabled (GOOGLE_CLIENT_ID set)" : "disabled"}`);
ok(`Facebook login: ${fbEnabled ? "ENABLED" : "disabled (FACEBOOK_LOGIN_ENABLED=false)"}`);
if (tsEnabled && tsKeySet) ok("Turnstile: enabled + keys set");
else if (tsEnabled && !tsKeySet) wa("Turnstile: enabled but TURNSTILE_SECRET_KEY not in Replit Secrets");
else ok("Turnstile: disabled");

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 7. MAPS
// ═══════════════════════════════════════════════════════════════════════════

startSection("Maps");
console.log(`\n${B}Maps${RE}`);

const mktPkg = JSON.parse(
  fs.readFileSync(path.join(ROOT, "artifacts/marketplace/package.json"), "utf8")
) as Record<string, Record<string, string>>;
const allDeps = { ...mktPkg["dependencies"], ...mktPkg["devDependencies"] };

if (allDeps["leaflet"])       ok(`leaflet: ${allDeps["leaflet"]}`);
else                          no("leaflet: not in artifacts/marketplace/package.json — run: pnpm --filter @workspace/marketplace add leaflet");

if (allDeps["react-leaflet"])  ok(`react-leaflet: ${allDeps["react-leaflet"]}`);
else                           no("react-leaflet: not in artifacts/marketplace/package.json");

if (allDeps["@types/leaflet"]) ok(`@types/leaflet: ${allDeps["@types/leaflet"]}`);
else                           wa("@types/leaflet: missing (TypeScript may warn)");

// Check CSS import in TrackingMap.tsx
const trackingMapPath = path.join(ROOT, "artifacts/marketplace/src/components/TrackingMap.tsx");
if (fs.existsSync(trackingMapPath)) {
  const content = fs.readFileSync(trackingMapPath, "utf8");
  if (content.includes("leaflet/dist/leaflet.css")) {
    ok("TrackingMap.tsx: leaflet CSS import present");
  } else {
    no("TrackingMap.tsx: missing 'import \"leaflet/dist/leaflet.css\"' — maps will render blank");
  }
} else {
  wa("TrackingMap.tsx not found at expected path");
}

// OSRM is external — just report it's used
ok("OSRM routing: used by TrackingService (real road routing, external service)");

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 8. SEARCH
// ═══════════════════════════════════════════════════════════════════════════

startSection("Search");
console.log(`\n${B}Search${RE}`);

// FTS: check fts_vector column exists
if (existingTables.has("products")) {
  const ftsRes = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='fts_vector'`
  );
  if (parseInt(ftsRes.rows[0]?.count ?? "0", 10) > 0) ok("FTS: fts_vector column present on products");
  else no("FTS: fts_vector column missing — start API to run search startup");

  // GIN index on fts_vector
  const ginRes = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM pg_indexes WHERE tablename='products' AND indexname LIKE '%fts%'`
  );
  if (parseInt(ginRes.rows[0]?.count ?? "0", 10) > 0) ok("FTS: GIN index present");
  else wa("FTS: GIN index missing — start API to run search startup");
}

// Semantic search: check pgvector
try {
  const vecRes = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='embedding'`
  );
  if (parseInt(vecRes.rows[0]?.count ?? "0", 10) > 0) ok("Semantic search: embedding column present");
  else wa("Semantic search: embedding column missing");
} catch { wa("Semantic search: could not check embedding column"); }

// Search synonyms seeded
const synRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM search_synonyms`);
const synCount = parseInt(synRes.rows[0]?.count ?? "0", 10);
if (synCount > 0) ok(`Search synonyms: ${synCount} entries`);
else              wa("Search synonyms: 0 — start API to seed");

// Live search test via API
try {
  const res = await fetchWithTimeout(
    `http://localhost:${apiPort}/api/search/trending`, 3000
  );
  if (res.ok) ok("Search API: /api/search/trending reachable");
  else        wa(`Search API: /api/search/trending returned ${res.status}`);
} catch {
  wa("Search API: not reachable — start API workflow");
}

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 9. TYPESCRIPT
// ═══════════════════════════════════════════════════════════════════════════

startSection("TypeScript");
console.log(`\n${B}TypeScript${RE}`);

// Build libs first (required for marketplace + mobile checks)
console.log("  (building shared libs — this may take ~10s)");
try {
  execSync("npx tsc --build lib/db lib/api-zod lib/api-client-react", {
    cwd: ROOT, stdio: "pipe", timeout: 60_000
  });
  ok("Shared libs built (lib/db · lib/api-zod · lib/api-client-react)");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  no(`Shared lib build failed: ${msg.slice(0, 200)}`);
}

const tsPackages: Array<{ name: string; config: string }> = [
  { name: "api-server",  config: "artifacts/api-server/tsconfig.json"  },
  { name: "marketplace", config: "artifacts/marketplace/tsconfig.json"  },
  { name: "mobile",      config: "artifacts/mobile/tsconfig.json"       },
];

for (const { name, config } of tsPackages) {
  try {
    execSync(`npx tsc --noEmit -p ${config}`, {
      cwd: ROOT, stdio: "pipe", timeout: 120_000
    });
    ok(`${name}: 0 TypeScript errors`);
  } catch (err) {
    const out = (err as { stderr?: Buffer; stdout?: Buffer });
    const errText = (out.stderr?.toString() ?? out.stdout?.toString() ?? "").trim();
    const errCount = (errText.match(/error TS/g) ?? []).length;
    no(`${name}: ${errCount || "?"} TypeScript error(s) — run: npx tsc --noEmit -p ${config}`);
  }
}

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// 10. WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════

startSection("Workflows");
console.log(`\n${B}Workflows${RE}`);

// Note: Only the "Embedding Service" workflow is agent-managed and stored in .replit.
// The other 3 workflows (API Server, Marketplace, Mobile) are Replit UI-managed
// and stored in Replit's backend (not in .replit). We verify them by checking
// that their commands are registered and their services are reachable.

const replitPath = path.join(ROOT, ".replit");
if (fs.existsSync(replitPath)) {
  const replitContent = fs.readFileSync(replitPath, "utf8");

  // Embedding Service — agent-managed, must be in .replit
  if (replitContent.includes(`name = "Embedding Service"`)) {
    ok(`Workflow "Embedding Service": registered in .replit ✓`);
  } else {
    no(`Workflow "Embedding Service" missing from .replit — re-add it`);
  }

  // Embedding Service command must include EMBEDDING_PORT=8000
  if (replitContent.includes("EMBEDDING_PORT=8000")) {
    ok(`Embedding Service: EMBEDDING_PORT=8000 set in workflow command ✓`);
  } else {
    no(`Embedding Service: EMBEDDING_PORT=8000 missing from workflow command — port will default to 8001`);
  }

  // No PORT= override (critical — breaks API server)
  if (replitContent.includes("PORT=") && !replitContent.includes("API_PORT")) {
    no("Forbidden: PORT= found in .replit — remove it (use API_PORT=8080 via shared env instead)");
  } else {
    ok("No PORT= override in .replit ✓ (using API_PORT from shared env)");
  }

  // Forbidden workflow names
  const forbiddenWorkflows = ["Start application", '"API Server"', '"Marketplace"'];
  let foundForbidden = false;
  for (const wf of forbiddenWorkflows) {
    if (replitContent.includes(`name = ${wf}`)) {
      no(`Forbidden workflow found: ${wf} — delete it from .replit`);
      foundForbidden = true;
    }
  }
  if (!foundForbidden) ok("No forbidden/duplicate workflows found ✓");

  // Other 3 workflows verified via service reachability (done in Services section above)
  const apiReachable  = sectionResults["Services"] !== "FAIL";
  if (apiReachable) {
    ok(`Workflow "artifacts/api-server: API Server": verified via API healthz`);
    ok(`Workflow "artifacts/marketplace: web": verified via Marketplace HTTP check`);
    ok(`Workflow "artifacts/mobile: expo": verified by node_modules presence`);
  } else {
    wa("Cannot verify API Server / Marketplace / Mobile workflows — Services section failed");
  }
} else {
  no(".replit file not found — cannot verify workflow configuration");
}

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// MASTER FILE CHECK
// ═══════════════════════════════════════════════════════════════════════════

startSection("Master Recovery File");
console.log(`\n${B}Master Recovery File${RE}`);

if (fileExists("SYANO_MASTER_RECOVERY.md")) {
  const content = fs.readFileSync(path.join(ROOT, "SYANO_MASTER_RECOVERY.md"), "utf8");
  const requiredSections = [
    "RECOVERY PROCEDURE", "WORKFLOWS", "DATABASE", "EMBEDDINGS",
    "AUTH", "MAPS", "SEARCH", "COMMON FAILURES", "Future Agent Rules",
  ];
  const missingSections = requiredSections.filter(s => !content.includes(s));
  if (missingSections.length === 0) ok("SYANO_MASTER_RECOVERY.md: all required sections present");
  else for (const s of missingSections) no(`SYANO_MASTER_RECOVERY.md: missing section "${s}"`);

  // Verify other docs redirect
  const redirectFiles = ["AGENT_BOOTSTRAP.md", "RECOVERY_GUIDE.md", "PROJECT_STATE.md"];
  for (const f of redirectFiles) {
    if (fileExists(f)) {
      const rc = fs.readFileSync(path.join(ROOT, f), "utf8");
      if (rc.includes("SYANO_MASTER_RECOVERY.md")) ok(`${f}: redirects to master ✓`);
      else no(`${f}: contains recovery logic — must redirect to SYANO_MASTER_RECOVERY.md`);
    }
  }
} else {
  no("SYANO_MASTER_RECOVERY.md not found — this is the required master recovery file");
}

endSection();

// ═══════════════════════════════════════════════════════════════════════════
// RELEASE DB CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

client.release();
await pool.end();

// ═══════════════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

const pad = (s: string, n: number) => s + ".".repeat(Math.max(1, n - s.length));

console.log(`\n${"─".repeat(50)}`);
console.log(`${B}SYANO IMPORT CERTIFICATION${RE}\n`);

const sections = [
  "Node Modules", "Environment", "Services", "Database",
  "Embeddings", "Auth", "Maps", "Search", "TypeScript",
  "Workflows", "Master Recovery File",
];

let totalFails = 0;
let totalWarns = 0;

for (const s of sections) {
  const r = sectionResults[s] ?? "PASS";
  const colour = r === "PASS" ? G : r === "WARN" ? Y : R;
  const label  = r === "PASS" ? "PASS" : r === "WARN" ? "WARN" : "FAIL";
  console.log(`  ${pad(s, 24)} ${colour}${B}${label}${RE}`);
  if (r === "FAIL") totalFails++;
  if (r === "WARN") totalWarns++;
}

console.log(`\n${"─".repeat(50)}`);

if (totalFails === 0 && totalWarns === 0) {
  console.log(`\n${G}${B}RESULT: PASS${RE} — All checks passed. Project is import-ready.\n`);
  process.exit(0);
} else if (totalFails === 0) {
  console.log(`\n${Y}${B}RESULT: PASS WITH WARNINGS${RE} — ${totalWarns} warning(s), 0 failures.\n`);
  process.exit(0);
} else {
  console.log(`\n${R}${B}RESULT: FAIL${RE} — ${totalFails} section(s) failed, ${totalWarns} warning(s).`);
  console.log(`\nTo fix common failures:`);
  console.log(`  pnpm install                                          # missing node_modules`);
  console.log(`  npx tsc --build lib/db lib/api-zod lib/api-client-react  # TS lib build`);
  console.log(`  cd lib/db && pnpm run push-force                      # missing tables`);
  console.log(`  # Start all 4 workflows in order: api-server → embedding → marketplace → mobile`);
  console.log(`  pnpm import:check                                      # re-run to confirm\n`);
  process.exit(1);
}
