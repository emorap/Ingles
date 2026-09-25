import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakSmart } from './voice.js';

// A fake meta+audio store; records putAudio calls.
function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    puts: [],
    async getAudio(k) { return map.get(k); },
    async putAudio(k, clip) { this.puts.push({ k, clip }); map.set(k, clip); },
  };
}

const spies = () => {
  const calls = { play: [], speak: [], tts: [] };
  return {
    calls,
    play: async (blob) => { calls.play.push(blob); },
    speakFn: (text, opts) => { calls.speak.push({ text, opts }); },
    ttsFn: async (key, text, opts) => { calls.tts.push({ key, text, opts }); return { blob: `BLOB(${text})`, mime: 'audio/wav' }; },
  };
};

test('cache hit plays the cached clip without any network', async () => {
  const store = fakeStore({ 'Kore::Hello': { blob: 'CACHED', mime: 'audio/wav' } });
  const { play, speakFn, ttsFn, calls } = spies();

  const r = await speakSmart('Hello', { ttsVoice: 'Kore', key: 'K', online: true, store, play, speakFn, ttsFn });

  assert.equal(r.source, 'cache');
  assert.deepEqual(calls.play, ['CACHED']);
  assert.equal(calls.tts.length, 0);
  assert.equal(calls.speak.length, 0);
});

test('online + key + cache miss calls Gemini, caches, and plays', async () => {
  const store = fakeStore();
  const { play, speakFn, ttsFn, calls } = spies();

  const r = await speakSmart('Hi', { ttsVoice: 'Puck', key: 'K', online: true, store, play, speakFn, ttsFn });

  assert.equal(r.source, 'gemini');
  assert.deepEqual(calls.tts[0], { key: 'K', text: 'Hi', opts: { voice: 'Puck' } });
  assert.deepEqual(store.puts[0], { k: 'Puck::Hi', clip: { blob: 'BLOB(Hi)', mime: 'audio/wav' } });
  assert.deepEqual(calls.play, ['BLOB(Hi)']);
  assert.equal(calls.speak.length, 0);
});

test('offline falls back to the browser voice', async () => {
  const store = fakeStore();
  const { play, speakFn, ttsFn, calls } = spies();

  const r = await speakSmart('Hola', { ttsVoice: 'Kore', browserVoice: 'Google US', key: 'K', online: false, store, play, speakFn, ttsFn });

  assert.equal(r.source, 'browser');
  assert.deepEqual(calls.speak[0], { text: 'Hola', opts: { voice: 'Google US' } });
  assert.equal(calls.tts.length, 0);
  assert.equal(calls.play.length, 0);
});

test('online but no key falls back to the browser voice', async () => {
  const { play, speakFn, ttsFn, calls } = spies();
  const r = await speakSmart('Hi', { online: true, key: '', play, speakFn, ttsFn });
  assert.equal(r.source, 'browser');
  assert.equal(calls.tts.length, 0);
  assert.equal(calls.speak.length, 1);
});

test('a Gemini failure falls back to the browser voice (never throws)', async () => {
  const store = fakeStore();
  const { play, speakFn, calls } = spies();
  const ttsFn = async () => { throw new Error('network'); };

  const r = await speakSmart('Hi', { ttsVoice: 'Kore', key: 'K', online: true, store, play, speakFn, ttsFn });

  assert.equal(r.source, 'browser');
  assert.equal(calls.speak.length, 1);
  assert.equal(store.puts.length, 0, 'nothing cached on failure');
});

test('works without a store (no cache ops)', async () => {
  const { play, speakFn, ttsFn, calls } = spies();
  const r = await speakSmart('Hi', { ttsVoice: 'Kore', key: 'K', online: true, play, speakFn, ttsFn });
  assert.equal(r.source, 'gemini');
  assert.deepEqual(calls.play, ['BLOB(Hi)']);
});

// #1: empty ttsVoice means "browser voice" (the settings picker's default). It
// must NOT call Gemini even with a key online — the natural voice is opt-in, so
// having a key for the text tutor never silently spends TTS quota.
test('empty ttsVoice uses the browser voice even with a key online', async () => {
  const store = fakeStore();
  const { play, speakFn, ttsFn, calls } = spies();
  const r = await speakSmart('Hi', { ttsVoice: '', browserVoice: 'Google US', key: 'K', online: true, store, play, speakFn, ttsFn });
  assert.equal(r.source, 'browser');
  assert.equal(calls.tts.length, 0, 'no Gemini call for the browser-voice option');
  assert.deepEqual(calls.speak[0], { text: 'Hi', opts: { voice: 'Google US' } });
  assert.equal(store.puts.length, 0);
});

// #2: a rejected cache read must never throw to the UI — it falls through to
// the online/browser path. speakSmart is a realce, never a hard dependency.
test('a rejected getAudio falls through instead of throwing', async () => {
  const store = { puts: [], getAudio: async () => { throw new Error('idb read failed'); }, putAudio: async () => {} };
  const { play, speakFn, ttsFn, calls } = spies();
  const r = await speakSmart('Hi', { ttsVoice: 'Kore', browserVoice: 'X', key: '', online: false, store, play, speakFn, ttsFn });
  assert.equal(r.source, 'browser');
  assert.equal(calls.speak.length, 1);
});

// #3: if the clip was fetched, a failed cache write must not discard it — play
// first, cache best-effort. A full IndexedDB should never mute the paid voice.
test('a putAudio failure still plays the fetched clip (cache is best-effort)', async () => {
  const store = { puts: [], getAudio: async () => undefined, putAudio: async () => { throw new Error('QuotaExceeded'); } };
  const { play, speakFn, ttsFn, calls } = spies();
  const r = await speakSmart('Hi', { ttsVoice: 'Kore', key: 'K', online: true, store, play, speakFn, ttsFn });
  assert.equal(r.source, 'gemini', 'still counts as natural voice — it played');
  assert.deepEqual(calls.play, ['BLOB(Hi)'], 'the fetched clip was played, not dropped');
  assert.equal(calls.speak.length, 0, 'did not fall back to the robotic voice');
});
