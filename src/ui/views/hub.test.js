import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderHub, HUB_DEFAULTS } from './hub.js';
import { buildSession } from '../../engine/session.js';
import { newCard } from '../../engine/scheduler.js';
import { allItems } from '../../engine/catalog.js';

function bil(en, es) { return { en, es }; }
function item(id, topic) { return { id, topic, type: 'cloze', prompt: bil(id, id), answer: 'x' }; }

const tenses = {
  version: 1,
  module: {
    id: 'tenses', title: bil('Tenses', 'Tiempos'), accent: '#6366F1',
    topics: [
      { id: 'present-simple', title: bil('Present Simple', 'Presente simple'), coreIdea: bil('a', 'a'), explanation: [] },
      { id: 'present-perfect', title: bil('Present Perfect', 'Pretérito perfecto'), coreIdea: bil('b', 'b'), explanation: [] },
    ],
    items: [
      item('ps-1', 'present-simple'), item('ps-2', 'present-simple'),
      item('pp-1', 'present-perfect'), item('pp-2', 'present-perfect'),
    ],
  },
};

const catalog = {
  manifest: [
    { id: 'tenses', order: 1, status: 'available', file: 'tenses.json', title: bil('Tenses', 'Tiempos'), accent: '#6366F1' },
    { id: 'conditionals', order: 2, status: 'coming-soon', file: 'conditionals.json', title: bil('Conditionals', 'Condicionales'), accent: '#8B5CF6' },
  ],
  modules: new Map([['tenses', tenses]]),
};

// All four tenses items mastered (stability >= 21).
function masteredAll() {
  const now = new Date();
  const map = new Map();
  for (const id of ['ps-1', 'ps-2', 'pp-1', 'pp-2']) {
    map.set(id, { itemId: id, card: { ...newCard(now), stability: 30 }, seen: 6, correct: 6 });
  }
  return map;
}

function ctx(overrides = {}) {
  return {
    catalog,
    progress: new Map(),
    onPractice: () => {},
    onOpenModule: () => {},
    ...overrides,
  };
}

beforeEach(() => installDom());

test('renders a card per manifest module and a practice CTA sized from buildSession over all items', () => {
  const container = document.createElement('div');
  const c = ctx();
  renderHub(container, c);
  const cards = container.querySelectorAll('[data-module]');
  assert.equal(cards.length, 2);
  const expectedN = buildSession(allItems(catalog), c.progress, HUB_DEFAULTS).length;
  const cta = container.querySelector('[data-action="practice"]');
  assert.ok(cta, 'has practice CTA');
  assert.match(cta.textContent, new RegExp(`Practicar lo de hoy \\(${expectedN} · ~\\d+ min\\)`));
});

test('practice CTA click invokes onPractice', () => {
  const container = document.createElement('div');
  let called = 0;
  renderHub(container, ctx({ onPractice: () => { called++; } }));
  container.querySelector('[data-action="practice"]').dispatchEvent(new window.Event('click'));
  assert.equal(called, 1);
});

test('clicking an available module card invokes onOpenModule with the module id', () => {
  const container = document.createElement('div');
  let opened = null;
  renderHub(container, ctx({ onOpenModule: (id) => { opened = id; } }));
  const btn = container.querySelector('[data-module="tenses"] button');
  assert.ok(btn, 'available module is a button');
  btn.dispatchEvent(new window.Event('click'));
  assert.equal(opened, 'tenses');
});

test('a coming-soon module is labelled "Próximamente" and is not clickable', () => {
  const container = document.createElement('div');
  let opened = null;
  renderHub(container, ctx({ onOpenModule: (id) => { opened = id; } }));
  const card = container.querySelector('[data-module="conditionals"]');
  assert.equal(card.getAttribute('data-status'), 'coming-soon');
  assert.match(card.textContent, /Próximamente/);
  assert.equal(card.querySelector('button'), null, 'coming-soon has no button');
  card.dispatchEvent(new window.Event('click'));
  assert.equal(opened, null, 'clicking a coming-soon card does nothing');
});

test('search filters module cards by module title or a contained topic title', () => {
  const container = document.createElement('div');
  renderHub(container, ctx());
  const search = container.querySelector('[data-role="topic-search"]');
  assert.ok(search, 'has search input');
  search.value = 'perfect'; // a topic inside Tiempos, not in Condicionales
  search.dispatchEvent(new window.Event('input'));
  assert.ok(!isHidden(container.querySelector('[data-module="tenses"]')), 'module with matching topic visible');
  assert.ok(isHidden(container.querySelector('[data-module="conditionals"]')), 'non-match hidden');

  search.value = 'condicion'; // ES module title
  search.dispatchEvent(new window.Event('input'));
  assert.ok(!isHidden(container.querySelector('[data-module="conditionals"]')), 'ES module title match visible');
});

test('a fully-mastered module shows a 100% progress ring', () => {
  const container = document.createElement('div');
  renderHub(container, ctx({ progress: masteredAll() }));
  const ring = container.querySelector('[data-module="tenses"] .progress-ring');
  assert.ok(ring, 'available module card has a ring');
  assert.match(ring.getAttribute('aria-label'), /100\s*%/);
});

test('the first available not-mastered module is marked as the suggested next step', () => {
  const container = document.createElement('div');
  renderHub(container, ctx()); // empty progress → tenses not mastered
  assert.equal(container.querySelector('[data-module="tenses"]').getAttribute('data-next'), 'true');
  // a mastered tenses is no longer the suggested next
  const c2 = document.createElement('div');
  renderHub(c2, ctx({ progress: masteredAll() }));
  assert.notEqual(c2.querySelector('[data-module="tenses"]').getAttribute('data-next'), 'true');
});

function isHidden(el) {
  return el.hasAttribute('hidden') || /display:\s*none/.test(el.getAttribute('style') ?? '');
}
