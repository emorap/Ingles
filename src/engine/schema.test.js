import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent, validateItem } from './schema.js';

const good = {
  version: 1,
  module: {
    id: 'tenses',
    title: { en: 'T', es: 'T' },
    accent: '#6366F1',
    topics: [{ id: 't1', title: { en: 'A', es: 'A' }, explanation: [], items: ['i1'], related: [] }],
    items: [{ id: 'i1', topic: 't1', type: 'cloze', prompt: { en: 'x', es: 'x' }, answer: 'a', accept: ['a'], why: { en: 'w', es: 'w' } }],
  },
};

test('validateContent accepts a well-formed file', () => {
  const r = validateContent(good);
  assert.equal(r.ok, true);
});

test('validateContent rejects an item whose accept omits the answer', () => {
  const bad = structuredClone(good);
  bad.module.items[0].accept = ['b'];
  const r = validateContent(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /accept/);
});

test('validateContent rejects an unresolved topic->item reference', () => {
  const bad = structuredClone(good);
  bad.module.topics[0].items = ['missing'];
  assert.equal(validateContent(bad).ok, false);
});

test('validateContent rejects an invalid item type', () => {
  const bad = structuredClone(good);
  bad.module.items[0].type = 'nope';
  assert.equal(validateContent(bad).ok, false);
});

test('validateItem accepts a renderable item and rejects malformed ones', () => {
  const ok = { id: 'i1', topic: 't1', type: 'cloze', prompt: { en: 'x', es: 'x' }, answer: 'a', accept: ['a'], why: { en: 'w', es: 'w' } };
  assert.equal(validateItem(ok), true);
  assert.equal(validateItem(null), false);
  assert.equal(validateItem({ ...ok, prompt: undefined }), false, 'needs a bilingual prompt to render');
  assert.equal(validateItem({ ...ok, type: 'nope' }), false);
  assert.equal(validateItem({ ...ok, answer: '' }), false);
  assert.equal(validateItem({ ...ok, why: { en: 'only en' } }), false);
  assert.equal(validateItem({ ...ok, accept: ['other'] }), false, 'accept must include the answer');
  assert.equal(validateItem({ id: 'c', topic: 't', type: 'choice', prompt: { en: 'x', es: 'x' }, answer: 'a', why: { en: 'w', es: 'w' } }), false, 'choice needs distractors');
  assert.equal(validateItem({ id: 'c', topic: 't', type: 'choice', prompt: { en: 'x', es: 'x' }, answer: 'a', distractors: ['b'], why: { en: 'w', es: 'w' } }), true);
});
