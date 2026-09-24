// Ephemeral fallback for the progress store, used when IndexedDB is unavailable
// (e.g. private-browsing mode). It implements the same duck-typed surface the
// app calls on `Store` (open/getMeta/setMeta/putProgress/allProgress/get-set
// Note/export/import), backed by in-memory Maps. Nothing persists across a
// reload — the persistence banner already warns the learner — but the entire
// offline core (practice, scheduling, streak, insights) keeps working instead
// of the app failing to start.
import { VERSION, SECRET_META } from './db.js';

/** @typedef {import('./types.js').ItemProgress} ItemProgress */

export class MemoryStore {
  /** @type {Map<string, ItemProgress>} */
  #progress = new Map();
  /** @type {Map<string, { itemId: string, text: string, at: number }>} */
  #notes = new Map();
  /** @type {Map<string, unknown>} */
  #meta = new Map();

  /** No connection to open; present so it is a drop-in for Store. */
  async open() { /* ephemeral — nothing to open */ }

  close() { /* ephemeral — nothing to close */ }

  /** @param {string} id @returns {Promise<ItemProgress | undefined>} */
  async getProgress(id) { return this.#progress.get(id); }

  /** @param {ItemProgress} progress */
  async putProgress(progress) { this.#progress.set(progress.itemId, { ...progress }); }

  /** @returns {Promise<Map<string, ItemProgress>>} */
  async allProgress() { return new Map(this.#progress); }

  /** @param {string} itemId @returns {Promise<string | undefined>} */
  async getNote(itemId) { return this.#notes.get(itemId)?.text; }

  /** @param {string} itemId @param {string} text */
  async setNote(itemId, text) {
    if (text) this.#notes.set(itemId, { itemId, text, at: Date.now() });
    else this.#notes.delete(itemId);
  }

  /**
   * @template T
   * @param {string} k @param {T} def @returns {Promise<T>}
   */
  async getMeta(k, def) { return this.#meta.has(k) ? /** @type {T} */ (this.#meta.get(k)) : def; }

  /** @param {string} k @param {unknown} v */
  async setMeta(k, v) { this.#meta.set(k, v); }

  /** @returns {Promise<string>} a JSON backup, matching Store.exportAll() shape */
  async exportAll() {
    const progress = [...this.#progress.values()];
    const notes = [...this.#notes.values()];
    /** @type {Record<string, unknown>} */
    const meta = {};
    for (const [k, v] of this.#meta) if (!SECRET_META.has(k)) meta[k] = v;
    return JSON.stringify({ format: 'momentum-progress', version: VERSION, progress, notes, meta });
  }

  /**
   * Restore a backup atomically: staged into copies and committed only if every
   * progress record is well-formed, so a malformed backup can never corrupt the
   * live maps (mirrors Store.importAll — RF#6).
   * @param {string} json
   * @param {{ idMap?: Record<string, string> }} [opts]
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async importAll(json, opts) {
    /** @type {any} */
    let data;
    try { data = JSON.parse(json); } catch { return { ok: false, error: 'invalid JSON' }; }
    if (data?.format !== 'momentum-progress' || !Array.isArray(data.progress)) {
      return { ok: false, error: 'unrecognised backup' };
    }
    const progress = new Map(this.#progress);
    const notes = new Map(this.#notes);
    const meta = new Map(this.#meta);
    for (const p of data.progress) {
      if (!p || typeof p.itemId !== 'string') return { ok: false, error: 'registros no válidos en la copia' };
      const id = opts?.idMap?.[p.itemId] ?? p.itemId;
      progress.set(id, { ...p, itemId: id });
    }
    for (const n of (Array.isArray(data.notes) ? data.notes : [])) {
      if (!n || typeof n.itemId !== 'string') continue;
      const id = opts?.idMap?.[n.itemId] ?? n.itemId;
      notes.set(id, { ...n, itemId: id });
    }
    for (const [k, v] of Object.entries(data.meta ?? {})) if (!SECRET_META.has(k)) meta.set(k, v);
    this.#progress = progress;
    this.#notes = notes;
    this.#meta = meta;
    return { ok: true };
  }
}
