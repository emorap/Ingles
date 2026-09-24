import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordStudyDay } from './streak.js';

function fakeStore(meta = {}) {
  return {
    meta,
    async getMeta(k, d) { return k in meta ? meta[k] : d; },
    async setMeta(k, v) { meta[k] = v; },
  };
}

test('first study day starts the streak at 1', async () => {
  const store = fakeStore();
  const s = await recordStudyDay(store, new Date('2026-09-23T10:00:00'));
  assert.equal(s, 1);
  assert.equal(store.meta.streak, 1);
});

test('studying twice on the same day does not change the streak', async () => {
  const store = fakeStore();
  await recordStudyDay(store, new Date('2026-09-23T08:00:00'));
  const s = await recordStudyDay(store, new Date('2026-09-23T20:00:00'));
  assert.equal(s, 1);
});

test('studying on the next day increments the streak', async () => {
  const store = fakeStore();
  await recordStudyDay(store, new Date('2026-09-23T10:00:00'));
  const s = await recordStudyDay(store, new Date('2026-09-24T10:00:00'));
  assert.equal(s, 2);
});

test('a gap of more than a day resets the streak to 1', async () => {
  const store = fakeStore();
  await recordStudyDay(store, new Date('2026-09-23T10:00:00'));
  const s = await recordStudyDay(store, new Date('2026-09-26T10:00:00'));
  assert.equal(s, 1);
});
