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
