// The AI tutor contract. This is an optional ONLINE realce layered on top of
// the fully-offline core: every provider method may reject (network, quota,
// timeout) and callers must degrade gracefully. Documentation only — no
// runtime. Concrete implementation: gemini.js.

/** @typedef {import('../engine/types.js').Item} Item */

/**
 * @typedef {Object} AITutorProvider
 * @property {(topic: any, itemContext?: any) => Promise<string>} explain
 *   A plain-Spanish explanation of a topic, with English examples.
 * @property {(item: Item, given: string) => Promise<string>} whyWrong
 *   Why the learner's answer was wrong and what the right idea is.
 * @property {(topic: any, n: number) => Promise<Item[]>} generateItems
 *   Fresh practice items for a topic; output is schema-validated by the caller.
 * @property {(history: { role: string, text: string }[]) => Promise<string>} chat
 *   Free-form English-learning chat grounded in the conversation so far.
 */

export {};
