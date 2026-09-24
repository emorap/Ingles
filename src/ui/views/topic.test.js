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
