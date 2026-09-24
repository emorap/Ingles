// Hub view: the home screen. A big "practice today" CTA (size from the SRS
// scheduler), a searchable list of topic cards each with a mastery ring.
// Streak lives in the app header (see app.js), not duplicated here.
// ctx = { content, progress, stats, onPractice, onOpenTopic, newPerDay?, cap?, now? }
import { progressRing } from '../components/progress-ring.js';
import { buildSession } from '../../engine/session.js';

export const HUB_DEFAULTS = { newPerDay: 10, cap: 20 };
const MASTERY_STABILITY = 21; // days — matches analytics "mastered"

/**
 * @param {HTMLElement} container
 * @param {{ content: any, progress: Map<string, any>, stats?: any,
 *           onPractice?: () => void, onOpenTopic?: (id: string) => void,
 *           newPerDay?: number, cap?: number, now?: Date }} ctx
 */
export function renderHub(container, ctx) {
  const { content, progress, onPractice, onOpenTopic } = ctx;
  const accent = content.module.accent;
  clear(container);

  const section = document.createElement('section');
  section.className = 'hub';
  section.setAttribute('data-view', 'hub');

  // --- Practice CTA: session size straight from buildSession ---
  const opts = {
    newPerDay: ctx.newPerDay ?? HUB_DEFAULTS.newPerDay,
    cap: ctx.cap ?? HUB_DEFAULTS.cap,
    now: ctx.now,
  };
  const size = buildSession(content.module.items, progress, opts).length;
  const minutes = Math.max(1, Math.round(size * 0.5));
  const cta = document.createElement('button');
  cta.className = 'btn cta';
  cta.type = 'button';
  cta.setAttribute('data-action', 'practice');
  cta.textContent = `Practicar lo de hoy (${size} · ~${minutes} min)`;
  if (size === 0) cta.setAttribute('disabled', '');
  cta.addEventListener('click', () => onPractice?.());
  section.append(cta);

  // --- Topic search ---
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'topic-search';
  search.setAttribute('data-role', 'topic-search');
  search.setAttribute('placeholder', 'Buscar tema…');
  search.setAttribute('aria-label', 'Buscar tema');
  section.append(search);

  // --- Topic cards ---
  const list = document.createElement('ul');
  list.className = 'topic-cards';
  const cards = [];
  for (const topic of content.module.topics) {
    const li = document.createElement('li');
    li.className = 'topic-card surface';
    li.setAttribute('data-topic', topic.id);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'topic-card-btn';
    btn.setAttribute('aria-label', `Abrir ${topic.title.es}`);
    btn.addEventListener('click', () => onOpenTopic?.(topic.id));
    btn.append(progressRing(topicPercent(topic.id, content.module.items, progress), accent));

    const label = document.createElement('span');
    label.className = 'topic-title';
    label.textContent = topic.title.es;
    btn.append(label);

    li.append(btn);
    list.append(li);
    cards.push({ li, topic });
  }
  section.append(list);

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const { li, topic } of cards) {
      const hay = `${topic.title.en} ${topic.title.es}`.toLowerCase();
      if (q === '' || hay.includes(q)) li.removeAttribute('hidden');
      else li.setAttribute('hidden', '');
    }
  });

  container.append(section);
}

function topicPercent(topicId, items, progress) {
  const topicItems = items.filter((i) => i.topic === topicId);
  if (topicItems.length === 0) return 0;
  let mastered = 0;
  for (const it of topicItems) {
    const p = progress.get(it.id);
    if (p?.card && p.card.stability >= MASTERY_STABILITY) mastered++;
  }
  return Math.round((mastered / topicItems.length) * 100);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
