import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recognitionAvailable, recognizeOnce, SpeechError } from './speech.js';

// A scripted fake of SpeechRecognition. `behavior(rec)` runs after recognizeOnce
// has set rec.onresult/onerror/onend and called rec.start() — the microtask
// timing mirrors the real API (handlers set synchronously, events fire later).
function fakeRecognizer(behavior) {
  return class {
    start() { queueMicrotask(() => behavior(this)); }
    abort() {}
  };
}

test('recognitionAvailable reflects the browser constructor', () => {
  assert.equal(recognitionAvailable({ SpeechRecognition: function () {} }), true);
  assert.equal(recognitionAvailable({ webkitSpeechRecognition: function () {} }), true);
  assert.equal(recognitionAvailable({}), false);
});

test('recognizeOnce resolves with the transcript and confidence', async () => {
  const Recognizer = fakeRecognizer((rec) =>
    rec.onresult({ results: [[{ transcript: '  I want a coffee  ', confidence: 0.9 }]] }));
  const r = await recognizeOnce({ Recognizer });
  assert.equal(r.transcript, 'I want a coffee'); // trimmed
  assert.equal(r.confidence, 0.9);
});

test('recognizeOnce rejects reason "denied" when the mic is blocked', async () => {
  const Recognizer = fakeRecognizer((rec) => rec.onerror({ error: 'not-allowed' }));
  await assert.rejects(recognizeOnce({ Recognizer }), (e) => e instanceof SpeechError && e.reason === 'denied');
});

test('recognizeOnce rejects reason "no-speech" when it ends without a result', async () => {
  const Recognizer = fakeRecognizer((rec) => rec.onend());
  await assert.rejects(recognizeOnce({ Recognizer }), (e) => e instanceof SpeechError && e.reason === 'no-speech');
});

test('recognizeOnce rejects reason "not-supported" with no recognizer at all', async () => {
  await assert.rejects(recognizeOnce({ Recognizer: undefined }), (e) => e instanceof SpeechError && e.reason === 'not-supported');
});

test('recognizeOnce rejects reason "timeout" when nothing happens', async () => {
  const Recognizer = fakeRecognizer(() => { /* never fires an event */ });
  await assert.rejects(recognizeOnce({ Recognizer, timeoutMs: 20 }), (e) => e instanceof SpeechError && e.reason === 'timeout');
});
