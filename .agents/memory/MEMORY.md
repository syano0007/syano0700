# SYANO Project Memory

- [Courier workspace W1-W12](courier-workspace.md) — Web-first courier experience; workspace.tsx is primary at /courier; separate history/earnings/profile pages.
- [Workflow constraints](workflow-constraints.md) — NEVER create new workflows; exactly 4 must exist; NEVER force PORT on marketplace/expo.
- [i18n rules](i18n-rules.md) — All strings via t(); en.json + ar.json must stay in sync (courier.* keys block).
- [API endpoint map](api-endpoints.md) — missionId is in couriers/assignments response; tracking via /api/tracking/:missionId.
- [JSX generic syntax](jsx-generics.md) — Babel rejects `<Component<T>>` generic syntax in TSX JSX; cast via arrow fn `onChange={(v) => fn(v as T)}` instead.
- [A8 courier_ratings unique constraint](a8-schema-fix.md) — courier_ratings missing unique(mission_id, customer_id); must use direct SQL ALTER TABLE, not drizzle-kit push (causes data loss prompt).
- [Variant system audit](variant-system.md) — Pipeline works end-to-end; 4 bugs fixed; cache invalidation critical; productDetailCache must be busted after any variant mutation.
- [Embedding lifecycle](embedding-lifecycle.md) — POST auto-embeds; PATCH had a bug (now fixed); generateSingleEmbedding catch was silent → changed to console.error.
- [Single source of truth](single-source-of-truth.md) — SYANO_MASTER_RECOVERY.md is THE only recovery file; all others (AGENT_BOOTSTRAP, RECOVERY_GUIDE, PROJECT_STATE, replit.md, project.manifest.json) redirect to it with no recovery logic.
- [Python install quirk](python-install-quirk-note.md) — torch must use --index-url https://download.pytorch.org/whl/cpu on Replit; use python3 -m pip in 3 passes (core → torch → ML); uv/pyproject fails.
- [RTL flex carousel fix](rtl-carousel-fix.md) — dir=rtl on <html> reverses flex main-axis; add direction:ltr to the track element to pin slide order; never invert transforms or create separate RTL code paths.
- [DB package rebuild after schema change](db-package-rebuild.md) — After editing lib/db/src/schema/*.ts, run `npx tsc --build lib/db/tsconfig.json --force` to regenerate stale .d.ts files; otherwise API server TS check fails with "Property X does not exist" even though the source file is correct.
- [Location system architecture](location-system.md) — LocationContext (contexts/LocationContext.tsx) is the global single source of truth; syncs via syano:location-updated event; persists to DB via PATCH /api/auth/me (deliveryLat/Lng/ZoneId columns on users table).
- [Hardened map engine](hardened-map-engine.md) — SW v4 tile caching, 6-layer gray tile fix, dual TileLayer crossfade, persistent LocationMapModal mount, AbortController Nominatim, geofence prefetch. Shared utils in src/lib/map-hardening.ts.
