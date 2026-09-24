// App shell: header (title + streak + theme toggle), nav landmark, and a
// routed <main id="view">. Opens the DB, loads progress, applies theme, and
// wires the hash router to a view container. View bodies are stubbed here and
// filled by later tasks (hub, practice, insights, settings). No innerHTML.
import { Store } from '../engine/db.js';
import { onRoute } from '../router.js';
import { createStore } from '../store.js';
import { streakChip } from './components/streak-chip.js';

/**
 * @param {HTMLElement} root
 * @param {import('../engine/types.js').ContentFile} content validated content
 * @param {InstanceType<typeof Store>} [store] injectable for tests
 * @returns {Promise<void>}
 */
export async function mountApp(root, content, store = new Store()) {
  await store.open();
  const progress = await store.allProgress();
  let theme = await store.getMeta('theme', 'dark');
  const streak = await store.getMeta('streak', 0);

  applyTheme(theme, content.module.accent);

  const ui = createStore({ content, progress, store });

  const view = document.createElement('main');
  view.id = 'view';

  const header = buildHeader(content, streak, () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, content.module.accent);
    store.setMeta('theme', theme);
  });

  clear(root);
  root.append(header, buildNav(), view);

  onRoute((route) => renderView(view, route, ui));
}

function applyTheme(theme, accent) {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  if (accent) html.style.setProperty('--color-primary', accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F8FAFC' : '#0F172A');
}

function buildHeader(content, streak, onToggle) {
  const header = document.createElement('header');
  header.className = 'app-header surface';

  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = content.module.title.es;

  const actions = document.createElement('div');
  actions.className = 'app-header-actions';
  actions.append(streakChip(streak));

  const toggle = document.createElement('button');
  toggle.className = 'btn ghost';
  toggle.type = 'button';
  toggle.setAttribute('data-action', 'toggle-theme');
  toggle.setAttribute('aria-label', 'Cambiar tema claro u oscuro');
  toggle.textContent = '🌓';
  toggle.addEventListener('click', onToggle);
  actions.append(toggle);

  header.append(title, actions);
  return header;
}

function buildNav() {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  for (const [view, label] of [['hub', 'Inicio'], ['insights', 'Progreso'], ['settings', 'Ajustes']]) {
    const a = document.createElement('a');
    a.href = `#/${view}`;
    a.setAttribute('data-route', view);
    a.textContent = label;
    nav.append(a);
  }
  return nav;
}

// Stub view dispatch — later tasks replace each branch with a real renderer.
function renderView(view, route, _ui) {
  clear(view);
  const section = document.createElement('section');
  section.setAttribute('data-view', route.view);
  const h = document.createElement('h2');
  h.textContent = route.view;
  section.append(h);
  view.append(section);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
