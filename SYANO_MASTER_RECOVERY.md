# SYANO — Master Recovery Document
### سوق سوريا — Syrian Digital Marketplace

**Certified:** 2026-06-22 · **Status:** ✅ FULLY OPERATIONAL  
**Health:** `status=ok · tables=44 · products=42 · embeddings=42 · backend=sentence-transformers`

> This is the **only** file a future agent needs to fully recover SYANO.  
> No other file contains recovery logic. Read this first. Read nothing else first.

**One-command verification:**
```bash
curl -s http://localhost:8080/api/healthz | python3 -m json.tool
# Healthy: status=ok, tables=44, products=42, embeddings=42, embeddingBackend=sentence-transformers
```

---

## PROJECT IDENTITY

**SYANO (سيانو / سوق سوريا)** is a production-grade multi-vendor digital marketplace serving Aleppo and surrounding Syrian cities.

**User roles:** Customer · Seller · Courier · Admin (Root Owner)

**Stack:**
| Layer | Technology |
|---|---|
| Web frontend | React 19 + Vite 7 + Tailwind v4 + Wouter + TanStack Query |
| API backend | Express 5 + Drizzle ORM + PostgreSQL 16 + Zod + Pino |
| Mobile | Expo 54 + expo-router (~95% web parity, 55 screens) |
| Embeddings | FastAPI + sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`, 384-dim) |
| Search | 13-step NLP pipeline (Arabic + English), FTS + pgvector RRF blend, LRU 500-entry cache |
| Maps | Leaflet + react-leaflet + OSRM real road routing + OpenStreetMap tiles |
| Monorepo | pnpm workspaces |

**Monorepo structure:**
```
artifacts/api-server/      Express API (30 route files, auto-migrations on boot)
artifacts/marketplace/     Vite React web app
artifacts/mobile/          Expo mobile app
artifacts/embedding-service/  FastAPI Python embedding service
lib/db/                    Drizzle schema + PostgreSQL client (44 tables)
lib/api-zod/               Shared Zod schemas + TypeScript types
lib/api-client-react/      Shared React hooks
```

---

## WORKFLOWS

**Exactly 4 workflows must exist. Never create more. Never force PORT= on marketplace or mobile.**

| Workflow Name | Command | Port | Purpose |
|---|---|---|---|
| `Embedding Service` | `cd artifacts/embedding-service && EMBEDDING_PORT=8000 python3 main.py` | **8000** (fixed) | FastAPI sentence-transformers |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | **8080** (via `API_PORT=8080`) | Express API + DB migrations |
| `artifacts/marketplace: web` | `pnpm --filter @workspace/marketplace run dev` | Replit-assigned | Vite React web app |
| `artifacts/mobile: expo` | `pnpm --filter @workspace/mobile run dev` | Replit-assigned | Expo mobile app |

**Required startup order:** api-server → embedding-service → marketplace → mobile

**FORBIDDEN workflows** — delete immediately if found:
- `Start application` · `API Server` (manual) · `Marketplace` (manual)

**Why no extra workflows:** Extra workflows conflict on ports, cause the API to bind on port 5000, or create duplicate processes. The Replit artifact system manages marketplace and mobile; do not replicate their commands.

---

## PORTS

| Service | Local Port | External Port | How assigned |
|---|---|---|---|
| API server | **8080** | 8080 | Fixed via `API_PORT=8080` in shared env |
| Embedding service | **8000** | 8000 | Fixed via `EMBEDDING_PORT=8000` in workflow command |
| Marketplace web | ~20787 | 3000 | Replit-assigned (do not hardcode) |
| Mobile web (Expo) | ~18115 | 3001 | Replit-assigned (do not hardcode) |
| Mobile Metro | ~18116 | 3002 | Replit-assigned (do not hardcode) |

**Preview routing:** Vite proxies `/api/*` → `localhost:8080`. Configured in `artifacts/marketplace/vite.config.ts`. Must never be removed.

**CRITICAL port rule:** `PORT` env var must NOT be set in shared env. It causes the API to bind on 5000 instead of 8080. Use `API_PORT=8080` only.

**Mobile API base URL:** `getBaseUrl()` in the mobile app returns `https://$REPLIT_DEV_DOMAIN` — never hardcode localhost for mobile.

---

## DATABASE

**Engine:** PostgreSQL 16 via Replit built-in (`DATABASE_URL` auto-provisioned)

**Required extensions:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector for semantic search (384-dim)
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram similarity for full-text search
```

**Expected table count: 44**

| # | Table | Rows (certified 2026-06-22) |
|---|---|---|
| 1 | admin_audit_log | 0 |
| 2 | cart_items | 0 |
| 3 | conversations | 0 |
| 4 | courier_assignments | 0 |
| 5 | courier_payout_requests | 0 |
| 6 | courier_ratings | 0 |
| 7 | courier_wallet_transactions | 0 |
| 8 | courier_wallets | 0 |
| 9 | couriers | 1 |
| 10 | delivery_missions | 0 |
| 11 | delivery_zones | 40 |
| 12 | dispatch_alerts | 0 |
| 13 | hero_banners | 0 |
| 14 | message_attachments | 0 |
| 15 | messages | 0 |
| 16 | mission_offers | 0 |
| 17 | mission_safety_events | 0 |
| 18 | notifications | 0 |
| 19 | order_items | 14 |
| 20 | order_status_history | 14 |
| 21 | orders | 14 |
| 22 | platform_settings | 1 |
| 23 | product_variant_groups | 0 |
| 24 | product_variant_options | 0 |
| 25 | product_variant_values | 0 |
| 26 | product_variants | 0 |
| 27 | products | 42 |
| 28 | push_subscriptions | 0 |
| 29 | query_logs | 0 |
| 30 | reviews | 40 |
| 31 | search_queries | 0 |
| 32 | search_synonyms | 48 |
| 33 | seller_applications | 5 |
| 34 | seller_reviews | 4 |
| 35 | seller_verification_log | 0 |
| 36 | store_follows | 4 |
| 37 | support_tickets | 0 |
| 38 | tracking_events | 0 |
| 39 | tracking_positions | 0 |
| 40 | tracking_sessions | 0 |
| 41 | users | 12 |
| 42 | variant_images | 0 |
| 43 | verification_audit_log | 0 |
| 44 | wishlists | 12 |

**Schema management:**
```bash
# Build shared TS libraries FIRST (required before push)
npx tsc --build lib/db lib/api-zod lib/api-client-react

# Push schema — fresh database only (skip if 44 tables already exist)
cd lib/db && pnpm run push-force
```

**Auto-migrations:** The API server runs `src/lib/run-migrations.ts` on every boot. These are additive, idempotent, and safe to re-run. Never use DROP or ALTER existing columns.

**Demo data bootstrapped on first boot (fresh DB only):**
- 42 products across multiple categories
- 12 users (admin + sellers + couriers + customers)
- 40 delivery zones covering Aleppo
- 14 demo orders, 40 reviews, 48 search synonyms, 1 platform_settings row

---

## EMBEDDINGS

**Model:** `paraphrase-multilingual-MiniLM-L12-v2`  
**Dimensions:** 384  
**Location:** `artifacts/embedding-service/model/model.safetensors` (449 MB)  
**Backend verified:** `sentence-transformers`  
**Products embedded:** 42/42

**Fallback behavior:** If `model.safetensors` is missing or corrupt, the embedding service automatically falls back to TF-IDF+LSA. Search still works but quality degrades. The healthz endpoint shows `embeddingBackend: "tfidf-lsa"` when in fallback mode.

**Verify:**
```bash
curl -s http://localhost:8000/health
# Must show: {"backend":"sentence-transformers","vector_dimensions":384}
```

**Re-embed all products:**
```bash
pnpm --filter @workspace/api-server embed:generate
```

**Download model if missing:**
```bash
curl -L -o artifacts/embedding-service/model/model.safetensors \
  "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors"
```

---

## AUTH

| Method | Status | Notes |
|---|---|---|
| Email/Phone + Password | ✅ Active | JWT HS256, signed by `SESSION_SECRET` |
| Google Login | ✅ Active | `GOOGLE_CLIENT_ID` only — no client secret needed |
| Facebook Login | ❌ Disabled | `FACEBOOK_LOGIN_ENABLED=false` |
| Cloudflare Turnstile | ⚠️ Partial | `TURNSTILE_SITE_KEY` in shared env; needs `TURNSTILE_SECRET_KEY` in Secrets for server-side verify |
| JWT storage | — | Web: `localStorage` · Mobile: `AsyncStorage` |

**Roles:** Admin (Root Owner) · Seller · Courier · Customer

**Admin bypass:** The admin email (`delewatiamer7@gmail.com`) bypasses role selector server-side. Do not rely on role selector for admin access.

**Rate limiter:** In-memory, 10 attempts / 15 min per IP. Restart API workflow to reset during testing.

**CORS rule (critical — do not revert):** `isReplitOrigin()` in `artifacts/api-server/src/app.ts` always allows `*.replit.dev` + `*.replit.app`. This is required for both web preview and mobile to authenticate. Removing it breaks all mobile logins.

**Demo accounts:**
| Role | Email | Password |
|---|---|---|
| Admin (Root Owner) | delewatiamer7@gmail.com | 00Amer00 |
| Seller | delewatiamer8@gmail.com | 00Amer00 |
| Courier | delewatiamer9@gmail.com | 00Amer00 |
| Seller (dev) | seller@syano.test | Seller@2026 |
| Courier (dev) | courier@syano.test | Courier@2026 |
| Customer (demo) | layla@syano.test | 00Amer00 |

---

## MAPS

**Libraries (all 3 required in `artifacts/marketplace/package.json`):**
```
leaflet ^1.9.4
react-leaflet ^5.0.0
@types/leaflet ^1.9.x
```

**CSS import (required in `artifacts/marketplace/src/components/TrackingMap.tsx`):**
```typescript
import "leaflet/dist/leaflet.css";
```

**Pages using maps:** `/courier` · `/tracking/:missionId` · `/admin/routing`  
**Routing engine:** OSRM (real road routing, not straight-line)  
**Tile source:** OpenStreetMap

**Validate maps:** Login as courier → open `/courier` → OSM map tiles must be visible (not blank gray).

**Fix if missing:**
```bash
pnpm --filter @workspace/marketplace add leaflet react-leaflet @types/leaflet
```

---

## MAP SYSTEM MANIFEST

> Audited: 2026-06-25. All layers verified present and correctly configured.  
> Reference implementation files: `artifacts/marketplace/src/components/TrackingMap.tsx` · `artifacts/marketplace/src/components/LocationMapModal.tsx`

---

### Map Engine Architecture

The SYANO map system is a hardened, multi-layer Leaflet engine used in two contexts:

| Component | File | Purpose |
|---|---|---|
| `TrackingMap` | `src/components/TrackingMap.tsx` | Live courier tracking — read-only, auto-pan, real-road polyline |
| `LocationMapModal` | `src/components/LocationMapModal.tsx` | Delivery address picker — interactive crosshair, zone auto-detection |

Both components share the same hardened `TileLayer` configuration and shimmer-loading pattern. They are independent React trees (not shared instances).

**Routing engine:** OSRM (`router.project-osrm.org`) via `artifacts/api-server/src/services/osrmService.ts`.  
**Fallback routing:** Haversine straight-line when OSRM is unreachable.  
**Route cache:** `artifacts/api-server/src/services/routeCacheService.ts` — 60 s TTL, invalidates if courier moves > 100 m.

---

### Configuration Hardening

These are the **critical parameters** that must be preserved in every migration. Changing any of them causes gray tiles, blank maps, or layout breaks.

#### TileLayer (both TrackingMap and LocationMapModal)

```tsx
<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  maxZoom={19}
  maxNativeZoom={19}
  minZoom={3}
  keepBuffer={12}
  updateWhenZooming={false}
  updateWhenIdle={false}
/>
```

| Parameter | Value | Why it must not change |
|---|---|---|
| `url` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | OSM CDN with subdomains `a/b/c` — load-balances tile requests |
| `maxZoom` | `19` | Leaflet render limit — must match `maxNativeZoom` |
| `maxNativeZoom` | `19` | Prevents gray/blurry tiles when user zooms past native tile resolution |
| `minZoom` | `3` | Guards against extreme zoom-out breaking tile coordinates |
| `keepBuffer` | `12` | Pre-loads 12 tiles outside the visible viewport — prevents blank edges on fast pan |
| `updateWhenZooming` | `false` | Suppresses mid-zoom tile requests — eliminates flicker during pinch/scroll |
| `updateWhenIdle` | `false` | Loads tiles continuously during pan, not only after the pan stops |

#### MapContainer settings

| Component | Critical settings |
|---|---|
| `TrackingMap` | `zoom={14}` · `attributionControl={false}` · `zoomControl` |
| `LocationMapModal` | `zoom={15}` · `zoomControl={false}` · `attributionControl={false}` · `scrollWheelZoom={true}` · `trackResize={true}` |

#### Inner helper components (must not be removed)

| Helper | Component | Purpose |
|---|---|---|
| `TileLoadTracker` | Both | Fires shimmer-dismiss only when Leaflet signals all tiles ready. Also has an 80 ms post-mount check for the cached-tile race (tiles load before the component mounts → "load" event never fires) |
| `AutoPan` | TrackingMap | Smooth `panTo` on each courier GPS update (1.2 s animation) |
| `AutoFit` | TrackingMap | `fitBounds` to route/markers on first load only (guarded by `fittedRef`) |
| `MapController` | LocationMapModal | `flyTo(target, 15, 1.5s)` for search results and GPS locate — uses `flyToTarget` state instead of re-mounting the map |
| `InvalidateSizeOnOpen` | LocationMapModal | Calls `map.invalidateSize()` immediately + after 150 ms when modal opens — prevents blank/collapsed tile grid inside flex containers |
| `CenterTracker` | LocationMapModal | Debounced (200 ms) map-move handler — feeds center state for reverse geocoding |

#### Shimmer overlay (both components)

Both maps show a branded shimmer loading state until tiles are ready. Key rules:
- `opacity` transitions from `1 → 0` over 0.6–0.65 s (CSS `transition: opacity`)
- `pointer-events: none` — map stays fully interactive while shimmer is visible
- Safety net: `setTimeout(800ms)` forces shimmer away if the Leaflet "load" event never fires (network stall, ad-blocker)
- `zIndex: 500–800` — above Leaflet tiles but below map controls (z-index 1000+)

#### LocationMapModal persistence (must not regress)

```
localStorage key  ZONE_KEY   → JSON number   (selected zone ID)
localStorage key  COORDS_KEY → JSON { lat, lng }
localStorage key  ADDR_KEY   → JSON { zoneId, lat, lng, address }
```

- On open: reads saved coords via `loadSavedCoords()` — falls back to `ALEPPO [36.2021047, 37.1342839]` if saved coords are `null` or `[0,0]`
- On confirm: writes all 3 keys + dispatches `syano:location-updated` CustomEvent
- **CRITICAL — no mapKey re-mount:** the modal uses `flyToTarget` state + `MapController.flyTo()` to navigate without unmounting the map. If `mapKey` or any other increment-on-open pattern is added, it causes a double-mount that produces gray tiles. Do not revert this.

#### Syria geofence (LocationMapModal)

```typescript
const SYRIA_LAT_MIN = 32.3,  SYRIA_LAT_MAX = 37.4;
const SYRIA_LNG_MIN = 35.6,  SYRIA_LNG_MAX = 42.4;
const SYRIA_CATCHALL_ID = 999;   // zone ID for "All Syrian Provinces"
```

Two-stage validation on every pin move (debounced 300 ms):
1. Fast bounding-box pre-check (`isInsideSyriaBBox`) — immediate rejection without Nominatim
2. Nominatim reverse geocode → strict `country_code === "sy"` check
- Outside Syria: disables the confirm button, shows warning, clears zone selection
- Unrecognized Syrian location: falls back to zone 999 (never leaves the user without a valid zone)

#### LRU caches (backend)

| Cache | File | Max entries | TTL | Invalidation |
|---|---|---|---|---|
| `searchCache` | `searchCache.ts` | 500 | none (LRU eviction only) | Evicted when full |
| `productsCache` | `cacheService.ts` | 200 | 60 s | TTL expiry |
| `productDetailCache` | `cacheService.ts` | 500 | 5 min | TTL expiry + explicit bust on mutation |
| `categoriesCache` | `cacheService.ts` | 10 | 1 hr | TTL expiry |
| `sellersCache` | `cacheService.ts` | 100 | 2 min | TTL expiry |
| Route cache | `routeCacheService.ts` | unbounded (Map) | 60 s | TTL expiry + courier moves > 100 m |

`searchCache` uses a doubly-linked list + Map for O(1) get/set/evict — do not replace with a plain `Map`.

#### Service Worker (sw.js)

**Current version: v4** · Asset cache: `syano-assets-v2` · Tile cache: `syano-tile-cache-v1` · Metadata cache: `syano-tile-meta-v1`

| Strategy | Applies to | Notes |
|---|---|---|
| Cache-First | OSM + CartoDB tiles (cross-origin) | Fetched with `mode:'cors'`; LRU eviction at cap 750 tiles |
| Cache-First | Hashed JS/CSS chunks (`/assets/*-[hash].(js\|css)`) | Content-addressed — safe to cache forever |
| Stale-While-Revalidate | Same-origin statics (fonts, icons, manifest, images) | Inter font is precached at install time |
| Network-only | Everything else (API, navigation, SSE) | TanStack Query handles API caching in JS |

**v4 additions over v3:**
- `syano-tile-cache-v1` — OSM/CartoDB tiles cached with Cache First (mode: cors)
- `syano-tile-meta-v1` — parallel metadata cache tracking `{ts: lastAccessMs}` per tile
- Background LRU eviction — runs every 50 tile writes, evicts oldest tiles until under cap (750)
- `postMessage({ type: 'INVALIDATE_TILE_CACHE' })` — runtime flush of both tile caches
- Tile URL regex: `/^https:\/\/[a-d]\.(?:tile\.openstreetmap\.org|basemaps\.cartocdn\.com)\//`

**`invalidateSWTileCache()` in `src/lib/map-hardening.ts`** — sends the postMessage with a MessageChannel for ACK.

---

### Map Health Check (run after any migration, code pull, or environment move)

```bash
# 1. Verify Leaflet packages are installed
pnpm --filter @workspace/marketplace ls leaflet react-leaflet @types/leaflet
# Must show: leaflet ^1.9.4, react-leaflet ^5.0.0, @types/leaflet ^1.9.x

# 2. Verify CSS import is present
grep -n "leaflet/dist/leaflet.css" artifacts/marketplace/src/components/TrackingMap.tsx
# Must return: line 14→import "leaflet/dist/leaflet.css";

# 3. Verify TileLayer keepBuffer value
grep -n "keepBuffer" artifacts/marketplace/src/components/TrackingMap.tsx
# Must return: keepBuffer={12}

grep -n "keepBuffer" artifacts/marketplace/src/components/LocationMapModal.tsx
# Must return: keepBuffer={12}

# 4. Verify maxNativeZoom is set (gray-tile guard)
grep -n "maxNativeZoom" artifacts/marketplace/src/components/TrackingMap.tsx artifacts/marketplace/src/components/LocationMapModal.tsx
# Both must return: maxNativeZoom={19}

# 5. Verify flyToTarget pattern is intact (no mapKey re-mount)
grep -n "flyToTarget\|mapKey\|setMapKey" artifacts/marketplace/src/components/LocationMapModal.tsx
# Must show flyToTarget — must NOT show mapKey or setMapKey

# 6. Verify geofence constants
grep -n "SYRIA_LAT_MIN\|SYRIA_LAT_MAX\|SYRIA_LNG_MIN\|SYRIA_LNG_MAX" artifacts/marketplace/src/components/LocationMapModal.tsx
# Must show: 32.3, 37.4, 35.6, 42.4

# 7. Verify service worker version
grep -n "Syano Service Worker\|CACHE_ASSETS" artifacts/marketplace/public/sw.js
# Must show: v3, syano-assets-v2

# 8. Live map smoke test (manual)
# Login as courier (delewatiamer9@gmail.com / 00Amer00)
# Navigate to /courier → OSM tiles must be visible (not blank gray)
# Open location picker → pin must default to Aleppo, zone auto-detect must fire
```

**Checklist (tick all before declaring map health OK):**

```
[ ] leaflet, react-leaflet, @types/leaflet all installed at correct versions
[ ] import "leaflet/dist/leaflet.css" present in TrackingMap.tsx (line 14)
[ ] TileLayer keepBuffer={12} in TrackingMap.tsx
[ ] TileLayer keepBuffer={12} in LocationMapModal.tsx
[ ] maxNativeZoom={19} in both map components
[ ] updateWhenZooming={false} + updateWhenIdle={false} in both map components
[ ] TileLoadTracker helper present in both components
[ ] InvalidateSizeOnOpen helper present in LocationMapModal
[ ] LocationMapModal uses flyToTarget (NOT mapKey increment) on open
[ ] ALEPPO [0,0] guard in LocationMapModal open handler
[ ] Syria geofence constants correct (32.3/37.4 lat, 35.6/42.4 lng)
[ ] Zone 999 catchall logic present
[ ] ZONE_KEY / COORDS_KEY / ADDR_KEY localStorage persistence intact
[ ] syano:location-updated CustomEvent dispatched on confirm
[ ] sw.js version v3, cache name syano-assets-v2
[ ] Route cache TTL = 60 s, movement threshold = 100 m (routeCacheService.ts)
[ ] searchCache MAX_SIZE = 500 (searchCache.ts)
[ ] /courier page shows OSM tiles (not blank gray) — live smoke test
[ ] LocationMapModal opens, shows shimmer, then tiles load — live smoke test
```

**Fix if map packages are missing:**
```bash
pnpm --filter @workspace/marketplace add leaflet react-leaflet @types/leaflet
```

---

## SEARCH

**Pipeline:** 13-step NLP (Arabic + English normalization → tokenization → FTS via GIN index + pgvector similarity → RRF blend)  
**Cache:** LRU 500-entry in-memory  
**Languages:** Arabic (native) + English  
**Indexes:** GIN (full-text), pgvector (semantic), pg_trgm (trigram similarity)  

**Search endpoints:**
```
GET /api/search?q=<query>           Full search (FTS + semantic)
GET /api/search/trending            Trending queries
GET /api/search/suggestions?q=<q>  Autocomplete suggestions
```

---

## MOBILE

**Framework:** Expo 54 + expo-router  
**Screens:** ~55  
**Web parity:** ~95%  
**Path:** `artifacts/mobile/app/`  
**API connection:** `getBaseUrl()` = `https://$REPLIT_DEV_DOMAIN` (not localhost)  
**Auth:** AsyncStorage JWT  
**i18n:** `artifacts/mobile/src/i18n/index.ts`

**Key mobile screens:** Home · Product detail · Cart · Orders · Courier workspace · Tracking · Profile · Seller dashboard · Admin panel

---

## REQUIRED SECRETS

### Replit Secrets tab (sensitive — never in code or shared env)

| Secret | Status | Purpose |
|---|---|---|
| `SESSION_SECRET` | ✅ REQUIRED — auto-provisioned | JWT signing |
| `DATABASE_URL` | ✅ REQUIRED — auto-provisioned | PostgreSQL connection string |
| `ROOT_ADMIN_PASSWORD` | ✅ REQUIRED — set manually | Bootstraps root admin account on first API boot |
| `TURNSTILE_SECRET_KEY` | ✅ REQUIRED — set manually | Cloudflare Turnstile server-side verification |
| `RESEND_API_KEY` | Optional | Email OTP + transactional emails (graceful fallback if absent) |
| `VAPID_PRIVATE_KEY` | Optional | Web push notifications (graceful fallback if absent) |

### Shared env vars (`.replit [userenv.shared]` — public values only, never secrets)

| Variable | Value | Notes |
|---|---|---|
| `API_PORT` | `8080` | API server port — **never change, never remove** |
| `EMBEDDING_SERVICE_URL` | `http://localhost:8000` | Internal URL to embedding service |
| `GOOGLE_CLIENT_ID` | `345038238714-85pmrf2d863vf3ck406umnmmot72u8s9.apps.googleusercontent.com` | Google OAuth client ID |
| `TURNSTILE_ENABLED` | `true` | Enable Turnstile bot protection UI |
| `TURNSTILE_SITE_KEY` | `0x4AAAAAADokmlEQVP2R17Wx` | Cloudflare Turnstile public key |
| `FACEBOOK_LOGIN_ENABLED` | `false` | Facebook login is disabled |
| `VAPID_PUBLIC_KEY` | `BFoem7SaEkB2P1zJ0O2jUvpWrJ08Hdb49m4OVBqNdlTmBKwxupHzbg4L3x9zBUkxQrvPIyQz4I6tpK69oj90vAI` | Web push VAPID public key |
| `VAPID_EMAIL` | `mailto:admin@syano.online` | Web push sender identity |
| `CORS_ORIGIN` | _(empty)_ | Extra CORS origins (Replit domains always auto-allowed) |
| `SITE_URL` | _(empty)_ | Site URL for sitemap generation |
| `VITE_SUPPORT_PHONE` | `+963-PLACEHOLDER` | Support phone number shown in UI |

**`PORT` must NOT be set** — its presence causes the API to bind on 5000 instead of 8080.

---

## RECOVERY PROCEDURE

Complete sequence for recovering SYANO from a fresh Replit import:

### STEP 1 — Import & node_modules
```bash
# After import, verify node_modules exist
ls node_modules   # should show packages (~855MB total)
# If missing or incomplete:
pnpm install --no-frozen-lockfile
```

### STEP 2 — Set secrets
In the Replit **Secrets** tab, set:
- `ROOT_ADMIN_PASSWORD` = your admin password
- `TURNSTILE_SECRET_KEY` = your Cloudflare Turnstile secret key

(`SESSION_SECRET` and `DATABASE_URL` are auto-provisioned by Replit — do not set manually.)

### STEP 3 — Install Python packages
**CRITICAL:** PyTorch must use the CPU wheel index. Do not use `uv` or `pyproject.toml` for this.

Replit's NixOS enforces PEP 668, which blocks `python3 -m pip install` with a "externally-managed-environment" error. Use `pip install --user` (the pip wrapper in `.pythonlibs`) instead — this writes to `.pythonlibs/` and is not blocked:

```bash
# Pass 1 — core packages
pip install --user numpy fastapi uvicorn scikit-learn pydantic

# Pass 2 — PyTorch CPU (explicit index required)
pip install --user torch --index-url https://download.pytorch.org/whl/cpu

# Pass 3 — ML packages (depend on torch)
pip install --user transformers sentence-transformers sentencepiece safetensors
```

### STEP 4 — Build shared TS libraries
```bash
npx tsc --build lib/db lib/api-zod lib/api-client-react
```
This is required before any TypeScript checks or DB schema push. Skipping it causes `TS6305: Output file has not been built` errors in marketplace and mobile.

### STEP 5 — Database schema (fresh DB only)
```bash
# Only run if the database has no tables (fresh import with blank DB)
# Skip if psql $DATABASE_URL -c "\dt" shows 44 tables
cd lib/db && pnpm run push-force
```

### STEP 6 — Start workflows (in this order)
1. `artifacts/api-server: API Server`
2. `Embedding Service`
3. `artifacts/marketplace: web`
4. `artifacts/mobile: expo`

### STEP 7 — Verify API
```bash
curl -s http://localhost:8080/api/healthz | python3 -m json.tool
# Expected: status=ok, tables=44, products=42, embeddings=42, embeddingBackend=sentence-transformers
```

### STEP 8 — Verify embeddings
```bash
curl -s http://localhost:8000/health
# Expected: {"backend":"sentence-transformers","vector_dimensions":384}
# If shows "tfidf-lsa": model.safetensors is missing — see EMBEDDINGS section
```

### STEP 9 — Verify maps
Login as courier (`delewatiamer9@gmail.com` / `00Amer00`) → open `/courier` → OSM map tiles must be visible (not blank gray).

### STEP 10 — Final certification
```bash
pnpm import:check   # Expected: PASS
```

---

## COMMON FAILURES

| Symptom | Root Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'numpy'` | Python packages not installed | Run STEP 3 above |
| `Cannot find package 'esbuild'` | pnpm workspace symlinks broken | `pnpm install --no-frozen-lockfile` |
| `relation "users" does not exist` | DB schema not pushed (fresh DB) | Run STEP 5: `cd lib/db && pnpm run push-force` |
| Blank gray map on `/courier` | Leaflet packages or CSS missing | `pnpm --filter @workspace/marketplace add leaflet react-leaflet @types/leaflet` |
| `embeddingBackend: "tfidf-lsa"` in healthz | `model.safetensors` missing or corrupt | Download from HuggingFace (see EMBEDDINGS section) |
| 500 on auth routes / "Invalid Turnstile token" | `TURNSTILE_SECRET_KEY` not set | Set it in Replit Secrets tab |
| API server binds port 5000 instead of 8080 | `PORT` env var set in shared env | Remove `PORT` from shared env; keep only `API_PORT=8080` |
| Every mobile login fails (generic error) | CORS not allowing Replit domains | Verify `healthz.auth.corsReplitDomainsAllowed=true`; restore `isReplitOrigin()` in `artifacts/api-server/src/app.ts` |
| `TS6305: Output file has not been built` | Shared lib dist files missing | `npx tsc --build lib/db lib/api-zod lib/api-client-react` |
| "Port in use" / duplicate workflows | Extra manual workflows exist | Delete any workflow not in the approved list of 4 |
| Tables < 44 after API boot | Migrations failed or incomplete | Restart API workflow (migrations auto-run on boot) |
| `pnpm install` times out | pnpm store cache incomplete | Re-run: `pnpm install --no-frozen-lockfile` |
| Embedding service torch install fails | uv/pyproject resolution conflict or Nix PEP 668 block | Use `pip install --user` (not `python3 -m pip`) with `--index-url https://download.pytorch.org/whl/cpu` |

---

## TYPESCRIPT POLICY

**All 5 packages must maintain 0 TypeScript errors at all times.**

```bash
# Build libs first, then check all packages
npx tsc --build lib/db lib/api-zod lib/api-client-react
npx tsc --noEmit -p artifacts/api-server/tsconfig.json
npx tsc --noEmit -p artifacts/marketplace/tsconfig.json
npx tsc --noEmit -p artifacts/mobile/tsconfig.json
```

**Rules:**
- No `any` types — use explicit types or `unknown`
- Strict mode enabled on all packages
- All DB changes additive only — no `DROP TABLE`, no `ALTER COLUMN` (type changes), no `DROP COLUMN`
- All visible text via i18n keys: `t()` in `en.json` + `ar.json` (web); `artifacts/mobile/src/i18n/index.ts` (mobile)
- RTL/LTR: Tailwind logical classes (`ms-` not `ml-`, `ps-` not `pl-`, `start-` not `left-`)

---

## CERTIFIED STATE — 2026-06-23 (re-verified on Replit after fresh import)

| System | Status | Detail |
|---|---|---|
| API Server | ✅ Running | Port 8080, Express 5, 30 route files |
| Database | ✅ 44/44 tables | PostgreSQL 16 + pgvector + pg_trgm |
| Products | ✅ 42/42 embedded | With semantic vectors |
| Embedding Service | ✅ Running | FastAPI port 8000, sentence-transformers, load_ms≈40549 |
| Marketplace Web | ✅ Running | Vite 7, React 19, Tailwind v4 |
| Mobile App | ✅ Running | Expo 54, ~95% parity, 55 screens |
| Search | ✅ Active | FTS + semantic RRF blend, LRU 500-entry cache |
| Auth | ✅ Healthy | JWT HS256, CORS allows *.replit.dev + *.replit.app |
| Turnstile | ✅ Fully active | `TURNSTILE_SECRET_KEY` set in Secrets |
| ROOT_ADMIN_PASSWORD | ✅ Set | Admin account password bootstrapped |
| Maps (Leaflet) | ✅ Packages present | leaflet ^1.9.4 + react-leaflet ^5.0.0 + @types/leaflet |
| OSRM Routing | ✅ Active | Real road routing, OSM tiles |
| TypeScript | ✅ 0 errors | All 3 artifact packages clean (after lib build) |
| pnpm workspace | ✅ Installed | All node_modules present |
| Python packages | ✅ Installed | numpy, fastapi, torch 2.12.1+cpu, sentence-transformers 5.6.0 (via `pip install --user` in 3 passes into `.pythonlibs`) |
| import:check | ✅ PASS WITH WARNINGS | All critical sections green; optional RESEND_API_KEY + VAPID_PRIVATE_KEY absent (graceful fallback active) |

**Import recovery notes (2026-06-23, re-verified):**
- On fresh import: `pnpm install --no-frozen-lockfile` is the safe command (frozen may fail if lockfile is stale)
- Python packages: use `pip install --user` in 3 passes as documented in STEP 3 above — **NOT** `python3 -m pip install` (blocked by Replit's PEP 668 enforcement) and **NOT** `uv`/`pyproject.toml` (uv resolver fails with sentence-transformers linux markers)
- torch MUST use `--index-url https://download.pytorch.org/whl/cpu` in Pass 2
- DB schema: run `cd lib/db && pnpm run push-force` if fresh DB — tables created in one pass
- Embedding service must be **restarted after** Python packages are installed to pick up sentence-transformers; without restart it stays on tfidf-lsa fallback
- The `tools/mockup-sandbox: Component Preview Server` workflow is added automatically by Replit's canvas tool — it is managed by the platform and not counted in the 4 required workflows

---

## FINAL VALIDATION CHECKLIST

After recovery, an agent must verify every item before declaring the system healthy:

```
[ ] curl http://localhost:8080/api/healthz → status=ok
[ ] healthz.database.tables = 44
[ ] healthz.database.products = 42
[ ] healthz.database.embeddings = 42
[ ] healthz.services.embeddingBackend = "sentence-transformers"
[ ] healthz.auth.corsReplitDomainsAllowed = true
[ ] curl http://localhost:8000/health → backend=sentence-transformers
[ ] Marketplace loads in browser (products visible on homepage)
[ ] Login works (any demo account)
[ ] /courier page shows OSM map tiles (not blank gray)
[ ] pnpm import:check → PASS
[ ] npx tsc --noEmit -p artifacts/api-server/tsconfig.json → 0 errors
[ ] npx tsc --noEmit -p artifacts/marketplace/tsconfig.json → 0 errors
[ ] npx tsc --noEmit -p artifacts/mobile/tsconfig.json → 0 errors
[ ] Exactly 4 workflows running (no extras)
```

---

## DOCUMENT ARCHITECTURE

This file is the **single source of truth**. All other documentation files redirect here.

| File | Role |
|---|---|
| `SYANO_MASTER_RECOVERY.md` | **THIS FILE — the only recovery source** |
| `AGENT_BOOTSTRAP.md` | Redirect only → points here |
| `RECOVERY_GUIDE.md` | Redirect only → points here |
| `PROJECT_STATE.md` | Redirect only → points here |
| `replit.md` | User preferences + redirect → points here |
| `project.manifest.json` | Machine pointer → points here |

**Zero duplicate recovery logic exists in any other file.**

---

## ROLE SYSTEM & ROUTE MAP

**Last audited:** 2026-06-25 (full repository scan)

### Role hierarchy
```
Guest (unauthenticated)
  └── Customer (registered + verified)
        └── Seller (customer who passed seller application; INHERITS all customer routes)
Courier (separate role; does NOT inherit customer routes)
Admin   (all admin routes; can also access courier routes for monitoring)
```

`ProtectedRoute` enforcement (`artifacts/marketplace/src/components/ProtectedRoute.tsx`):
- `canAccess('seller', ['customer'])` → **true** (sellers can shop)
- `canAccess('courier', ['customer'])` → **false** (couriers cannot access /checkout etc.)
- Unauthorized role → redirected to their own dashboard (admin→`/admin`, seller→`/seller/dashboard`, courier→`/courier`, else→`/customer/dashboard`)
- Unauthenticated → redirected to `/login`

### Public routes (no auth)
`/` · `/login` · `/register` · `/verify` · `/forgot-password` · `/account-suspended`  
`/shop` · `/search` · `/products` · `/categories` · `/products/:id` · `/cart`  
`/store/:slug` · `/stores` · `/sellers/directory` · `/tracking/:missionId` · `/wishlist`  
`/about` · `/about/story` · `/about/team` · `/contact` · `/help`  
`/seller/how-to-sell` · `/seller/terms` · `/seller/center` · `/seller/commission` · `/seller/faq`  
`/shipping` · `/shipping/nationwide` · `/payment-methods` · `/syano-guarantee` · `/loyalty`  
`/privacy-policy` · `/terms-of-use` · `/returns-policy` · `/cookies`

### Customer routes (`allowedRoles: ["customer"]` — Seller inherits)
`/checkout` · `/orders` · `/orders/:id` · `/customer/dashboard` · `/messages` · `/support`  
`/seller/apply` · `/seller/application-status` · `/courier/apply`

### Any-auth routes (no role restriction beyond being logged in)
`/account` · `/courier/application-status`

### Seller routes (`allowedRoles: ["seller"]`)
`/seller/dashboard` · `/seller/products` · `/seller/products/new` · `/seller/products/:id/edit`  
`/seller/orders` · `/seller/orders/:id` · `/seller/inventory` · `/seller/messages`  
`/seller/analytics` · `/seller/reviews` · `/seller/store-settings` · `/seller/trust`

### Courier routes (`allowedRoles: ["courier", "admin"]`)
`/courier` (workspace) · `/courier/dashboard` · `/courier/history` · `/courier/earnings`  
`/courier/performance` · `/courier/wallet` · `/courier/profile`

### Admin routes (`allowedRoles: ["admin"]`)
`/admin` · `/admin/users` · `/admin/products` · `/admin/orders` · `/admin/sellers`  
`/admin/analytics` · `/admin/search-analytics` · `/admin/logs` · `/admin/settings`  
`/admin/hero-banners` · `/admin/messages` · `/admin/support` · `/admin/verification`  
`/admin/courier-applications` · `/admin/courier-applications/:id`  
`/admin/delivery` · `/admin/delivery-missions` · `/admin/courier-availability`  
`/admin/courier-locations` · `/admin/tracking-monitor` · `/admin/routing`  
`/admin/dispatch-center` · `/admin/courier-payouts`

---

## MAP ENGINE v4

**Last updated:** 2026-06-25

### Service Worker (sw.js)
| Constant | Value |
|---|---|
| `CACHE_ASSETS` | `syano-assets-v2` |
| `CACHE_TILES` | `syano-tiles-v4` |
| `CACHE_TILE_META` | `syano-tile-meta-v1` |
| Tile cap | 750 entries (LRU eviction every 50 writes) |
| Tile strategy | Cache First → network fallback |
| Asset strategy | Cache First for precached; network for runtime |

**PRECACHE_URLS** (installed on SW activation):
- `fonts/inter-latin.woff2`
- `marker-icon.png`
- `marker-icon-2x.png`
- `marker-shadow.png`

**postMessage handlers:**
- `PREFETCH_TILES` — queues up to N tile URLs for background caching (100 ms throttle)
- `INVALIDATE_TILE_CACHE` — deletes entire `syano-tiles-v4` cache

**Why marker images are local:** Previously served from `unpkg.com` CDN (cross-origin, uncacheable by SW). Moved to `public/` so the SW can precache them and serve offline.

### Nominatim Local Memory Cache
- **Location:** module-level `Map` in `artifacts/marketplace/src/components/LocationMapModal.tsx`
- **Cache key:** `${lat.toFixed(3)},${lng.toFixed(3)}` — 3 decimal places ≈ 111 m grid resolution
- **TTL:** 5 minutes
- **Behaviour:** On a cache hit the zone, address, and Syria-status are applied instantly with zero network requests. On a miss, Nominatim is fetched and the result is stored.
- **Why this key precision:** Panning within the same ~111 m "block" reuses the same geocode result, eliminating redundant requests while keeping zone accuracy acceptable for delivery zones.

### GPS Accuracy Circle
- **Component:** `react-leaflet` `Circle`, rendered inside `LocationMapModal`
- **Anchor:** GPS fix position (`geoLocatedCenter`) — does NOT follow the draggable pin
- **Style:** Blue dashed stroke, 8 % fill opacity, radius = `accuracy` in metres
- **Warning pill:** Amber banner, auto-dismisses after 5 s, triggers when `accuracy > 100 m`
- **Reset:** Cleared every time the modal is opened (no state leak between sessions)

### Courier Map Clustering (Admin)
- **File:** `artifacts/marketplace/src/components/CourierMapClustered.tsx`
- **Library:** `supercluster` (NOT `react-leaflet-cluster` — incompatible with react-leaflet v5)
- **Cluster icon:** Green circle, count label; sizes 38 px / 44 px / 52 px for <10 / <50 / 100+ couriers
- **Click:** `flyTo(cluster centroid, currentZoom + 2)`
- **Individual marker:** Status-coloured teardrop (ONLINE=green, BUSY=amber, OFFLINE=gray)
- **Popup:** Name, phone, status badge, accuracy ± m, stale-location warning with age
- **Used in:** `/admin/courier-locations` — Map/Table toggle in header; auto-refreshes on 10 s `refetchInterval`

---

## TECHNICAL DEBT & KNOWN DEAD ENDS

**Last audited:** 2026-06-25 (full repository scan, Feature Freeze active)

This section is permanent and must be kept current as dead ends are resolved or new ones accumulate.

### Static / marketing pages with no backend logic
| Route | Symptom | What is missing |
|---|---|---|
| `/loyalty` | Full 3-tier marketing page (Silver/Blue/Gold) | No `loyalty_points` table, no accrual on orders, no tier tracking. All content is static i18n copy. |
| `/payment-methods` | COD card shows "Available"; Credit Card + Mobile show "Coming Soon" | No payment gateway integration. Only COD is wired end-to-end. |
| `/contact` | Form UI renders a "Send Message" button | No `onSubmit` handler connected to an API. Button does nothing. |
| `/syano-guarantee`, `/about/*`, `/help`, `/seller/center`, `/seller/faq`, `/shipping`, `/shipping/nationwide` | Purely informational | Correct for marketing pages; no interactive logic needed. |

### UI elements that exist but have no underlying logic
| Location | Element | Status |
|---|---|---|
| `/loyalty` | "Join Now" for logged-in users | Links exist but no loyalty account is created |
| `/wishlist` | Heart icon on product cards | localStorage only — **not synced to DB** for logged-in users. Clearing browser storage loses all items. `wishlists` table exists in DB but is not used by the web wishlist feature. |
| `/payment-methods` | Credit Card / Mobile Payment cards | Dimmed, labelled "Coming Soon", no `onClick` — acceptable placeholder |

### Error boundary coverage gaps
| Scenario | Coverage | Risk |
|---|---|---|
| App-level JS crash (any route) | ✅ Single `<ErrorBoundary>` wraps the global `<Suspense>` in `App.tsx` | Any page crash is caught; user must refresh to recover |
| Individual admin page JS error | ⚠️ No per-page boundary | One admin page crash blanks the entire app (caught by global boundary only) |
| API 500 on initial load | ✅ react-query `isError` state on most pages | Each section shows its own error fallback |
| Background refetch failure | ⚠️ Most pages silently keep stale data | User sees outdated info without a visible error indicator |
| Geolocation on HTTP (non-HTTPS) | ⚠️ `navigator.geolocation` is undefined on HTTP | LocationMapModal has the guard (`"geolocation" in navigator`) so it does not crash, but the locate button never appears |

### Missing features behind existing DB tables
| Feature | DB table exists? | Web UI exists? | Backend API? |
|---|---|---|---|
| Loyalty points system | ❌ No table | ✅ Marketing page | ❌ None |
| Credit card / mobile payment | — | ✅ "Coming Soon" | ❌ None |
| Wishlist server sync | ✅ `wishlists` table (12 rows demo) | ✅ Heart icon | ❌ Not wired to `/api/wishlist` |
| Push notifications | ✅ `push_subscriptions` table | ⚠️ Partial SW wiring | ⚠️ Endpoint exists; end-to-end subscription flow needs verification |
| Courier safety event reporting | ✅ `mission_safety_events` table | — | ✅ Route exists — verify any UI buttons are wired |

### Known architectural constraints (intentional, not bugs)
1. **Seller inherits Customer routes** — intentional; sellers can also shop and place orders.
2. **Courier does NOT inherit Customer routes** — intentional per business rules; a courier cannot checkout.
3. **Admin can access Courier routes** — `allowedRoles: ["courier", "admin"]` — intended for monitoring/testing.
4. **Single global ErrorBoundary** — a crash in any lazy route shows the global fallback for the whole app. Users must refresh. Per-page boundaries would isolate failures but are not yet implemented.
5. **ProtectedRoute uses `useEffect` for redirect** — there is a 1-frame white flash before the redirect fires on very fast connections. Cosmetically acceptable.
6. **Nominatim public ToS** — 1 req/sec limit. The local cache + AbortController mitigates burst. A high-traffic production deployment should self-host Nominatim with Syria OSM data.
7. **OSRM public endpoint** — `router.project-osrm.org` is best-effort. Production should deploy a private OSRM instance with Syria data for SLA guarantees.
8. **No CSRF protection** — API uses JWT Bearer tokens in `Authorization` headers (not cookies), so CSRF is not currently applicable. If any future feature adopts cookie-based auth, add CSRF middleware immediately.

---

## Future Agent Rules

These rules are permanent. They apply to every agent that works on SYANO, in every session, forever.

1. **Never create additional recovery files.** There is exactly one recovery document: `SYANO_MASTER_RECOVERY.md`. Do not create `RECOVERY_v2.md`, `NEW_RECOVERY.md`, `IMPORT_GUIDE.md`, or any equivalent.

2. **Never duplicate recovery instructions.** If recovery information already exists in this file, do not copy it into any other file. Do not paraphrase it into another file. Do not summarize it elsewhere.

3. **Never create alternate recovery guides.** Phase reports, audit reports, certification documents, and "state snapshots" that contain recovery logic are forbidden. The only permitted recovery document is this one.

4. **Never split recovery logic.** Do not partially document a procedure here and partially elsewhere. If a procedure is here, it is complete here.

5. **Always update this file when infrastructure changes.** If you change a port, workflow command, secret name, Python package, or database procedure — update the relevant section in this file in the same task. Do not leave it stale.

6. **Always run `pnpm import:check` after major infrastructure work.** This verifies the certified state has not been broken. It must exit PASS or PASS WITH WARNINGS.

7. **The import check script is at `scripts/src/import-check.ts`.** Modify it when new certification checks are needed. Do not create a separate certification script.

8. **Do not treat `AGENT_BOOTSTRAP.md`, `RECOVERY_GUIDE.md`, `PROJECT_STATE.md`, or `replit.md` as recovery sources.** They contain only redirect pointers. Do not add recovery logic to them.

9. **Do not treat `.agents/memory/` topic files as recovery sources.** Memory files are agent behavior notes, not recovery instructions. Recovery instructions belong in this file only.

10. **When in doubt, read this file first.** Before running any migration, workflow, or infrastructure change, verify the current certified state in the "CERTIFIED STATE" section above.
