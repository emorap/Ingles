// "Mis errores" log + bookmarks. Both live in the meta store (small, bounded
// lists), so they ride along with the existing backup/export for free. The
// mistakes log is a ring buffer: the last MAX_MISTAKES wrong answers, oldest
// dropped. All functions take a store exposing getMeta(key, default)/setMeta.

export const MAX_MISTAKES = 50;

/** @typedef {{ getMeta: (k: string, def: any) => Promise<any>, setMeta: (k: string, v: any) => Promise<void> }} MetaStore */
/** @typedef {{ itemId: string, given: string, at: number }} Mistake */

/**
 * Record a wrong answer. Appends to the ring buffer and trims to MAX_MISTAKES.
 * @param {MetaStore} store
 * @param {string} itemId
 * @param {string} given the learner's (incorrect) answer
 */
export async function logMistake(store, itemId, given) {
  /** @type {Mistake[]} */
  const log = await store.getMeta('mistakes', []);
  log.push({ itemId, given, at: Date.now() });
  await store.setMeta('mistakes', log.slice(-MAX_MISTAKES));
}

/**
 * The n most recent mistakes, newest first.
 * @param {MetaStore} store
 * @param {number} n
 * @returns {Promise<Mistake[]>}
 */
export async function recentMistakes(store, n) {
  /** @type {Mistake[]} */
  const log = await store.getMeta('mistakes', []);
  return log.slice().reverse().slice(0, n);
}

/**
 * Unique item ids from recent mistakes, newest first — the input for a
 * topic-agnostic "practicar mis errores" session.
 * @param {MetaStore} store
 * @param {number} [n] how many recent mistakes to draw from (default: all)
 * @returns {Promise<string[]>}
 */
export async function mistakeItemIds(store, n = MAX_MISTAKES) {
  const recent = await recentMistakes(store, n);
  const seen = new Set();
  const ids = [];
  for (const m of recent) {
    if (seen.has(m.itemId)) continue;
    seen.add(m.itemId);
    ids.push(m.itemId);
  }
  return ids;
}

/**
 * Add or remove a bookmark for an item.
 * @param {MetaStore} store
 * @param {string} itemId
 * @param {boolean} on
 */
export async function setBookmark(store, itemId, on) {
  const set = new Set(await store.getMeta('bookmarks', []));
  if (on) set.add(itemId); else set.delete(itemId);
  await store.setMeta('bookmarks', [...set]);
}

/**
 * @param {MetaStore} store
 * @param {string} itemId
 * @returns {Promise<boolean>}
 */
export async function isBookmarked(store, itemId) {
  return (await store.getMeta('bookmarks', [])).includes(itemId);
}

/**
 * @param {MetaStore} store
 * @returns {Promise<string[]>}
 */
export async function listBookmarks(store) {
  return store.getMeta('bookmarks', []);
}
