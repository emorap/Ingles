// Picks the items for a practice session from the current route:
//   #/practice            → today's study session over the whole module
//   #/practice/<topicId>  → a session scoped to one topic (also "Reforzar")
//   #/practice/mistakes   → the recently-missed items, newest first, deduped
// Session shaping (due-first, newPerDay, cap, interleave) lives in buildSession;
// the mistakes list is taken as-is (already an explicit, ordered set).
import { buildSession } from '../engine/session.js';
import { mistakeItemIds } from '../engine/mistakes.js';

/**
 * @param {{ view: string, param?: string }} route
 * @param {{ content: any, progress: Map<string, any>, store: any,
 *           newPerDay: number, cap: number, now?: Date }} deps
 * @returns {Promise<import('../../engine/types.js').Item[]>}
 */
export async function selectItems(route, { content, progress, store, newPerDay, cap, now }) {
  const all = content.module.items;

  if (route.param === 'mistakes') {
    const byId = new Map(all.map((i) => [i.id, i]));
    const ids = await mistakeItemIds(store);
    return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, cap);
  }

  const pool = route.param ? all.filter((i) => i.topic === route.param) : all;
  return buildSession(pool, progress, { newPerDay, cap, now });
}
