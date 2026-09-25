import '../test-utils/idb-env.js';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from './db.js';
import { openDB } from '../../vendor/idb.js';

const DB = 'momentum';
/** @type {Store | undefined} */
let s;
beforeEach(() => { indexedDB.deleteDatabase(DB); });
afterEach(() => { s?.close(); s = undefined; });

const wav = (bytes) => new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });

test('putAudio/getAudio round-trips a cached blob', async () => {
  s = new Store();
  await s.open();
  await s.putAudio('Kore::Hello', { blob: wav([1, 2, 3]), mime: 'audio/wav' });

  const got = await s.getAudio('Kore::Hello');
  assert.equal(got.mime, 'audio/wav');
  assert.equal(got.blob.size, 3);
  assert.deepEqual([...new Uint8Array(await got.blob.arrayBuffer())], [1, 2, 3]);
});

test('getAudio returns undefined for a missing key', async () => {
  s = new Store();
  await s.open();
  assert.equal(await s.getAudio('nope'), undefined);
});

test('exportAll never includes cached audio (regenerable + heavy)', async () => {
  s = new Store();
  await s.open();
  await s.putAudio('Kore::Hi', { blob: wav([9]), mime: 'audio/wav' });

  const dump = JSON.parse(await s.exportAll());
  assert.deepEqual(Object.keys(dump).sort(), ['format', 'meta', 'notes', 'progress', 'version']);
});

test('upgrading a pre-audio database keeps progress and adds the audio store', async () => {
  // A returning learner whose DB predates the audio store (older schema).
  const old = await openDB(DB, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'itemId' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    },
  });
  await old.put('progress', { itemId: 'ps-x', seen: 3, correct: 2 });
  await old.put('meta', 5, 'streak');
  old.close();

  s = new Store();
  await s.open(); // opens at the current VERSION → runs the upgrade

  assert.equal((await s.getProgress('ps-x')).seen, 3, 'progress survived migration');
  assert.equal(await s.getMeta('streak', 0), 5, 'meta survived migration');
  await s.putAudio('v::t', { blob: wav([1]), mime: 'audio/wav' });
  assert.ok(await s.getAudio('v::t'), 'audio store usable after upgrade');
});
