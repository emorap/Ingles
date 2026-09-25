import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { callGemini, createGeminiTutor, AiError } from './gemini.js';

// callGemini uses globalThis.fetch; stub it per test and restore after.
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const textResponse = (t) => ({
  ok: true, status: 200,
  async json() { return { candidates: [{ content: { parts: [{ text: t }] } }] }; },
});
const notFound = () => ({ ok: false, status: 404, async json() { return {}; } });

test('callGemini falls back to the next model on 404 and returns its text', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return url.includes('gemini-flash-latest') ? notFound() : textResponse('hola');
  };
  const out = await callGemini('K', 'hi');
  assert.equal(out, 'hola');
  assert.equal(urls.length, 2, 'tried the primary, then the fallback');
  assert.match(urls[0], /gemini-flash-latest:generateContent/);
  assert.match(urls[1], /gemini-2\.5-flash:generateContent/);
});

test('callGemini uses the first model when it works (no fallback call)', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return textResponse('ok'); };
  const out = await callGemini('K', 'hi');
  assert.equal(out, 'ok');
  assert.equal(urls.length, 1, 'a working primary means no fallback request');
  assert.match(urls[0], /gemini-flash-latest:generateContent/);
});

test('callGemini throws AiError mentioning 404 when every model is unavailable', async () => {
  globalThis.fetch = async () => notFound();
  await assert.rejects(() => callGemini('K', 'hi'), (e) => e instanceof AiError && /404/.test(e.message));
});

test('callGemini throws immediately on a non-404 HTTP error (not a model problem)', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return { ok: false, status: 400, async json() { return {}; } }; };
  await assert.rejects(() => callGemini('K', 'hi'), AiError);
  assert.equal(urls.length, 1, '400 is a key/request problem — do not waste calls on other models');
});

test('callGemini maps a network failure to AiError', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(() => callGemini('K', 'hi'), AiError);
});

test('chat honors a leading system turn and drops the Spanish-explanation bias', async () => {
  // The dialogue role-play sends { role:'system', text:'…Reply ONLY in English…' }.
  // That instruction must reach the model as authoritative, NOT buried under the
  // default "Explica en español" learner bias — the two directly contradict.
  let sentBody = null;
  globalThis.fetch = async (url, init) => { sentBody = JSON.parse(init.body); return textResponse('Sure, one coffee!'); };
  const out = await createGeminiTutor('K').chat([
    { role: 'system', text: 'You are a barista. Reply ONLY in English.' },
    { role: 'user', text: 'A coffee please' },
  ]);
  assert.equal(out, 'Sure, one coffee!');
  const prompt = sentBody.contents[0].parts[0].text;
  assert.match(prompt, /Reply ONLY in English/, 'system instruction is honored');
  assert.doesNotMatch(prompt, /Explica en español/, 'no Spanish-explanation bias that would contradict an English-only role-play');
  assert.match(prompt, /Estudiante: A coffee please/, 'the user turn stays in the conversation');
});

test('chat without a system turn keeps the Spanish-explaining tutor framing', async () => {
  let sentBody = null;
  globalThis.fetch = async (url, init) => { sentBody = JSON.parse(init.body); return textResponse('ok'); };
  await createGeminiTutor('K').chat([{ role: 'user', text: 'Traduce esto' }]);
  const prompt = sentBody.contents[0].parts[0].text;
  assert.match(prompt, /Explica en español/, 'generic chat still uses the learner framing');
});

test('callGemini honors a custom models list', async () => {
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(url); return textResponse('x'); };
  await callGemini('K', 'hi', { models: ['gemini-2.5-flash'] });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /gemini-2\.5-flash:generateContent/);
});
