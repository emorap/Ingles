/** @typedef {import('./types.js').Item} Item */
/** @typedef {import('./types.js').ItemProgress} ItemProgress */

// Days of FSRS stability at which a card counts as "mature" — matches the
// analytics "mastered" metric and the hub progress ring so all three agree.
export const MASTERY_STABILITY = 21;

/**
 * Derive a topic's place in the learn → practice → master journey (spec §6):
 * - 'todo': lesson never opened and no item practiced.
 * - 'learned': lesson viewed, but no item practiced yet.
 * - 'practicing': at least one item seen, but not all items mature.
 * - 'mastered': every item of the topic has reached FSRS maturity.
 *
 * @param {{ id: string }} topic
 * @param {Item[]} items all items (any topic; filtered here)
 * @param {Map<string, ItemProgress>} progress
 * @param {Record<string, number>} lessonViewed map topicId → timestamp
 * @returns {'todo' | 'learned' | 'practicing' | 'mastered'}
 */
export function topicStatus(topic, items, progress, lessonViewed) {
  const own = items.filter((i) => i.topic === topic.id);
  const seen = own.filter((i) => (progress.get(i.id)?.seen ?? 0) > 0);
  const mature = own.filter((i) => (progress.get(i.id)?.card?.stability ?? 0) >= MASTERY_STABILITY);
  if (own.length > 0 && mature.length === own.length) return 'mastered';
  if (seen.length > 0) return 'practicing';
  if (lessonViewed?.[topic.id]) return 'learned';
  return 'todo';
}
