import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { maybeOnboard, finishOnboarding, renderOnboarding } from './onboarding.js';

function fakeStore() {
  const m = new Map();
  return {
    async getMeta(k, def) { return m.has(k) ? m.get(k) : def; },
    async setMeta(k, v) { m.set(k, v); },
  };
}

beforeEach(() => installDom());

test('maybeOnboard: true until onboarding is finished', async () => {
  const s = fakeStore();
  assert.equal(await maybeOnboard(s), true);
  await finishOnboarding(s, { newPerDay: 10 });
  assert.equal(await maybeOnboard(s), false);
});

test('finishOnboarding persists the onboarded flag and the daily goal', async () => {
  const s = fakeStore();
  await finishOnboarding(s, { newPerDay: 5 });
  assert.equal(await s.getMeta('onboarded', false), true);
  assert.equal(await s.getMeta('newPerDay', null), 5);
});

test('renders 3 slides including the "cuesta = aprende" idea', () => {
  const container = document.createElement('div');
  renderOnboarding(container, () => {});
  assert.equal(container.querySelectorAll('[data-role="slide"]').length, 3);
  assert.match(container.textContent, /Cuesta = aprende/);
});

test('advancing through all slides finishes with the default daily goal', () => {
  const container = document.createElement('div');
  let result = null;
  renderOnboarding(container, (r) => { result = r; });
  const advance = container.querySelector('[data-role="advance"]');
  advance.dispatchEvent(new window.Event('click')); // → slide 2
  advance.dispatchEvent(new window.Event('click')); // → slide 3
  advance.dispatchEvent(new window.Event('click')); // Empezar
  assert.deepEqual(result, { newPerDay: 10 });
});

test('choosing a different daily goal is reflected in onDone', () => {
  const container = document.createElement('div');
  let result = null;
  renderOnboarding(container, (r) => { result = r; });
  const advance = container.querySelector('[data-role="advance"]');
  advance.dispatchEvent(new window.Event('click'));
  advance.dispatchEvent(new window.Event('click'));
  const goal15 = [...container.querySelectorAll('[data-role="goal"]')].find((b) => b.getAttribute('data-value') === '15');
  goal15.dispatchEvent(new window.Event('click'));
  advance.dispatchEvent(new window.Event('click'));
  assert.deepEqual(result, { newPerDay: 15 });
});
