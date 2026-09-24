import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from './analytics.js';
import { newCard, review, Rating } from './scheduler.js';

/** @param {string} id @param {string} topic */
const mk = (id, topic) => ({ id, topic, type: 'cloze', prompt: { en: '', es: '' }, answer: 'a', why: { en: '', es: '' } });

test('reports seen count and retention ratio', () => {
  const now = new Date('2026-01-01');
  const items = [mk('a', 't0'), mk('b', 't0')];
  const prog = new Map([
    ['a', { itemId: 'a', seen: 2, correct: 2, card: review(newCard(now), Rating.Good, now) }],
    ['b', { itemId: 'b', seen: 2, correct: 1, card: review(newCard(now), Rating.Good, now) }],
  ]);
  const s = computeStats(items, prog, now);
  assert.equal(s.seen, 2);
  assert.ok(Math.abs(s.retention - 0.75) < 0.01);
});

test('flags weak topics (low correct ratio)', () => {
  const now = new Date('2026-01-01');
  const items = [mk('a', 'weak'), mk('b', 'strong')];
  const prog = new Map([
    ['a', { itemId: 'a', seen: 4, correct: 1, card: newCard(now) }],
    ['b', { itemId: 'b', seen: 4, correct: 4, card: newCard(now) }],
  ]);
  assert.equal(computeStats(items, prog, now).weakTopics[0].topic, 'weak');
});

test('produces a 7-day forecast array', () => {
  const now = new Date('2026-01-01');
  const s = computeStats([mk('a', 't0')], new Map(), now);
  assert.equal(s.forecast.length, 7);
});
