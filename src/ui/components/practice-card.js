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
 * @param {{
 *   onRate?: (rating: number, wasCorrect: boolean, given: string) => void,
 *   voice?: string,
 *   tutor?: import('../../ai/provider.js').AITutorProvider | null,
 * }} [ctx]
 * @returns {HTMLElement}
 */
export function practiceCard(item, { onRate, voice, tutor } = {}) {
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

  const rate = (rating, wasCorrect, given) => {
    if (keyHandler) { removeEventListener('keydown', keyHandler); keyHandler = null; }
    onRate?.(rating, wasCorrect, given);
  };

  const reveal = (wasCorrect, given) => {
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
      b.addEventListener('click', () => rate(rating, wasCorrect, given));
      ratings.append(b);
    }
    feedback.append(ratings);

    // AI tutor realce — only when a tutor is available (online + key). The
    // offline core is untouched; these buttons simply don't exist otherwise.
    if (tutor) feedback.append(aiPanel(tutor, item, wasCorrect, given));

    keyHandler = (e) => {
      const found = RATINGS.find((r) => r[3] === e.key);
      if (found) rate(found[2], wasCorrect, given);
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
      b.addEventListener('click', () => reveal(isCorrect(opt, item), opt));
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

    const submit = () => reveal(isCorrect(input.value, item), input.value);
    check.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    answerRegion.append(input, check);
  }

  return card;
}

/**
 * The optional AI tutor panel shown under a revealed card. "¿Por qué fallé?"
 * appears only on a wrong answer; "Explícame más" always. Each call is async
 * and time-boxed by the provider; failures render their Spanish message.
 */
function aiPanel(tutor, item, wasCorrect, given) {
  const panel = document.createElement('div');
  panel.className = 'practice-ai';
  panel.setAttribute('data-role', 'ai-panel');

  const output = document.createElement('div');
  output.className = 'practice-ai-output muted';
  output.setAttribute('data-role', 'ai-output');
  output.setAttribute('aria-live', 'polite');

  const run = (btn, fn) => async () => {
    for (const b of panel.querySelectorAll('button')) b.setAttribute('disabled', '');
    output.textContent = 'Pensando…';
    try {
      output.textContent = await fn();
    } catch (err) {
      output.textContent = (err && err.message) ? err.message : 'No se pudo contactar la IA.';
    } finally {
      for (const b of panel.querySelectorAll('button')) b.removeAttribute('disabled');
    }
  };

  const buttons = document.createElement('div');
  buttons.className = 'practice-ai-actions';

  if (!wasCorrect) {
    const whyBtn = document.createElement('button');
    whyBtn.type = 'button';
    whyBtn.className = 'btn ghost';
    whyBtn.setAttribute('data-action', 'ai-why');
    whyBtn.textContent = '¿Por qué fallé?';
    whyBtn.addEventListener('click', run(whyBtn, () => tutor.whyWrong(item, given)));
    buttons.append(whyBtn);
  }

  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'btn ghost';
  moreBtn.setAttribute('data-action', 'ai-explain');
  moreBtn.textContent = 'Explícame más';
  moreBtn.addEventListener('click', run(moreBtn, () => tutor.explain(
    { id: item.topic },
    { prompt: item.prompt, answer: item.answer, why: item.why },
  )));
  buttons.append(moreBtn);

  panel.append(buttons, output);
  return panel;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
