// AI tutor availability + factory. The tutor is available only when BOTH the
// device is online AND the learner has stored their own Gemini key. When
// either is missing, getTutor returns null and the app stays fully functional
// offline — the AI is a realce, never a dependency. No network call happens
// here; callers trigger requests explicitly from the UI.
import { createGeminiTutor } from './gemini.js';

const KEY_META = 'aiKey';

/** @returns {boolean} best-effort online check (treats "unknown" as online). */
export function isOnline() {
  return globalThis.navigator?.onLine !== false;
}

/**
 * @param {{ getMeta: (k: string, def: any) => Promise<any> }} store
 * @returns {Promise<boolean>}
 */
export async function aiAvailable(store) {
  const key = await store.getMeta(KEY_META, '');
  return isOnline() && !!key;
}

/**
 * @param {{ getMeta: (k: string, def: any) => Promise<any> }} store
 * @returns {Promise<import('./provider.js').AITutorProvider | null>}
 */
export async function getTutor(store) {
  if (!(await aiAvailable(store))) return null;
  const key = await store.getMeta(KEY_META, '');
  return createGeminiTutor(key);
}
