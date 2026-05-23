/* Tohar HQ — Service Worker v10
   Aggressive update: always fresh, never cache HTML/JS/CSS. */

const CACHE_VERSION = 'tohar-hq-v11';
const ASSET_CACHE = 'tohar-hq-assets-v11';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))  // Delete ALL old caches
    ).then(() => self.clients.claim())
     .then(() => {
       // Tell all open tabs to reload
       return self.clients.matchAll({ type: 'window' }).then((clients) => {
         clients.forEach((client) => client.postMessage({ type: 'RELOAD' }));
       });
     })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // External (fonts) — cache-first
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((response) => {
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

  // ALWAYS network-first for app code (HTML/JS/CSS/JSON)
  const isAppCode = /\.(html|js|css|json)$/i.test(url.pathname) ||
                    url.pathname === '/' ||
                    url.pathname.endsWith('/');

  if (isAppCode) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        caches.match(req).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Icons/assets — cache-first with refresh
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
