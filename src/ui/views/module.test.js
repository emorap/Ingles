import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderModule } from './module.js';
import { newCard } from '../../engine/scheduler.js';

function bil(en, es) { return { en, es }; }
function item(id, topic) { return { id, topic, type: 'cloze', prompt: bil(id, id), answer: 'x' }; }

const moduleContent = {
  version: 1,
  module: {
    id: 'tenses', title: bil('Tense system', 'Sistema de tiempos'), accent: '#6366F1',
    topics: [
      { id: 'present-simple', title: bil('Present Simple', 'Presente simple'), coreIdea: bil('a', 'a'), explanation: [], items: ['ps-1'] },
      { id: 'present-perfect', title: bil('Present Perfect', 'Presente perfecto'), coreIdea: bil('b', 'b'), explanation: [], items: ['pp-1'] },
    ],
    items: [item('ps-1', 'present-simple'), item('pp-1', 'present-perfect')],
  },
};
const entry = { id: 'tenses', order: 1, status: 'available', title: bil('Tense system', 'Sistema de tiempos'), accent: '#6366F1' };

function ctx(overrides = {}) {
  return {
    moduleContent, entry, progress: new Map(), lessonViewed: {},
    onOpenTopic: () => {},
    ...overrides,
  };
}

beforeEach(() => installDom());

test('renderModule lists a row per topic under a module heading', () => {
  const container = document.createElement('div');
  renderModule(container, ctx());
  assert.ok(container.querySelector('[data-view="module"]'), 'module view');
  assert.match(container.textContent, /Sistema de tiempos/);
  assert.equal(container.querySelectorAll('[data-topic]').length, 2);
});

test('clicking a topic row invokes onOpenTopic with the topic id', () => {
  const container = document.createElement('div');
  let opened = null;
  renderModule(container, ctx({ onOpenTopic: (id) => { opened = id; } }));
  const row = container.querySelector('[data-topic="present-perfect"] button')
    ?? container.querySelector('[data-topic="present-perfect"]');
  row.dispatchEvent(new window.Event('click'));
  assert.equal(opened, 'present-perfect');
});

test('each topic row shows its derived status label', () => {
  const container = document.createElement('div');
  const now = new Date();
  const progress = new Map([['pp-1', { itemId: 'pp-1', card: { ...newCard(now), stability: 30 }, seen: 5, correct: 5 }]]);
  // present-simple: lesson viewed, not practiced → Aprendido; present-perfect: all mastered → Dominado
  renderModule(container, ctx({ progress, lessonViewed: { 'present-simple': 1 } }));
  const ps = container.querySelector('[data-topic="present-simple"] [data-status]');
  const pp = container.querySelector('[data-topic="present-perfect"] [data-status]');
  assert.equal(ps.getAttribute('data-status'), 'learned');
  assert.match(ps.textContent, /Aprendido/);
  assert.equal(pp.getAttribute('data-status'), 'mastered');
  assert.match(pp.textContent, /Dominado/);
});

test('an untouched topic shows the "Por aprender" status', () => {
  const container = document.createElement('div');
  renderModule(container, ctx());
  const ps = container.querySelector('[data-topic="present-simple"] [data-status]');
  assert.equal(ps.getAttribute('data-status'), 'todo');
  assert.match(ps.textContent, /Por aprender/);
});
