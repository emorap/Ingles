// PWA glue: ask for persistent storage, detect whether IndexedDB exists, and
// build a warning banner when local data isn't safe (Review Focus: persistence
// denied or IndexedDB unavailable). Kept out of main.js so it's unit-testable;
// main.js just calls these. Service-worker registration lives here too.

/**
 * Ask the browser to make storage persistent (won't be evicted under pressure).
 * No-throw: returns false when the API is missing or the request is denied.
 * @returns {Promise<boolean>}
 */
export async function requestPersist() {
  const storage = globalThis.navigator?.storage;
  if (!storage || typeof storage.persist !== 'function') return false;
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/** @returns {boolean} whether IndexedDB is usable in this context. */
export function idbAvailable() {
  return typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null;
}

/**
 * A warning banner when local data isn't safe, or null when it is.
 * @param {{ idb: boolean, persisted: boolean }} status
 * @returns {HTMLElement | null}
 */
export function persistenceBanner({ idb, persisted }) {
  if (idb && persisted) return null;
  const el = document.createElement('div');
  el.className = 'storage-warning';
  el.setAttribute('data-role', 'storage-warning');
  el.setAttribute('role', 'alert');
  const p = document.createElement('p');
  p.textContent = idb
    ? 'Tu navegador podría borrar tu progreso al liberar espacio. Exporta una copia de seguridad en Ajustes para no perder nada.'
    : 'Este navegador no permite guardar tu progreso localmente (¿modo privado?). Tu avance no se guardará entre sesiones.';
  el.append(p);
  return el;
}

/**
 * Register the service worker (after load, so it never delays first paint).
 * No-op where service workers are unavailable.
 * @param {string} [url]
 */
export function registerServiceWorker(url = './sw.js') {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
