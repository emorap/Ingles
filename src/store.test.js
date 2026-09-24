import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './test-utils/dom-env.js';
import { createStore } from './store.js';
import { onRoute, go } from './router.js';

test('store: set patches state and notifies subscribers with the new state', () => {
  const s = createStore({ n: 0, name: 'a' });
  const seen = [];
  s.subscribe((state) => seen.push(state));
  s.set({ n: 1 });
  assert.equal(s.get().n, 1);
  assert.equal(s.get().name, 'a'); // patch merges, does not replace
  assert.deepEqual(seen, [{ n: 1, name: 'a' }]);
});

test('store: subscribe returns an unsubscribe that stops further notifications', () => {
  const s = createStore({ n: 0 });
  let calls = 0;
  const off = s.subscribe(() => { calls++; });
  s.set({ n: 1 });
  off();
  s.set({ n: 2 });
  assert.equal(calls, 1);
  assert.equal(s.get().n, 2);
});

test('router: onRoute fires immediately with the current route (hub by default)', () => {
  installDom();
  const routes = [];
  onRoute((r) => routes.push(r));
  assert.deepEqual(routes, [{ view: 'hub', param: undefined }]);
});

test('router: onRoute parses #/view/param on hashchange', () => {
  installDom();
  const routes = [];
  onRoute((r) => routes.push(r));
  location.hash = '#/practice/tenses';
  assert.deepEqual(routes.at(-1), { view: 'practice', param: 'tenses' });
});

test('router: go() sets the hash and drives onRoute', () => {
  installDom();
  const routes = [];
  onRoute((r) => routes.push(r));
  go('insights');
  assert.equal(location.hash, '#/insights');
  assert.deepEqual(routes.at(-1), { view: 'insights', param: undefined });
  go('practice', 'present-simple');
  assert.equal(location.hash, '#/practice/present-simple');
  assert.deepEqual(routes.at(-1), { view: 'practice', param: 'present-simple' });
});
