// Momentum bootstrap (composition root). Registers the service worker, asks
// for persistent storage and warns if data isn't safe, then fetches +
// validates the module content and mounts the app shell. All logic lives in
// tested units (pwa.js, validateContent, mountApp); this file only wires them
// to the browser.
import { mountApp } from './ui/app.js';
import { Store } from './engine/db.js';
import { MemoryStore } from './engine/memory-store.js';
import { loadCatalog } from './engine/catalog.js';
import { requestPersist, idbAvailable, persistenceBanner, registerServiceWorker } from './pwa.js';

registerServiceWorker();

const root = document.getElementById('app');
if (root) boot(root);

/** @param {HTMLElement} root */
async function boot(root) {
  const persisted = await requestPersist();
  const hasIdb = idbAvailable();
  const banner = persistenceBanner({ idb: hasIdb, persisted });
  if (banner) document.body.insertBefore(banner, document.body.firstChild);

  try {
    // Manifest-driven: load index.json then every `available` module. A single
    // bad module file is skipped inside loadCatalog; this throws only if the
    // manifest itself is unreadable or no module loaded.
    const catalog = await loadCatalog((u) => fetch(u));
    if (catalog.modules.size === 0) throw new Error('No se pudo cargar ningún módulo');
    // Without IndexedDB (e.g. private mode) — or if opening it fails — fall back
    // to an ephemeral in-memory store so the offline core still runs. The banner
    // above already warns that progress won't be saved between sessions.
    try {
      await mountApp(root, catalog, hasIdb ? new Store() : new MemoryStore());
    } catch (storageErr) {
      if (!banner) document.body.insertBefore(persistenceBanner({ idb: false, persisted: false }), document.body.firstChild);
      await mountApp(root, catalog, new MemoryStore());
    }
  } catch (err) {
    const msg = document.createElement('main');
    msg.style.padding = '2rem';
    const h1 = document.createElement('h1');
    h1.textContent = 'Momentum';
    const p = document.createElement('p');
    p.textContent = 'No se pudo cargar el contenido: ' + (err?.message ?? err);
    msg.append(h1, p);
    root.append(msg);
  }
}
