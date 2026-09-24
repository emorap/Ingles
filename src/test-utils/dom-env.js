// Installs a real (linkedom) DOM as globals so UI modules — which call
// document.createElement / addEventListener / location.hash in the browser —
// run unchanged under node:test. Mirrors idb-env.js for IndexedDB.
//
// linkedom lives in the git-ignored node_modules populated by
// scripts/fetch_test_deps.py (no package manager on the host). It is a
// TEST-ONLY dependency; the shipped app never imports it.
import { parseHTML } from 'linkedom';

const BLANK = '<!doctype html><html><head></head><body><div id="app"></div></body></html>';

/**
 * Install a fresh DOM as globals. Call in beforeEach for isolation.
 * @param {string} [html]
 * @returns {{ window: any, document: any }}
 */
export function installDom(html = BLANK) {
  const { window, document } = parseHTML(html);
  augmentWindow(window);
  define('window', window);
  define('document', document);
  // Constructors/singletons UI code references unqualified in the browser.
  for (const key of [
    'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
    'navigator', 'location', 'history', 'customElements', 'getComputedStyle',
    'addEventListener', 'removeEventListener', 'dispatchEvent',
  ]) {
    if (window[key] !== undefined) {
      const v = window[key];
      define(key, typeof v === 'function' ? v.bind(window) : v);
    }
  }
  return { window, document };
}

// linkedom's window already has a working native event system (addEventListener
// / dispatchEvent), but all windows share ONE native location via the prototype
// and its hash setter never fires 'hashchange'. So we shadow location with an
// OWN property whose hash setter dispatches 'hashchange' through the window's
// native events — using linkedom's own Event so its dispatcher accepts it.
// This is exactly the browser contract router.js is written against.
function augmentWindow(window) {
  let hash = '';
  forceOwn(window, 'location', {
    get hash() { return hash; },
    set hash(value) {
      const next = String(value).startsWith('#') ? String(value) : '#' + value;
      if (next === hash) return;
      hash = next;
      window.dispatchEvent(new window.Event('hashchange'));
    },
  });
  if (!window.history) {
    forceOwn(window, 'history', { pushState() {}, replaceState() {}, back() {} });
  }
}

// Define an own property that shadows any inherited (shared-prototype) accessor.
function forceOwn(obj, key, value) {
  Object.defineProperty(obj, key, { value, configurable: true, writable: true, enumerable: true });
}

// Some globals (e.g. navigator in Node 22) are getter-only; plain assignment
// throws. defineProperty overrides them regardless.
function define(key, value) {
  Object.defineProperty(globalThis, key, {
    value, configurable: true, writable: true, enumerable: false,
  });
}
