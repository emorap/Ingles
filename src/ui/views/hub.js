// Hub view: the home screen and the roadmap. A big "practice today" CTA (size
// from the SRS scheduler over every loaded module), then one card per module in
// the manifest, in recommended order. Available modules are buttons into the
// module view with an aggregate mastery ring; coming-soon modules show the full
// route ("Próximamente") but aren't navigable yet. Guide, don't gate: the first
// available not-mastered module is marked as the suggested next step, never
// forced. Streak lives in the app header (see app.js). No innerHTML.
import { progressRing } from '../components/progress-ring.js';
import { buildSession } from '../../engine/session.js';
import { allItems } from '../../engine/catalog.js';

export const HUB_DEFAULTS = { newPerDay: 10, cap: 20 };
const MASTERY_STABILITY = 21; // days — matches analytics "mastered"

/**
 * @param {HTMLElement} container
 * @param {{ catalog: import('../../engine/catalog.js').Catalog, progress: Map<string, any>,
 *           onPractice?: () => void, onOpenModule?: (id: string) => void,
 *           newPerDay?: number, cap?: number, now?: Date }} ctx
 */
export function renderHub(container, ctx) {
  const { catalog, progress, onPractice, onOpenModule } = ctx;
  clear(container);

  const section = document.createElement('section');
  section.className = 'hub';
  section.setAttribute('data-view', 'hub');

  // --- Practice CTA: session size straight from buildSession over all modules ---
  const opts = {
    newPerDay: ctx.newPerDay ?? HUB_DEFAULTS.newPerDay,
    cap: ctx.cap ?? HUB_DEFAULTS.cap,
    now: ctx.now,
  };
  const size = buildSession(allItems(catalog), progress, opts).length;
  const minutes = Math.max(1, Math.round(size * 0.5));
  const cta = document.createElement('button');
  cta.className = 'btn cta';
  cta.type = 'button';
  cta.setAttribute('data-action', 'practice');
  cta.textContent = `Practicar lo de hoy (${size} · ~${minutes} min)`;
  if (size === 0) cta.setAttribute('disabled', '');
  cta.addEventListener('click', () => onPractice?.());
  section.append(cta);

  // --- Search: filters module cards by module title or a contained topic title ---
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'topic-search';
  search.setAttribute('data-role', 'topic-search');
  search.setAttribute('placeholder', 'Buscar módulo o tema…');
  search.setAttribute('aria-label', 'Buscar módulo o tema');
  section.append(search);

  // --- Module cards, in recommended order ---
  const ordered = [...catalog.manifest].sort((a, b) => a.order - b.order);
  // Suggested next: first available module not yet fully mastered.
  const nextId = ordered.find((e) => {
    const c = catalog.modules.get(e.id);
    return e.status === 'available' && c && modulePercent(c, progress) < 100;
  })?.id;

  const list = document.createElement('ul');
  list.className = 'module-cards';
  const cards = [];
  for (const entry of ordered) {
    const content = catalog.modules.get(entry.id);
    const available = entry.status === 'available' && !!content;
    const li = document.createElement('li');
    li.className = 'module-card surface';
    li.setAttribute('data-module', entry.id);
    li.setAttribute('data-status', available ? 'available' : 'coming-soon');
    if (entry.id === nextId) li.setAttribute('data-next', 'true');

    const order = document.createElement('span');
    order.className = 'module-order';
    order.setAttribute('aria-hidden', 'true');
    order.textContent = String(entry.order);

    if (available) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'module-card-btn';
      btn.style.setProperty('--module-accent', entry.accent);
      btn.setAttribute('aria-label', `Abrir ${entry.title.es}`);
      btn.addEventListener('click', () => onOpenModule?.(entry.id));
      btn.append(order, progressRing(modulePercent(content, progress), entry.accent));

      const label = document.createElement('span');
      label.className = 'module-title';
      label.textContent = entry.title.es;
      btn.append(label);

      if (entry.id === nextId) {
        const next = document.createElement('span');
        next.className = 'module-next-badge';
        next.textContent = 'Siguiente';
        btn.append(next);
      }
      li.append(btn);
    } else {
      // coming-soon: shown in the roadmap, not navigable (no content yet).
      const inner = document.createElement('div');
      inner.className = 'module-card-soon';

      const label = document.createElement('span');
      label.className = 'module-title';
      label.textContent = entry.title.es;

      const soon = document.createElement('span');
      soon.className = 'module-coming';
      soon.textContent = 'Próximamente';

      inner.append(order, label, soon);
      li.append(inner);
    }

    list.append(li);
    cards.push({ li, entry, content });
  }
  section.append(list);

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const { li, entry, content } of cards) {
      const topicText = (content?.module.topics ?? [])
        .map((t) => `${t.title.en} ${t.title.es}`).join(' ');
      const hay = `${entry.title.en} ${entry.title.es} ${topicText}`.toLowerCase();
      if (q === '' || hay.includes(q)) li.removeAttribute('hidden');
      else li.setAttribute('hidden', '');
    }
  });

  container.append(section);
}

/** Aggregate mastery of a module: mature items / total items, as a percent. */
function modulePercent(content, progress) {
  const items = content.module.items;
  if (items.length === 0) return 0;
  let mastered = 0;
  for (const it of items) {
    const p = progress.get(it.id);
    if (p?.card && p.card.stability >= MASTERY_STABILITY) mastered++;
  }
  return Math.round((mastered / items.length) * 100);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
