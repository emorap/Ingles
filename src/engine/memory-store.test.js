import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './memory-store.js';

test('open() never throws — it is the fallback for when IndexedDB is unavailable', async () => {
  const s = new MemoryStore();
  await assert.doesNotReject(() => s.open());
});

test('round-trips progress and meta in memory (ephemeral core still works)', async () => {
  const s = new MemoryStore();
  await s.open();
  await s.putProgress({ itemId: 'i1', seen: 1, correct: 1 });
  assert.equal((await s.getProgress('i1'))?.itemId, 'i1');
  assert.equal((await s.allProgress()).get('i1')?.seen, 1);
  await s.setMeta('newPerDay', 7);
  assert.equal(await s.getMeta('newPerDay', 10), 7);
  assert.equal(await s.getMeta('missing', 'def'), 'def', 'default returned for absent key');
});

test('export omits the AI key, and import refuses malformed records without corrupting data', async () => {
  const s = new MemoryStore();
  await s.open();
  await s.setMeta('aiKey', 'secret');
  await s.putProgress({ itemId: 'keep', seen: 2 });

  const dump = JSON.parse(await s.exportAll());
  assert.equal(dump.meta.aiKey, undefined, 'aiKey never exported');

  const bad = JSON.stringify({ format: 'momentum-progress', version: 2, progress: [{ seen: 1 }] });
  assert.equal((await s.importAll(bad)).ok, false, 'malformed backup refused');
  assert.equal((await s.getProgress('keep'))?.itemId, 'keep', 'existing data intact after a refused import');
});

test('import never introduces an AI key from a backup', async () => {
  const s = new MemoryStore();
  await s.open();
  const leak = JSON.stringify({ format: 'momentum-progress', version: 2, progress: [], meta: { aiKey: 'leaked', voice: 'v' } });
  assert.equal((await s.importAll(leak)).ok, true);
  assert.equal(await s.getMeta('aiKey', ''), '', 'a leaked key in a backup is not restored');
  assert.equal(await s.getMeta('voice', ''), 'v', 'other meta restored');
});
