/* ─── Service worker ───────────────────────────────────────
   Offline shell only. API responses are deliberately never
   cached: a stale habit streak or an out-of-date balance is
   worse than an honest "you are offline".
   ───────────────────────────────────────────────────────── */

const VERSION = 'sortlife-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

/* Enough to render the app frame while the network is gone. Hashed
   build assets are added lazily as they are requested. */
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `reload` skips the HTTP cache, so a deploy is never precached stale.
      .then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .catch(() => {
        /* A failed precache must not block activation — the app still
           works online, it just has no offline shell this session. */
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** Same-origin static build output, which is content-hashed and immutable. */
function isBuildAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/assets/');
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept the API — freshness matters more than availability.
  if (isApiRequest(url)) return;

  // Cross-origin (fonts, CDNs) goes straight to the network.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || Response.error()))
    );
    return;
  }

  // Hashed assets: cache first, since the filename changes on every build.
  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        });
      })
    );
  }
});

/* The page asks for an immediate takeover after it installs an update. */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
