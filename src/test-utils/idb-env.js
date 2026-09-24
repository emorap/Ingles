// Test-only: install fake-indexeddb globals so `idb` works under node:test.
// The browser provides these natively; this is never imported by app code.
// idb performs `instanceof IDBRequest` / `IDBTransaction` / etc. checks, so
// every IDB* class must be present on the global object, not just indexedDB.
import * as fakeIDB from '../../vendor/fake-indexeddb.js';

for (const [name, value] of Object.entries(fakeIDB)) {
  if (name.startsWith('IDB')) globalThis[name] = value;
}
globalThis.indexedDB = fakeIDB.indexedDB;
