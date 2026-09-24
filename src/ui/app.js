// App shell + composition root for the view layer. Opens the DB, applies the
// persisted theme, builds the header/nav, then either runs first-run onboarding
// or wires the hash router to renderRoute. renderRoute is the one place that
// turns a route into a rendered view and connects the pure views to the store:
// practice → logMistake / streak, settings → persist + live-apply, topic/
// practice → the AI tutor (only when getTutor resolves one). No innerHTML.
import { Store } from '../engine/db.js';
import { onRoute, go } from '../router.js';
import { streakChip } from './components/streak-chip.js';
import { renderHub, HUB_DEFAULTS } from './views/hub.js';
import { renderTopic } from './views/topic.js';
import { renderPractice } from './views/practice.js';
import { renderInsights } from './views/insights.js';
import { renderSettings } from './views/settings.js';
import { renderOnboarding, maybeOnboard, finishOnboarding } from './views/onboarding.js';
import { selectItems } from './session-select.js';
import { computeStats } from '../engine/analytics.js';
import { logMistake } from '../engine/mistakes.js';
import { recordStudyDay } from '../engine/streak.js';
import { getTutor } from '../ai/tutor.js';
import { listVoices } from '../audio/tts.js';

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
  let newPerDay = await store.getMeta('newPerDay', HUB_DEFAULTS.newPerDay);
  let voice = await store.getMeta('voice', '');
  const streak = await store.getMeta('streak', 0);

  applyTheme(theme, content.module.accent);

  const view = document.createElement('main');
  view.id = 'view';

  const headerApi = buildHeader(content, streak, () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, content.module.accent);
    store.setMeta('theme', theme);
  });

  clear(root);
  root.append(headerApi.header, buildNav(), view);

  let currentRoute = { view: 'hub' };

  /** @type {any} */
  const deps = {
    content,
    store,
    progress,
    cap: HUB_DEFAULTS.cap,
    navigate: go,
    get newPerDay() { return newPerDay; },
    get voice() { return voice; },
    // Live-apply a settings change, then re-render the current view.
    onChanged: async (key, value) => {
      if (key === 'theme') { theme = value; applyTheme(theme, content.module.accent); }
      if (key === 'newPerDay') newPerDay = value;
      if (key === 'voice') voice = value;
      await renderRoute(view, currentRoute, deps);
    },
    // AI-generated items join the module in memory, then we practice them.
    onGenerated: (topicId, items) => { content.module.items.push(...items); go('practice', topicId); },
    // A finished session advances the daily streak and refreshes the header.
    onStudyComplete: async (now) => { headerApi.setStreak(await recordStudyDay(store, now ?? new Date())); },
  };

  const startRouting = () => onRoute((route) => { currentRoute = route; renderRoute(view, route, deps); });

  if (await maybeOnboard(store)) {
    renderOnboarding(view, async ({ newPerDay: goal }) => {
      await finishOnboarding(store, { newPerDay: goal });
      newPerDay = goal;
      startRouting();
      go('hub');
    });
  } else {
    startRouting();
  }
}

/**
 * Render one route into `view`, wiring the pure views to the store/navigation.
 * Exported so the composition can be tested without the hash router.
 * @param {HTMLElement} view
 * @param {{ view: string, param?: string }} route
 * @param {any} deps
 */
export async function renderRoute(view, route, deps) {
  clear(view);
  const { content, store, progress } = deps;
  const now = deps.now;

  switch (route.view) {
    case 'topic': {
      const topic = content.module.topics.find((t) => t.id === route.param);
      if (!topic) { deps.navigate('hub'); return; }
      const tutor = await getTutor(store);
      renderTopic(view, {
        topic,
        onPractice: (id) => deps.navigate('practice', id),
        tutor,
        onGenerated: (items) => deps.onGenerated?.(topic.id, items),
      });
      return;
    }
    case 'practice': {
      const items = await selectItems(route, {
        content, progress, store, newPerDay: deps.newPerDay, cap: deps.cap, now,
      });
      const tutor = await getTutor(store);
      renderPractice(view, {
        items, progress, store, now, voice: deps.voice, tutor,
        onWrong: (itemId, given) => logMistake(store, itemId, given),
        onDone: async () => { await deps.onStudyComplete?.(now); },
      });
      return;
    }
    case 'insights': {
      const stats = computeStats(content.module.items, progress, now ?? new Date());
      renderInsights(view, {
        stats,
        onFocusWeak: (topic) => deps.navigate('practice', topic),
        titleFor: (id) => content.module.topics.find((t) => t.id === id)?.title.es ?? id,
      });
      return;
    }
    case 'settings': {
      const [themeM, lang, newPerDay, voice, aiKey, lastBackup] = await Promise.all([
        store.getMeta('theme', 'dark'),
        store.getMeta('lang', 'es'),
        store.getMeta('newPerDay', HUB_DEFAULTS.newPerDay),
        store.getMeta('voice', ''),
        store.getMeta('aiKey', ''),
        store.getMeta('lastBackup', undefined),
      ]);
      renderSettings(view, {
        store,
        settings: { theme: themeM, lang, newPerDay, voice, aiKey, lastBackup },
        voices: listVoices().map((v) => v.name),
        now,
        onChange: async (key, value) => {
          await store.setMeta(key, value);
          await deps.onChanged?.(key, value);
        },
      });
      return;
    }
    default: { // 'hub'
      renderHub(view, {
        content, progress, now,
        newPerDay: deps.newPerDay, cap: deps.cap,
        onPractice: () => deps.navigate('practice'),
        onOpenTopic: (id) => deps.navigate('topic', id),
      });
    }
  }
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
  let chip = streakChip(streak);
  actions.append(chip);

  const toggle = document.createElement('button');
  toggle.className = 'btn ghost';
  toggle.type = 'button';
  toggle.setAttribute('data-action', 'toggle-theme');
  toggle.setAttribute('aria-label', 'Cambiar tema claro u oscuro');
  toggle.textContent = '🌓';
  toggle.addEventListener('click', onToggle);
  actions.append(toggle);

  header.append(title, actions);
  return {
    header,
    setStreak(n) { const next = streakChip(n); actions.replaceChild(next, chip); chip = next; },
  };
}

function buildNav() {
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  const links = [
    ['hub', 'Inicio', undefined],
    ['practice', 'Mis errores', 'mistakes'],
    ['insights', 'Progreso', undefined],
    ['settings', 'Ajustes', undefined],
  ];
  for (const [view, label, param] of links) {
    const a = document.createElement('a');
    a.href = `#/${view}${param ? '/' + param : ''}`;
    a.setAttribute('data-route', param ?? view);
    a.textContent = label;
    nav.append(a);
  }
  return nav;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
