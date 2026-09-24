import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { aiAvailable, getTutor } from './tutor.js';

// Stand-in store: getMeta returns the configured key (or the caller's default).
const fakeStore = (key) => ({ getMeta: async (_k, def) => (key !== undefined ? key : def) });

function setNavigator(onLine) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine }, configurable: true });
}
function geminiReturns(text) {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
}

afterEach(() => { delete globalThis.fetch; });

test('unavailable with no key, even online', async () => {
  setNavigator(true);
  assert.equal(await aiAvailable(fakeStore(undefined)), false);
  assert.equal(await getTutor(fakeStore(undefined)), null);
});

test('unavailable when offline even with a key', async () => {
  setNavigator(false);
  assert.equal(await aiAvailable(fakeStore('k')), false);
  assert.equal(await getTutor(fakeStore('k')), null);
});

test('available (adapter returned) when online with a key', async () => {
  setNavigator(true);
  assert.equal(await aiAvailable(fakeStore('k')), true);
  assert.notEqual(await getTutor(fakeStore('k')), null);
});

test('generateItems is schema-validated: invalid items are dropped (Review Focus #4)', async () => {
  setNavigator(true);
  const valid = { id: 'g1', topic: 't1', type: 'cloze', prompt: { en: 'a ___', es: 'a ___' }, answer: 'x', accept: ['x'], why: { en: 'because', es: 'porque' } };
  const junk = { id: 'g2', type: 'nope' };
  geminiReturns(JSON.stringify([valid, junk]));
  const t = await getTutor(fakeStore('k'));
  const items = await t.generateItems({ id: 't1' }, 3);
  assert.ok(Array.isArray(items));
  assert.equal(items.length, 1, 'only the valid item survives');
  assert.equal(items[0].id, 'g1');
});

test('generateItems tolerates fenced JSON and returns [] on non-JSON', async () => {
  setNavigator(true);
  geminiReturns('```json\n[]\n```');
  assert.deepEqual(await (await getTutor(fakeStore('k'))).generateItems({ id: 't1' }, 3), []);
  geminiReturns('lo siento, no puedo generar eso');
  assert.deepEqual(await (await getTutor(fakeStore('k'))).generateItems({ id: 't1' }, 3), []);
});

test('explain / whyWrong / chat return the model text', async () => {
  setNavigator(true);
  geminiReturns('Aquí tienes una explicación.');
  const t = await getTutor(fakeStore('k'));
  assert.equal(await t.explain({ id: 't1', title: { en: 'Present', es: 'Presente' } }, {}), 'Aquí tienes una explicación.');
  assert.equal(await t.whyWrong({ answer: 'lives', prompt: { en: 'x', es: 'x' } }, 'living'), 'Aquí tienes una explicación.');
  assert.equal(await t.chat([{ role: 'user', text: 'hola' }]), 'Aquí tienes una explicación.');
});

test('a non-OK API response surfaces a friendly error', async () => {
  setNavigator(true);
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const t = await getTutor(fakeStore('k'));
  await assert.rejects(() => t.explain({ id: 't1' }, {}), /Gemini|IA/);
});
