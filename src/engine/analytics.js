/** @typedef {import('./types.js').Item} Item */
/** @typedef {import('./types.js').ItemProgress} ItemProgress */

/**
 * Aggregate study stats over a module's items.
 * - `retention`: correct / total attempts across seen items.
 * - `mastered`: cards whose FSRS stability >= 21 days.
 * - `seen`: distinct items attempted at least once.
 * - `forecast[d]`: cards due on day offset d, for d in 0..6.
 * - `weakTopics`: topics sorted by ascending correct ratio (weakest first).
 * @param {Item[]} items
 * @param {Map<string, ItemProgress>} progress
 * @param {Date} [now]
 */
export function computeStats(items, progress, now = new Date()) {
  let seen = 0;
  let totalSeen = 0;
  let totalCorrect = 0;
  /** @type {Map<string, { seen: number, correct: number }>} */
  const byTopic = new Map();
  for (const it of items) {
    const p = progress.get(it.id);
    if (!p || p.seen === 0) continue;
    seen++;
    totalSeen += p.seen;
    totalCorrect += p.correct;
    const t = byTopic.get(it.topic) ?? { seen: 0, correct: 0 };
    t.seen += p.seen;
    t.correct += p.correct;
    byTopic.set(it.topic, t);
  }
  const retention = totalSeen ? totalCorrect / totalSeen : 0;
  const mastered = [...progress.values()].filter((p) => p.card.stability >= 21).length;
  const forecast = Array.from({ length: 7 }, () => 0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const p of progress.values()) {
    const d = Math.floor((new Date(p.card.due).getTime() - start.getTime()) / 86400000);
    if (d >= 0 && d < 7) forecast[d]++;
  }
  const weakTopics = [...byTopic.entries()]
    .map(([topic, v]) => ({ topic, ratio: v.seen ? v.correct / v.seen : 1 }))
    .sort((a, b) => a.ratio - b.ratio);
  return { retention, mastered, seen, forecast, weakTopics };
}
