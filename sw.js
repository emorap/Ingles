// Momentum service worker — offline-first.
//
// Strategy: precache the minimal app shell on install, then cache-first for
// every same-origin GET (stale-while-revalidate), so the whole ES-module
// graph, vendored libraries and content JSON are cached on first online visit
// and served offline forever after. Navigations fall back to the cached shell
// when the network is gone. Cross-origin requests (e.g. the AI tutor) are left
// to the network so failures degrade gracefully upstream.
// Bumped v1 -> v2 when the app became manifest-driven: boot now loads
// content/index.json first (loadCatalog throws without it), so it must be
// precached. The version bump purges the stale v1 cache (old present-only
// content) on activate and guarantees a fresh precache for returning users.
// Bumped v2 -> v3 when the five remaining modules shipped: every module's
// JSON is now precached so the whole corpus works offline from the first
// visit (not just after a learner happens to open each module online).
// Bumped v3 -> v4 after the content-enrichment pass (every topic raised to
// 5 examples, cross-linking + two reference tables). The precache list is
// unchanged, but the bump forces returning users to re-precache the updated
// JSON on activate instead of waiting a load behind for stale-while-revalidate.
// Bumped v4 -> v5 after the content-fidelity pass restored the teaching
// frameworks from the PDFs (57 explanation blocks across the 6 modules:
// the "N purposes/jobs" tables + diagnostic-question callouts). Same
// precache list; the bump re-precaches the deepened JSON for returning users.
// Bumped v5 -> v6 with Fase 1 (voz natural): new ES modules (audio/wav.js,
// audio/gemini-tts.js, audio/voice.js) join the module graph and are cached
// on-demand by the fetch handler — no SHELL change needed. The bump purges the
// stale v5 cache on activate so returning users pick up the new app code.
// Bumped v6 -> v7 with Fase 2 (diálogo por voz): new ES modules
// (audio/speech.js, ui/views/dialogue.js) and the scenarios data module
// (content/scenarios.js) join the module graph and are cached on-demand by the
// fetch handler — no SHELL change needed (the voice dialogue is an online
// realce, so it is never needed offline before the first online visit). The
// bump purges the stale v6 cache on activate so returning users get the new code.
const CACHE = 'momentum-v7';
const SHELL = [
  './',
  './index.html',
  './public/manifest.webmanifest',
  './src/styles/theme.css',
  './src/main.js',
  './content/index.json',
  './content/tenses.json',
  './content/conditionals.json',
  './content/structure.json',
  './content/verbforms.json',
  './content/modifiers.json',
  './content/mechanics.json',
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
