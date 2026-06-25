/* Syano Service Worker v3
 * v1 → v2: Added cache-first strategy for hashed static assets and same-origin
 *          static files. Old cache cleanup on activate. Push handling unchanged.
 * v2 → v3: Install-time precache for the self-hosted Inter font so it is
 *          available from SW cache on EVERY page load after the first visit
 *          (not just once it has been fetched lazily). Cache name kept as v2
 *          to avoid invalidating users' existing hashed JS/CSS chunk caches.
 *
 * Caching strategy:
 *   Hashed JS/CSS chunks  → Cache First (content-addressed, safe to cache forever)
 *   Same-origin static    → Stale While Revalidate (icons, fonts, manifest)
 *   Everything else       → Network only (API, navigation, SSE)
 *
 * Deliberately NOT caching API responses in the SW — TanStack Query provides a
 * superior stale-while-revalidate strategy in JS with smarter cache invalidation.
 */

const CACHE_ASSETS = "syano-assets-v2";
const ALL_CACHES   = [CACHE_ASSETS];

// Assets to warm into the cache during SW install so they are instantly
// available on all subsequent page loads — no conditional network request.
// Paths are relative to the SW registration scope (e.g. /marketplace/).
const PRECACHE_URLS = [
  "fonts/inter-latin.woff2",
];

/* ── Install: precache critical assets, then skip waiting ──────── */
self.addEventListener("install", (event) => {
  const scope = self.registration.scope; // e.g. "https://app.replit.app/"
  const precache = caches.open(CACHE_ASSETS)
    .then((cache) =>
      cache.addAll(PRECACHE_URLS.map((p) => scope + p))
    )
    .catch(() => {}); // swallow failures — font is not critical for SW install

  event.waitUntil(
    precache.then(() => self.skipWaiting())
  );
});

/* ── Activate: purge caches from old SW versions ───────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !ALL_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── Fetch handler ─────────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  /* 1. Hashed JS/CSS chunks — Cache First, no expiry.
     Pattern: /assets/name-[8+hex].(js|css)
     These are content-addressed: the hash changes whenever the file changes,
     so it is safe to cache them indefinitely. First visit hits network and
     populates the cache; every subsequent visit is instant from disk cache. */
  if (/\/assets\/[^/?]+-[0-9a-f]{8,}\.(js|css)(\?.*)?$/.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  /* 2. Same-origin static assets — Stale While Revalidate.
     Covers fonts, icons, manifest, and other non-hashed statics.
     Serves the cached version immediately while refreshing in the background. */
  if (
    url.hostname === self.location.hostname &&
    /\.(woff2?|ttf|otf|ico|png|svg|webmanifest|webp|jpg|jpeg|gif)(\?.*)?$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) {
          /* Refresh in background — fire-and-forget */
          fetch(event.request)
            .then((res) => { if (res.ok) cache.put(event.request, res); })
            .catch(() => {});
          return hit;
        }
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  /* Everything else (API, navigation, SSE, cross-origin): network only.
     API caching is handled by TanStack Query (staleTime / gcTime).
     External images are cached by the browser's built-in HTTP cache based on
     the CDN's Cache-Control headers (Pexels/Unsplash send proper long-lived headers). */
});

/* ── Push event (unchanged from v1) ───────────────────────────── */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Syano", body: event.data.text(), data: {} };
  }

  const { title, body, icon, badge, data, tag, priority } = payload;

  const notificationOptions = {
    body:               body ?? "",
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
  };

  event.waitUntil(
    self.registration.showNotification(title ?? "Syano", notificationOptions)
  );
});

/* ── Notification click (unchanged from v1) ────────────────────── */
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
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

/* ── Background sync (unchanged from v1) ──────────────────────── */
self.addEventListener("sync", (event) => {
  if (event.tag === "syano-sync") {
    event.waitUntil(Promise.resolve());
  }
});
