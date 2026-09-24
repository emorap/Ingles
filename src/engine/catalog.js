// The content catalog: the manifest (content/index.json) is the single source
// of the recommended module order and each module's status. loadCatalog reads
// it, then fetches + validates only the `available` module files, degrading
// gracefully if one is missing or invalid so the app still boots. `coming-soon`
// modules have no file yet — they exist in the roadmap but are never fetched.
import { validateContent } from './schema.js';

/** @typedef {import('./types.js').ContentFile} ContentFile */

/** @param {any} v */
const isBi = (v) => v && typeof v.en === 'string' && typeof v.es === 'string';
const STATUS = new Set(['available', 'coming-soon']);

/**
 * @param {unknown} data
 * @returns {{ ok: true, manifest: any[] } | { ok: false, errors: string[] }}
 */
export function validateManifest(data) {
  /** @type {string[]} */
  const e = [];
  /** @type {any} */
  const d = data;
  const mods = d?.modules;
  if (!Array.isArray(mods) || mods.length === 0) return { ok: false, errors: ['modules[] required'] };
  /** @type {Set<string>} */
  const ids = new Set();
  /** @type {number[]} */
  const orders = [];
  for (const m of mods) {
    if (typeof m.id !== 'string') { e.push('module.id missing'); } else {
      if (ids.has(m.id)) e.push(`duplicate module id ${m.id}`);
      ids.add(m.id);
    }
    if (!STATUS.has(m.status)) e.push(`module ${m.id}: bad status ${m.status}`);
    if (typeof m.file !== 'string') e.push(`module ${m.id}: file missing`);
    if (!isBi(m.title)) e.push(`module ${m.id}: title must be bilingual`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(m.accent ?? '')) e.push(`module ${m.id}: accent must be a hex color`);
    orders.push(m.order);
  }
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted.some((o, i) => o !== i + 1)) e.push('order must be a permutation of 1..N');
  return e.length ? { ok: false, errors: e } : { ok: true, manifest: mods };
}

/**
 * @typedef {{ manifest: any[], modules: Map<string, ContentFile> }} Catalog
 */

/**
 * Load the manifest and every `available` module. Throws only if the manifest
 * itself is invalid; a single bad module file is logged and skipped.
 * @param {(url: string) => Promise<{ ok: boolean, json: () => Promise<any> }>} fetchFn
 * @param {string} [base]
 * @returns {Promise<Catalog>}
 */
export async function loadCatalog(fetchFn, base = './content/') {
  const res = await fetchFn(base + 'index.json');
  const data = await res.json();
  const v = validateManifest(data);
  if (!v.ok) throw new Error('Manifiesto inválido: ' + JSON.stringify(v.errors));
  /** @type {Map<string, ContentFile>} */
  const modules = new Map();
  for (const entry of v.manifest) {
    if (entry.status !== 'available') continue; // coming-soon has no file yet
    try {
      const mres = await fetchFn(base + entry.file);
      if (!mres.ok) throw new Error('fetch failed');
      const mval = validateContent(await mres.json());
      if (!mval.ok) throw new Error(JSON.stringify(mval.errors));
      modules.set(entry.id, mval.content);
    } catch (err) {
      // Degrade: keep booting with the modules that did load.
      console.warn(`Módulo ${entry.id} omitido:`, err instanceof Error ? err.message : err);
    }
  }
  return { manifest: v.manifest, modules };
}

/** @param {Catalog} cat */
export const allItems = (cat) => [...cat.modules.values()].flatMap((c) => c.module.items);

/** @param {Catalog} cat */
export const allTopics = (cat) => [...cat.modules.values()].flatMap((c) => c.module.topics);

/**
 * @param {Catalog} cat
 * @param {string} id
 * @returns {{ topic: any, moduleId: string, content: ContentFile } | null}
 */
export function findTopic(cat, id) {
  for (const [moduleId, content] of cat.modules) {
    const topic = content.module.topics.find((t) => t.id === id);
    if (topic) return { topic, moduleId, content };
  }
  return null;
}
