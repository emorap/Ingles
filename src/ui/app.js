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
import { renderModule } from './views/module.js';
import { renderTopic } from './views/topic.js';
import { renderPractice } from './views/practice.js';
import { renderInsights } from './views/insights.js';
import { renderSettings } from './views/settings.js';
import { renderOnboarding, maybeOnboard, finishOnboarding } from './views/onboarding.js';
import { selectItems } from './session-select.js';
import { allItems, findTopic } from '../engine/catalog.js';
import { computeStats } from '../engine/analytics.js';
import { logMistake } from '../engine/mistakes.js';
import { recordStudyDay } from '../engine/streak.js';
import { getTutor, isOnline } from '../ai/tutor.js';
import { listVoices } from '../audio/tts.js';
import { speakSmart } from '../audio/voice.js';
import { TTS_VOICES } from '../audio/gemini-tts.js';
import { renderDialogue } from './views/dialogue.js';
import { recognizeOnce, recognitionAvailable } from '../audio/speech.js';
import { SCENARIOS } from '../../content/scenarios.js';

/**
 * @param {HTMLElement} root
 * @param {import('../engine/catalog.js').Catalog} catalog loaded module catalog
 * @param {InstanceType<typeof Store>} [store] injectable for tests
 * @returns {Promise<void>}
 */
export async function mountApp(root, catalog, store = new Store()) {
  await store.open();
  const progress = await store.allProgress();
  let theme = await store.getMeta('theme', 'dark');
  let newPerDay = await store.getMeta('newPerDay', HUB_DEFAULTS.newPerDay);
  let voice = await store.getMeta('voice', '');
  // Natural-voice (Gemini TTS) settings: the prebuilt voice name and the
  // learner's own key. Both feed speakSmart; empty ttsVoice/key just means the
  // browser voice is used. Kept in `let`s so onChanged applies edits live.
  let ttsVoice = await store.getMeta('ttsVoice', '');
  let aiKey = await store.getMeta('aiKey', '');
  const streak = await store.getMeta('streak', 0);
  // Which topics the learner has already opened the lesson for — drives the
  // "Aprendido" status on the module roadmap even before any practice.
  const lessonViewed = await store.getMeta('lessonViewed', {});

  // The global primary accent follows the first available module (indigo for
  // Tiempos today). Per-module accents on the roadmap cards come from the
  // manifest; a future module view can re-apply its own accent on entry.
  const accent = activeModule(catalog)?.module.accent;
  applyTheme(theme, accent);

  const view = document.createElement('main');
  view.id = 'view';

  const headerApi = buildHeader(streak, () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme, accent);
    store.setMeta('theme', theme);
  });

  clear(root);
  root.append(headerApi.header, buildNav(), view);

  let currentRoute = { view: 'hub' };

  // Opening a topic's lesson marks it viewed (drives the "Aprendido" status on
  // the roadmap even before any practice) and persists the map.
  const markViewed = (id) => {
    lessonViewed[id] = Date.now();
    store.setMeta('lessonViewed', lessonViewed);
  };

  /** @type {any} */
  const deps = {
    catalog,
    store,
    progress,
    lessonViewed,
    markViewed,
    cap: HUB_DEFAULTS.cap,
    navigate: go,
    get newPerDay() { return newPerDay; },
    get voice() { return voice; },
    get ttsVoice() { return ttsVoice; },
    // The one "say this English text" entry point handed to the views. Reads the
    // current settings at call time (closure over the mutable lets), so a voice
    // or key change in Ajustes applies to the next click without a rebuild.
    speak: (text) => speakSmart(text, {
      ttsVoice, browserVoice: voice, key: aiKey, online: isOnline(), store,
    }),
    // Live-apply a settings change, then re-render the current view.
    onChanged: async (key, value) => {
      if (key === 'theme') { theme = value; applyTheme(theme, accent); }
      if (key === 'newPerDay') newPerDay = value;
      if (key === 'voice') voice = value;
      if (key === 'ttsVoice') ttsVoice = value;
      if (key === 'aiKey') aiKey = value;
      await renderRoute(view, currentRoute, deps);
    },
    // AI-generated items join their topic's module in memory, then we practice them.
    onGenerated: (topicId, items) => {
      const found = findTopic(catalog, topicId);
      if (found) found.content.module.items.push(...items);
      go('practice', topicId);
    },
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
  const { catalog, store, progress } = deps;
  const now = deps.now;

  switch (route.view) {
    case 'module': {
      // Coming-soon modules are never loaded, so modules.get is undefined →
      // redirect to the hub. Same for an unknown id. Guide, don't dead-end.
      const moduleContent = catalog.modules.get(route.param);
      const entry = catalog.manifest.find((m) => m.id === route.param);
      if (!moduleContent || !entry) { deps.navigate('hub'); return; }
      renderModule(view, {
        moduleContent, entry, progress,
        lessonViewed: deps.lessonViewed ?? {},
        onOpenTopic: (id) => deps.navigate('topic', id),
        onBack: () => deps.navigate('hub'), // module → hub
      });
      return;
    }
    case 'topic': {
      const found = findTopic(catalog, route.param);
      if (!found) { deps.navigate('hub'); return; }
      const topic = found.topic;
      deps.markViewed?.(topic.id); // learn-first: opening the lesson counts
      const tutor = await getTutor(store);
      renderTopic(view, {
        topic,
        onPractice: (id) => deps.navigate('practice', id),
        tutor,
        speak: deps.speak,
        onGenerated: (items) => deps.onGenerated?.(topic.id, items),
        onBack: () => deps.navigate('module', found.moduleId), // topic → its module
      });
      return;
    }
    case 'practice': {
      const items = await selectItems(route, {
        items: allItems(catalog), progress, store, newPerDay: deps.newPerDay, cap: deps.cap, now,
      });
      const tutor = await getTutor(store);
      renderPractice(view, {
        items, progress, store, now, voice: deps.voice, tutor, speak: deps.speak,
        onWrong: (itemId, given) => logMistake(store, itemId, given),
        onDone: async () => { await deps.onStudyComplete?.(now); },
      });
      return;
    }
    case 'dialogue': {
      // #/dialogue → picker; #/dialogue/<id> → conversation. Unknown id → back
      // to the picker (guide, don't dead-end). tutor is null offline / without a
      // key → the view shows its notice and stays fully usable (read + listen).
      const scenario = route.param ? (SCENARIOS.find((s) => s.id === route.param) ?? null) : null;
      if (route.param && !scenario) { deps.navigate('dialogue', undefined); return; }
      const tutor = await getTutor(store);
      renderDialogue(view, {
        scenario,
        scenarios: SCENARIOS,
        tutor,
        online: isOnline(),
        recognitionOk: recognitionAvailable(),
        speak: deps.speak,
        recognize: (opts) => recognizeOnce(opts),
        onPick: (id) => deps.navigate('dialogue', id || undefined),
      });
      return;
    }
    case 'insights': {
      const stats = computeStats(allItems(catalog), progress, now ?? new Date());
      renderInsights(view, {
        stats,
        onFocusWeak: (topic) => deps.navigate('practice', topic),
        titleFor: (id) => findTopic(catalog, id)?.topic.title.es ?? id,
      });
      return;
    }
    case 'settings': {
      const [themeM, lang, newPerDay, voice, ttsVoiceM, aiKey, lastBackup] = await Promise.all([
        store.getMeta('theme', 'dark'),
        store.getMeta('lang', 'es'),
        store.getMeta('newPerDay', HUB_DEFAULTS.newPerDay),
        store.getMeta('voice', ''),
        store.getMeta('ttsVoice', ''),
        store.getMeta('aiKey', ''),
        store.getMeta('lastBackup', undefined),
      ]);
      renderSettings(view, {
        store,
        settings: { theme: themeM, lang, newPerDay, voice, ttsVoice: ttsVoiceM, aiKey, lastBackup },
        voices: listVoices().map((v) => v.name),
        ttsVoices: TTS_VOICES,
        now,
        onChange: async (key, value) => {
          await store.setMeta(key, value);
          await deps.onChanged?.(key, value);
        },
      });
      return;
    }
    default: { // 'hub' — the multi-module roadmap
      renderHub(view, {
        catalog, progress, now,
        newPerDay: deps.newPerDay, cap: deps.cap,
        onPractice: () => deps.navigate('practice'),
        onOpenModule: (id) => deps.navigate('module', id),
      });
    }
  }
}

/**
 * The content file whose accent drives the global primary. First module in
 * recommended order that actually loaded, else any loaded module.
 * @param {import('../engine/catalog.js').Catalog} catalog
 * @returns {import('../engine/types.js').ContentFile | undefined}
 */
function activeModule(catalog) {
  const ordered = [...catalog.manifest].sort((a, b) => a.order - b.order);
  for (const e of ordered) if (catalog.modules.has(e.id)) return catalog.modules.get(e.id);
  return catalog.modules.values().next().value;
}

function applyTheme(theme, accent) {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  if (accent) html.style.setProperty('--color-primary', accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F8FAFC' : '#0F172A');
}

function buildHeader(streak, onToggle) {
  const header = document.createElement('header');
  header.className = 'app-header surface';

  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'Momentum';

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
    ['dialogue', 'Hablar', undefined],
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
