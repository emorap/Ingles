import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../test-utils/dom-env.js';
import { mountApp } from './app.js';
import { progressRing } from './components/progress-ring.js';
import { streakChip } from './components/streak-chip.js';

const CONTENT = {
  version: 1,
  module: { id: 'tenses', title: { en: 'Tenses', es: 'Tiempos verbales' }, accent: '#6366F1', topics: [], items: [] },
};

// Minimal in-memory Store double (real DB is exercised in db.test.js).
function fakeStore(meta = {}) {
  const calls = { setMeta: [], open: 0 };
  return {
    calls,
    async open() { calls.open++; },
    async allProgress() { return new Map(); },
    async getMeta(k, d) { return k in meta ? meta[k] : d; },
    async setMeta(k, v) { calls.setMeta.push([k, v]); meta[k] = v; },
  };
}

beforeEach(() => installDom());

test('mountApp renders header, nav landmark, and a routed main#view', async () => {
  const root = document.createElement('div');
  await mountApp(root, CONTENT, fakeStore());
  assert.ok(root.querySelector('header'), 'has header');
  assert.ok(root.querySelector('nav'), 'has nav landmark');
  assert.ok(root.querySelector('main#view'), 'has main#view container');
  assert.match(root.querySelector('header').textContent, /Tiempos verbales/);
});

test('mountApp opens the store and applies the persisted theme', async () => {
  const root = document.createElement('div');
  const store = fakeStore({ theme: 'light' });
  await mountApp(root, CONTENT, store);
  assert.equal(store.calls.open, 1);
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});

test('mountApp defaults to dark theme when none persisted', async () => {
  const root = document.createElement('div');
  await mountApp(root, CONTENT, fakeStore());
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('theme toggle flips data-theme and persists it', async () => {
  const root = document.createElement('div');
  const store = fakeStore({ theme: 'dark' });
  await mountApp(root, CONTENT, store);
  const toggle = root.querySelector('[data-action="toggle-theme"]');
  assert.ok(toggle, 'has a theme toggle');
  toggle.dispatchEvent(new window.Event('click'));
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.deepEqual(store.calls.setMeta.at(-1), ['theme', 'light']);
});

test('mountApp themes the app with the module accent', async () => {
  const root = document.createElement('div');
  await mountApp(root, CONTENT, fakeStore());
  assert.equal(document.documentElement.style.getPropertyValue('--color-primary'), '#6366F1');
});

test('progressRing renders an accessible SVG whose ring encodes the percent', () => {
  const svg = progressRing(75, '#10B981');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.match(svg.getAttribute('aria-label'), /75\s*%/);
  const arc = svg.querySelector('.ring-value');
  assert.ok(arc, 'has a value arc');
  assert.equal(arc.getAttribute('stroke'), '#10B981');
  // 0% and 100% must produce different dash offsets (the ring actually moves).
  assert.notEqual(
    progressRing(0, '#10B981').querySelector('.ring-value').getAttribute('stroke-dashoffset'),
    progressRing(100, '#10B981').querySelector('.ring-value').getAttribute('stroke-dashoffset'),
  );
});

test('streakChip shows the day count and is labelled', () => {
  const chip = streakChip(5);
  assert.match(chip.textContent, /5/);
  assert.match(chip.getAttribute('aria-label') ?? '', /racha|5/i);
});
