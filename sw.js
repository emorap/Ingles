// Momentum service worker — offline-first.
//
// Strategy: precache the minimal app shell on install, then cache-first for
// every same-origin GET (stale-while-revalidate), so the whole ES-module
// graph, vendored libraries and content JSON are cached on first online visit
// and served offline forever after. Navigations fall back to the cached shell
// when the network is gone. Cross-origin requests (e.g. the AI tutor) are left
// to the network so failures degrade gracefully upstream.
const CACHE = 'momentum-v1';
const SHELL = [
  './',
  './index.html',
  './public/manifest.webmanifest',
  './src/styles/theme.css',
  './src/main.js',
  './content/tenses.json',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // pass cross-origin through

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        event.waitUntil(fetchAndCache(req).catch(() => {})); // refresh in background
        return cached;
      }
      return fetchAndCache(req).catch(() => fallback(req));
    }),
  );
});

async function fetchAndCache(req) {
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function fallback(req) {
  if (req.mode === 'navigate') {
    const shell = await caches.match('./index.html');
    if (shell) return shell;
  }
  return new Response('', { status: 504, statusText: 'offline' });
}
