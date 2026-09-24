// Practice view: the core learning loop. Walks a session of items one at a
// time — retrieve, grade locally, rate, schedule (FSRS), persist — then a
// short summary. 100% offline: nothing here calls the network.
import { practiceCard } from '../components/practice-card.js';
import { newCard, review } from '../../engine/scheduler.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   items: import('../../engine/types.js').Item[],
 *   progress: Map<string, any>,
 *   store: { putProgress: (rec: any) => Promise<void> },
 *   onDone?: (results: { correct: number, total: number }) => void,
 *   now?: Date,
 *   voice?: string,
 * }} ctx
 */
export function renderPractice(container, { items, progress, store, onDone, now = new Date(), voice }) {
  let i = 0;
  const total = items.length;
  const results = { correct: 0, total };

  const persist = async (item, rating, wasCorrect) => {
    const prev = progress.get(item.id);
    const card = review(prev?.card ?? newCard(now), rating, now);
    const rec = {
      itemId: item.id,
      card,
      seen: (prev?.seen ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (wasCorrect ? 1 : 0),
    };
    progress.set(item.id, rec);
    await store.putProgress(rec);
  };

  const showNext = () => {
    clear(container);
    if (i >= total) {
      container.append(summary(results));
      onDone?.(results);
      return;
    }
    const item = items[i];
    const section = document.createElement('section');
    section.className = 'practice';
    section.setAttribute('data-view', 'practice');

    const progressLabel = document.createElement('p');
    progressLabel.className = 'practice-progress muted';
    progressLabel.textContent = `${i + 1} / ${total}`;
    section.append(progressLabel);

    section.append(practiceCard(item, {
      voice,
      onRate: async (rating, wasCorrect) => {
        await persist(item, rating, wasCorrect);
        if (wasCorrect) results.correct += 1;
        i += 1;
        showNext();
      },
    }));

    container.append(section);
  };

  showNext();
}

function summary({ correct, total }) {
  const box = document.createElement('section');
  box.className = 'practice-summary surface';
  box.setAttribute('data-role', 'summary');
  const h = document.createElement('h2');
  h.textContent = '¡Sesión completa!';
  const p = document.createElement('p');
  p.textContent = `Acertaste ${correct} de ${total}.`;
  box.append(h, p);
  return box;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
