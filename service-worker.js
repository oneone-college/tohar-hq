/* Tohar HQ — Service Worker v6
   Network-first for HTML/JS/CSS (always fresh).
   Cache-first for assets (fonts, icons). */

const CACHE_VERSION = 'tohar-hq-v8';
const ASSET_CACHE = 'tohar-hq-assets-v8';

const APP_SHELL = [
  '/',
  '/index.html',
];

// Install — fetch shell into cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting(); // Activate immediately, don't wait
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — strategy depends on resource type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // External requests (fonts, etc.) — cache-first
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy));
          }
          return response;
        }).catch(() => cached)
      )
    );
    return;
  }

  // HTML/JS/CSS — network-first (always fresh!)
  const isAppCode = /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

  if (isAppCode) {
    event.respondWith(
      fetch(req).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return response;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Icons & other assets — cache-first with background refresh
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
