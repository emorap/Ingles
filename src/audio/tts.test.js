import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ttsAvailable, speak, listVoices } from './tts.js';

// A speechSynthesis double that records the utterance it was asked to speak.
function stubSynth(voices = []) {
  const calls = { speak: [], cancel: 0 };
  globalThis.speechSynthesis = {
    getVoices: () => voices,
    cancel: () => { calls.cancel++; },
    speak: (u) => { calls.speak.push(u); },
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; this.rate = 1; this.voice = null; }
  };
  return calls;
}

afterEach(() => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

test('reports unavailable and speak() is a safe no-op when speechSynthesis is missing', () => {
  delete globalThis.speechSynthesis;
  assert.equal(ttsAvailable(), false);
  assert.deepEqual(listVoices(), []);
  assert.doesNotThrow(() => speak('hello'));
});

test('reports available and calls speechSynthesis.speak with the text', () => {
  const calls = stubSynth();
  assert.equal(ttsAvailable(), true);
  speak('hello');
  assert.equal(calls.speak.length, 1);
  assert.equal(calls.speak[0].text, 'hello');
});

test('cancels any in-flight utterance before speaking (no overlap) and applies default rate', () => {
  const calls = stubSynth();
  speak('hi');
  assert.equal(calls.cancel, 1);
  assert.equal(calls.speak[0].rate, 0.95);
});

test('prefers an English voice by default and honors opts.voice + opts.rate', () => {
  const voices = [
    { name: 'Mónica', lang: 'es-ES' },
    { name: 'Daniel', lang: 'en-GB' },
  ];
  const calls = stubSynth(voices);
  speak('hi');
  assert.equal(calls.speak[0].voice.lang, 'en-GB'); // default → English

  speak('hi', { voice: 'Mónica', rate: 0.8 });
  assert.equal(calls.speak[1].voice.name, 'Mónica');
  assert.equal(calls.speak[1].rate, 0.8);
});
