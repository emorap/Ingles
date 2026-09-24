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
  const { moduleContent, entry, progress, lessonViewed, onOpenTopic } = ctx;
  const mod = moduleContent.module;
  clear(container);

  const section = document.createElement('section');
  section.className = 'module';
  section.setAttribute('data-view', 'module');
  if (entry?.accent) section.style.setProperty('--module-accent', entry.accent);

  const header = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = mod.title.es;
  const sub = document.createElement('p');
  sub.className = 'module-subtitle muted';
  sub.textContent = mod.title.en;
  header.append(h2, sub);
  section.append(header);

  const list = document.createElement('ol');
  list.className = 'topic-rows';
  for (const topic of mod.topics) {
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
    list.append(li);
  }
  section.append(list);
  container.append(section);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
