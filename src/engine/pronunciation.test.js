import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePronunciation, normalizeWords } from './pronunciation.js';

test('normalizeWords baja caso, quita acentos y puntuación, une apóstrofos (don\'t → dont)', () => {
  assert.equal(normalizeWords("Don't! Café, please."), "dont cafe please");
  assert.equal(normalizeWords('  '), '');
});

test('match perfecto → score 100 y sin palabras off', () => {
  const r = comparePronunciation('I want a coffee', 'I want a coffee');
  assert.equal(r.score, 100);
  assert.deepEqual(r.wordsOff, []);
  assert.equal(r.wordsOk.length, 4);
});

test('una palabra distinta → esa palabra en wordsOff, score parcial', () => {
  const r = comparePronunciation('I want a coffee', 'I want a copy');
  assert.deepEqual(r.wordsOff, ['coffee']);
  assert.equal(r.score, 75);
});

test('palabra saltada no cascada: solo la faltante queda off (alineación LCS)', () => {
  const r = comparePronunciation('please give me the menu', 'please give the menu');
  assert.deepEqual(r.wordsOff, ['me']);
  assert.deepEqual(r.wordsOk, ['please', 'give', 'the', 'menu']);
});

test('normalización empareja puntuación/caso/acentos', () => {
  const r = comparePronunciation("Don't worry", 'dont worry');
  assert.equal(r.score, 100);
});

test('transcript vacío → score 0, todas las palabras off, sin crash', () => {
  const r = comparePronunciation('hello there', '   ');
  assert.equal(r.score, 0);
  assert.deepEqual(r.wordsOff, ['hello', 'there']);
  assert.equal(r.marks.length, 2);
  assert.equal(r.marks.every((m) => m.ok === false), true);
});

test('objetivo vacío → score 0 y estructuras vacías', () => {
  const r = comparePronunciation('', 'anything');
  assert.equal(r.score, 0);
  assert.deepEqual(r.marks, []);
});

// Alineación palabra-visible ↔ token normalizado. Estas frases son ejemplos
// reales del contenido (verbforms/tenses/mechanics): un em dash suelto o una
// palabra con guion NO deben correr los chips ni mostrarse como palabra hablada.
test('em dash suelto no se muestra como palabra; los chips quedan alineados', () => {
  const r = comparePronunciation("come — it's optional", 'come its optional');
  assert.deepEqual(r.marks.map((m) => m.word), ['come', "it's", 'optional']);
  assert.ok(!r.wordsOk.includes('—') && !r.wordsOff.includes('—'), 'el em dash nunca es una palabra');
  assert.equal(r.score, 100);
});

test('palabra con guion (long-term → dos tokens) no corre los chips siguientes', () => {
  const r = comparePronunciation('a long-term plan', 'a long term plan');
  assert.deepEqual(r.marks.map((m) => m.word), ['a', 'long', 'term', 'plan']);
  assert.deepEqual(r.wordsOff, []);
  assert.equal(r.score, 100);
});

test('palabra de más en lo oído → objetivo intacto, nada off (LCS inserción)', () => {
  const r = comparePronunciation('I want coffee', 'I really want coffee');
  assert.equal(r.score, 100);
  assert.deepEqual(r.wordsOff, []);
  assert.deepEqual(r.wordsOk, ['I', 'want', 'coffee']);
});
