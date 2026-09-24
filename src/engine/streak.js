// Daily study streak. Stored in meta as a day-key string ('lastStudy') plus a
// counter ('streak'). Called once when a practice session completes: same day
// → unchanged; the very next day → +1; any larger gap → back to 1. Local date
// keys (not UTC) so "today" matches the learner's wall clock. Pure over meta.

/** @typedef {{ getMeta: (k: string, def: any) => Promise<any>, setMeta: (k: string, v: any) => Promise<void> }} MetaStore */

/** Local YYYY-MM-DD key for a date. */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Record that the learner studied on `now` and return the resulting streak.
 * @param {MetaStore} store
 * @param {Date} [now]
 * @returns {Promise<number>}
 */
export async function recordStudyDay(store, now = new Date()) {
  const today = dayKey(now);
  const last = await store.getMeta('lastStudy', null);
  const prev = await store.getMeta('streak', 0);

  if (last === today) return prev; // already counted today

  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  const streak = last === yesterday ? prev + 1 : 1;

  await store.setMeta('streak', streak);
  await store.setMeta('lastStudy', today);
  return streak;
}
