import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, isCorrect } from './normalize.js';

test('normalize lowercases, trims, collapses spaces, unifies apostrophes', () => {
  assert.equal(normalize('  She’s   Here '), "she's here");
});

test('isCorrect accepts the answer regardless of case/space', () => {
  const item = { answer: 'has worked', accept: ["'s worked"] };
  assert.equal(isCorrect('  Has Worked ', item), true);
});

test('isCorrect accepts a listed variant (curly apostrophe)', () => {
  const item = { answer: 'has worked', accept: ["'s worked"] };
  assert.equal(isCorrect('’s worked', item), true);
});

test('isCorrect rejects a wrong answer', () => {
  const item = { answer: 'has worked', accept: ["'s worked"] };
  assert.equal(isCorrect('worked', item), false);
});
