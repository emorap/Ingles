// Content guard: "ni práctica sin concepto, ni concepto sin práctica."
// Reads the real content files from disk (content/index.json + each available
// module) and enforces the learn-first contract on every shipped topic. The
// present-tense corpus already complies; this guard is what protects the Past,
// Future and future modules from ever shipping a topic with no lesson or no
// practice. Lives under src/ so the `src/**/*.test.js` glob runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './catalog.js';
import { validateContent } from './schema.js';

const read = (f) => JSON.parse(readFileSync(fileURLToPath(new URL('../../content/' + f, import.meta.url)), 'utf8'));
const manifest = read('index.json');
const available = manifest.modules.filter((m) => m.status === 'available');

test('manifest is valid', () => {
  assert.equal(validateManifest(manifest).ok, true, JSON.stringify(validateManifest(manifest).errors));
});

test('every available topic has a concept AND practice', () => {
  const seenItemIds = new Set();
  for (const entry of available) {
    const data = read(entry.file);
    const res = validateContent(data);
    assert.equal(res.ok, true, `${entry.file} schema: ${JSON.stringify(res.errors)}`);
    const items = data.module.items;
    for (const t of data.module.topics) {
      // Concept side of the contract.
      assert.ok(t.coreIdea?.en && t.coreIdea?.es, `${t.id}: coreIdea must be bilingual`);
      assert.ok((t.explanation ?? []).length >= 1, `${t.id}: needs at least one explanation block`);
      assert.ok((t.examples ?? []).length >= 1, `${t.id}: needs at least one example`);
      // Practice side of the contract.
      assert.ok(items.some((i) => i.topic === t.id), `${t.id}: needs at least one practice item`);
    }
    // Item ids unique across the whole corpus (AI-generated items key off these).
    for (const it of items) {
      assert.equal(seenItemIds.has(it.id), false, `duplicate item id across corpus: ${it.id}`);
      seenItemIds.add(it.id);
    }
  }
});

// A module with many topics must split them into families so the module view is
// navigable (Presente · Pasado · Futuro), not one long undifferentiated pile —
// the "todo mezclado" complaint. Small modules may stay flat.
const GROUP_THRESHOLD = 6;

test('a module with many topics groups them into families', () => {
  for (const entry of available) {
    const data = read(entry.file);
    const topics = data.module.topics;
    if (topics.length <= GROUP_THRESHOLD) continue;
    const groups = data.module.groups ?? [];
    assert.ok(groups.length >= 2, `${entry.file}: ${topics.length} topics must declare groups (found ${groups.length})`);
    const groupIds = new Set(groups.map((g) => g.id));
    for (const t of topics) {
      assert.ok(groupIds.has(t.group), `${t.id}: must belong to a declared family (group='${t.group}')`);
    }
  }
});

test('every related link resolves to a topic in the same module', () => {
  for (const entry of available) {
    const data = read(entry.file);
    const topicIds = new Set(data.module.topics.map((t) => t.id));
    for (const t of data.module.topics) {
      for (const ref of t.related ?? []) {
        assert.equal(topicIds.has(ref), true, `${t.id}: dangling related '${ref}' in ${entry.file}`);
      }
    }
  }
});
