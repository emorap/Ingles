import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession } from './session.js';
import { newCard, review, Rating } from './scheduler.js';

/** @param {string} id @param {string} topic */
const mk = (id, topic) => ({ id, topic, type: 'cloze', prompt: { en: '', es: '' }, answer: 'a', why: { en: '', es: '' } });

test('caps total items', () => {
  const now = new Date('2026-01-01');
  const items = Array.from({ length: 50 }, (_, i) => mk('i' + i, 't' + (i % 3)));
  const s = buildSession(items, new Map(), { newPerDay: 8, cap: 15, now });
  assert.ok(s.length <= 15);
});

test('introduces at most newPerDay brand-new items', () => {
  const now = new Date('2026-01-01');
  const items = Array.from({ length: 50 }, (_, i) => mk('i' + i, 't0'));
  const s = buildSession(items, new Map(), { newPerDay: 8, cap: 15, now });
  assert.equal(s.length, 8);
});

test('prioritises due items over new ones', () => {
  const now = new Date('2026-01-01');
  const items = [mk('due', 't0'), mk('new', 't1')];
  const prog = new Map([['due', {
    itemId: 'due', seen: 1, correct: 1,
    card: review(newCard(new Date('2025-12-01')), Rating.Again, new Date('2025-12-01')),
  }]]);
  const s = buildSession(items, prog, { newPerDay: 8, cap: 15, now });
  assert.equal(s[0].id, 'due');
});

test('avoids two same-topic items back to back when possible', () => {
  const now = new Date('2026-01-01');
  const items = [mk('a', 't0'), mk('b', 't0'), mk('c', 't1'), mk('d', 't1')];
  const s = buildSession(items, new Map(), { newPerDay: 8, cap: 15, now });
  let adjacent = 0;
  for (let i = 1; i < s.length; i++) if (s[i].topic === s[i - 1].topic) adjacent++;
  assert.ok(adjacent < s.length - 1);
});
