import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderPractice } from './practice.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

const CLOZE = {
  id: 'c1', topic: 't', type: 'cloze',
  prompt: { en: 'Water ___ (boil) at 100.', es: 'El agua ___ (boil) a 100.' },
  answer: 'boils', accept: ['boils'],
  why: { en: 'Third person adds -s.', es: 'La tercera persona añade -s.' },
};
const CHOICE = {
  id: 'c2', topic: 't', type: 'choice',
  prompt: { en: 'He ___ in London.', es: 'Él ___ en Londres.' },
  answer: 'lives', distractors: ['is living'],
  why: { en: 'Stable truth.', es: 'Verdad estable.' },
};

function fakeStore() {
  const puts = [];
  return { puts, async putProgress(rec) { puts.push(rec); } };
}

beforeEach(() => installDom());
afterEach(() => { delete globalThis.fetch; });

async function type(container, value) {
  const input = container.querySelector('[data-role="answer-input"]');
  input.value = value;
  container.querySelector('[data-action="check"]').dispatchEvent(new window.Event('click'));
  await tick();
}

test('cloze: correct answer reveals why + 4 ratings; rating Good persists updated card', async () => {
  const container = document.createElement('div');
  const store = fakeStore();
  renderPractice(container, { items: [CLOZE], progress: new Map(), store, onDone: () => {}, now: new Date() });

  await type(container, 'boils');
  assert.match(container.textContent, /La tercera persona añade -s\./, 'why (ES) shown');
  assert.equal(container.querySelectorAll('[data-rating]').length, 4, '4 rating buttons');

  container.querySelector('[data-rating="good"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(store.puts.length, 1);
  const rec = store.puts[0];
  assert.equal(rec.itemId, 'c1');
  assert.equal(rec.seen, 1);
  assert.equal(rec.correct, 1);
  assert.ok(rec.card, 'updated card persisted');
});

test('cloze: wrong answer reveals the correct answer and rating Again records correct=0', async () => {
  const container = document.createElement('div');
  const store = fakeStore();
  renderPractice(container, { items: [CLOZE], progress: new Map(), store, onDone: () => {}, now: new Date() });

  await type(container, 'boil');
  const feedback = container.querySelector('[data-role="feedback"]');
  assert.match(feedback.textContent, /boils/, 'reveals correct answer');

  container.querySelector('[data-rating="again"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(store.puts[0].correct, 0);
  assert.equal(store.puts[0].seen, 1);
});

test('choice: renders a button per option (answer + distractors); correct choice reveals why', async () => {
  const container = document.createElement('div');
  renderPractice(container, { items: [CHOICE], progress: new Map(), store: fakeStore(), onDone: () => {}, now: new Date() });

  const choices = container.querySelectorAll('[data-role="choice"]');
  assert.equal(choices.length, 2);
  const correct = [...choices].find((b) => b.textContent.trim() === 'lives');
  correct.dispatchEvent(new window.Event('click'));
  await tick();
  assert.match(container.textContent, /Verdad estable\./);
});

test('keyboard 1–4 rate the revealed card (3 = Good)', async () => {
  const container = document.createElement('div');
  const store = fakeStore();
  renderPractice(container, { items: [CLOZE], progress: new Map(), store, onDone: () => {}, now: new Date() });
  await type(container, 'boils');

  const e = new window.Event('keydown');
  e.key = '3';
  window.dispatchEvent(e);
  await tick();
  assert.equal(store.puts.length, 1, 'keyboard rated the card');
});

test('session completion calls onDone after the last item is rated', async () => {
  const container = document.createElement('div');
  let done = 0;
  renderPractice(container, { items: [CLOZE], progress: new Map(), store: fakeStore(), onDone: () => { done++; }, now: new Date() });
  await type(container, 'boils');
  container.querySelector('[data-rating="good"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(done, 1);
});

test('offline (Review Focus #2): a full cycle never touches the network', async () => {
  globalThis.fetch = () => { throw new Error('network call during practice!'); };
  const container = document.createElement('div');
  const store = fakeStore();
  renderPractice(container, { items: [CLOZE], progress: new Map(), store, onDone: () => {}, now: new Date() });
  await type(container, 'boils');
  container.querySelector('[data-rating="good"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(store.puts.length, 1); // completed without invoking fetch
});
