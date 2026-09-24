import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicStatus } from './topic-status.js';

const topic = { id: 't', items: ['a', 'b'] };
const items = [{ id: 'a', topic: 't' }, { id: 'b', topic: 't' }, { id: 'z', topic: 'other' }];

test('topicStatus is "todo" with no lesson view and no practice', () => {
  assert.equal(topicStatus(topic, items, new Map(), {}), 'todo');
});

test('topicStatus is "learned" once the lesson was viewed but not practiced', () => {
  assert.equal(topicStatus(topic, items, new Map(), { t: 123 }), 'learned');
});

test('topicStatus is "practicing" when some items have been seen but not all mastered', () => {
  const progress = new Map([['a', { itemId: 'a', card: { stability: 30 }, seen: 3, correct: 2 }]]);
  assert.equal(topicStatus(topic, items, progress, { t: 1 }), 'practicing');
});

test('topicStatus counts practice even without a prior lesson view', () => {
  const progress = new Map([['a', { itemId: 'a', card: { stability: 1 }, seen: 2, correct: 1 }]]);
  assert.equal(topicStatus(topic, items, progress, {}), 'practicing');
});

test('topicStatus is "mastered" when every topic item reaches FSRS maturity', () => {
  const progress = new Map([
    ['a', { itemId: 'a', card: { stability: 30 }, seen: 5, correct: 5 }],
    ['b', { itemId: 'b', card: { stability: 22 }, seen: 4, correct: 4 }],
  ]);
  assert.equal(topicStatus(topic, items, progress, { t: 1 }), 'mastered');
});

test('topicStatus ignores items from other topics', () => {
  // 'z' belongs to 'other'; only 'a' and 'b' count. Neither mastered → not mastered.
  const progress = new Map([['z', { itemId: 'z', card: { stability: 99 }, seen: 9, correct: 9 }]]);
  assert.equal(topicStatus(topic, items, progress, { t: 1 }), 'learned');
});
