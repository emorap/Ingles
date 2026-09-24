/** @typedef {import('./types.js').ContentFile} ContentFile */
/** @typedef {import('./types.js').Item} Item */
/** @typedef {import('./types.js').ItemType} ItemType */

/** @type {ItemType[]} */
const TYPES = ['cloze', 'choice', 'natural', 'order', 'match'];

/** @param {any} v */
const isBi = (v) => v && typeof v.en === 'string' && typeof v.es === 'string';

/**
 * Validate a single item in isolation — used to vet AI-generated items before
 * they enter a session. Stricter than the content-file loop: it also requires
 * a bilingual `prompt` (needed to render) and distractors for choice items.
 * @param {any} it
 * @returns {boolean}
 */
export function validateItem(it) {
  return Boolean(
    it
    && typeof it.id === 'string' && it.id.length > 0
    && TYPES.includes(it.type)
    && isBi(it.prompt)
    && typeof it.answer === 'string' && it.answer.length > 0
    && isBi(it.why)
    && (!it.accept || (Array.isArray(it.accept) && it.accept.includes(it.answer)))
    && (it.type !== 'choice' || (Array.isArray(it.distractors) && it.distractors.length > 0)),
  );
}

/**
 * Validate a parsed content file against Momentum's content invariants:
 * every item has a valid type, an answer, and a bilingual `why`; `accept`
 * (when present) includes the answer; every topic->item reference resolves.
 * @param {unknown} data
 * @returns {{ ok: true, content: ContentFile } | { ok: false, errors: string[] }}
 */
export function validateContent(data) {
  /** @type {string[]} */
  const e = [];
  /** @type {any} */
  const d = data;
  if (!d || typeof d !== 'object') return { ok: false, errors: ['root is not an object'] };
  if (typeof d.version !== 'number') e.push('version must be a number');
  const m = d.module;
  if (!m || typeof m !== 'object') return { ok: false, errors: ['module missing'] };
  if (typeof m.id !== 'string') e.push('module.id missing');
  if (!/^#[0-9A-Fa-f]{6}$/.test(m.accent ?? '')) e.push('module.accent must be a hex color');
  /** @type {Set<string>} */
  const itemIds = new Set();
  for (const it of (m.items ?? [])) {
    if (typeof it.id !== 'string') { e.push('item.id missing'); continue; }
    itemIds.add(it.id);
    if (!TYPES.includes(it.type)) e.push(`item ${it.id}: invalid type ${it.type}`);
    if (typeof it.answer !== 'string' || !it.answer) e.push(`item ${it.id}: answer required`);
    if (!isBi(it.why)) e.push(`item ${it.id}: why must be bilingual`);
    if (it.accept && !it.accept.includes(it.answer)) e.push(`item ${it.id}: accept must include answer`);
  }
  for (const t of (m.topics ?? [])) {
    for (const ref of (t.items ?? [])) if (!itemIds.has(ref)) e.push(`topic ${t.id}: unresolved item ${ref}`);
    // `related` may point to topics in other modules; that is checked cross-module at load time.
  }
  return e.length ? { ok: false, errors: e } : { ok: true, content: /** @type {ContentFile} */ (d) };
}
