// Guard for the portable single-file build. The whole point of momentum.html
// is that ONE file runs offline from file:// or a share, with no adjacent
// content/ folder and no server. That only holds if the build inlines the
// content the app fetches at runtime. When main.js moved from a direct
// `fetch('./content/tenses.json')` to `loadCatalog((u) => fetch(u))`, the
// build's string-replace silently became a no-op and the single file started
// depending on ./content/ again. This test decodes the inlined entry module
// and fails if the live catalog fetch survives or the module content is not
// embedded — so that regression can never ship silently again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PY = process.env.PYTHON || 'python3';

/** Build the single file and return the decoded source of the entry module. */
function buildAndReadEntrySource() {
  execFileSync(PY, ['scripts/build_singlefile.py'], { cwd: ROOT, stdio: 'pipe' });
  const html = readFileSync(new URL('../momentum.html', import.meta.url), 'utf8');
  const mapMatch = html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(mapMatch, 'built file must contain an importmap');
  const importmap = JSON.parse(mapMatch[1]);
  const entryUrl = importmap.imports['src/main.js'];
  assert.ok(entryUrl, 'entry module src/main.js must be in the importmap');
  const b64 = entryUrl.split(',')[1];
  return Buffer.from(b64, 'base64').toString('utf8');
}

test('single-file build inlines the catalog so it runs with no ./content/ fetch', () => {
  const entrySrc = buildAndReadEntrySource();
  // The live catalog fetchFn must be gone — replaced by an inlined resolver.
  assert.ok(
    !entrySrc.includes('(u) => fetch(u)'),
    'build must replace the live catalog fetchFn; the single file cannot depend on ./content/',
  );
  // The actual module content (not just the manifest) must be embedded, so the
  // file is self-contained when shared with no adjacent content/ folder.
  assert.ok(
    entrySrc.includes('future-perfect-continuous'),
    'the tenses module content must be inlined into the entry module',
  );
});
