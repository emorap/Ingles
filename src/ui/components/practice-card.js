// Practice card: one retrieval-first item. Prompt → the learner answers
// (typed for cloze/natural, buttons for choice) → we grade with isCorrect →
// reveal the answer + why (bilingual, with audio) → 4 rating buttons (keyboard
// 1–4) → onRate(rating, wasCorrect). No network: grading is 100% local.
import { isCorrect } from '../../engine/normalize.js';
import { Rating } from '../../engine/scheduler.js';
import { bilingualCallout } from './bilingual-callout.js';

const RATINGS = [
  ['again', 'Otra vez', Rating.Again, '1'],
  ['hard', 'Difícil', Rating.Hard, '2'],
  ['good', 'Bien', Rating.Good, '3'],
  ['easy', 'Fácil', Rating.Easy, '4'],
];

/**
 * @param {import('../../engine/types.js').Item} item
 * @param {{ onRate?: (rating: number, wasCorrect: boolean) => void, voice?: string }} [ctx]
 * @returns {HTMLElement}
 */
export function practiceCard(item, { onRate, voice } = {}) {
  const card = document.createElement('article');
  card.className = 'practice-card surface';
  card.setAttribute('data-item', item.id);

  const prompt = document.createElement('p');
  prompt.className = 'practice-prompt';
  prompt.setAttribute('lang', 'en');
  prompt.textContent = item.prompt.en;

  const promptEs = document.createElement('p');
  promptEs.className = 'practice-prompt-es muted';
  promptEs.setAttribute('lang', 'es');
  promptEs.textContent = item.prompt.es;

  const answerRegion = document.createElement('div');
  answerRegion.className = 'practice-answer';

  const feedback = document.createElement('div');
  feedback.className = 'practice-feedback';
  feedback.setAttribute('data-role', 'feedback');
  feedback.setAttribute('aria-live', 'polite');

  card.append(prompt, promptEs, answerRegion, feedback);

  let answered = false;
  let keyHandler = null;

  const rate = (rating, wasCorrect) => {
    if (keyHandler) { removeEventListener('keydown', keyHandler); keyHandler = null; }
    onRate?.(rating, wasCorrect);
  };

  const reveal = (wasCorrect) => {
    if (answered) return;
    answered = true;
    for (const el of [...answerRegion.querySelectorAll('input, button')]) el.setAttribute('disabled', '');

    const verdict = document.createElement('p');
    verdict.className = `verdict ${wasCorrect ? 'ok' : 'no'}`;
    verdict.textContent = wasCorrect ? '¡Correcto!' : `No exactamente. Respuesta: ${item.answer}`;
    feedback.append(verdict);

    const why = bilingualCallout(item.why, { voice, kind: 'why' });
    feedback.append(why);

    const ratings = document.createElement('div');
    ratings.className = 'practice-ratings';
    for (const [key, label, rating, digit] of RATINGS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn rating';
      b.setAttribute('data-rating', key);
      b.setAttribute('aria-keyshortcuts', digit);
      b.textContent = `${digit} · ${label}`;
      b.addEventListener('click', () => rate(rating, wasCorrect));
      ratings.append(b);
    }
    feedback.append(ratings);

    keyHandler = (e) => {
      const found = RATINGS.find((r) => r[3] === e.key);
      if (found) rate(found[2], wasCorrect);
    };
    addEventListener('keydown', keyHandler);
  };

  if (item.type === 'choice') {
    for (const opt of shuffle([item.answer, ...(item.distractors ?? [])])) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost choice';
      b.setAttribute('data-role', 'choice');
      b.textContent = opt;
      b.addEventListener('click', () => reveal(isCorrect(opt, item)));
      answerRegion.append(b);
    }
  } else {
    // cloze / natural (and order/match fallback): typed entry
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'answer-input';
    input.setAttribute('data-role', 'answer-input');
    input.setAttribute('aria-label', 'Tu respuesta');
    input.setAttribute('autocomplete', 'off');

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'btn';
    check.setAttribute('data-action', 'check');
    check.textContent = 'Comprobar';

    const submit = () => reveal(isCorrect(input.value, item));
    check.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    answerRegion.append(input, check);
  }

  return card;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
