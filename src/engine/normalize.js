/** @typedef {import('./types.js').Item} Item */

/**
 * Canonicalize a typed answer for tolerant comparison: trim, lowercase,
 * unify curly apostrophes to straight, and collapse runs of whitespace.
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  return s.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/**
 * True when `input` matches the item's answer or any accepted variant,
 * ignoring case, surrounding/duplicate spaces, and apostrophe style.
 * @param {string} input
 * @param {Pick<Item, 'answer' | 'accept'>} item
 * @returns {boolean}
 */
export function isCorrect(input, item) {
  const targets = new Set([item.answer, ...(item.accept ?? [])].map(normalize));
  return targets.has(normalize(input));
}
