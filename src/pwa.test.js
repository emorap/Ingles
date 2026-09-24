import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './test-utils/dom-env.js';
import { requestPersist, idbAvailable, persistenceBanner } from './pwa.js';

beforeEach(() => installDom());
afterEach(() => {
  delete globalThis.navigator.storage;
  delete globalThis.indexedDB;
});

test('requestPersist returns false and does not throw when navigator.storage is undefined', async () => {
  delete globalThis.navigator.storage;
  assert.equal(await requestPersist(), false);
});

test('requestPersist short-circuits to true when storage is already persisted', async () => {
  let persistCalled = false;
  globalThis.navigator.storage = {
    persisted: async () => true,
    persist: async () => { persistCalled = true; return false; },
  };
  assert.equal(await requestPersist(), true);
  assert.equal(persistCalled, false, 'no need to request when already persisted');
});

test('requestPersist requests persistence and returns the grant result', async () => {
  globalThis.navigator.storage = { persisted: async () => false, persist: async () => true };
  assert.equal(await requestPersist(), true);
  globalThis.navigator.storage = { persisted: async () => false, persist: async () => false };
  assert.equal(await requestPersist(), false);
});

test('idbAvailable reflects whether IndexedDB exists', () => {
  globalThis.indexedDB = {};
  assert.equal(idbAvailable(), true);
  delete globalThis.indexedDB;
  assert.equal(idbAvailable(), false);
});

test('persistenceBanner: null when data is safe, an alert when not', () => {
  assert.equal(persistenceBanner({ idb: true, persisted: true }), null);

  const noIdb = persistenceBanner({ idb: false, persisted: false });
  assert.equal(noIdb.getAttribute('role'), 'alert');
  assert.match(noIdb.textContent, /no permite guardar/i);

  const notPersisted = persistenceBanner({ idb: true, persisted: false });
  assert.equal(notPersisted.getAttribute('data-role'), 'storage-warning');
  assert.match(notPersisted.textContent, /copia de seguridad/i);
});
