import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectItems } from './session-select.js';

function item(id, topic) {
  return {
    id, topic, type: 'cloze',
    prompt: { en: `${id} en`, es: `${id} es` },
    answer: id, accept: [id],
    why: { en: 'w', es: 'w' },
  };
}

const CONTENT = {
  module: {
    items: [item('a1', 'ta'), item('a2', 'ta'), item('b1', 'tb'), item('b2', 'tb')],
  },
};

function fakeStore(meta = {}) {
  return { async getMeta(k, d) { return k in meta ? meta[k] : d; } };
}

const OPTS = { newPerDay: 10, cap: 20, now: new Date('2026-09-23T10:00:00Z') };

test('no param → a full study session over all items', async () => {
  const items = await selectItems({ view: 'practice' }, { content: CONTENT, progress: new Map(), store: fakeStore(), ...OPTS });
  assert.equal(items.length, 4);
});

test('a topic param → only that topic\'s items', async () => {
  const items = await selectItems({ view: 'practice', param: 'tb' }, { content: CONTENT, progress: new Map(), store: fakeStore(), ...OPTS });
  assert.deepEqual(items.map((i) => i.id).sort(), ['b1', 'b2']);
});

test('the "mistakes" param → the logged mistake items, newest first, deduped', async () => {
  const mistakes = [
    { itemId: 'a1', given: 'x', at: 1 },
    { itemId: 'b2', given: 'y', at: 2 },
    { itemId: 'a1', given: 'z', at: 3 }, // repeat, newest
  ];
  const items = await selectItems(
    { view: 'practice', param: 'mistakes' },
    { content: CONTENT, progress: new Map(), store: fakeStore({ mistakes }), ...OPTS },
  );
  assert.deepEqual(items.map((i) => i.id), ['a1', 'b2']);
});

test('the "mistakes" param drops ids no longer in the content', async () => {
  const mistakes = [{ itemId: 'gone', given: 'x', at: 1 }, { itemId: 'a2', given: 'y', at: 2 }];
  const items = await selectItems(
    { view: 'practice', param: 'mistakes' },
    { content: CONTENT, progress: new Map(), store: fakeStore({ mistakes }), ...OPTS },
  );
  assert.deepEqual(items.map((i) => i.id), ['a2']);
});
