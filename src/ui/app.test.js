import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../test-utils/dom-env.js';
import { mountApp, renderRoute } from './app.js';
import { progressRing } from './components/progress-ring.js';
import { streakChip } from './components/streak-chip.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

const CONTENT = {
  version: 1,
  module: { id: 'tenses', title: { en: 'Tenses', es: 'Tiempos verbales' }, accent: '#6366F1', topics: [], items: [] },
};

/** Wrap one content file in a single-available-module catalog for the shell. */
function catalogOf(content, id = 'tenses') {
  return {
    manifest: [{ id, order: 1, status: 'available', file: `${id}.json`, title: content.module.title, accent: content.module.accent }],
    modules: new Map([[id, content]]),
  };
}

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
  await mountApp(root, catalogOf(CONTENT), fakeStore());
  assert.ok(root.querySelector('header'), 'has header');
  assert.ok(root.querySelector('nav'), 'has nav landmark');
  assert.ok(root.querySelector('main#view'), 'has main#view container');
  assert.match(root.querySelector('header').textContent, /Momentum/);
});

test('mountApp opens the store and applies the persisted theme', async () => {
  const root = document.createElement('div');
  const store = fakeStore({ theme: 'light' });
  await mountApp(root, catalogOf(CONTENT), store);
  assert.equal(store.calls.open, 1);
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});

test('mountApp defaults to dark theme when none persisted', async () => {
  const root = document.createElement('div');
  await mountApp(root, catalogOf(CONTENT), fakeStore());
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('theme toggle flips data-theme and persists it', async () => {
  const root = document.createElement('div');
  const store = fakeStore({ theme: 'dark' });
  await mountApp(root, catalogOf(CONTENT), store);
  const toggle = root.querySelector('[data-action="toggle-theme"]');
  assert.ok(toggle, 'has a theme toggle');
  toggle.dispatchEvent(new window.Event('click'));
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.deepEqual(store.calls.setMeta.at(-1), ['theme', 'light']);
});

test('mountApp themes the app with the module accent', async () => {
  const root = document.createElement('div');
  await mountApp(root, catalogOf(CONTENT), fakeStore());
  assert.equal(document.documentElement.style.getPropertyValue('--color-primary'), '#6366F1');
});

// --- Task 21: routed view dispatch + composition wiring ---

const ITEM = {
  id: 'i1', topic: 'pt', type: 'cloze',
  prompt: { en: 'He ___ (go) home.', es: 'Él ___ (go) a casa.' },
  answer: 'goes', accept: ['goes'],
  why: { en: 'Third person adds -s.', es: 'La tercera persona añade -s.' },
};
const CONTENT2 = {
  version: 1,
  module: {
    id: 'tenses', title: { en: 'Tenses', es: 'Tiempos verbales' }, accent: '#6366F1',
    topics: [{ id: 'pt', title: { en: 'Present Simple', es: 'Presente simple' } }],
    items: [ITEM],
  },
};

function richStore(meta = {}) {
  const puts = [];
  return {
    meta, puts,
    async open() {},
    async allProgress() { return new Map(); },
    async putProgress(rec) { puts.push(rec); },
    async getMeta(k, d) { return k in meta ? meta[k] : d; },
    async setMeta(k, v) { meta[k] = v; },
  };
}

function baseDeps(store, over = {}) {
  return {
    catalog: catalogOf(CONTENT2), store, progress: new Map(),
    newPerDay: 10, cap: 20, voice: '',
    navigate: () => {}, now: new Date('2026-09-23T10:00:00'),
    ...over,
  };
}

test('renderRoute: hub shows the "practice today" CTA', async () => {
  const view = document.createElement('main');
  await renderRoute(view, { view: 'hub' }, baseDeps(richStore()));
  assert.ok(view.querySelector('[data-view="hub"]'), 'hub view');
  assert.ok(view.querySelector('[data-action="practice"]'), 'practice CTA');
});

test('renderRoute: topic renders the selected topic', async () => {
  const view = document.createElement('main');
  await renderRoute(view, { view: 'topic', param: 'pt' }, baseDeps(richStore()));
  assert.ok(view.querySelector('[data-view="topic"]'), 'topic view');
  assert.match(view.textContent, /Presente simple/);
});

test('renderRoute: a topic id that does not exist redirects to the hub', async () => {
  const view = document.createElement('main');
  let nav = null;
  await renderRoute(view, { view: 'topic', param: 'ghost' }, baseDeps(richStore(), {
    navigate: (v) => { nav = v; },
  }));
  assert.equal(nav, 'hub');
});

test('renderRoute: insights renders the progress view', async () => {
  const view = document.createElement('main');
  await renderRoute(view, { view: 'insights' }, baseDeps(richStore()));
  assert.ok(view.querySelector('[data-view="insights"]'), 'insights view');
});

test('renderRoute: settings renders controls and persists a changed setting', async () => {
  const view = document.createElement('main');
  const store = richStore({ theme: 'dark' });
  await renderRoute(view, { view: 'settings' }, baseDeps(store));
  assert.ok(view.querySelector('[data-action="export"]'), 'export button');
  assert.ok(view.querySelector('[data-role="ai-key"]'), 'AI key input');
  const light = [...view.querySelectorAll('[data-role="theme"] [data-value]')]
    .find((b) => b.getAttribute('data-value') === 'light');
  light.dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(store.meta.theme, 'light');
});

test('renderRoute: a wrong practice answer is logged as a mistake', async () => {
  const view = document.createElement('main');
  const store = richStore();
  await renderRoute(view, { view: 'practice' }, baseDeps(store));
  const input = view.querySelector('[data-role="answer-input"]');
  input.value = 'go';
  view.querySelector('[data-action="check"]').dispatchEvent(new window.Event('click'));
  await tick();
  view.querySelector('[data-rating="again"]').dispatchEvent(new window.Event('click'));
  await tick(); await tick();
  assert.ok(Array.isArray(store.meta.mistakes), 'mistakes logged');
  assert.equal(store.meta.mistakes.length, 1);
  assert.equal(store.meta.mistakes[0].itemId, 'i1');
});

test('renderRoute: insights "Reforzar" navigates to that topic\'s practice', async () => {
  const view = document.createElement('main');
  const progress = new Map([['i1', {
    itemId: 'i1', card: { stability: 1, due: new Date('2026-09-23T10:00:00').toISOString() }, seen: 2, correct: 0,
  }]]);
  let nav = null;
  await renderRoute(view, { view: 'insights' }, baseDeps(richStore(), {
    progress, navigate: (v, p) => { nav = { v, p }; },
  }));
  const btn = view.querySelector('[data-action="reforzar"]');
  assert.ok(btn, 'a weak topic with a Reforzar button');
  btn.dispatchEvent(new window.Event('click'));
  assert.deepEqual(nav, { v: 'practice', p: 'pt' });
});

test('mountApp shows onboarding on first run and finishing it records the goal', async () => {
  const root = document.createElement('div');
  const store = richStore(); // no 'onboarded' meta → first run
  await mountApp(root, catalogOf(CONTENT2), store);
  const view = root.querySelector('main#view');
  assert.ok(view.querySelector('[data-view="onboarding"]'), 'onboarding shown first');
  const advance = view.querySelector('[data-role="advance"]');
  advance.dispatchEvent(new window.Event('click')); // → slide 2
  advance.dispatchEvent(new window.Event('click')); // → slide 3
  advance.dispatchEvent(new window.Event('click')); // → Empezar
  await tick(); await tick();
  assert.equal(store.meta.onboarded, true);
  assert.equal(typeof store.meta.newPerDay, 'number');
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
