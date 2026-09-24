import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, isDue, isNew, Rating } from './scheduler.js';

test('a new card is New and due now', () => {
  const c = newCard(new Date('2026-01-01'));
  assert.equal(isNew(c), true);
  assert.equal(isDue(c, new Date('2026-01-01')), true);
});

test('rating Good pushes the due date into the future', () => {
  const now = new Date('2026-01-01');
  const c = review(newCard(now), Rating.Good, now);
  assert.ok(new Date(c.due).getTime() > now.getTime());
});

test('rating Again keeps it near-term vs Easy', () => {
  const now = new Date('2026-01-01');
  const again = review(newCard(now), Rating.Again, now);
  const easy = review(newCard(now), Rating.Easy, now);
  assert.ok(new Date(again.due).getTime() < new Date(easy.due).getTime());
});
