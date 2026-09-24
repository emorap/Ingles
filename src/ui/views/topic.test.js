import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { audioButton } from '../components/audio-button.js';
import { bilingualCallout } from '../components/bilingual-callout.js';
import { renderTopic } from './topic.js';

function stubSynth() {
  const calls = { speak: [] };
  globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak: (u) => calls.speak.push(u) };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.voice = null; } };
  return calls;
}

const TOPIC = {
  id: 'present-simple',
  title: { en: 'Present Simple', es: 'Presente simple' },
  source: 'p.3',
  explanation: [
    { kind: 'p', text: { en: 'It describes general truths.', es: 'Describe verdades generales.' } },
    { kind: 'callout', text: { en: 'Ask: is this your normal reality?', es: '¿Es tu realidad normal?' } },
  ],
  examples: [
    { en: 'I work here.', es: 'Trabajo aquí.' },
    { en: 'Water boils at 100.', es: 'El agua hierve a 100.' },
  ],
  related: ['present-continuous'],
  items: ['ps-1'],
  diagrams: ['content/assets/ps-1.png'],
  audio: { voice: 'Daniel' },
};

beforeEach(() => installDom());
afterEach(() => { delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; });

test('audioButton: visible and speaks on click when TTS is available', () => {
  const calls = stubSynth();
  const btn = audioButton('hello');
  assert.equal(btn.tagName, 'BUTTON');
  assert.ok(!btn.hasAttribute('hidden'), 'not hidden');
  assert.match(btn.getAttribute('aria-label') ?? '', /escuchar/i);
  btn.dispatchEvent(new window.Event('click'));
  assert.equal(calls.speak.at(-1).text, 'hello');
});

test('audioButton: hidden and disabled when TTS is unavailable (graceful)', () => {
  delete globalThis.speechSynthesis;
  const btn = audioButton('hello');
  assert.ok(btn.hasAttribute('hidden'), 'hidden');
  assert.ok(btn.hasAttribute('disabled'), 'disabled');
});

test('bilingualCallout: shows EN + ES and an audio button on the EN line', () => {
  stubSynth();
  const el = bilingualCallout({ en: 'Hi there', es: 'Hola' });
  assert.match(el.textContent, /Hi there/);
  assert.match(el.textContent, /Hola/);
  assert.ok(el.querySelector('[data-role="audio"]'), 'has audio button');
});

test('renderTopic: renders title, explanation blocks (EN+ES), and related', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: TOPIC, onPractice: () => {} });
  assert.match(c.textContent, /Presente simple/);
  assert.match(c.textContent, /Describe verdades generales/);       // p (ES)
  assert.match(c.textContent, /Ask: is this your normal reality\?/); // callout (EN)
});

test('renderTopic: renders each example with an audio button', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: TOPIC, onPractice: () => {} });
  const examples = c.querySelectorAll('[data-role="example"]');
  assert.equal(examples.length, 2);
  assert.ok(examples[0].querySelector('[data-role="audio"]'), 'example has audio button');
  assert.match(examples[0].textContent, /I work here\./);
});

test('renderTopic: diagrams render as lazy-loaded images', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: TOPIC, onPractice: () => {} });
  const img = c.querySelector('img');
  assert.ok(img, 'has an image');
  assert.equal(img.getAttribute('loading'), 'lazy');
  assert.equal(img.getAttribute('src'), 'content/assets/ps-1.png');
});

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeGenTutor(items) {
  const calls = [];
  return { calls, async generateItems(topic, n) { calls.push([topic.id, n]); return items; } };
}

test('renderTopic: no "Generar práctica" button when no tutor is available', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: TOPIC, onPractice: () => {} });
  assert.equal(c.querySelector('[data-action="generate-practice"]'), null);
});

test('renderTopic: shows "Generar práctica" when a tutor is available', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: TOPIC, onPractice: () => {}, tutor: fakeGenTutor([]) });
  assert.ok(c.querySelector('[data-action="generate-practice"]'));
});

test('renderTopic: "Generar práctica" passes generated items to onGenerated and reports the count', async () => {
  stubSynth();
  const c = document.createElement('div');
  const items = [{ id: 'g1' }, { id: 'g2' }];
  const tutor = fakeGenTutor(items);
  let received = null;
  renderTopic(c, { topic: TOPIC, onPractice: () => {}, tutor, onGenerated: (its) => { received = its; } });
  c.querySelector('[data-action="generate-practice"]').dispatchEvent(new window.Event('click'));
  await tick(); await tick();
  assert.deepEqual(tutor.calls[0][0], 'present-simple');
  assert.deepEqual(received, items);
  assert.match(c.querySelector('[data-role="ai-status"]').textContent, /2/);
});

test('renderTopic: "Generar práctica" reports when the AI returns no valid items', async () => {
  stubSynth();
  const c = document.createElement('div');
  let received = 'untouched';
  renderTopic(c, { topic: TOPIC, onPractice: () => {}, tutor: fakeGenTutor([]), onGenerated: (its) => { received = its; } });
  c.querySelector('[data-action="generate-practice"]').dispatchEvent(new window.Event('click'));
  await tick(); await tick();
  assert.equal(received, 'untouched', 'onGenerated not called with an empty set');
  assert.match(c.querySelector('[data-role="ai-status"]').textContent, /no.*ejercicios|Intenta/i);
});

test('renderTopic: "Practicar este tema" invokes onPractice', () => {
  stubSynth();
  const c = document.createElement('div');
  let called = 0;
  renderTopic(c, { topic: TOPIC, onPractice: () => { called++; } });
  const practice = c.querySelector('[data-action="practice-topic"]');
  assert.ok(practice, 'has practice button');
  practice.dispatchEvent(new window.Event('click'));
  assert.equal(called, 1);
});

// --- Task 7: lesson-first (coreIdea header, pitfall blocks, guards) ---

test('renderTopic shows a "Volver" button that calls onBack, without displacing the coreIdea', () => {
  stubSynth();
  const c = document.createElement('div');
  let backed = 0;
  const topic = { ...TOPIC, coreIdea: { en: 'Your normal reality.', es: 'Tu realidad normal.' } };
  renderTopic(c, { topic, onPractice: () => {}, onBack: () => { backed++; } });
  const back = c.querySelector('[data-action="back"]');
  assert.ok(back, 'has a back button');
  back.dispatchEvent(new window.Event('click'));
  assert.equal(backed, 1);
  // Nav chrome must not push the concept below the fold: coreIdea is still the
  // first non-header child of .topic.
  const first = c.querySelector('.topic > *:not(header)');
  assert.ok(first?.classList.contains('topic-core-idea'), 'core idea still comes first');
});

test('renderTopic: shows the coreIdea in a highlighted block at the top', () => {
  stubSynth();
  const c = document.createElement('div');
  const topic = { ...TOPIC, coreIdea: { en: 'Your normal reality.', es: 'Tu realidad normal.' } };
  renderTopic(c, { topic, onPractice: () => {} });
  const core = c.querySelector('.topic-core-idea');
  assert.ok(core, 'has a core-idea block');
  assert.match(core.textContent, /Tu realidad normal\./);
  // It must sit before the first explanation block (concept before detail).
  const first = c.querySelector('.topic > *:not(header)');
  assert.ok(first?.classList.contains('topic-core-idea'), 'core idea comes first');
});

test('renderTopic: a pitfall block renders as a warning callout', () => {
  stubSynth();
  const c = document.createElement('div');
  const topic = { ...TOPIC, explanation: [{ kind: 'pitfall', text: { en: 'Do not use -ing here.', es: 'No uses -ing aquí.' } }] };
  renderTopic(c, { topic, onPractice: () => {} });
  const warn = c.querySelector('.callout-pitfall');
  assert.ok(warn, 'has a pitfall callout');
  assert.match(warn.textContent, /No uses -ing aquí\./);
});

test('renderTopic: a topic with no practice items disables the practice button', () => {
  stubSynth();
  const c = document.createElement('div');
  renderTopic(c, { topic: { ...TOPIC, items: [] }, onPractice: () => {} });
  const practice = c.querySelector('[data-action="practice-topic"]');
  assert.ok(practice.hasAttribute('disabled'), 'practice button is disabled when there is nothing to practice');
});

test('renderTopic: a dangling related id does not throw', () => {
  stubSynth();
  const c = document.createElement('div');
  assert.doesNotThrow(() => renderTopic(c, { topic: { ...TOPIC, related: ['no-existe'] }, onPractice: () => {} }));
});
