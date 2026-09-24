import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderHub, HUB_DEFAULTS } from './hub.js';
import { buildSession } from '../../engine/session.js';
import { newCard } from '../../engine/scheduler.js';

function bil (en, es) { return { en, es }; }

function item(id, topic) {
  return { id, topic, type: 'cloze', prompt: bil(id, id), answer: 'x' };
}

const CONTENT = {
  version: 1,
  module: {
    id: 'tenses', title: bilingual('Tenses', 'Tiempos'), accent: '#6366F1',
    topics: [
      { id: 'present-simple', title: bilingual('Present Simple', 'Presente simple'), explanation: [] },
      { id: 'present-perfect', title: bilingual('Present Perfect', 'Pretérito perfecto'), explanation: [] },
    ],
    items: [
      item('ps-1', 'present-simple'), item('ps-2', 'present-simple'),
      item('pp-1', 'present-perfect'), item('pp-2', 'present-perfect'),
    ],
  },
};

function bilingual(en, es) { return { en, es }; }

// Mastered progress for the two present-simple items (stability >= 21 days).
function masteredProgress() {
  const now = new Date();
  const map = new Map();
  for (const id of ['ps-1', 'ps-2']) {
    map.set(id, { itemId: id, card: { ...newCard(now), stability: 30 }, seen: 6, correct: 6 });
  }
  return map;
}

function ctx(overrides = {}) {
  return {
    content: CONTENT,
    progress: new Map(),
    stats: {},
    onPractice: () => {},
    onOpenTopic: () => {},
    ...overrides,
  };
}

beforeEach(() => installDom());

test('renders a card per topic and the practice CTA sized from buildSession', () => {
  const container = document.createElement('div');
  const c = ctx();
  renderHub(container, c);
  const cards = container.querySelectorAll('[data-topic]');
  assert.equal(cards.length, 2);
  const expectedN = buildSession(CONTENT.module.items, c.progress, HUB_DEFAULTS).length;
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

test('clicking a topic card invokes onOpenTopic with the topic id', () => {
  const container = document.createElement('div');
  let opened = null;
  renderHub(container, ctx({ onOpenTopic: (id) => { opened = id; } }));
  const card = container.querySelector('[data-topic="present-perfect"] button, button[data-topic="present-perfect"]')
    ?? container.querySelector('[data-topic="present-perfect"]');
  card.dispatchEvent(new window.Event('click'));
  assert.equal(opened, 'present-perfect');
});

test('search box filters topic cards by title (EN or ES), case-insensitive', () => {
  const container = document.createElement('div');
  renderHub(container, ctx());
  const search = container.querySelector('[data-role="topic-search"]');
  assert.ok(search, 'has search input');
  search.value = 'perfect';
  search.dispatchEvent(new window.Event('input'));
  assert.ok(isHidden(container.querySelector('[data-topic="present-simple"]')), 'non-match hidden');
  assert.ok(!isHidden(container.querySelector('[data-topic="present-perfect"]')), 'match visible');

  search.value = 'presente'; // ES title
  search.dispatchEvent(new window.Event('input'));
  assert.ok(!isHidden(container.querySelector('[data-topic="present-simple"]')), 'ES match visible');
});

test('a fully-mastered topic shows a 100% progress ring', () => {
  const container = document.createElement('div');
  renderHub(container, ctx({ progress: masteredProgress() }));
  const ring = container.querySelector('[data-topic="present-simple"] .progress-ring');
  assert.ok(ring, 'topic card has a ring');
  assert.match(ring.getAttribute('aria-label'), /100\s*%/);
});

function isHidden(el) {
  return el.hasAttribute('hidden') || /display:\s*none/.test(el.getAttribute('style') ?? '');
}
