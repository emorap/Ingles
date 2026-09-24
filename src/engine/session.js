import { isDue } from './scheduler.js';

/** @typedef {import('./types.js').Item} Item */
/** @typedef {import('./types.js').ItemProgress} ItemProgress */

/**
 * Reorder items so that, when possible, no two consecutive items share a topic
 * (interleaving aids retention). Greedy: always take from the largest queue
 * whose head differs from the last emitted topic.
 * @param {Item[]} items
 * @returns {Item[]}
 */
function interleave(items) {
  /** @type {Map<string, Item[]>} */
  const byTopic = new Map();
  for (const it of items) {
    const q = byTopic.get(it.topic);
    if (q) q.push(it);
    else byTopic.set(it.topic, [it]);
  }
  const queues = [...byTopic.values()];
  /** @type {Item[]} */
  const out = [];
  while (out.length < items.length) {
    queues.sort((a, b) => b.length - a.length);
    const last = out.length ? out[out.length - 1].topic : null;
    const q = queues.find((q) => q.length && q[0].topic !== last) ?? queues.find((q) => q.length);
    out.push(q.shift());
  }
  return out;
}

/**
 * Build a study session: all due items first, then up to `newPerDay` brand-new
 * items, capped at `cap`, then interleaved across topics.
 * @param {Item[]} items
 * @param {Map<string, ItemProgress>} progress
 * @param {{ newPerDay: number, cap: number, now?: Date }} opts
 * @returns {Item[]}
 */
export function buildSession(items, progress, opts) {
  const now = opts.now ?? new Date();
  /** @type {Item[]} */
  const due = [];
  /** @type {Item[]} */
  const fresh = [];
  for (const it of items) {
    const p = progress.get(it.id);
    if (!p) fresh.push(it);
    else if (isDue(p.card, now)) due.push(it);
  }
  const chosen = [...due, ...fresh.slice(0, opts.newPerDay)].slice(0, opts.cap);
  return interleave(chosen);
}
