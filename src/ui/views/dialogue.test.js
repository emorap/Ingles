import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderDialogue } from './dialogue.js';
import { SpeechError } from '../../audio/speech.js';

beforeEach(() => installDom());

const SCN = {
  id: 'cafe', title: { es: 'Café', en: 'Coffee' },
  system: 'You are a barista.', opening: 'Hi! What can I get you?',
  suggestions: [{ en: 'A coffee, please.', es: 'Un café, por favor.' }],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeTutor(reply = 'Sure, one coffee!') {
  const calls = [];
  return { calls, chat: async (history) => { calls.push(history); return reply; } };
}

test('no scenario → renders the scenario picker; a card reports onPick(id)', () => {
  const c = document.createElement('div');
  let picked = null;
  renderDialogue(c, { scenario: null, scenarios: [SCN], onPick: (id) => { picked = id; } });
  const cards = c.querySelectorAll('[data-action="pick-scenario"]');
  assert.equal(cards.length, 1);
  cards[0].dispatchEvent(new window.Event('click'));
  assert.equal(picked, 'cafe');
});

test('a full turn: mic → recognize → chat(system+turns) → speak(reply) + bubbles', async () => {
  const c = document.createElement('div');
  const tutor = fakeTutor('Sure, one coffee!');
  const spoken = [];
  renderDialogue(c, {
    scenario: SCN, tutor, online: true, recognitionOk: true,
    speak: (t) => spoken.push(t),
    recognize: async () => ({ transcript: 'A coffee please', confidence: 0.9 }),
  });

  // Opening line is shown and spoken.
  assert.equal(c.querySelectorAll('[data-role="bubble"]').length, 1);
  assert.ok(spoken.includes('Hi! What can I get you?'));

  const mic = c.querySelector('[data-action="mic"]');
  assert.equal(mic.disabled, false);
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();

  const bubbles = c.querySelectorAll('[data-role="bubble"]');
  assert.equal(bubbles.length, 3, 'opening + user + tutor reply');
  // chat() got the system priming first, then the opening + the user turn.
  const sent = tutor.calls[0];
  assert.equal(sent[0].role, 'system');
  assert.match(sent[0].text, /English/i);
  assert.ok(sent.some((m) => m.role === 'user' && m.text === 'A coffee please'));
  assert.ok(spoken.includes('Sure, one coffee!'), 'reply is spoken');
  assert.equal(mic.disabled, false, 'mic re-enabled for the next turn');
});

test('offline (no tutor) → shows the notice, disables the mic, still lists the scenario', () => {
  const c = document.createElement('div');
  renderDialogue(c, { scenario: SCN, tutor: null, online: true, recognitionOk: true, speak: () => {} });
  assert.ok(c.querySelector('[data-role="offline-notice"]'));
  assert.equal(c.querySelector('[data-action="mic"]').disabled, true);
  assert.ok(c.querySelector('[data-role="suggestions"]'));
});

test('recognize rejects (mic denied) → shows the message, no user bubble, mic re-enabled', async () => {
  const c = document.createElement('div');
  const tutor = fakeTutor();
  renderDialogue(c, {
    scenario: SCN, tutor, online: true, recognitionOk: true, speak: () => {},
    recognize: async () => { throw new SpeechError('denied', 'No diste permiso al micrófono.'); },
  });
  const mic = c.querySelector('[data-action="mic"]');
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  assert.match(c.querySelector('[data-role="status"]').textContent, /permiso/i);
  assert.equal(c.querySelectorAll('[data-role="bubble"]').length, 1, 'no user bubble added');
  assert.equal(tutor.calls.length, 0, 'tutor not called');
  assert.equal(mic.disabled, false);
});

test('empty transcript → gentle status, no tutor call', async () => {
  const c = document.createElement('div');
  const tutor = fakeTutor();
  renderDialogue(c, {
    scenario: SCN, tutor, online: true, recognitionOk: true, speak: () => {},
    recognize: async () => ({ transcript: '   ', confidence: 0 }),
  });
  c.querySelector('[data-action="mic"]').dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  assert.equal(tutor.calls.length, 0);
  assert.equal(c.querySelectorAll('[data-role="bubble"]').length, 1);
});

test('chat rejects mid-turn → user bubble stays, status shows error, mic re-enabled', async () => {
  const c = document.createElement('div');
  const tutor = { calls: [], chat: async () => { throw new Error('Gemini respondió 404.'); } };
  renderDialogue(c, {
    scenario: SCN, tutor, online: true, recognitionOk: true, speak: () => {},
    recognize: async () => ({ transcript: 'Hello', confidence: 0.9 }),
  });
  c.querySelector('[data-action="mic"]').dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  assert.equal(c.querySelectorAll('[data-role="bubble"]').length, 2, 'opening + user turn kept');
  assert.match(c.querySelector('[data-role="status"]').textContent, /404|reintenta/i);
  assert.equal(c.querySelector('[data-action="mic"]').disabled, false);
});
