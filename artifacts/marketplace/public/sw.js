/* Syano Service Worker v4
 * v1 → v2: Cache-first for hashed JS/CSS chunks; stale-while-revalidate for same-origin statics.
 * v2 → v3: Install-time precache for Inter font.
 * v3 → v4: Cross-origin OSM/CartoDB tile caching (Cache First, mode: cors).
 *          Parallel metadata cache (syano-tile-meta-v1) for LRU eviction tracking.
 *          Background LRU eviction every 50 tile writes (cap: 750 tiles).
 *          Runtime cache invalidation via postMessage({ type: 'INVALIDATE_TILE_CACHE' }).
 *
 * Caching strategies:
 *   OSM / CartoDB tiles   → Cache First (cross-origin, new in v4)
 *   Hashed JS/CSS chunks  → Cache First (content-addressed, safe to cache forever)
 *   Same-origin statics   → Stale While Revalidate (fonts, icons, manifest)
 *   Everything else       → Network only (API, navigation, SSE)
 *
 * API caching deliberately omitted — TanStack Query provides superior
 * stale-while-revalidate with smarter invalidation in JS land.
 */

const CACHE_ASSETS = "syano-assets-v2";
const CACHE_TILES  = "syano-tile-cache-v1";
const CACHE_META   = "syano-tile-meta-v1";
const ALL_CACHES   = [CACHE_ASSETS, CACHE_TILES, CACHE_META];

const TILE_MAX    = 750;  // maximum tiles kept in cache (LRU eviction after this)
const EVICT_EVERY = 50;   // run LRU eviction check every N tile writes

/* Matches OSM subdomains a/b/c and CartoDB subdomains a/b/c/d */
const TILE_ORIGIN_RE =
  /^https:\/\/[a-d]\.(?:tile\.openstreetmap\.org|basemaps\.cartocdn\.com)\//;

let tileWriteCount = 0;

// ── Metadata helpers ──────────────────────────────────────────────────────────

async function updateTileMeta(url) {
  try {
    const cache = await caches.open(CACHE_META);
    await cache.put(
      new Request(url),
      new Response(String(Date.now()), {
        headers: { "Content-Type": "text/plain" },
      }),
    );
  } catch { /* ignore */ }
}

// ── LRU eviction — runs in background, never blocks fetch ─────────────────────

async function evictOldTiles() {
  try {
    const [tileCache, metaCache] = await Promise.all([
      caches.open(CACHE_TILES),
      caches.open(CACHE_META),
    ]);

    const metaKeys = await metaCache.keys();
    if (metaKeys.length <= TILE_MAX) return; // still within cap

    const entries = await Promise.all(
      metaKeys.map(async (req) => {
        const res = await metaCache.match(req);
        const ts = res ? parseInt(await res.text(), 10) : 0;
        return { url: req.url, ts };
      }),
    );

    /* Sort oldest-first, evict the excess */
    entries.sort((a, b) => a.ts - b.ts);
    const excess = entries.slice(0, entries.length - TILE_MAX);

    await Promise.all(
      excess.map(({ url }) =>
        Promise.all([
          tileCache.delete(new Request(url)),
          metaCache.delete(new Request(url)),
        ]),
      ),
    );
  } catch { /* ignore eviction errors */ }
}

// ── Install: precache critical assets ────────────────────────────────────────

/* v4.1: also precache index.html (app shell) so navigation works offline */
const PRECACHE_URLS = ["fonts/inter-latin.woff2", ""];

self.addEventListener("install", (event) => {
  const scope = self.registration.scope;
  const precache = caches
    .open(CACHE_ASSETS)
    .then((cache) =>
      cache.addAll(PRECACHE_URLS.map((p) => scope + p)),
    )
    .catch(() => {});

  event.waitUntil(precache.then(() => self.skipWaiting()));
});

// ── Activate: purge old caches ────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch handler ─────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  /* ① OSM / CartoDB tiles — Cache First (v4 addition)
     Re-issued with mode:'cors' so we get a transparent (inspectable) response.
     Both OSM and CartoDB send Access-Control-Allow-Origin: * so this is safe.
     On hit: update metadata access timestamp (fire-and-forget).
     On miss: fetch, store, increment write counter, trigger LRU if needed. */
  if (TILE_ORIGIN_RE.test(event.request.url)) {
    event.respondWith(
      caches.open(CACHE_TILES).then(async (tileCache) => {
        const cached = await tileCache.match(event.request, { ignoreVary: true });
        if (cached) {
          updateTileMeta(event.request.url); /* fire-and-forget */
          return cached;
        }

        const corsReq = new Request(event.request.url, { mode: "cors" });
        const res = await fetch(corsReq);
        if (res.ok) {
          tileCache.put(event.request, res.clone());
          await updateTileMeta(event.request.url);
          tileWriteCount++;
          if (tileWriteCount % EVICT_EVERY === 0) {
            evictOldTiles(); /* non-blocking — no await */
          }
        }
        return res;
      }),
    );
    return;
  }

  /* ② Hashed JS/CSS chunks — Cache First, no expiry.
     Content-addressed: the hash changes when file changes → safe to cache forever. */
  if (/\/assets\/[^/?]+-[0-9a-f]{8,}\.(js|css)(\?.*)?$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      }),
    );
    return;
  }

  /* ③ Same-origin statics — Stale While Revalidate.
     Fonts, icons, manifest, images: serve from cache, refresh in background. */
  if (
    url.hostname === self.location.hostname &&
    /\.(woff2?|ttf|otf|ico|png|svg|webmanifest|webp|jpg|jpeg|gif)(\?.*)?$/.test(
      url.pathname,
    )
  ) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) {
          fetch(event.request)
            .then((res) => { if (res.ok) cache.put(event.request, res); })
            .catch(() => {});
          return hit;
        }
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      }),
    );
    return;
  }

  /* ④ Same-origin navigation — SPA shell fallback.
     Try network first; if offline, serve the cached index.html shell
     so the app stays usable without a connection. */
  if (
    event.request.mode === "navigate" &&
    url.hostname === self.location.hostname
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .open(CACHE_ASSETS)
          .then((cache) =>
            cache.match(new Request(self.registration.scope)) ||
            cache.match(new Request(self.registration.scope + "index.html")),
          )
          .then((shell) => shell || fetch(event.request)),
      ),
    );
    return;
  }

  /* ⑤ Everything else (API, SSE, external images) — network only.
     External images rely on CDN Cache-Control headers (Pexels/Unsplash → long TTL).
     API caching is handled by TanStack Query. */
});

// ── Push notifications (unchanged from v3) ────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Syano", body: event.data.text(), data: {} };
  }

  const { title, body, icon, badge, data, tag, priority } = payload;

  event.waitUntil(
    self.registration.showNotification(title ?? "Syano", {
      body:               body  ?? "",
      icon:               icon  ?? "/favicon.svg",
      badge:              badge ?? "/favicon.svg",
      data:               data  ?? {},
      tag:                tag   ?? "syano-notif",
      renotify:           true,
      requireInteraction: priority === "critical",
      vibrate:            priority === "critical"
        ? [200, 100, 200, 100, 200]
        : [100, 50, 100],
      timestamp: Date.now(),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link      = event.notification.data?.link;
  const targetUrl = link
    ? (link.startsWith("http") ? link : `https://syano.online${link}`)
    : "https://syano.online/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("syano") && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "syano-sync") event.waitUntil(Promise.resolve());
});

// ── postMessage: runtime tile cache invalidation (v4 addition) ────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "INVALIDATE_TILE_CACHE") {
    Promise.all([
      caches.delete(CACHE_TILES),
      caches.delete(CACHE_META),
    ])
      .then(() => event.ports?.[0]?.postMessage({ ok: true }))
      .catch(() => event.ports?.[0]?.postMessage({ ok: false }));
  }
});
