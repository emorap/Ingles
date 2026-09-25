import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { geminiTTS, TTS_VOICES } from './gemini-tts.js';
import { base64ToBytes } from './wav.js';
import { AiError } from '../ai/gemini.js';

const B64 = 'AQIDBA=='; // 4 bytes of fake PCM
const okResponse = (mimeType = 'audio/L16;codec=pcm;rate=24000') => ({
  ok: true,
  status: 200,
  async json() {
    return { candidates: [{ content: { parts: [{ inlineData: { data: B64, mimeType } }] } }] };
  },
});

let calls;
const realFetch = globalThis.fetch;
beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = realFetch; });

test('TTS_VOICES lists prebuilt voice names', () => {
  assert.ok(Array.isArray(TTS_VOICES) && TTS_VOICES.length > 0);
  assert.ok(TTS_VOICES.includes('Kore'));
});

test('geminiTTS posts an AUDIO request and returns a WAV blob', async () => {
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return okResponse(); };

  const { blob, mime } = await geminiTTS('KEY', 'Hello', { voice: 'Puck' });

  assert.equal(mime, 'audio/wav');
  assert.equal(blob.type, 'audio/wav');
  assert.equal(blob.size, 44 + base64ToBytes(B64).length, 'WAV = header + PCM');

  const { url, init } = calls[0];
  assert.match(url, /gemini-2\.5-flash-preview-tts:generateContent/);
  assert.match(url, /key=KEY/);
  const body = JSON.parse(init.body);
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
});

test('geminiTTS defaults to the Kore voice', async () => {
  globalThis.fetch = async () => okResponse();
  await geminiTTS('KEY', 'Hi');
  // re-run capturing
  globalThis.fetch = async (url, init) => { calls.push({ init }); return okResponse(); };
  await geminiTTS('KEY', 'Hi');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Kore');
});

test('geminiTTS parses the sample rate from the response mime type', async () => {
  globalThis.fetch = async () => okResponse('audio/L16;codec=pcm;rate=16000');
  const { blob } = await geminiTTS('KEY', 'Hi');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const rate = new DataView(bytes.buffer).getUint32(24, true);
  assert.equal(rate, 16000);
});

test('geminiTTS maps an HTTP error to AiError', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 400, async json() { return {}; } });
  await assert.rejects(() => geminiTTS('BAD', 'Hi'), AiError);
});

test('geminiTTS maps an abort to AiError', async () => {
  globalThis.fetch = async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); };
  await assert.rejects(() => geminiTTS('KEY', 'Hi'), AiError);
});

test('geminiTTS rejects when the response carries no audio', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text: 'oops' }] } }] }; } });
  await assert.rejects(() => geminiTTS('KEY', 'Hi'), AiError);
});
