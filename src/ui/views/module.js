// Module view (#/module/<id>): the topics of one module, in recommended order,
// each with its derived status (Por aprender · Aprendido · Practicando ·
// Dominado). Every topic is tappable — guide, don't gate. Pure DOM, no innerHTML.
import { topicStatus } from '../../engine/topic-status.js';

/** ES labels for each derived status. */
const STATUS_LABEL = {
  todo: 'Por aprender',
  learned: 'Aprendido',
  practicing: 'Practicando',
  mastered: 'Dominado',
};

/**
 * @param {HTMLElement} container
 * @param {{ moduleContent: import('../../engine/types.js').ContentFile,
 *           entry: { id: string, order: number, accent: string, title: import('../../engine/types.js').Bilingual },
 *           progress: Map<string, any>, lessonViewed: Record<string, number>,
 *           onOpenTopic?: (id: string) => void }} ctx
 */
export function renderModule(container, ctx) {
  const { moduleContent, entry, progress, lessonViewed, onOpenTopic, onBack } = ctx;
  const mod = moduleContent.module;
  clear(container);

  const section = document.createElement('section');
  section.className = 'module';
  section.setAttribute('data-view', 'module');
  if (entry?.accent) section.style.setProperty('--module-accent', entry.accent);

  const header = document.createElement('header');
  if (onBack) header.append(backButton(onBack));
  const h2 = document.createElement('h2');
  h2.textContent = mod.title.es;
  const sub = document.createElement('p');
  sub.className = 'module-subtitle muted';
  sub.textContent = mod.title.en;
  header.append(h2, sub);
  section.append(header);

  // One <li> for a topic: a tappable row with its title and derived status.
  const topicRow = (topic) => {
    const status = topicStatus(topic, mod.items, progress, lessonViewed ?? {});
    const li = document.createElement('li');
    li.className = 'topic-row surface';
    li.setAttribute('data-topic', topic.id);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'topic-row-btn';
    btn.setAttribute('aria-label', `Abrir ${topic.title.es}`);
    btn.addEventListener('click', () => onOpenTopic?.(topic.id));

    const name = document.createElement('span');
    name.className = 'topic-row-title';
    name.textContent = topic.title.es;

    const badge = document.createElement('span');
    badge.className = 'topic-status';
    badge.setAttribute('data-status', status);
    badge.textContent = STATUS_LABEL[status];

    btn.append(name, badge);
    li.append(btn);
    return li;
  };

  const rowList = (topics) => {
    const list = document.createElement('ol');
    list.className = 'topic-rows';
    for (const topic of topics) list.append(topicRow(topic));
    return list;
  };

  if (mod.groups?.length) {
    // Grouped: one labelled section per declared family, in declared order, so a
    // large module (14 tenses) reads as Presente · Pasado · Futuro, not a pile.
    for (const group of mod.groups) {
      const topics = mod.topics.filter((t) => t.group === group.id);
      if (!topics.length) continue;
      const groupSection = document.createElement('section');
      groupSection.className = 'topic-group';
      groupSection.setAttribute('data-group', group.id);
      const h3 = document.createElement('h3');
      h3.className = 'topic-group-title';
      h3.textContent = group.title.es;
      const en = document.createElement('span');
      en.className = 'topic-group-en muted';
      en.setAttribute('lang', 'en');
      en.textContent = group.title.en;
      h3.append(' ', en);
      groupSection.append(h3, rowList(topics));
      section.append(groupSection);
    }
    // Any topic without a declared family still shows — guide, don't drop.
    const orphans = mod.topics.filter((t) => !mod.groups.some((g) => g.id === t.group));
    if (orphans.length) section.append(rowList(orphans));
  } else {
    section.append(rowList(mod.topics));
  }
  container.append(section);
}

// A contextual "← Volver" control so a learner can step back one level (module
// → hub) instead of losing their place — there's no browser chrome in the PWA.
function backButton(onBack) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost back';
  btn.setAttribute('data-action', 'back');
  btn.textContent = '← Volver';
  btn.addEventListener('click', () => onBack());
  return btn;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
