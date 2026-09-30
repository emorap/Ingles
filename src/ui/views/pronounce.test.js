import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderPronounce } from './pronounce.js';
import { comparePronunciation } from '../../engine/pronunciation.js';
import { SpeechError } from '../../audio/speech.js';

beforeEach(() => installDom());

const TOPIC = {
  id: 'cafe', title: { es: 'Café', en: 'Coffee' },
  examples: [{ en: 'I want a coffee', es: 'Quiero un café' }],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function base(overrides = {}) {
  return {
    topic: TOPIC, topics: [TOPIC], online: true, recognitionOk: true,
    tutor: { coachPronunciation: async () => 'consejo' },
    speak: () => {}, compare: comparePronunciation,
    ...overrides,
  };
}

test('sin tema → renderiza el selector; una tarjeta reporta onPick(id)', () => {
  const c = document.createElement('div');
  let picked = null;
  renderPronounce(c, { topic: null, topics: [TOPIC], onPick: (id) => { picked = id; } });
  const cards = c.querySelectorAll('[data-action="pick-topic"]');
  assert.equal(cards.length, 1);
  cards[0].dispatchEvent(new window.Event('click'));
  assert.equal(picked, 'cafe');
});

test('intento completo: score honesto (no nota), palabra off accesible, resultado anunciable, coaching', async () => {
  const c = document.createElement('div');
  const coachCalls = [];
  const tutor = {
    coachPronunciation: async (target, heard) => {
      coachCalls.push([target, heard]);
      return 'La /θ/ suena distinta a la /t/. Sigue así.';
    },
  };
  renderPronounce(c, base({
    tutor,
    recognize: async () => ({ transcript: 'I want a copy', confidence: 0.8 }),
  }));

  const mic = c.querySelector('[data-action="mic"]');
  assert.equal(mic.disabled, false);
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();

  const phrase = c.querySelector('[data-role="phrase"]');
  // Score HONESTO: cuenta palabras reconocidas, no se presenta como nota /100.
  const score = phrase.querySelector('[data-role="score"]').textContent;
  assert.match(score, /3 de 4/);
  assert.doesNotMatch(score, /100|\/\s*\d/, 'no se presenta como un puntaje sobre 100');
  // Palabra off marcada por algo más que el color (marcador para lectores de pantalla).
  assert.equal(phrase.querySelectorAll('.word.off').length, 1, 'solo "coffee" quedó off');
  assert.match(phrase.querySelector('.word.off').textContent, /coffee/i);
  assert.ok(phrase.querySelector('.word.off .visually-hidden'), 'la palabra off lleva marcador accesible');
  // El resultado se anuncia a lectores de pantalla (región viva).
  assert.equal(phrase.querySelector('[data-role="results"]').getAttribute('aria-live'), 'polite');
  // Coaching + cableado objetivo/oído.
  assert.match(phrase.querySelector('[data-role="coaching"]').textContent, /θ/);
  assert.deepEqual(coachCalls[0], ['I want a coffee', 'I want a copy']);
  // Mic reactivado para reintentar.
  assert.equal(mic.disabled, false);
});

test('sin tutor pero online → score se muestra, aviso para añadir la clave, sin coaching', async () => {
  const c = document.createElement('div');
  renderPronounce(c, base({
    tutor: null,
    recognize: async () => ({ transcript: 'I want a coffee', confidence: 0.9 }),
  }));
  const notice = c.querySelector('[data-role="offline-notice"]');
  assert.ok(notice, 'hay aviso para el usuario sin clave');
  assert.match(notice.textContent, /clave|Ajustes/i);
  // Grabar y ver el score NO requiere clave → el micrófono sigue habilitado.
  const mic = c.querySelector('[data-action="mic"]');
  assert.equal(mic.disabled, false);
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  const phrase = c.querySelector('[data-role="phrase"]');
  assert.match(phrase.querySelector('[data-role="score"]').textContent, /4 de 4/);
  assert.equal(phrase.querySelector('[data-role="coaching"]'), null, 'sin tutor no hay coaching');
});

test('sin reconocimiento → aviso, mic deshabilitado, escuchar sí funciona', () => {
  const c = document.createElement('div');
  const spoken = [];
  renderPronounce(c, base({ recognitionOk: false, speak: (t) => spoken.push(t) }));
  const notice = c.querySelector('[data-role="offline-notice"]');
  assert.ok(notice);
  assert.match(notice.textContent, /no permite hablar/i);
  assert.equal(c.querySelector('[data-action="mic"]').disabled, true);
  c.querySelector('[data-action="listen"]').dispatchEvent(new window.Event('click'));
  assert.ok(spoken.includes('I want a coffee'));
});

test('offline (online:false) → aviso de conexión y mic deshabilitado', () => {
  const c = document.createElement('div');
  renderPronounce(c, base({ online: false }));
  const notice = c.querySelector('[data-role="offline-notice"]');
  assert.ok(notice);
  assert.match(notice.textContent, /conexión/i);
  assert.equal(c.querySelector('[data-action="mic"]').disabled, true);
});

test('transcript vacío del reconocedor → mensaje suave, sin score, mic reactivado', async () => {
  const c = document.createElement('div');
  renderPronounce(c, base({ recognize: async () => ({ transcript: '   ', confidence: 0 }) }));
  const mic = c.querySelector('[data-action="mic"]');
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  const phrase = c.querySelector('[data-role="phrase"]');
  assert.match(phrase.querySelector('[data-role="status"]').textContent, /no te oí/i);
  assert.equal(phrase.querySelector('[data-role="score"]'), null, 'sin score en transcript vacío');
  assert.equal(mic.disabled, false);
});

test('recognize rechaza → muestra el mensaje, sin score, mic reactivado', async () => {
  const c = document.createElement('div');
  renderPronounce(c, base({
    recognize: async () => { throw new SpeechError('denied', 'No diste permiso al micrófono.'); },
  }));
  const mic = c.querySelector('[data-action="mic"]');
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  assert.match(c.querySelector('[data-role="status"]').textContent, /permiso/i);
  assert.equal(c.querySelector('[data-role="score"]'), null, 'sin resultado');
  assert.equal(mic.disabled, false);
});

test('coachPronunciation rechaza → conserva score y resalte, coaching muestra fallback, mic reactivado', async () => {
  const c = document.createElement('div');
  const tutor = { coachPronunciation: async () => { throw new Error('Gemini respondió 404.'); } };
  renderPronounce(c, base({
    tutor,
    recognize: async () => ({ transcript: 'I want a copy', confidence: 0.8 }),
  }));
  const mic = c.querySelector('[data-action="mic"]');
  mic.dispatchEvent(new window.Event('click'));
  await flush(); await flush();
  const phrase = c.querySelector('[data-role="phrase"]');
  assert.match(phrase.querySelector('[data-role="score"]').textContent, /3 de 4/, 'score se mantiene');
  assert.equal(phrase.querySelectorAll('.word.off').length, 1, 'resalte se mantiene');
  assert.match(phrase.querySelector('[data-role="coaching"]').textContent, /no se pudo|consejo/i);
  assert.equal(mic.disabled, false, 'mic se reactiva tras el fallo del coaching');
});
