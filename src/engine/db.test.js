import '../test-utils/idb-env.js';
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from './db.js';
import { newCard } from './scheduler.js';

/** @param {string} id */
const p = (id) => ({ itemId: id, card: newCard(), seen: 0, correct: 0 });

describe('Store', () => {
  /** @type {Store} */
  let s;
  beforeEach(async () => {
    // Safe to delete: afterEach closed the previous connection.
    indexedDB.deleteDatabase('momentum');
    s = new Store();
    await s.open();
  });
  afterEach(() => {
    s?.close();
  });

  test('round-trips progress', async () => {
    await s.putProgress(p('i1'));
    assert.equal((await s.getProgress('i1'))?.itemId, 'i1');
  });

  test('exports and imports', async () => {
    await s.putProgress(p('i1'));
    const dump = await s.exportAll();
    // Simulate a fresh device: close, wipe, reopen empty, then import.
    s.close();
    indexedDB.deleteDatabase('momentum');
    const s2 = new Store();
    await s2.open();
    const r = await s2.importAll(dump);
    assert.equal(r.ok, true);
    assert.equal((await s2.getProgress('i1'))?.itemId, 'i1');
    s = s2; // hand off to afterEach for closing
  });

  test('rejects malformed import without corrupting data', async () => {
    await s.putProgress(p('keep'));
    const r = await s.importAll('{not json');
    assert.equal(r.ok, false);
    assert.equal((await s.getProgress('keep'))?.itemId, 'keep');
  });

  test('migrates ids on import', async () => {
    await s.putProgress(p('old'));
    const dump = await s.exportAll();
    s.close();
    indexedDB.deleteDatabase('momentum');
    const s2 = new Store();
    await s2.open();
    await s2.importAll(dump, { idMap: { old: 'new' } });
    assert.equal(await s2.getProgress('old'), undefined);
    assert.equal((await s2.getProgress('new'))?.itemId, 'new');
    s = s2; // hand off to afterEach for closing
  });
});
