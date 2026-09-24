// Shared content + progress types for Momentum, expressed as JSDoc typedefs.
// No-build toolchain: these are documentation/IDE hints, not runtime values.
// Consumed everywhere via `@typedef {import('./types.js').X} X`.

/** @typedef {'en' | 'es'} Lang */

/** @typedef {Record<Lang, string>} Bilingual */

/** @typedef {'cloze' | 'choice' | 'natural' | 'order' | 'match'} ItemType */

/**
 * A content block inside a topic's explanation.
 * @typedef {(
 *   { kind: 'p', text: Bilingual } |
 *   { kind: 'callout', text: Bilingual } |
 *   { kind: 'pitfall', text: Bilingual } |
 *   { kind: 'quote', text: Bilingual } |
 *   { kind: 'table', headers: string[], rows: string[][] }
 * )} Block
 */

/**
 * A practice item. SRS state is NOT stored here — it lives in IndexedDB keyed by `id`.
 * @typedef {object} Item
 * @property {string} id
 * @property {string} topic
 * @property {ItemType} type
 * @property {Bilingual} prompt
 * @property {string} answer
 * @property {string[]} [accept]
 * @property {string[]} [distractors]
 * @property {Bilingual} why
 * @property {string[]} [tags]
 */

/**
 * @typedef {object} Topic
 * @property {string} id
 * @property {Bilingual} title
 * @property {Bilingual} coreIdea one-sentence essence, shown above the lesson
 * @property {string} [source]
 * @property {Block[]} explanation
 * @property {string[]} [diagrams]
 * @property {{ voice?: string }} [audio]
 * @property {{ en: string, es: string }[]} [examples]
 * @property {string[]} [related]
 * @property {string[]} items
 */

/**
 * @typedef {object} Module
 * @property {string} id
 * @property {Bilingual} title
 * @property {string} accent
 * @property {Topic[]} topics
 * @property {Item[]} items
 */

/**
 * @typedef {object} ContentFile
 * @property {number} version
 * @property {Module} module
 */

/**
 * Per-item study progress. `card` is a ts-fsrs Card.
 * @typedef {object} ItemProgress
 * @property {string} itemId
 * @property {import('../../vendor/ts-fsrs.js').Card} card
 * @property {number} seen
 * @property {number} correct
 */

export {};
