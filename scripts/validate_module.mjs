#!/usr/bin/env node
// Dev helper: validate ONE content module file against Momentum's schema and
// the learn-first content guard (mirrors src/engine/content.test.js, but scoped
// to a single file so it can run before the module is added to the manifest).
// Usage: node scripts/validate_module.mjs content/<module>.json
// Prints {ok, topics, items, errors} as JSON; exits 0 when ok, 1 otherwise.
import { readFileSync } from 'node:fs';
import { validateContent } from '../src/engine/schema.js';

const file = process.argv[2];
if (!file) { console.error('usage: validate_module.mjs <file>'); process.exit(2); }

const errors = [];
let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.log(JSON.stringify({ ok: false, errors: ['invalid JSON: ' + e.message] }));
  process.exit(1);
}

const res = validateContent(data);
if (!res.ok) errors.push(...res.errors);

const m = data.module ?? {};
const topics = m.topics ?? [];
const items = m.items ?? [];

const itemIds = new Set();
for (const it of items) {
  if (itemIds.has(it.id)) errors.push(`duplicate item id ${it.id}`);
  itemIds.add(it.id);
}

const topicIds = new Set(topics.map((t) => t.id));
for (const t of topics) {
  if (!(t.coreIdea?.en && t.coreIdea?.es)) errors.push(`${t.id}: coreIdea must be bilingual`);
  if ((t.explanation ?? []).length < 1) errors.push(`${t.id}: needs >=1 explanation block`);
  if ((t.examples ?? []).length < 1) errors.push(`${t.id}: needs >=1 example`);
  if (!items.some((i) => i.topic === t.id)) errors.push(`${t.id}: needs >=1 practice item`);
  for (const r of (t.related ?? [])) if (!topicIds.has(r)) errors.push(`${t.id}: dangling related '${r}'`);
}

// Big modules must be split into families so the module view is navigable.
if (topics.length > 6) {
  const groups = m.groups ?? [];
  if (groups.length < 2) errors.push(`${topics.length} topics but <2 families declared`);
  const gids = new Set(groups.map((g) => g.id));
  for (const t of topics) if (!gids.has(t.group)) errors.push(`${t.id}: group '${t.group}' not declared`);
}

const ok = errors.length === 0;
console.log(JSON.stringify({ ok, topics: topics.length, items: items.length, errors }, null, 2));
process.exit(ok ? 0 : 1);
