#!/usr/bin/env node
// CI content check: validate every content/*.json against the SAME validator
// the app uses (src/engine/schema.js), so authoring errors fail fast. Exits
// non-zero on any invalid file.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { validateContent } from '../src/engine/schema.js';

const dir = 'content';
if (!existsSync(dir)) {
  console.error('no content/ directory');
  process.exit(1);
}
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error('no content/*.json files');
  process.exit(1);
}
let bad = 0;
for (const f of files) {
  const r = validateContent(JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
  if (!r.ok) {
    bad++;
    console.error('✗', f, r.errors);
  } else {
    console.log('✓', f, `(${r.content.module.items.length} items, ${r.content.module.topics.length} topics)`);
  }
}
process.exit(bad ? 1 : 0);
