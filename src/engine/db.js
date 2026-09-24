import { openDB } from '../../vendor/idb.js';

/** @typedef {import('./types.js').ItemProgress} ItemProgress */

const DB = 'momentum';
const VERSION = 2;

/**
 * IndexedDB-backed progress store. SRS state lives here, keyed by itemId,
 * so updating content never erases progress. Supports export/import (backup)
 * with optional id migration when a content update renames an item.
 */
export class Store {
  /** @type {import('../../vendor/idb.js').IDBPDatabase | undefined} */
  #db;

  async open() {
    this.#db = await openDB(DB, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'itemId' });
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'itemId' });
      },
    });
  }

  /** Release the underlying connection so another can delete/upgrade the DB. */
  close() {
    this.#db?.close();
  }

  /**
   * @param {string} id
   * @returns {Promise<ItemProgress | undefined>}
   */
  getProgress(id) {
    return /** @type {Promise<ItemProgress | undefined>} */ (this.#db.get('progress', id));
  }

  /** @param {ItemProgress} progress */
  async putProgress(progress) {
    await this.#db.put('progress', progress);
  }

  /** @returns {Promise<Map<string, ItemProgress>>} */
  async allProgress() {
    const all = /** @type {ItemProgress[]} */ (await this.#db.getAll('progress'));
    return new Map(all.map((p) => [p.itemId, p]));
  }

  /**
   * A learner's free-text note for an item, or undefined.
   * @param {string} itemId
   * @returns {Promise<string | undefined>}
   */
  async getNote(itemId) {
    const rec = await this.#db.get('notes', itemId);
    return rec?.text;
  }

  /**
   * Save (or, with empty text, clear) a note for an item.
   * @param {string} itemId
   * @param {string} text
   */
  async setNote(itemId, text) {
    if (text) await this.#db.put('notes', { itemId, text, at: Date.now() });
    else await this.#db.delete('notes', itemId);
  }

  /**
   * @template T
   * @param {string} k
   * @param {T} def
   * @returns {Promise<T>}
   */
  async getMeta(k, def) {
    const v = await this.#db.get('meta', k);
    return v === undefined ? def : v;
  }

  /**
   * @param {string} k
   * @param {unknown} v
   */
  async setMeta(k, v) {
    await this.#db.put('meta', v, k);
  }

  /** @returns {Promise<string>} a JSON backup of all progress + notes + meta */
  async exportAll() {
    const progress = await this.#db.getAll('progress');
    const notes = await this.#db.getAll('notes');
    const metaKeys = await this.#db.getAllKeys('meta');
    /** @type {Record<string, unknown>} */
    const meta = {};
    for (const k of metaKeys) meta[/** @type {string} */ (k)] = await this.#db.get('meta', k);
    return JSON.stringify({ format: 'momentum-progress', version: VERSION, progress, notes, meta });
  }

  /**
   * Restore a backup. Malformed input is rejected without touching existing
   * data. `idMap` remaps item ids (used when a content update renames items).
   * @param {string} json
   * @param {{ idMap?: Record<string, string> }} [opts]
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async importAll(json, opts) {
    /** @type {any} */
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return { ok: false, error: 'invalid JSON' };
    }
    if (data?.format !== 'momentum-progress' || !Array.isArray(data.progress)) {
      return { ok: false, error: 'unrecognised backup' };
    }
    const tx = this.#db.transaction(['progress', 'notes', 'meta'], 'readwrite');
    for (const p of /** @type {ItemProgress[]} */ (data.progress)) {
      const id = opts?.idMap?.[p.itemId] ?? p.itemId;
      await tx.objectStore('progress').put({ ...p, itemId: id });
    }
    for (const n of /** @type {{ itemId: string }[]} */ (Array.isArray(data.notes) ? data.notes : [])) {
      const id = opts?.idMap?.[n.itemId] ?? n.itemId;
      await tx.objectStore('notes').put({ ...n, itemId: id });
    }
    for (const [k, v] of Object.entries(data.meta ?? {})) await tx.objectStore('meta').put(v, k);
    await tx.done;
    return { ok: true };
  }
}
