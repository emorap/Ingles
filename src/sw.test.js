// Guard for the service-worker precache manifest. boot() (main.js) loads the
// catalog via loadCatalog, which fetches content/index.json FIRST and throws
// if the manifest is unreadable — so index.json is a hard offline dependency.
// The multi-module refactor made it load-bearing but left it out of SHELL,
// which precaches only tenses.json. A returning user reloading offline would
// then miss the manifest and land on the error screen. This test pins every
// file boot hard-depends on into the precache list. sw.js references `self`,
// so we read its source and extract the SHELL literal rather than import it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// sw.js lives at the repo root (registered from there), one level up from src/.
const src = readFileSync(fileURLToPath(new URL('../sw.js', import.meta.url)), 'utf8');

function shellList() {
  const m = src.match(/const SHELL = (\[[\s\S]*?\]);/);
  assert.ok(m, 'sw.js must define a SHELL precache array');
  // JS array literal (single quotes + trailing comma) -> JSON.
  const json = m[1].replace(/'/g, '"').replace(/,(\s*])/g, '$1');
  return JSON.parse(json);
}

test('service worker precaches every file boot hard-depends on', () => {
  const shell = shellList();
  // loadCatalog fetches the manifest first and boot throws if it is missing,
  // so the manifest must be cached for offline returning users.
  assert.ok(shell.includes('./content/index.json'), 'SHELL must precache content/index.json (the manifest)');
  // The one available module and the entry module must also be cached offline.
  assert.ok(shell.includes('./content/tenses.json'), 'SHELL must precache the tenses module');
  assert.ok(shell.includes('./src/main.js'), 'SHELL must precache the entry module');
});
