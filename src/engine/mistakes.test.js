import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logMistake, recentMistakes, mistakeItemIds, setBookmark, isBookmarked, listBookmarks, MAX_MISTAKES } from './mistakes.js';

// Minimal meta-backed fake: mistakes.js only touches getMeta/setMeta.
function fakeStore() {
  const m = new Map();
  return {
    async getMeta(k, def) { return m.has(k) ? m.get(k) : def; },
    async setMeta(k, v) { m.set(k, v); },
  };
}

test('logging mistakes returns them newest-first, capped at n', async () => {
  const s = fakeStore();
  await logMistake(s, 'a', 'wrongA');
  await logMistake(s, 'b', 'wrongB');
  await logMistake(s, 'c', 'wrongC');

  const recent = await recentMistakes(s, 2);
  assert.equal(recent.length, 2, 'capped at n');
  assert.deepEqual(recent.map((m) => m.itemId), ['c', 'b'], 'newest first');
  assert.equal(recent[0].given, 'wrongC');
  assert.equal(typeof recent[0].at, 'number', 'timestamped');
});

test('the log is a ring buffer capped at MAX_MISTAKES', async () => {
  const s = fakeStore();
  for (let i = 0; i < MAX_MISTAKES + 5; i++) await logMistake(s, `i${i}`, 'x');
  const all = await recentMistakes(s, 10000);
  assert.equal(all.length, MAX_MISTAKES, 'oldest entries dropped');
  assert.equal(all[0].itemId, `i${MAX_MISTAKES + 4}`, 'newest retained');
});

test('mistakeItemIds returns unique ids newest-first for a focused session', async () => {
  const s = fakeStore();
  await logMistake(s, 'a', 'x');
  await logMistake(s, 'b', 'y');
  await logMistake(s, 'a', 'z'); // repeated
  assert.deepEqual(await mistakeItemIds(s), ['a', 'b']);
});

test('setBookmark toggles membership; isBookmarked / listBookmarks reflect it', async () => {
  const s = fakeStore();
  assert.equal(await isBookmarked(s, 'x'), false);
  await setBookmark(s, 'x', true);
  await setBookmark(s, 'y', true);
  await setBookmark(s, 'x', true); // idempotent
  assert.equal(await isBookmarked(s, 'x'), true);
  assert.deepEqual((await listBookmarks(s)).sort(), ['x', 'y']);
  await setBookmark(s, 'x', false);
  assert.equal(await isBookmarked(s, 'x'), false);
  assert.deepEqual(await listBookmarks(s), ['y']);
});
