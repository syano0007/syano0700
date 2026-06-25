/**
 * SYANO Recovery Report Generator
 *
 * Usage: pnpm recovery:report
 *
 * Generates RECOVERY_REPORT.md from live project state — no hardcoded values.
 * All counts come from the database at runtime.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env["DATABASE_URL"]! });

console.log("Connecting to database...");
const client = await pool.connect();
console.log("Connected. Gathering live state...");

// ── Gather live data ─────────────────────────────────────────────────────────

const tableRes = await client.query<{ count: string }>(
  `SELECT COUNT(*)::text AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
);
const tableCount = parseInt(tableRes.rows[0]?.count ?? "0", 10);

const tableListRes = await client.query<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
);
const tableList = tableListRes.rows.map(r => r.table_name);

const productRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM products`);
const productCount = parseInt(productRes.rows[0]?.count ?? "0", 10);

const embRes = await client.query<{ count: string }>(
  `SELECT COUNT(*)::text AS count FROM products WHERE embedding IS NOT NULL`
);
const embCount = parseInt(embRes.rows[0]?.count ?? "0", 10);

const userRes = await client.query<{ role: string; count: string }>(
  `SELECT role, COUNT(*)::text AS count FROM users GROUP BY role ORDER BY role`
);
const usersByRole = Object.fromEntries(userRes.rows.map(r => [r.role, parseInt(r.count, 10)]));

const orderRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM orders`);
const orderCount = parseInt(orderRes.rows[0]?.count ?? "0", 10);

const zoneRes = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM delivery_zones`);
const zoneCount = parseInt(zoneRes.rows[0]?.count ?? "0", 10);

const notifEnumRes = await client.query<{ count: string }>(
  `SELECT COUNT(*)::text AS count FROM unnest(enum_range(NULL::notification_type))`
);
const notifEnumCount = parseInt(notifEnumRes.rows[0]?.count ?? "0", 10);

const orderStatusEnumRes = await client.query<{ count: string }>(
  `SELECT COUNT(*)::text AS count FROM unnest(enum_range(NULL::order_status))`
);
const orderStatusEnumCount = parseInt(orderStatusEnumRes.rows[0]?.count ?? "0", 10);

// Mission offers / dispatch alerts
let missionCount = 0;
let offerCount = 0;
let alertCount = 0;
try {
  const mr = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM delivery_missions`);
  missionCount = parseInt(mr.rows[0]?.count ?? "0", 10);
  const or2 = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM mission_offers`);
  offerCount = parseInt(or2.rows[0]?.count ?? "0", 10);
  const ar = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM dispatch_alerts`);
  alertCount = parseInt(ar.rows[0]?.count ?? "0", 10);
} catch { /* tables may be empty */ }

// Check API
let apiStatus = "NOT CHECKED";
try {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 2000);
  const apiRes = await fetch("http://localhost:8080/api/healthz", { signal: ctrl.signal });
  clearTimeout(tid);
  apiStatus = apiRes.ok ? "OK" : `HTTP ${apiRes.status}`;
} catch {
  apiStatus = "NOT RUNNING";
}

// Check embedding service
let embServiceStatus = "NOT CHECKED";
const embeddingUrl = process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000";
try {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 2000);
  const eRes = await fetch(`${embeddingUrl}/health`, { signal: ctrl.signal });
  clearTimeout(tid);
  if (eRes.ok) {
    const body = await eRes.json() as Record<string, unknown>;
    embServiceStatus = `OK (${body["backend"] ?? "unknown"})`;
  } else {
    embServiceStatus = `HTTP ${eRes.status}`;
  }
} catch {
  embServiceStatus = "NOT RUNNING (TF-IDF fallback)";
}

client.release();
await pool.end();

// ── Build report ─────────────────────────────────────────────────────────────

const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

const missingSections: string[] = [];
const requiredTables = [
  "users", "products", "orders", "cart_items", "order_items",
  "couriers", "delivery_zones", "delivery_missions", "mission_offers", "dispatch_alerts",
];
for (const t of requiredTables) {
  if (!tableList.includes(t)) missingSections.push(t);
}

const overallStatus = missingSections.length === 0 && tableCount >= 27 ? "✅ HEALTHY" : "⚠️ DEGRADED";

const report = `# SYANO Recovery Report
Generated: ${now}
Status: ${overallStatus}

---

## Database

| Metric | Value |
|--------|-------|
| Tables | ${tableCount} |
| Products | ${productCount} |
| Products with embeddings | ${embCount} |
| Orders | ${orderCount} |
| Delivery Zones | ${zoneCount} |
| Delivery Missions | ${missionCount} |
| Mission Offers | ${offerCount} |
| Dispatch Alerts | ${alertCount} |
| notification_type enum values | ${notifEnumCount} |
| order_status enum values | ${orderStatusEnumCount} |

### Users by Role

${Object.entries(usersByRole).map(([role, count]) => `- **${role}**: ${count}`).join("\n") || "- (no users)"}

### Tables Present (${tableList.length})

${tableList.map(t => `- \`${t}\``).join("\n")}

${missingSections.length > 0 ? `### ⚠️ Missing Tables\n\n${missingSections.map(t => `- \`${t}\``).join("\n")}` : "### ✅ No Missing Required Tables"}

---

## Services

| Service | Status |
|---------|--------|
| API Server (port 8080) | ${apiStatus} |
| Embedding Service (port 8000) | ${embServiceStatus} |

---

## Recovery Steps (if needed)

If any tables are missing or services are not running:

\`\`\`bash
# 1. Install dependencies
pnpm install

# 2. Push database schema
pnpm --filter @workspace/db run push

# 3. Start services (in Replit — use workflow restart, not shell)
#    - API Server workflow (runs migrations + seed automatically)
#    - Embedding Service workflow
#    - Marketplace workflow

# 4. Re-run this report
pnpm recovery:report

# 5. Full certification check
pnpm import:check
\`\`\`

---

## Environment Variables

| Variable | Status |
|----------|--------|
| DATABASE_URL | ${process.env["DATABASE_URL"] ? "✅ Set" : "❌ Missing"} |
| SESSION_SECRET | ${process.env["SESSION_SECRET"] ? "✅ Set" : "❌ Missing"} |
| EMBEDDING_SERVICE_URL | ${process.env["EMBEDDING_SERVICE_URL"] ? "✅ Set" : "⚠️ Not set (defaults to localhost:8000)"} |
| RESEND_API_KEY | ${process.env["RESEND_API_KEY"] ? "✅ Set" : "⚠️ Not set (email disabled)"} |
| VAPID_PUBLIC_KEY | ${process.env["VAPID_PUBLIC_KEY"] ? "✅ Set" : "⚠️ Not set (push notifications disabled)"} |

---

*Auto-generated by \`pnpm recovery:report\` — do not edit manually.*
`;

const outputPath = path.join(ROOT, "RECOVERY_REPORT.md");
fs.writeFileSync(outputPath, report, "utf-8");
console.log(`\n✓ RECOVERY_REPORT.md written to ${outputPath}`);
console.log(`  Status: ${overallStatus}`);
console.log(`  Tables: ${tableCount} | Products: ${productCount} | Embeddings: ${embCount}/${productCount}`);
