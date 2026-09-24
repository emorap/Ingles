import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, loadCatalog, allItems, allTopics, findTopic } from './catalog.js';

const manifest = {
  version: 1,
  modules: [
    { id: 'tenses', order: 1, status: 'available', file: 'tenses.json', title: { en: 'Tenses', es: 'Tiempos' }, accent: '#6366F1' },
    { id: 'conditionals', order: 2, status: 'coming-soon', file: 'conditionals.json', title: { en: 'Conditionals', es: 'Condicionales' }, accent: '#8B5CF6' },
  ],
};
const tenses = {
  version: 1,
  module: {
    id: 'tenses', accent: '#6366F1',
    topics: [{ id: 'present-simple', title: { en: 'PS', es: 'PS' }, coreIdea: { en: 'x', es: 'x' }, items: ['a'] }],
    items: [{ id: 'a', topic: 'present-simple', type: 'choice', answer: 'x', why: { en: 'w', es: 'w' }, distractors: ['y'] }],
  },
};

/** Build a fake fetch over a { url-suffix: payload } map. */
function fakeFetch(map) {
  return async (url) => {
    for (const [suffix, payload] of Object.entries(map)) {
      if (url.endsWith(suffix)) return { ok: true, json: async () => payload };
    }
    return { ok: false, json: async () => ({}) };
  };
}

test('validateManifest rejects a non-permutation order and a bad status', () => {
  assert.equal(validateManifest({ version: 1, modules: [{ id: 'a', order: 2, status: 'available', file: 'a.json', title: { en: 'A', es: 'A' }, accent: '#6366F1' }] }).ok, false);
  assert.equal(validateManifest({ version: 1, modules: [{ id: 'a', order: 1, status: 'nope', file: 'a.json', title: { en: 'A', es: 'A' }, accent: '#6366F1' }] }).ok, false);
  assert.equal(validateManifest({ version: 1, modules: [] }).ok, false);
  assert.equal(validateManifest(manifest).ok, true);
});

test('validateManifest rejects duplicate module ids and bad accents', () => {
  const dup = { version: 1, modules: [
    { id: 'a', order: 1, status: 'available', file: 'a.json', title: { en: 'A', es: 'A' }, accent: '#6366F1' },
    { id: 'a', order: 2, status: 'available', file: 'b.json', title: { en: 'B', es: 'B' }, accent: '#6366F1' },
  ] };
  assert.equal(validateManifest(dup).ok, false);
  const badAccent = structuredClone(manifest);
  badAccent.modules[0].accent = 'indigo';
  assert.equal(validateManifest(badAccent).ok, false);
});

test('loadCatalog loads available modules and never fetches coming-soon', async () => {
  const cat = await loadCatalog(fakeFetch({ 'index.json': manifest, 'tenses.json': tenses }));
  assert.ok(cat.modules.has('tenses'));
  assert.equal(cat.modules.has('conditionals'), false); // coming-soon: never fetched
  assert.equal(cat.manifest.length, 2);                 // full roadmap still known
  assert.equal(allItems(cat).length, 1);
  assert.equal(allTopics(cat).length, 1);
  const found = findTopic(cat, 'present-simple');
  assert.equal(found.moduleId, 'tenses');
  assert.equal(findTopic(cat, 'nope'), null);
});

test('loadCatalog degrades: a broken available module is skipped, app still boots', async () => {
  const bad = { version: 1, modules: [{ id: 'tenses', order: 1, status: 'available', file: 'tenses.json', title: { en: 'T', es: 'T' }, accent: '#6366F1' }] };
  // index resolves, but the module file fetch fails.
  const cat = await loadCatalog(fakeFetch({ 'index.json': bad }));
  assert.equal(cat.modules.size, 0);    // skipped, not thrown
  assert.equal(cat.manifest.length, 1); // roadmap preserved
});

test('loadCatalog throws only when the manifest itself is invalid', async () => {
  await assert.rejects(() => loadCatalog(fakeFetch({ 'index.json': { version: 1, modules: [] } })));
});
