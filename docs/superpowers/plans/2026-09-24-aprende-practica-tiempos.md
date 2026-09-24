# Plan — Flujo "Aprende → Practica" + módulo de Tiempos completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) o superpowers:subagent-driven-development para implementar este plan tarea por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Que cada tema enseñe el concepto antes de evaluarlo (lección-primero, guiar sin bloquear), mostrar la ruta de 6 módulos en el Hub, y completar el módulo de Tiempos con Pasado y Futuro.

**Architecture:** Sobre el motor existente (ESM vanilla sin build, IndexedDB, FSRS, router hash). Se introduce un **manifiesto** (`content/index.json`) y un **catálogo** que carga los módulos disponibles; el shell (`mountApp`/`renderRoute`) pasa de asumir un módulo único a consumir el catálogo. El Hub muestra módulos (drill-down: Hub → Módulo → Tema → Práctica). El contenido se redacta al estándar "ventanas" del módulo de Presente ya existente.

**Tech Stack:** JS ESM + JSDoc, `node:test`/`node:assert/strict`, linkedom + fake-indexeddb para DOM/IDB en pruebas. Sin toolchain de build. Service worker + manifest a mano.

**Spec:** `docs/superpowers/specs/2026-09-24-momentum-flujo-aprendizaje-y-rollout-design.md` (extiende `2026-09-23-momentum-design.md`).

## Global Constraints

- **Sin `innerHTML`** — construcción de DOM pura (hook de seguridad lo bloquea).
- **Sin toolchain de build** — ESM vanilla + JSDoc; deps vendorizadas en `vendor/`.
- **Offline-first** — el núcleo nunca depende de la red; carga solo JSON (los assets pesados van por SW).
- **No romper el progreso SRS** — el estado vive en IndexedDB por `item.id`; no renombrar ids de ítems existentes (`ps-*`, `pc-*`, `pp-*`, `ppc-*`).
- **Guiar, no bloquear** — el orden es recomendación visual; ningún módulo/tema `available` queda inaccesible; siempre hay ruta directa a práctica.
- **Bilingüe EN/ES** en todo contenido (`{ en, es }`).
- **Un commit por tarea**, terminando el mensaje con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Estándar de calidad de contenido:** los 4 temas de Presente en `content/tenses.json` son el ejemplo de referencia (metáforas "ventana/lente/puente", `explanation` bilingüe, `examples`, ítems con `why` y distractores realistas).
- Ejecutar la suite completa con `node --test` (o el runner del repo) tras cada tarea; el reporte incluye cualquier fallo por nombre.

## Review Focus

Entradas/fallos que la spec implica pero que ninguna prueba de tarea ejercita, ordenados por probabilidad de morder:

1. **Módulo `available` con archivo ausente/corrupto en runtime** → la app debe omitirlo y arrancar igual (degradación). *Prueba en Task 2 (loader con fetch que falla en un módulo).* 
2. **Deep-link a `#/topic/<id>` o `#/module/<id>` inexistente** (bookmark viejo) → redirigir al hub, no romper. *Prueba en Task 4 (shell) y Task 6 (module view).* 
3. **Deep-link a un módulo `coming-soon`** → manejar con gracia (redirige al hub o muestra "próximamente"), no vista vacía. *Prueba en Task 6.* 
4. **`related` de un tema apunta a un tema inexistente o de otro módulo** → la vista de tema no debe romper. *Prueba en Task 7.* 
5. **Tema sin ítems de práctica** llega al botón "Practicar" → sesión vacía manejada (botón deshabilitado o mensaje). *Prueba en Task 7.*

---

### Task 1: Esquema — `coreIdea` obligatorio por tema

**Files:**
- Modify: `src/engine/schema.js`
- Test: `src/engine/schema.test.js`
- Modify: `content/tenses.json` (añadir `coreIdea` a los 4 temas de Presente)

**Interfaces:**
- Consumes: `validateContent(data)` existente.
- Produces: `validateContent` ahora exige `topic.coreIdea` bilingüe en cada `module.topics[]`.

- [ ] **Step 1: Escribir la prueba que falla**

```js
// en src/engine/schema.test.js
test('validateContent requires bilingual coreIdea on every topic', () => {
  const base = {
    version: 1,
    module: {
      id: 'm', accent: '#6366F1',
      topics: [{ id: 't', title: { en: 'T', es: 'T' }, items: [] }],
      items: [],
    },
  };
  const missing = validateContent(base);
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => /coreIdea/.test(e)));

  const withIdea = structuredClone(base);
  withIdea.module.topics[0].coreIdea = { en: 'idea', es: 'idea' };
  assert.equal(validateContent(withIdea).ok, true);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test src/engine/schema.test.js`
Expected: FAIL (hoy `validateContent` no revisa `coreIdea`).

- [ ] **Step 3: Implementar**

En `validateContent`, dentro del `for (const t of (m.topics ?? []))`, añadir:
```js
if (!isBi(t.coreIdea)) e.push(`topic ${t.id}: coreIdea must be bilingual`);
```

- [ ] **Step 4: Añadir `coreIdea` a los 4 temas de Presente en `content/tenses.json`**

A cada objeto de `module.topics` (present-simple, present-continuous, present-perfect, present-perfect-continuous) añadir un campo `coreIdea` (justo tras `title`), la esencia en una frase, bilingüe. Ejemplo para present-perfect:
```jsonc
"coreIdea": {
  "en": "Present Perfect is a bridge from the past into now — not a real past tense.",
  "es": "El presente perfecto es un puente del pasado al ahora — no es un pasado de verdad."
}
```
(Redactar las otras tres desde su explicación existente: identidad/ventana, zoom/temporal, time-lapse/proceso.)

- [ ] **Step 5: Correr esquema + validación de contenido**

Run: `node --test src/engine/schema.test.js` → PASS.
Run: `node --test` (suite completa) → verde (el contenido real ya cumple `coreIdea`).

- [ ] **Step 6: Commit**

```bash
git add src/engine/schema.js src/engine/schema.test.js content/tenses.json
git commit -m "feat(schema): require bilingual coreIdea per topic; add it to present topics"
```

---

### Task 2: Manifiesto + cargador de catálogo

**Files:**
- Create: `content/index.json`
- Create: `src/engine/catalog.js`
- Test: `src/engine/catalog.test.js`

**Interfaces:**
- Consumes: `validateContent` (Task 1) para cada módulo.
- Produces:
  - `validateManifest(data) → { ok: true, manifest } | { ok: false, errors }`
  - `loadCatalog(fetchFn) → Promise<Catalog>` donde `Catalog = { manifest: ManifestEntry[], modules: Map<string, ContentFile> }`
  - `allItems(catalog) → Item[]` (concatena ítems de todos los módulos cargados)
  - `allTopics(catalog) → Topic[]`
  - `findTopic(catalog, id) → { topic, moduleId, content } | null`
  - `ManifestEntry = { id, order, status: 'available'|'coming-soon', file, title:{en,es}, accent }`

- [ ] **Step 1: Escribir pruebas que fallan**

```js
// src/engine/catalog.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, loadCatalog, allItems, findTopic } from './catalog.js';

const manifest = {
  version: 1,
  modules: [
    { id: 'tenses', order: 1, status: 'available', file: 'tenses.json', title: { en: 'Tenses', es: 'Tiempos' }, accent: '#6366F1' },
    { id: 'conditionals', order: 2, status: 'coming-soon', file: 'conditionals.json', title: { en: 'Conditionals', es: 'Condicionales' }, accent: '#8B5CF6' },
  ],
};
const tenses = {
  version: 1,
  module: { id: 'tenses', accent: '#6366F1',
    topics: [{ id: 'present-simple', title: { en: 'PS', es: 'PS' }, coreIdea: { en: 'x', es: 'x' }, items: ['a'] }],
    items: [{ id: 'a', topic: 'present-simple', type: 'choice', answer: 'x', why: { en: 'w', es: 'w' }, distractors: ['y'] }] },
};

test('validateManifest rejects a non-permutation order and bad status', () => {
  assert.equal(validateManifest({ version: 1, modules: [{ id: 'a', order: 2, status: 'available', file: 'a.json', title: { en: 'A', es: 'A' }, accent: '#6366F1' }] }).ok, false);
  assert.equal(validateManifest({ version: 1, modules: [{ id: 'a', order: 1, status: 'nope', file: 'a.json', title: { en: 'A', es: 'A' }, accent: '#6366F1' }] }).ok, false);
  assert.equal(validateManifest(manifest).ok, true);
});

test('loadCatalog loads available modules and skips coming-soon', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('index.json')) return { ok: true, json: async () => manifest };
    if (url.endsWith('tenses.json')) return { ok: true, json: async () => tenses };
    return { ok: false, json: async () => ({}) };
  };
  const cat = await loadCatalog(fetchFn);
  assert.ok(cat.modules.has('tenses'));
  assert.equal(cat.modules.has('conditionals'), false); // coming-soon: never fetched
  assert.equal(allItems(cat).length, 1);
  assert.equal(findTopic(cat, 'present-simple').moduleId, 'tenses');
});

test('loadCatalog degrades: a broken available module is skipped, app still boots', async () => {
  const bad = { version: 1, modules: [{ id: 'tenses', order: 1, status: 'available', file: 'tenses.json', title: { en: 'T', es: 'T' }, accent: '#6366F1' }] };
  const fetchFn = async (url) => url.endsWith('index.json')
    ? { ok: true, json: async () => bad }
    : { ok: false, json: async () => ({}) }; // module fetch fails
  const cat = await loadCatalog(fetchFn);
  assert.equal(cat.modules.size, 0);       // skipped
  assert.equal(cat.manifest.length, 1);    // roadmap still known
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `node --test src/engine/catalog.test.js`
Expected: FAIL ("Cannot find module './catalog.js'").

- [ ] **Step 3: Implementar `src/engine/catalog.js`**

```js
import { validateContent } from './schema.js';

/** @param {any} v */ const isBi = (v) => v && typeof v.en === 'string' && typeof v.es === 'string';
const STATUS = new Set(['available', 'coming-soon']);

export function validateManifest(data) {
  const e = [];
  const mods = data?.modules;
  if (!Array.isArray(mods) || mods.length === 0) return { ok: false, errors: ['modules[] required'] };
  const ids = new Set(), orders = [];
  for (const m of mods) {
    if (typeof m.id !== 'string') e.push('module.id missing'); else { if (ids.has(m.id)) e.push(`duplicate module id ${m.id}`); ids.add(m.id); }
    if (!STATUS.has(m.status)) e.push(`module ${m.id}: bad status ${m.status}`);
    if (typeof m.file !== 'string') e.push(`module ${m.id}: file missing`);
    if (!isBi(m.title)) e.push(`module ${m.id}: title must be bilingual`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(m.accent ?? '')) e.push(`module ${m.id}: accent hex`);
    orders.push(m.order);
  }
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted.some((o, i) => o !== i + 1)) e.push('order must be a permutation of 1..N');
  return e.length ? { ok: false, errors: e } : { ok: true, manifest: mods };
}

/**
 * @param {(url: string) => Promise<{ ok: boolean, json: () => Promise<any> }>} fetchFn
 * @param {string} [base]
 */
export async function loadCatalog(fetchFn, base = './content/') {
  const res = await fetchFn(base + 'index.json');
  const data = await res.json();
  const v = validateManifest(data);
  if (!v.ok) throw new Error('Manifiesto inválido: ' + JSON.stringify(v.errors));
  const modules = new Map();
  for (const entry of v.manifest) {
    if (entry.status !== 'available') continue; // coming-soon has no file yet
    try {
      const mres = await fetchFn(base + entry.file);
      if (!mres.ok) throw new Error('fetch failed');
      const mval = validateContent(await mres.json());
      if (!mval.ok) throw new Error(JSON.stringify(mval.errors));
      modules.set(entry.id, mval.content);
    } catch (err) {
      console.warn(`Módulo ${entry.id} omitido:`, err?.message ?? err); // degrade, keep booting
    }
  }
  return { manifest: v.manifest, modules };
}

export const allItems = (cat) => [...cat.modules.values()].flatMap((c) => c.module.items);
export const allTopics = (cat) => [...cat.modules.values()].flatMap((c) => c.module.topics);
export function findTopic(cat, id) {
  for (const [moduleId, content] of cat.modules) {
    const topic = content.module.topics.find((t) => t.id === id);
    if (topic) return { topic, moduleId, content };
  }
  return null;
}
```

- [ ] **Step 4: Crear `content/index.json`** (6 módulos; tenses `available`, resto `coming-soon`)

```json
{
  "version": 1,
  "modules": [
    { "id": "tenses",        "order": 1, "status": "available",  "file": "tenses.json",        "title": { "en": "Tense system", "es": "Sistema de tiempos" }, "accent": "#6366F1" },
    { "id": "conditionals",  "order": 2, "status": "coming-soon", "file": "conditionals.json",  "title": { "en": "Conditionals", "es": "Condicionales" }, "accent": "#8B5CF6" },
    { "id": "structure",     "order": 3, "status": "coming-soon", "file": "structure.json",     "title": { "en": "Structure & voice", "es": "Estructura y voz" }, "accent": "#2DD4BF" },
    { "id": "verbforms",     "order": 4, "status": "coming-soon", "file": "verbforms.json",     "title": { "en": "Verb forms", "es": "Formas verbales" }, "accent": "#38BDF8" },
    { "id": "modifiers",     "order": 5, "status": "coming-soon", "file": "modifiers.json",     "title": { "en": "Words & modifiers", "es": "Palabras y modificadores" }, "accent": "#10B981" },
    { "id": "mechanics",     "order": 6, "status": "coming-soon", "file": "mechanics.json",     "title": { "en": "Real-world mechanics", "es": "Mecánica del inglés real" }, "accent": "#F59E0B" }
  ]
}
```

- [ ] **Step 5: Correr**

Run: `node --test src/engine/catalog.test.js` → PASS. Suite completa → verde.

- [ ] **Step 6: Commit**

```bash
git add content/index.json src/engine/catalog.js src/engine/catalog.test.js
git commit -m "feat(content): module manifest + catalog loader with graceful degradation"
```

---

### Task 3: Estado por tema — `topic-status` + persistencia "lección vista"

**Files:**
- Create: `src/engine/topic-status.js`
- Test: `src/engine/topic-status.test.js`

**Interfaces:**
- Consumes: `progress` (Map itemId→ItemProgress), `lessonViewed` (objeto `{ [topicId]: number }`).
- Produces:
  - `topicStatus(topic, items, progress, lessonViewed) → 'todo'|'learned'|'practicing'|'mastered'`
  - `MASTERY_STABILITY` (export, 21) reutilizable por el anillo.
  - Reglas: sin viewed y sin práctica → `todo`; viewed y sin ítems con reps → `learned`; con reps pero no todos maduros → `practicing`; todos los ítems del tema con `card.stability >= 21` → `mastered`.

- [ ] **Step 1: Prueba que falla**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicStatus } from './topic-status.js';

const topic = { id: 't', items: ['a', 'b'] };
const items = [{ id: 'a', topic: 't' }, { id: 'b', topic: 't' }];

test('topicStatus reflects the learn→practice→master journey', () => {
  assert.equal(topicStatus(topic, items, new Map(), {}), 'todo');
  assert.equal(topicStatus(topic, items, new Map(), { t: 123 }), 'learned');
  const practicing = new Map([['a', { card: { stability: 30, reps: 3 } }]]);
  assert.equal(topicStatus(topic, items, practicing, { t: 1 }), 'practicing');
  const mastered = new Map([['a', { card: { stability: 30 } }], ['b', { card: { stability: 22 } }]]);
  assert.equal(topicStatus(topic, items, mastered, { t: 1 }), 'mastered');
});
```

- [ ] **Step 2: Correr → FAIL** (`Cannot find module './topic-status.js'`).

- [ ] **Step 3: Implementar**

```js
export const MASTERY_STABILITY = 21; // días — igual que analytics/hub

export function topicStatus(topic, items, progress, lessonViewed) {
  const own = items.filter((i) => i.topic === topic.id);
  const withReps = own.filter((i) => (progress.get(i.id)?.card?.reps ?? 0) > 0);
  const mastered = own.filter((i) => (progress.get(i.id)?.card?.stability ?? 0) >= MASTERY_STABILITY);
  if (own.length > 0 && mastered.length === own.length) return 'mastered';
  if (withReps.length > 0) return 'practicing';
  if (lessonViewed?.[topic.id]) return 'learned';
  return 'todo';
}
```

- [ ] **Step 4: Correr → PASS**; suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add src/engine/topic-status.js src/engine/topic-status.test.js
git commit -m "feat(engine): topicStatus (todo/learned/practicing/mastered)"
```

---

### Task 4: Shell consume el catálogo (main + mountApp/renderRoute)

**Files:**
- Modify: `src/main.js`
- Modify: `src/ui/app.js`
- Test: `src/ui/app.test.js`

**Interfaces:**
- Consumes: `loadCatalog`, `allItems`, `findTopic` (Task 2); `topicStatus` (Task 3).
- Produces:
  - `mountApp(root, catalog, store)` — **cambia** de `content` a `catalog`.
  - `renderRoute(view, route, deps)` con `deps.catalog`; práctica/insights usan `allItems(catalog)`; topic usa `findTopic`.
  - Header muestra "Momentum" (no el título del módulo). `applyTheme` usa el acento del módulo activo cuando se conoce, si no el índigo por defecto.
  - Deep-link a `topic` inexistente → `navigate('hub')` (ya existe para topic; añadir la misma guarda al futuro `module`).
- Nota: el Hub sigue renderizando los temas del **primer módulo disponible** en esta tarea (se pasa `content = [...catalog.modules.values()][0]`), para mantener verde; la conversión a tarjetas de módulo es Task 5.

- [ ] **Step 1: Prueba que falla** — `app.test.js`: montar con un `catalog` (no `content`) y verificar que renderiza el hub y que `#/practice` arma sesión desde `allItems`. Ajustar los helpers de test existentes que construían `content` para envolverlo en `{ manifest, modules: new Map([[id, content]]) }`. Añadir aserción: el header contiene "Momentum".

```js
// esbozo — adaptar al estilo de app.test.js existente
test('mountApp boots from a catalog and header shows the app name', async () => {
  const root = makeRoot();
  await mountApp(root, catalogFixture(), new MemoryStore());
  assert.match(root.querySelector('.app-title').textContent, /Momentum/);
});
```

- [ ] **Step 2: Correr → FAIL** (mountApp aún espera `content.module`).

- [ ] **Step 3: Implementar**
- `main.js`: reemplazar el `fetch('./content/tenses.json')` + `validateContent` por:
  ```js
  const catalog = await loadCatalog((u) => fetch(u));
  if (catalog.modules.size === 0) throw new Error('No se pudo cargar ningún módulo');
  await mountApp(root, catalog, hasIdb ? new Store() : new MemoryStore());
  ```
- `app.js`:
  - Firma `mountApp(root, catalog, store)`. Derivar `const active = [...catalog.modules.values()][0];`
  - `applyTheme(theme, active?.module.accent)` como hoy.
  - `buildHeader`: título fijo `'Momentum'`.
  - `deps.catalog = catalog;` conservar `deps.content = active` (para el hub temporal).
  - `renderRoute`:
    - `topic`: `const found = findTopic(catalog, route.param); if (!found) return deps.navigate('hub'); renderTopic(view, { topic: found.topic, ... })`.
    - `practice`: `selectItems(route, { items: allItems(catalog), progress, store, ... })` (ver Task ajuste de `selectItems` abajo).
    - `insights`: `computeStats(allItems(catalog), progress, now)`; `titleFor` usa `findTopic(catalog, id)?.topic.title.es ?? id`.
- Ajustar `src/ui/session-select.js`: cambiar la firma para recibir `items` en vez de `content` (`selectItems(route, { items, progress, store, newPerDay, cap, now })`, `const all = items;`) y actualizar su test `src/ui/session-select.test.js`.

- [ ] **Step 4: Correr** `node --test src/ui/app.test.js src/ui/session-select.test.js` → PASS. Suite completa → verde.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/ui/app.js src/ui/app.test.js src/ui/session-select.js src/ui/session-select.test.js
git commit -m "refactor(shell): consume module catalog; header shows app name; practice/insights over all modules"
```

---

### Task 5: Hub como ruta de módulos (roadmap)

**Files:**
- Modify: `src/ui/views/hub.js`
- Test: `src/ui/views/hub.test.js`
- Modify: `src/ui/app.js` (pasar `catalog`+`lessonViewed` al hub; `onOpenModule`)
- Modify: `src/styles/theme.css` (tarjeta de módulo, etiqueta "Próximamente", marca "siguiente")

**Interfaces:**
- Consumes: `catalog.manifest`, `catalog.modules`, `progress`, `lessonViewed`, `topicStatus`.
- Produces: `renderHub(container, { catalog, progress, lessonViewed, onPractice, onOpenModule, now, newPerDay, cap })` que dibuja **una tarjeta por módulo del manifiesto** (orden por `order`), con anillo agregado para `available`, número de orden, marca "siguiente sugerido" (primer `available` no dominado), y etiqueta "Próximamente" + no-click para `coming-soon`. Conserva el CTA global "Practicar lo de hoy" y el buscador (busca temas de módulos `available`).

- [ ] **Step 1: Prueba que falla** — `hub.test.js`: con el catálogo fixture (1 available + 1 coming-soon), `renderHub` produce 2 `.module-card`; la available es un botón que dispara `onOpenModule('tenses')`; la coming-soon tiene `[data-status="coming-soon"]`, texto "Próximamente" y no es botón clickeable. El CTA "Practicar lo de hoy" sigue presente.

- [ ] **Step 2: Correr → FAIL.**

- [ ] **Step 3: Implementar** `renderHub` (reescribe el bucle de temas por un bucle de módulos del manifiesto). Para `available`, el anillo agrega los ítems del módulo (reutiliza `topicPercent` sobre `content.module.items` del módulo). `onOpenModule?.(entry.id)`. Añadir CSS `.module-card`, `.module-card[data-status="coming-soon"]`, `.module-order`, `.module-next`, `.module-coming` (etiqueta). En `app.js`, `default` (hub): `renderHub(view, { catalog, progress, lessonViewed, onPractice: () => navigate('practice'), onOpenModule: (id) => navigate('module', id), ... })`.

- [ ] **Step 4: Correr** `node --test src/ui/views/hub.test.js src/styles/theme.test.js` → PASS. Suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/hub.js src/ui/views/hub.test.js src/ui/app.js src/styles/theme.css
git commit -m "feat(hub): 6-module roadmap (available + coming-soon), guide-don't-gate"
```

---

### Task 6: Vista de módulo + ruta `#/module/<id>`

**Files:**
- Create: `src/ui/views/module.js`
- Test: `src/ui/views/module.test.js`
- Modify: `src/ui/app.js` (ruta `module` en `renderRoute`)
- Modify: `src/styles/theme.css` (lista de temas con estado)

**Interfaces:**
- Consumes: `catalog.modules`, `catalog.manifest`, `progress`, `lessonViewed`, `topicStatus`.
- Produces: `renderModule(container, { moduleContent, entry, progress, lessonViewed, onOpenTopic, onPractice })` — lista los temas del módulo, numerados, con etiqueta de estado (`Por aprender / Aprendido / Practicando / Dominado`) desde `topicStatus`; todos tocables → `onOpenTopic(id)`.
- `renderRoute` caso `module`: si el id no es un módulo `available` cargado → `navigate('hub')` (cubre deep-link inexistente y `coming-soon`).

- [ ] **Step 1: Prueba que falla** — `module.test.js`: `renderModule` con el módulo tenses fixture produce un `.topic-row` por tema con su `[data-status]`; click en uno dispara `onOpenTopic`. Y en `app.test.js`: `renderRoute` con `{view:'module', param:'inexistente'}` llama `navigate('hub')`; con `param` de un `coming-soon` también.

- [ ] **Step 2: Correr → FAIL.**

- [ ] **Step 3: Implementar** `renderModule` (DOM puro, sin innerHTML) + el caso `module` en `renderRoute`:
```js
case 'module': {
  const content = catalog.modules.get(route.param);
  const entry = catalog.manifest.find((m) => m.id === route.param);
  if (!content || !entry) return deps.navigate('hub');
  renderModule(view, { moduleContent: content, entry, progress, lessonViewed: deps.lessonViewed,
    onOpenTopic: (id) => deps.navigate('topic', id), onPractice: () => deps.navigate('practice') });
  return;
}
```
CSS: `.topic-row`, `.topic-status[data-status="…"]` con color por estado.

- [ ] **Step 4: Correr** `node --test src/ui/views/module.test.js src/ui/app.test.js` → PASS. Suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/module.js src/ui/views/module.test.js src/ui/app.js src/styles/theme.css
git commit -m "feat(module): module view with per-topic status; #/module/<id> route with guards"
```

---

### Task 7: Vista de tema lección-primero (coreIdea + pitfall + marcar vista)

**Files:**
- Modify: `src/ui/views/topic.js`
- Test: `src/ui/views/topic.test.js`
- Modify: `src/ui/app.js` (marcar "lección vista" al abrir un tema)
- Modify: `src/styles/theme.css` (`.topic-core-idea`, `.callout-pitfall`)

**Interfaces:**
- Consumes: `topic.coreIdea` (Task 1), bloques `explanation` con `kind: 'pitfall'`.
- Produces:
  - `renderTopic` muestra `coreIdea` en un bloque destacado **arriba** (tras el header, antes de `explanation`).
  - `renderBlock` maneja `kind: 'pitfall'` (callout de advertencia, reutiliza `bilingualCallout` con `kind:'pitfall'`).
  - `related` inexistente no rompe (se ignora un id que no resuelve).
  - Tema sin ítems → botón "Practicar este tema" deshabilitado (o texto "Aún no hay práctica").
  - Al entrar a `#/topic/<id>`, `app.js` marca `lessonViewed[id]=now` y lo persiste (`store.setMeta('lessonViewed', map)`), actualizando `deps.lessonViewed` en memoria.

- [ ] **Step 1: Pruebas que fallan** — `topic.test.js`:
  - un tema con `coreIdea` renderiza `.topic-core-idea` conteniendo el texto ES;
  - un bloque `{ kind: 'pitfall', text }` produce un callout con clase de advertencia;
  - un tema con `items: []` deja el botón "Practicar" `disabled`;
  - un `related: ['no-existe']` no lanza.
  - En `app.test.js`: navegar a un topic llama `store.setMeta('lessonViewed', …)` incluyendo ese id.

- [ ] **Step 2: Correr → FAIL.**

- [ ] **Step 3: Implementar**
  - `topic.js`: tras `header`, si `topic.coreIdea`, insertar `.topic-core-idea` (bilingüe, ES destacado). En `renderBlock`, `if (block.kind === 'pitfall') return bilingualCallout(block.text, { voice, kind: 'pitfall' });`. Si `topic.items?.length` es 0, `practice.setAttribute('disabled','')`. Guardar `related` render defensivo (si ya se renderiza; si no, no-op).
  - `bilingual-callout.js`: aceptar `kind:'pitfall'` → clase `callout callout-pitfall`.
  - `app.js` caso `topic`: antes/después de render, `deps.markViewed?.(found.topic.id)`; implementar `markViewed` en `mountApp` (lee `lessonViewed` de meta al inicio, lo muta y persiste).
  - CSS: `.topic-core-idea` (destacado, borde acento, texto grande); `.callout-pitfall` (borde/acento en `--color-error`).

- [ ] **Step 4: Correr** `node --test src/ui/views/topic.test.js src/ui/app.test.js src/styles/theme.test.js` → PASS. Suite completa verde.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/topic.js src/ui/views/topic.test.js src/ui/app.js src/ui/components/bilingual-callout.js src/styles/theme.css
git commit -m "feat(topic): lesson-first — coreIdea header, pitfall blocks, mark lesson viewed"
```

---

### Task 8: Guard de contenido "ni práctica sin concepto, ni concepto sin práctica"

**Files:**
- Create: `content/content.test.js`

**Interfaces:**
- Consumes: `content/index.json` + cada `<módulo>.json` `available` (leídos de disco), `validateContent`, `validateManifest`.
- Produces: una prueba de datos que recorre todos los módulos `available` y exige por cada tema: `coreIdea` (EN+ES), ≥1 bloque `explanation`, ≥1 `example`, y ≥1 ítem de práctica que lo referencie; además ids de ítem únicos en **todo** el corpus, y `related` que resuelven dentro del corpus.

- [ ] **Step 1: Prueba (que pasa con el contenido correcto, pero fallaría si un tema quedara sin lección o sin práctica)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateManifest } from '../src/engine/catalog.js';
import { validateContent } from '../src/engine/schema.js';

const read = (f) => JSON.parse(readFileSync(fileURLToPath(new URL('./' + f, import.meta.url)), 'utf8'));
const manifest = read('index.json');

test('manifest is valid', () => assert.equal(validateManifest(manifest).ok, true));

test('every available topic has a concept AND practice', () => {
  const seen = new Set();
  for (const entry of manifest.modules.filter((m) => m.status === 'available')) {
    const data = read(entry.file);
    assert.equal(validateContent(data).ok, true, `${entry.file} schema`);
    const items = data.module.items;
    for (const t of data.module.topics) {
      assert.ok(t.coreIdea?.en && t.coreIdea?.es, `${t.id}: coreIdea`);
      assert.ok((t.explanation ?? []).length >= 1, `${t.id}: explanation`);
      assert.ok((t.examples ?? []).length >= 1, `${t.id}: examples`);
      assert.ok(items.some((i) => i.topic === t.id), `${t.id}: at least one practice item`);
    }
    for (const it of items) { assert.equal(seen.has(it.id), false, `dup id ${it.id}`); seen.add(it.id); }
  }
});
```

- [ ] **Step 2: Correr** `node --test content/content.test.js`
Expected: PASS (el contenido de Presente ya cumple; es el guard que protegerá a Pasado/Futuro y a los módulos futuros).

- [ ] **Step 3: (verificación negativa, manual y revertida)** Temporalmente quitar `coreIdea` de un tema en un archivo de prueba mental → el guard debe fallar. Confirmar leyendo el mensaje de aserción. No commitear la ruptura.

- [ ] **Step 4: Commit**

```bash
git add content/content.test.js
git commit -m "test(content): guard — every topic needs concept (coreIdea+explanation+examples) and practice"
```

---

### Task 9: Contenido — Pasado (desde `Past Tense Masterclass.pdf`)

**Files:**
- Modify: `content/tenses.json` (añadir temas de pasado + sus ítems)

**Interfaces:**
- Consumes: esquema (Task 1), guard (Task 8).
- Produces: temas de pasado en `module.topics` + ítems en `module.items`, al estándar de Presente.

- [ ] **Step 1: Leer la fuente** — `Past Tense Masterclass.pdf` (en `/Users/edgar.mora/Documents/Ingles/`). Extraer las "perspectivas" del pasado (past simple, past continuous, past perfect, past perfect continuous) con sus metáforas, ejemplos y errores comunes.

- [ ] **Step 2: Redactar los temas** siguiendo exactamente la forma de un tema de Presente. Por cada tema:
```jsonc
{
  "id": "past-simple",
  "title": { "en": "Past Simple — the closed door", "es": "Pasado simple — la puerta cerrada" },
  "coreIdea": { "en": "…", "es": "…" },
  "source": "Past Tense Masterclass.pdf",
  "explanation": [ { "kind": "p", "text": {…} }, { "kind": "callout", "text": {…} }, { "kind": "pitfall", "text": {…} } ],
  "examples": [ { "en": "…", "es": "…" }, … ],
  "related": ["present-perfect"],
  "items": ["pst-…", …]
}
```
Prefijos de id de ítem sin colisión: `pst-*` (past simple), `pstc-*` (past continuous), `pstp-*` (past perfect), `pstpc-*`. 5–8 ítems por tema, `type` choice/cloze, con `why` bilingüe y distractores realistas (de errores comunes ES→EN).

- [ ] **Step 3: Validar**

Run: `node --test content/content.test.js src/engine/schema.test.js` → PASS (guard + esquema cubren coreIdea/explanation/examples/ítems y unicidad de ids).

- [ ] **Step 4: Correr suite completa** → verde.

- [ ] **Step 5: Commit**

```bash
git add content/tenses.json
git commit -m "content(tenses): past tenses — lessons + practice from Past Tense Masterclass"
```

---

### Task 10: Contenido — Futuro + renombrar módulo a "Sistema de tiempos"

**Files:**
- Modify: `content/tenses.json` (temas de futuro + `module.title`)
- Modify: `src/ui/views/onboarding.js` **solo si** referencia el título viejo (verificar; si no, omitir)

**Interfaces:**
- Consumes: esquema + guard.
- Produces: temas de futuro (`will`, `going to`, present continuous para planes, future perfect/continuous según el PDF) + ítems; `module.title` = `{ en: "Tense system", es: "Sistema de tiempos" }`.

- [ ] **Step 1: Leer** `Future Tense Masterclass.pdf`.

- [ ] **Step 2: Redactar** los temas de futuro (misma forma que Task 9). Prefijos: `fut-*`, `futg-*` (going to), `futc-*`, `futp-*`. 5–8 ítems c/u.

- [ ] **Step 3: Renombrar** `module.title` a Sistema de tiempos / Tense system (id `tenses` intacto; ids de ítems intactos → sin pérdida de progreso). Verificar que `content/index.json` ya usa ese título (Task 2) — coincidir.

- [ ] **Step 4: Validar** `node --test content/content.test.js` → PASS. Suite completa → verde.

- [ ] **Step 5: Commit**

```bash
git add content/tenses.json src/ui/views/onboarding.js
git commit -m "content(tenses): future tenses + rename module to Tense system"
```

---

## Cierre (tras la última tarea)

- Reconstruir el build single-file: `python3 scripts/build_singlefile.py` (o el comando del repo) para actualizar `momentum.html`.
- Revisión final de toda la rama (reviewer fresco en el modelo más capaz, o self-review documentado) según superpowers:executing-plans.
- `superpowers:finishing-a-development-branch` para integrar/publicar.
- Verificación visual en https://emorap.github.io/Ingles/ tras publicar (hard-refresh por el service worker).
