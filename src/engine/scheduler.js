import { fsrs, generatorParameters, createEmptyCard, Rating, State } from '../../vendor/ts-fsrs.js';

/** @typedef {import('../../vendor/ts-fsrs.js').Card} Card */
/** @typedef {import('../../vendor/ts-fsrs.js').Grade} Grade */

const engine = fsrs(generatorParameters({ enable_fuzz: true }));

/**
 * A fresh, unreviewed card, due immediately.
 * @param {Date} [now]
 * @returns {Card}
 */
export function newCard(now = new Date()) {
  return createEmptyCard(now);
}

/**
 * Apply a rating and return the next scheduled card.
 * @param {Card} card
 * @param {Grade} rating
 * @param {Date} [now]
 * @returns {Card}
 */
export function review(card, rating, now = new Date()) {
  return engine.next(card, now, rating).card;
}

/**
 * @param {Card} card
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isDue(card, now = new Date()) {
  return new Date(card.due) <= now;
}

/**
 * @param {Card} card
 * @returns {boolean}
 */
export function isNew(card) {
  return card.state === State.New;
}

export { Rating };
