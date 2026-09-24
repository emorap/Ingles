import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderInsights } from './insights.js';

beforeEach(() => installDom());

const STATS = {
  retention: 0.82,
  mastered: 3,
  seen: 10,
  forecast: [2, 0, 1, 4, 0, 0, 3],
  weakTopics: [
    { topic: 'present-simple', ratio: 0.5 },
    { topic: 'past-simple', ratio: 0.9 },
  ],
};

test('renders retention % and mastered / seen summary', () => {
  const container = document.createElement('div');
  renderInsights(container, { stats: STATS, onFocusWeak: () => {} });
  assert.match(container.querySelector('[data-role="retention"]').textContent, /82\s*%/);
  const mastered = container.querySelector('[data-role="mastered"]').textContent;
  assert.match(mastered, /3/);
  assert.match(mastered, /10/);
});

test('renders a 7-day forecast with one bar per day', () => {
  const container = document.createElement('div');
  renderInsights(container, { stats: STATS, onFocusWeak: () => {} });
  assert.equal(container.querySelectorAll('[data-role="bar"]').length, 7);
});

test('weak topics render a "Reforzar" button that starts a topic-filtered session', () => {
  const container = document.createElement('div');
  let focused = null;
  renderInsights(container, { stats: STATS, onFocusWeak: (t) => { focused = t; } });
  const buttons = container.querySelectorAll('[data-action="reforzar"]');
  assert.equal(buttons.length, 2, 'one Reforzar button per weak topic');
  assert.match(buttons[0].textContent, /Reforzar/);
  buttons[0].dispatchEvent(new window.Event('click'));
  assert.equal(focused, 'present-simple', 'clicking focuses the weakest topic');
});

test('empty state (nothing studied yet) shows a message and no Reforzar buttons', () => {
  const container = document.createElement('div');
  const empty = { retention: 0, mastered: 0, seen: 0, forecast: [0, 0, 0, 0, 0, 0, 0], weakTopics: [] };
  renderInsights(container, { stats: empty, onFocusWeak: () => {} });
  assert.ok(container.querySelector('[data-role="empty"]'), 'shows an empty-state message');
  assert.equal(container.querySelectorAll('[data-action="reforzar"]').length, 0);
});
