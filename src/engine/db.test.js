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

  test('round-trips a per-item note', async () => {
    await s.setNote('i1', 'recuerda la -s de tercera persona');
    assert.equal(await s.getNote('i1'), 'recuerda la -s de tercera persona');
    assert.equal(await s.getNote('missing'), undefined);
  });

  test('backup carries notes across a fresh device', async () => {
    await s.putProgress(p('i1'));
    await s.setNote('i1', 'nota importante');
    const dump = await s.exportAll();
    s.close();
    indexedDB.deleteDatabase('momentum');
    const s2 = new Store();
    await s2.open();
    assert.equal((await s2.importAll(dump)).ok, true);
    assert.equal(await s2.getNote('i1'), 'nota importante');
    s = s2; // hand off to afterEach for closing
  });

  test('rejects a parseable backup with malformed records without throwing or corrupting data', async () => {
    await s.putProgress(p('keep'));
    // Valid JSON, right format tag, but a progress record with no itemId: the
    // keyPath resolves to undefined and put() would reject (RF#6).
    const bad = JSON.stringify({ format: 'momentum-progress', version: 2, progress: [{ seen: 1 }] });
    let r;
    await assert.doesNotReject(async () => { r = await s.importAll(bad); }, 'importAll never rejects');
    assert.equal(r.ok, false, 'malformed backup is refused');
    assert.equal((await s.getProgress('keep'))?.itemId, 'keep', 'existing data untouched');
  });

  test('export omits the AI key so a shared backup never leaks it', async () => {
    await s.setMeta('aiKey', 'secret-gemini-key');
    await s.setMeta('newPerDay', 12);
    const dump = JSON.parse(await s.exportAll());
    assert.equal(dump.meta.aiKey, undefined, 'aiKey excluded from backup');
    assert.equal(dump.meta.newPerDay, 12, 'other meta still exported');
  });

  test('import ignores any AI key embedded in a backup', async () => {
    const withKey = JSON.stringify({ format: 'momentum-progress', version: 2, progress: [], meta: { aiKey: 'leaked', newPerDay: 9 } });
    assert.equal((await s.importAll(withKey)).ok, true);
    assert.equal(await s.getMeta('aiKey', ''), '', 'aiKey not restored from backup');
    assert.equal(await s.getMeta('newPerDay', 0), 9, 'other meta restored');
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
