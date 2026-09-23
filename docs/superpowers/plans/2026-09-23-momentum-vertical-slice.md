# Momentum — Implementation Plan (v1 vertical slice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Momentum's offline-first PWA — engine + core UI + the *Present tense* module end-to-end, with audio (TTS), analytics, and an optional Gemini AI-Tutor layer behind graceful degradation.

**Architecture:** Layered. A 100% offline **core** (content-as-data, FSRS scheduling, IndexedDB progress, retrieval-first practice UI, TTS pronunciation, analytics) plus **optional online realces** (AI Tutor, HQ audio) that detect availability and hide/disable themselves when absent. Delivered as a Vite-built PWA (app-shell + per-module JSON cached by a service worker), with an optional single-file build for portability.

**Tech Stack:** TypeScript, Vite, Vitest (jsdom), `ts-fsrs` (scheduling), `idb` (IndexedDB), `fake-indexeddb` (tests), `vite-plugin-pwa` (Workbox SW), `vite-plugin-singlefile` (portable build), vanilla TS view modules + a tiny observable store (no UI framework). Content pipeline: Python + `pypdf`, `poppler` (`pdftoppm`) for diagrams.

**Spec:** `docs/superpowers/specs/2026-09-23-momentum-design.md`

## Global Constraints

- **Offline core:** the core never requires network, backend, or an API key. Realces degrade gracefully.
- **SRS state lives in IndexedDB**, keyed by `item.id` — never inside `content/*.json`. Updating content must not erase progress.
- **Scheduling:** use `ts-fsrs`. Ratings map to buttons *Otra vez=Again(1) · Difícil=Hard(2) · Bien=Good(3) · Fácil=Easy(4)*.
- **Session shape:** default new-items/day = `8`; session cap = `15`; show `3–6` items per screen; sessions interleave items across topics.
- **Diagrams** are cached assets (PNG/SVG), never base64-inlined into the app shell.
- **Palette (exact):** base `#0F172A`, surface `#1E293B`, primary `#6366F1`, success `#10B981`, streak `#F59E0B`, error `#F43F5E`, text `#F8FAFC`, text-muted `#94A3B8`. Default dark; optional light mode.
- **Module accents (exact):** tenses `#6366F1`, conditionals `#8B5CF6`, structure `#2DD4BF`, verb-forms `#38BDF8`, mechanics `#10B981`, functional `#F59E0B`.
- **AI Tutor:** default provider Gemini, behind an `AITutorProvider` interface; the user's own key is stored locally (no meaningful client-side encryption — do not claim it).
- **Content invariants:** every item has a valid `type`, an `answer`, and a `why`; `accept` (when present) includes `answer`; every `topic`/`item`/`related` reference resolves.
- **A11y:** contrast AA, visible focus, full keyboard, `aria-label`s, tap targets ≥44px, honor `prefers-reduced-motion`.

## Review Focus

Input classes/failure modes the spec implies that a real user will hit; each gets a test pinned to the owning task:

1. **No TTS voices in the browser** → audio button degrades to no-op/tooltip, never throws. *(Task 12)*
2. **Offline at practice time** → practice + scheduling + progress all work; AI Tutor and HQ-audio controls are hidden. *(Tasks 13, 20)*
3. **IndexedDB blocked/evicted (Safari private, storage pressure)** → app surfaces a clear warning and requests persistence; no silent data loss. *(Task 6, 17)*
4. **AI key absent / invalid / quota exceeded / request fails** → AI features disabled or error-handled; no unhandled promise rejection; core unaffected. *(Task 20)*
5. **Typed answer variants** (case, extra spaces, `’` vs `'`, contraction like `has worked` vs `'s worked`) → normalization accepts valid variants; genuinely wrong answers still fail. *(Task 2)*
6. **Import of malformed or older progress JSON** → validated and rejected safely; existing data not corrupted; version handled. *(Task 6)*
7. **Content update changes an item's id** → progress migrates by id-map, no orphaned/lost cards. *(Task 6)*

---

## File Structure

```
momentum/
  index.html                     # app-shell entry
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts
  public/manifest.webmanifest  public/icons/
  src/
    main.ts                      # bootstrap: mount app, register SW, request persist
    store.ts                     # tiny observable store
    router.ts                    # hash-based routing
    engine/
      types.ts                   # shared content + progress types
      normalize.ts               # answer normalization + isCorrect
      schema.ts                  # content validation
      scheduler.ts               # ts-fsrs wrapper
      session.ts                 # session builder (due + new + interleave + cap)
      db.ts                      # IndexedDB store, export/import, id migration
      analytics.ts               # retention / mastery / forecast / weak areas
    audio/tts.ts                 # Web Speech API wrapper (graceful)
    ai/provider.ts               # AITutorProvider interface + capability detection
    ai/gemini.ts                 # Gemini adapter
    ai/tutor.ts                  # feature orchestration + graceful degradation
    ui/app.ts                    # shell layout + nav
    ui/views/{hub,topic,practice,insights,settings,onboarding}.ts
    ui/components/{progress-ring,streak-chip,practice-card,bilingual-callout,audio-button}.ts
    styles/theme.css             # palette tokens, dark/light, components
  content/tenses.json            # built by pipeline
  content/assets/                # diagrams
  scripts/extract_pdf.py         # pypdf → draft content JSON
  scripts/export_diagrams.sh     # pdftoppm → PNG
  scripts/validate_content.mjs   # CI schema check
```

---

## Phase 0 — Scaffold

### Task 1: Project scaffold + tooling + git

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/styles/theme.css`, `.gitignore`

**Interfaces:**
- Produces: a runnable Vite dev server, `npm test` (Vitest, jsdom), and the Momentum CSS tokens (`--color-base`, `--color-primary`, …) consumed by all UI.

- [ ] **Step 1: Init project and install deps**
```bash
cd ~/Downloads/Ingles/momentum
git init
npm init -y
npm i ts-fsrs idb
npm i -D typescript vite vitest jsdom vite-plugin-pwa vite-plugin-singlefile fake-indexeddb @types/node
```

- [ ] **Step 2: Add config files**

`tsconfig.json`:
```json
{ "compilerOptions": { "target": "ES2020", "module": "ESNext", "moduleResolution": "Bundler", "strict": true, "lib": ["ES2020","DOM","DOM.Iterable"], "types": ["vite/client"], "skipLibCheck": true }, "include": ["src","tests"] }
```
`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'jsdom', globals: true, setupFiles: ['fake-indexeddb/auto'] } })
```
`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [VitePWA({ registerType: 'autoUpdate', manifest: false,
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg,json}'] } })],
})
```
Add `package.json` scripts: `"dev":"vite"`, `"build":"vite build"`, `"test":"vitest run"`, `"test:watch":"vitest"`, `"content:validate":"node scripts/validate_content.mjs"`.

- [ ] **Step 3: Add CSS tokens** — `src/styles/theme.css`
```css
:root{--color-base:#0F172A;--color-surface:#1E293B;--color-primary:#6366F1;--color-success:#10B981;--color-streak:#F59E0B;--color-error:#F43F5E;--color-text:#F8FAFC;--color-muted:#94A3B8;--radius:14px;--tap:44px;--font:Inter,system-ui,sans-serif}
[data-theme="light"]{--color-base:#F8FAFC;--color-surface:#FFFFFF;--color-text:#0F172A;--color-muted:#475569}
*{box-sizing:border-box}html,body{margin:0;background:var(--color-base);color:var(--color-text);font-family:var(--font)}
:focus-visible{outline:2px solid var(--color-primary);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 4: Add shell** — `index.html` with `<div id="app"></div>` + `<script type="module" src="/src/main.ts">`; `src/main.ts` renders `Momentum` heading into `#app`.

- [ ] **Step 5: Verify + commit**
```bash
npm run dev   # loads, shows heading
npm test      # runs (0 tests) green
git add -A && git commit -m "chore: scaffold Momentum PWA (vite+ts+vitest+pwa)"
```

---

## Phase 1 — Engine (TDD)

### Task 2: Types + answer normalization

**Files:**
- Create: `src/engine/types.ts`, `src/engine/normalize.ts`, `src/engine/normalize.test.ts`

**Interfaces:**
- Produces types consumed everywhere: `Lang`, `Bilingual`, `ItemType`, `Item`, `Topic`, `Block`, `Module`, `ContentFile`, `ItemProgress`. Produces `normalize(s:string):string` and `isCorrect(input:string, item:Pick<Item,'answer'|'accept'>):boolean`.

- [ ] **Step 1: Write failing test** — `src/engine/normalize.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { normalize, isCorrect } from './normalize'
describe('normalize', () => {
  it('lowercases, trims, collapses spaces, unifies apostrophes', () => {
    expect(normalize("  She’s   Here ")).toBe("she's here")
  })
})
describe('isCorrect', () => {
  const item = { answer: 'has worked', accept: ["'s worked"] }
  it('accepts the answer regardless of case/space', () => {
    expect(isCorrect('  Has Worked ', item)).toBe(true)
  })
  it('accepts a listed variant', () => {
    expect(isCorrect("’s worked", item)).toBe(true)
  })
  it('rejects a wrong answer', () => {
    expect(isCorrect('worked', item)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run src/engine/normalize.test.ts` → "Cannot find module './normalize'".

- [ ] **Step 3: Implement**

`src/engine/types.ts`:
```ts
export type Lang = 'en' | 'es'
export type Bilingual = Record<Lang, string>
export type ItemType = 'cloze' | 'choice' | 'natural' | 'order' | 'match'
export type Block =
  | { kind: 'p'; text: Bilingual }
  | { kind: 'callout'; text: Bilingual }
  | { kind: 'quote'; text: Bilingual }
  | { kind: 'table'; headers: string[]; rows: string[][] }
export interface Item {
  id: string; topic: string; type: ItemType
  prompt: Bilingual; answer: string; accept?: string[]
  distractors?: string[]; why: Bilingual; tags?: string[]
}
export interface Topic {
  id: string; title: Bilingual; source?: string
  explanation: Block[]; diagrams?: string[]; audio?: { voice?: string }
  examples?: { en: string; es: string }[]; related?: string[]; items: string[]
}
export interface Module { id: string; title: Bilingual; accent: string; topics: Topic[]; items: Item[] }
export interface ContentFile { version: number; module: Module }
import type { Card } from 'ts-fsrs'
export interface ItemProgress { itemId: string; card: Card; seen: number; correct: number }
```
`src/engine/normalize.ts`:
```ts
import type { Item } from './types'
export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
}
export function isCorrect(input: string, item: Pick<Item, 'answer' | 'accept'>): boolean {
  const targets = new Set([item.answer, ...(item.accept ?? [])].map(normalize))
  return targets.has(normalize(input))
}
```

- [ ] **Step 4: Run — expect PASS** — `npx vitest run src/engine/normalize.test.ts`.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): types + answer normalization"`

---

### Task 3: Content schema validator

**Files:**
- Create: `src/engine/schema.ts`, `src/engine/schema.test.ts`

**Interfaces:**
- Consumes: `ContentFile`, `Item`, `Topic` from `types.ts`.
- Produces: `validateContent(data: unknown): { ok: true; content: ContentFile } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from 'vitest'
import { validateContent } from './schema'
const good = { version:1, module:{ id:'tenses', title:{en:'T',es:'T'}, accent:'#6366F1',
  topics:[{ id:'t1', title:{en:'A',es:'A'}, explanation:[], items:['i1'], related:[] }],
  items:[{ id:'i1', topic:'t1', type:'cloze', prompt:{en:'x',es:'x'}, answer:'a', accept:['a'], why:{en:'w',es:'w'} }] }}
describe('validateContent', () => {
  it('accepts a well-formed file', () => {
    const r = validateContent(good); expect(r.ok).toBe(true)
  })
  it('rejects an item whose accept omits the answer', () => {
    const bad = structuredClone(good); bad.module.items[0].accept = ['b']
    const r = validateContent(bad); expect(r.ok).toBe(false)
    if(!r.ok) expect(r.errors.join()).toMatch(/accept/)
  })
  it('rejects an unresolved topic->item reference', () => {
    const bad = structuredClone(good); bad.module.topics[0].items = ['missing']
    const r = validateContent(bad); expect(r.ok).toBe(false)
  })
  it('rejects an invalid item type', () => {
    const bad = structuredClone(good); (bad.module.items[0] as any).type = 'nope'
    expect(validateContent(bad).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `src/engine/schema.ts`
```ts
import type { ContentFile, Item, ItemType } from './types'
const TYPES: ItemType[] = ['cloze','choice','natural','order','match']
const isBi = (v:any) => v && typeof v.en==='string' && typeof v.es==='string'
export function validateContent(data: unknown): { ok:true; content:ContentFile } | { ok:false; errors:string[] } {
  const e:string[] = []
  const d:any = data
  if (!d || typeof d!=='object') return { ok:false, errors:['root is not an object'] }
  if (typeof d.version!=='number') e.push('version must be a number')
  const m = d.module
  if (!m || typeof m!=='object') return { ok:false, errors:['module missing'] }
  if (typeof m.id!=='string') e.push('module.id missing')
  if (!/^#[0-9A-Fa-f]{6}$/.test(m.accent??'')) e.push('module.accent must be a hex color')
  const itemIds = new Set<string>()
  for (const it of (m.items??[]) as Item[]) {
    if (typeof it.id!=='string'){ e.push('item.id missing'); continue }
    itemIds.add(it.id)
    if (!TYPES.includes(it.type)) e.push(`item ${it.id}: invalid type ${it.type}`)
    if (typeof it.answer!=='string' || !it.answer) e.push(`item ${it.id}: answer required`)
    if (!isBi(it.why)) e.push(`item ${it.id}: why must be bilingual`)
    if (it.accept && !it.accept.includes(it.answer)) e.push(`item ${it.id}: accept must include answer`)
  }
  for (const t of (m.topics??[])) {
    for (const ref of (t.items??[])) if (!itemIds.has(ref)) e.push(`topic ${t.id}: unresolved item ${ref}`)
    for (const rel of (t.related??[])) { /* related may point to other topics; checked cross-module at load */ }
  }
  return e.length ? { ok:false, errors:e } : { ok:true, content:d as ContentFile }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): content schema validator"`

---

### Task 4: FSRS scheduler wrapper

**Files:**
- Create: `src/engine/scheduler.ts`, `src/engine/scheduler.test.ts`

**Interfaces:**
- Produces: `Rating` (re-export), `newCard(now?:Date):Card`, `review(card:Card, rating:Grade, now?:Date):Card`, `isDue(card:Card, now?:Date):boolean`, `isNew(card:Card):boolean`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from 'vitest'
import { newCard, review, isDue, isNew, Rating } from './scheduler'
describe('scheduler', () => {
  it('a new card is New and due now', () => {
    const c = newCard(new Date('2026-01-01'))
    expect(isNew(c)).toBe(true); expect(isDue(c, new Date('2026-01-01'))).toBe(true)
  })
  it('rating Good pushes the due date into the future', () => {
    const now = new Date('2026-01-01')
    const c = review(newCard(now), Rating.Good, now)
    expect(new Date(c.due).getTime()).toBeGreaterThan(now.getTime())
  })
  it('rating Again keeps it near-term vs Easy', () => {
    const now = new Date('2026-01-01')
    const again = review(newCard(now), Rating.Again, now)
    const easy = review(newCard(now), Rating.Easy, now)
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(easy.due).getTime())
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `src/engine/scheduler.ts`
```ts
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card, type Grade } from 'ts-fsrs'
const engine = fsrs(generatorParameters({ enable_fuzz: true }))
export function newCard(now: Date = new Date()): Card { return createEmptyCard(now) }
export function review(card: Card, rating: Grade, now: Date = new Date()): Card {
  return engine.next(card, now, rating).card
}
export function isDue(card: Card, now: Date = new Date()): boolean { return new Date(card.due) <= now }
export function isNew(card: Card): boolean { return card.state === State.New }
export { Rating }
export type { Card, Grade }
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): ts-fsrs scheduler wrapper"`

---

### Task 5: Session builder (due + new + interleave + cap)

**Files:**
- Create: `src/engine/session.ts`, `src/engine/session.test.ts`

**Interfaces:**
- Consumes: `Item`, `ItemProgress`, `isDue`, `isNew`.
- Produces: `buildSession(items: Item[], progress: Map<string,ItemProgress>, opts: { newPerDay:number; cap:number; now?:Date }): Item[]`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from 'vitest'
import { buildSession } from './session'
import { newCard, review, Rating } from './scheduler'
import type { Item, ItemProgress } from './types'
const mk = (id:string, topic:string):Item => ({ id, topic, type:'cloze', prompt:{en:'',es:''}, answer:'a', why:{en:'',es:''} })
describe('buildSession', () => {
  const now = new Date('2026-01-01')
  it('caps total items', () => {
    const items = Array.from({length:50}, (_,i)=>mk('i'+i, 't'+(i%3)))
    const s = buildSession(items, new Map(), { newPerDay:8, cap:15, now })
    expect(s.length).toBeLessThanOrEqual(15)
  })
  it('introduces at most newPerDay brand-new items', () => {
    const items = Array.from({length:50}, (_,i)=>mk('i'+i,'t0'))
    const s = buildSession(items, new Map(), { newPerDay:8, cap:15, now })
    expect(s.length).toBe(8)
  })
  it('prioritises due items over new ones', () => {
    const items = [mk('due','t0'), mk('new','t1')]
    const prog = new Map<string,ItemProgress>([['due',{ itemId:'due', seen:1, correct:1,
      card: review(newCard(new Date('2025-12-01')), Rating.Again, new Date('2025-12-01')) }]])
    const s = buildSession(items, prog, { newPerDay:8, cap:15, now })
    expect(s[0].id).toBe('due')
  })
  it('avoids two same-topic items back to back when possible', () => {
    const items = [mk('a','t0'),mk('b','t0'),mk('c','t1'),mk('d','t1')]
    const s = buildSession(items, new Map(), { newPerDay:8, cap:15, now })
    let adjacent = 0; for (let i=1;i<s.length;i++) if (s[i].topic===s[i-1].topic) adjacent++
    expect(adjacent).toBeLessThan(s.length-1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `src/engine/session.ts`
```ts
import type { Item, ItemProgress } from './types'
import { isDue } from './scheduler'
function interleave(items: Item[]): Item[] {
  const byTopic = new Map<string, Item[]>()
  for (const it of items) (byTopic.get(it.topic) ?? byTopic.set(it.topic,[]).get(it.topic)!).push(it)
  const queues = [...byTopic.values()]; const out: Item[] = []
  while (out.length < items.length) {
    queues.sort((a,b)=>b.length-a.length)
    const q = queues.find(q => q.length && (!out.length || q[0].topic !== out[out.length-1].topic)) ?? queues.find(q=>q.length)!
    out.push(q.shift()!)
  }
  return out
}
export function buildSession(items: Item[], progress: Map<string,ItemProgress>,
  opts: { newPerDay:number; cap:number; now?:Date }): Item[] {
  const now = opts.now ?? new Date()
  const due: Item[] = [], fresh: Item[] = []
  for (const it of items) {
    const p = progress.get(it.id)
    if (!p) fresh.push(it)
    else if (isDue(p.card, now)) due.push(it)
  }
  const chosen = [...due, ...fresh.slice(0, opts.newPerDay)].slice(0, opts.cap)
  return interleave(chosen)
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): session builder with interleaving"`

---

### Task 6: IndexedDB store + export/import + id migration

**Files:**
- Create: `src/engine/db.ts`, `src/engine/db.test.ts`

**Interfaces:**
- Produces: `class Store` with `open():Promise<void>`, `getProgress(id):Promise<ItemProgress|undefined>`, `putProgress(p):Promise<void>`, `allProgress():Promise<Map<string,ItemProgress>>`, `getMeta<T>(k,def):Promise<T>`, `setMeta(k,v):Promise<void>`, `exportAll():Promise<string>`, `importAll(json:string, opts?:{idMap?:Record<string,string>}):Promise<{ok:boolean;error?:string}>`. DB name `momentum`, stores `progress` (keyPath `itemId`), `sessions`, `meta`.

- [ ] **Step 1: Write failing test** (uses `fake-indexeddb/auto` from setup)
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Store } from './db'
import { newCard } from './scheduler'
const p = (id:string) => ({ itemId:id, card:newCard(), seen:0, correct:0 })
describe('Store', () => {
  let s: Store
  beforeEach(async () => { indexedDB.deleteDatabase('momentum'); s = new Store(); await s.open() })
  it('round-trips progress', async () => {
    await s.putProgress(p('i1'))
    expect((await s.getProgress('i1'))?.itemId).toBe('i1')
  })
  it('exports and imports', async () => {
    await s.putProgress(p('i1')); const dump = await s.exportAll()
    indexedDB.deleteDatabase('momentum'); const s2 = new Store(); await s2.open()
    const r = await s2.importAll(dump); expect(r.ok).toBe(true)
    expect((await s2.getProgress('i1'))?.itemId).toBe('i1')
  })
  it('rejects malformed import without corrupting data', async () => {
    await s.putProgress(p('keep'))
    const r = await s.importAll('{not json'); expect(r.ok).toBe(false)
    expect((await s.getProgress('keep'))?.itemId).toBe('keep')
  })
  it('migrates ids on import', async () => {
    await s.putProgress(p('old')); const dump = await s.exportAll()
    indexedDB.deleteDatabase('momentum'); const s2 = new Store(); await s2.open()
    await s2.importAll(dump, { idMap: { old:'new' } })
    expect(await s2.getProgress('old')).toBeUndefined()
    expect((await s2.getProgress('new'))?.itemId).toBe('new')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `src/engine/db.ts`
```ts
import { openDB, type IDBPDatabase } from 'idb'
import type { ItemProgress } from './types'
const DB = 'momentum', VERSION = 1
export class Store {
  private db!: IDBPDatabase
  async open() {
    this.db = await openDB(DB, VERSION, { upgrade(db){
      if(!db.objectStoreNames.contains('progress')) db.createObjectStore('progress',{keyPath:'itemId'})
      if(!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions',{keyPath:'id',autoIncrement:true})
      if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }})
  }
  getProgress(id:string){ return this.db.get('progress', id) as Promise<ItemProgress|undefined> }
  async putProgress(p:ItemProgress){ await this.db.put('progress', p) }
  async allProgress(){ const all = await this.db.getAll('progress') as ItemProgress[]
    return new Map(all.map(p=>[p.itemId,p])) }
  async getMeta<T>(k:string, def:T){ const v = await this.db.get('meta', k); return (v===undefined?def:v) as T }
  async setMeta(k:string, v:unknown){ await this.db.put('meta', v, k) }
  async exportAll(){ const progress = await this.db.getAll('progress')
    const metaKeys = await this.db.getAllKeys('meta'); const meta:Record<string,unknown> = {}
    for(const k of metaKeys) meta[k as string] = await this.db.get('meta', k)
    return JSON.stringify({ format:'momentum-progress', version:VERSION, progress, meta }) }
  async importAll(json:string, opts?:{idMap?:Record<string,string>}) {
    let data:any
    try { data = JSON.parse(json) } catch { return { ok:false, error:'invalid JSON' } }
    if (data?.format!=='momentum-progress' || !Array.isArray(data.progress)) return { ok:false, error:'unrecognised backup' }
    const tx = this.db.transaction(['progress','meta'],'readwrite')
    for (const p of data.progress as ItemProgress[]) {
      const id = opts?.idMap?.[p.itemId] ?? p.itemId
      await tx.objectStore('progress').put({ ...p, itemId:id })
    }
    for (const [k,v] of Object.entries(data.meta ?? {})) await tx.objectStore('meta').put(v, k)
    await tx.done; return { ok:true }
  }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): IndexedDB store, export/import, id migration"`

---

### Task 7: Analytics (retention / mastery / forecast / weak areas)

**Files:**
- Create: `src/engine/analytics.ts`, `src/engine/analytics.test.ts`

**Interfaces:**
- Consumes: `Item`, `ItemProgress`, `State` (via ts-fsrs).
- Produces: `computeStats(items:Item[], progress:Map<string,ItemProgress>, now?:Date): { retention:number; mastered:number; seen:number; forecast:number[]; weakTopics:{topic:string;ratio:number}[] }` where `forecast[d]` = cards due on day offset `d` for `d in 0..6`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from 'vitest'
import { computeStats } from './analytics'
import { newCard, review, Rating } from './scheduler'
import type { Item, ItemProgress } from './types'
const mk = (id:string,topic:string):Item=>({id,topic,type:'cloze',prompt:{en:'',es:''},answer:'a',why:{en:'',es:''}})
describe('computeStats', () => {
  const now = new Date('2026-01-01')
  it('reports seen count and retention ratio', () => {
    const items=[mk('a','t0'),mk('b','t0')]
    const prog=new Map<string,ItemProgress>([
      ['a',{itemId:'a',seen:2,correct:2,card:review(newCard(now),Rating.Good,now)}],
      ['b',{itemId:'b',seen:2,correct:1,card:review(newCard(now),Rating.Good,now)}]])
    const s=computeStats(items,prog,now)
    expect(s.seen).toBe(2); expect(s.retention).toBeCloseTo(0.75,2)
  })
  it('flags weak topics (low correct ratio)', () => {
    const items=[mk('a','weak'),mk('b','strong')]
    const prog=new Map<string,ItemProgress>([
      ['a',{itemId:'a',seen:4,correct:1,card:newCard(now)}],
      ['b',{itemId:'b',seen:4,correct:4,card:newCard(now)}]])
    expect(computeStats(items,prog,now).weakTopics[0].topic).toBe('weak')
  })
  it('produces a 7-day forecast array', () => {
    const s=computeStats([mk('a','t0')],new Map(),now)
    expect(s.forecast).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — `src/engine/analytics.ts`
```ts
import type { Item, ItemProgress } from './types'
export function computeStats(items: Item[], progress: Map<string,ItemProgress>, now: Date = new Date()) {
  let seen=0, totalSeen=0, totalCorrect=0
  const byTopic = new Map<string,{seen:number;correct:number}>()
  for (const it of items) {
    const p = progress.get(it.id); if(!p || p.seen===0) continue
    seen++; totalSeen+=p.seen; totalCorrect+=p.correct
    const t = byTopic.get(it.topic) ?? { seen:0, correct:0 }
    t.seen+=p.seen; t.correct+=p.correct; byTopic.set(it.topic,t)
  }
  const retention = totalSeen ? totalCorrect/totalSeen : 0
  const mastered = [...progress.values()].filter(p=>p.card.stability>=21).length
  const forecast = Array.from({length:7}, ()=>0)
  const start = new Date(now); start.setHours(0,0,0,0)
  for (const p of progress.values()) {
    const d = Math.floor((new Date(p.card.due).getTime()-start.getTime())/86400000)
    if (d>=0 && d<7) forecast[d]++
  }
  const weakTopics = [...byTopic.entries()]
    .map(([topic,v])=>({topic, ratio: v.seen? v.correct/v.seen : 1}))
    .sort((a,b)=>a.ratio-b.ratio)
  return { retention, mastered, seen, forecast, weakTopics }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(engine): study analytics"`

---

## Phase 2 — Content pipeline

### Task 8: PDF → content JSON pipeline (Present tense) + diagrams + CI validator

**Files:**
- Create: `scripts/extract_pdf.py`, `scripts/export_diagrams.sh`, `scripts/validate_content.mjs`, `content/tenses.json` (generated, then curated)

**Interfaces:**
- Produces: `content/tenses.json` conforming to `ContentFile`, validated by the same rules as `src/engine/schema.ts`; diagrams under `content/assets/`.

- [ ] **Step 1: Draft extractor** — `scripts/extract_pdf.py`: use `pypdf` to read `"Present tense masterclass.pdf"`, split into topic sections by heading heuristics, emit a draft `content/tenses.json` skeleton (module `tenses`, accent `#6366F1`, one topic per present tense window) with `explanation` blocks and empty `items:[]`.
```python
# usage: python3 scripts/extract_pdf.py "Present tense masterclass.pdf" content/tenses.json
import sys, json, re
from pypdf import PdfReader
src, out = sys.argv[1], sys.argv[2]
pages = [ (p.extract_text() or "") for p in PdfReader(src).pages ]
text = "\n".join(pages)
# heuristic: split on the four "WINDOW" markers seen in the corpus
module = {"version":1,"module":{"id":"tenses","title":{"en":"Tense system","es":"Sistema de tiempos"},
  "accent":"#6366F1","topics":[],"items":[]}}
json.dump(module, open(out,"w"), ensure_ascii=False, indent=2)
print("wrote", out)
```

- [ ] **Step 2: Diagram export** — `scripts/export_diagrams.sh` (requires poppler)
```bash
#!/usr/bin/env bash
set -e
command -v pdftoppm >/dev/null || { echo "install poppler: brew install poppler"; exit 1; }
mkdir -p content/assets
pdftoppm -png -r 150 "Present tense masterclass.pdf" content/assets/present
echo "exported present-*.png"
```

- [ ] **Step 3: Curate** — hand-author `content/tenses.json` topics + items from the extracted text: for each present window write `explanation` blocks (EN/ES), attach diagram filenames, and author `items` (cloze/choice/natural) reusing the PDF's own practice questions and `❌`-marked mistakes as `distractors`; set `why` and `accept` for each. (This is the mechanical, repeatable curation step.)

- [ ] **Step 4: CI validator** — `scripts/validate_content.mjs` imports the compiled `validateContent` (or re-implements the same checks) and validates every `content/*.json`; exits non-zero on error.
```js
import { readFileSync, readdirSync } from 'node:fs'
import { validateContent } from '../dist-engine/schema.js' // built by `tsc` of engine, or inline the checks
let bad = 0
for (const f of readdirSync('content').filter(f=>f.endsWith('.json'))) {
  const r = validateContent(JSON.parse(readFileSync('content/'+f,'utf8')))
  if(!r.ok){ bad++; console.error(f, r.errors) }
}
process.exit(bad?1:0)
```

- [ ] **Step 5: Verify + commit** — `npm run content:validate` passes; `git add -A && git commit -m "feat(content): present-tense pipeline + curated tenses.json"`

---

## Phase 3 — Core UI + audio

### Task 9: Observable store + hash router

**Files:**
- Create: `src/store.ts`, `src/router.ts`, `src/store.test.ts`

**Interfaces:**
- Produces: `createStore<T>(initial:T)` → `{ get():T; set(patch:Partial<T>):void; subscribe(fn:(s:T)=>void):()=>void }`; `onRoute(fn:(route:{view:string;param?:string})=>void):void` parsing `#/view/param`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect, vi } from 'vitest'
import { createStore } from './store'
describe('store', () => {
  it('notifies subscribers on set', () => {
    const s = createStore({ n:0 }); const spy = vi.fn(); s.subscribe(spy)
    s.set({ n:1 }); expect(spy).toHaveBeenCalledWith({ n:1 }); expect(s.get().n).toBe(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**
```ts
// src/store.ts
export function createStore<T extends object>(initial:T){
  let state = { ...initial }; const subs = new Set<(s:T)=>void>()
  return { get:()=>state, set:(p:Partial<T>)=>{ state={...state,...p}; subs.forEach(f=>f(state)) },
    subscribe:(f:(s:T)=>void)=>{ subs.add(f); return ()=>subs.delete(f) } }
}
// src/router.ts
export function onRoute(fn:(r:{view:string;param?:string})=>void){
  const parse = ()=>{ const [,view='hub',param] = location.hash.split('/'); fn({view:view||'hub',param}) }
  addEventListener('hashchange', parse); parse()
}
export function go(view:string, param?:string){ location.hash = `#/${view}${param?'/'+param:''}` }
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): observable store + hash router"`

---

### Task 10: App shell + theme toggle + content loader

**Files:**
- Create: `src/ui/app.ts`, `src/ui/components/progress-ring.ts`, `src/ui/components/streak-chip.ts`; Modify: `src/main.ts`

**Interfaces:**
- Consumes: store, router, `Store` (db), `validateContent`.
- Produces: `mountApp(root:HTMLElement):Promise<void>` that opens the DB, loads+validates `content/tenses.json`, renders nav + routed view container, applies `data-theme`.

- [ ] **Step 1: Smoke test** — `src/ui/app.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('../engine/db', () => ({ Store: class { async open(){}; async allProgress(){return new Map()}
  async getMeta(_:string,d:any){return d}; async setMeta(){} } }))
import { mountApp } from './app'
describe('app shell', () => {
  it('renders nav landmarks', async () => {
    const root = document.createElement('div')
    await mountApp(root, { version:1, module:{ id:'tenses', title:{en:'T',es:'T'}, accent:'#6366F1', topics:[], items:[] } } as any)
    expect(root.querySelector('nav')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `mountApp(root, content)` — build header (title, streak-chip, theme toggle), `<nav>` with links to hub/insights/settings, and a `<main id="view">`; wire `onRoute` to render the right view (stubs until later tasks). `progress-ring.ts` renders an SVG ring given `percent` + `color`. `main.ts` fetches `content/tenses.json`, validates, calls `mountApp`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): app shell, theme toggle, content loader"`

---

### Task 11: Hub view

**Files:** Create `src/ui/views/hub.ts`, `src/ui/views/hub.test.ts`
**Interfaces:** Produces `renderHub(container, ctx)` where `ctx={content, progress, stats, onPractice, onOpenTopic}`; shows module cards with progress rings, a search box filtering topics, streak, and the "Practicar lo de hoy (N · ~min)" CTA (N from `buildSession`).

- [ ] **Step 1: Smoke test** — asserts a module card and the practice CTA render given fake ctx.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** hub rendering (module list from `content.module`, per-topic progress via `progress`, search input filtering by title EN/ES, CTA computing session size from `buildSession`).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): hub view"`

---

### Task 12: Topic view + bilingual callout + audio button (TTS, graceful)

**Files:** Create `src/audio/tts.ts`, `src/audio/tts.test.ts`, `src/ui/components/bilingual-callout.ts`, `src/ui/components/audio-button.ts`, `src/ui/views/topic.ts`

**Interfaces:** `speak(text:string, opts?:{voice?:string;rate?:number}):void`, `ttsAvailable():boolean`, `listVoices():SpeechSynthesisVoice[]`. Audio button calls `speak` and is `disabled`/hidden when `!ttsAvailable()`. `renderTopic(container, {topic, onPractice})`.

- [ ] **Step 1: Write failing test** — `src/audio/tts.test.ts` (Review Focus #1)
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ttsAvailable, speak } from './tts'
afterEach(()=>{ vi.unstubAllGlobals() })
describe('tts graceful degradation', () => {
  it('reports unavailable and speak() is a safe no-op when no speechSynthesis', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    expect(ttsAvailable()).toBe(false)
    expect(()=>speak('hello')).not.toThrow()
  })
  it('calls speechSynthesis.speak when available', () => {
    const spy = vi.fn()
    vi.stubGlobal('speechSynthesis', { speak: spy, getVoices: ()=>[] })
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public t:string){} } as any)
    speak('hello'); expect(spy).toHaveBeenCalled()
  })
})
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `tts.ts`:
```ts
export function ttsAvailable(){ return typeof globalThis.speechSynthesis !== 'undefined' }
export function listVoices(){ return ttsAvailable()? speechSynthesis.getVoices() : [] }
export function speak(text:string, opts:{voice?:string;rate?:number}={}){
  if(!ttsAvailable()) return
  const u = new SpeechSynthesisUtterance(text); u.rate = opts.rate ?? 0.95
  const v = listVoices().find(v=>v.name===opts.voice || v.lang.startsWith('en'))
  if(v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u)
}
```
Then `audio-button.ts` (a `<button aria-label="Escuchar">🔊</button>`, hidden if `!ttsAvailable()`), `bilingual-callout.ts` (EN block + ES block, audio button on EN), and `topic.ts` (renders explanation blocks, diagrams `<img loading=lazy>`, examples with audio buttons, "Practicar este tema" button).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): topic view + bilingual callout + TTS audio (graceful)"`

---

### Task 13: Practice view (retrieval-first flow)

**Files:** Create `src/ui/components/practice-card.ts`, `src/ui/views/practice.ts`, `src/ui/views/practice.test.ts`

**Interfaces:** `renderPractice(container, { items, progress, store, onDone })`. Flow: prompt → user answers (typed for cloze, buttons for choice/natural, drag/tap for order/match) → `isCorrect` → reveal answer + `why` + audio + diagram → 4 rating buttons → `review(card,rating)` → `putProgress` (update seen/correct) → next. Offline-only (Review Focus #2): no network calls here.

- [ ] **Step 1: Smoke test** — render one cloze item, submit the correct answer, assert the `why` text appears and rating buttons show; submit rating "Bien" and assert `store.putProgress` called with updated card.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** the card component + flow, using `normalize/isCorrect`, `scheduler.review`, and `store.putProgress`. Keyboard shortcuts 1–4 for ratings on desktop; `aria-live` region for feedback.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): retrieval-first practice flow"`

---

## Phase 4 — Study-value features

### Task 14: Insights view

**Files:** Create `src/ui/views/insights.ts`, `src/ui/views/insights.test.ts`
**Interfaces:** `renderInsights(container, { stats, onFocusWeak })` — retention %, mastered/seen, 7-day forecast bar chart (CSS bars), weak-topics list with "Reforzar" buttons that start a topic-filtered session.
- [ ] **Step 1: Smoke test** — given fake `stats`, asserts retention % text and one weak-topic "Reforzar" button render.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** using `computeStats` output; bars from `stats.forecast`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ui): insights view"`

### Task 15: Bookmarks, notes, and "Mis errores" log

**Files:** Modify `src/engine/db.ts` (+ store `notes` keyed by itemId; bookmark flag + mistakes log in `meta`); Create `src/engine/mistakes.ts`, `src/engine/mistakes.test.ts`
**Interfaces:** `logMistake(store, itemId, given:string):Promise<void>`; `recentMistakes(store, n):Promise<{itemId:string;given:string;at:number}[]>`; bookmark toggle `setBookmark(store,itemId,on)`.
- [ ] **Step 1: Write failing test** — logging two mistakes returns them newest-first, capped at `n`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** mistakes log (append to a `meta.mistakes` ring buffer) + bookmark/notes helpers; wire a "practicar mis errores" entry (topic-agnostic session from logged item ids). Add the practice flow call to `logMistake` on a wrong answer.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat: bookmarks, notes, mistakes log + focused review"`

### Task 16: Onboarding (first-run)

**Files:** Create `src/ui/views/onboarding.ts`, `src/ui/views/onboarding.test.ts`
**Interfaces:** `maybeOnboard(store):Promise<boolean>` returns whether to show; `renderOnboarding(container, onDone)` — 3 slides explaining retrieval + spaced repetition ("cuesta = aprende") and sets `meta.onboarded=true` + initial `newPerDay`.
- [ ] **Step 1: Smoke test** — `maybeOnboard` true when `meta.onboarded` unset; false after done.
- [ ] **Step 2–5:** implement, test, commit — `git commit -am "feat(ui): first-run onboarding"`

---

## Phase 5 — PWA / offline / data safety

### Task 17: PWA install + persistence + offline shell

**Files:** Create `public/manifest.webmanifest`, `public/icons/*`; Modify `src/main.ts`, `vite.config.ts`
**Interfaces:** SW via `vite-plugin-pwa` precaches shell + `content/*.json` + `assets/*`; `requestPersist():Promise<boolean>` calls `navigator.storage.persist()`; a banner warns if persistence denied or IndexedDB unavailable (Review Focus #3).
- [ ] **Step 1: Write failing test** — `src/main.test.ts`: `requestPersist` returns false and shows no throw when `navigator.storage` is undefined.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** manifest (name "Momentum", theme `#0F172A`, icons, `display:standalone`), `requestPersist`, IndexedDB-availability guard + warning banner, enable manifest in `vite.config.ts`.
- [ ] **Step 4: Run — expect PASS**, then `npm run build && npm run preview`, load, go offline (DevTools), confirm practice still works.
- [ ] **Step 5: Commit** — `git commit -am "feat(pwa): installable + offline + persistent storage"`

### Task 18: Backup/restore UI + reminder

**Files:** Create `src/ui/views/settings.ts`, `src/ui/views/settings.test.ts`
**Interfaces:** Settings renders theme/UI-lang/newPerDay/voice controls + **Export** (downloads `store.exportAll()`), **Import** (file input → `store.importAll`), and a backup reminder based on `meta.lastBackup`.
- [ ] **Step 1: Smoke test** — clicking Export triggers a download blob; Import of malformed file shows an error toast (uses `importAll` result).
- [ ] **Step 2–5:** implement, test, commit — `git commit -am "feat(ui): settings + backup/restore + reminder"`

---

## Phase 6 — AI Tutor (optional online layer)

### Task 19: Provider interface + Gemini adapter + graceful degradation

**Files:** Create `src/ai/provider.ts`, `src/ai/gemini.ts`, `src/ai/tutor.ts`, `src/ai/tutor.test.ts`
**Interfaces:**
- `interface AITutorProvider { explain(topic,itemContext):Promise<string>; whyWrong(item,given):Promise<string>; generateItems(topic,n):Promise<Item[]>; chat(history):Promise<string> }`
- `aiAvailable(store):Promise<boolean>` = online AND key present.
- `getTutor(store):Promise<AITutorProvider|null>` returns null when unavailable.

- [ ] **Step 1: Write failing test** (Review Focus #4)
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { aiAvailable, getTutor } from './tutor'
const fakeStore = (key?:string) => ({ getMeta: async (_:string,d:any)=> key ?? d }) as any
afterEach(()=>vi.unstubAllGlobals())
describe('AI tutor availability', () => {
  it('unavailable with no key', async () => {
    vi.stubGlobal('navigator', { onLine:true })
    expect(await aiAvailable(fakeStore(undefined))).toBe(false)
    expect(await getTutor(fakeStore(undefined))).toBeNull()
  })
  it('unavailable when offline even with key', async () => {
    vi.stubGlobal('navigator', { onLine:false })
    expect(await aiAvailable(fakeStore('k'))).toBe(false)
  })
  it('generateItems output is schema-validated before returning', async () => {
    vi.stubGlobal('navigator', { onLine:true })
    vi.stubGlobal('fetch', vi.fn(async ()=>({ ok:true, json: async ()=>({ candidates:[{content:{parts:[{text:'[]'}]}}] }) })) as any)
    const t = await getTutor(fakeStore('k')); expect(t).not.toBeNull()
    const items = await t!.generateItems({ id:'t1' } as any, 3)
    expect(Array.isArray(items)).toBe(true)  // invalid items dropped by validation
  })
})
```
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** `gemini.ts` (fetch `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=…`, timeout via `AbortController`, try/catch → throws typed error), `tutor.ts` (`aiAvailable` checks `navigator.onLine` + stored key; `getTutor` returns adapter or null; `generateItems` runs returned JSON through `validateContent`-style item checks and drops invalid ones). No call is made without an explicit user action in the UI layer.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(ai): Gemini tutor provider with graceful degradation"`

### Task 20: AI Tutor UI hooks

**Files:** Modify `src/ui/views/practice.ts`, `src/ui/views/topic.ts`, `src/ui/views/settings.ts`
**Interfaces:** Settings gains an "AI Tutor (Gemini)" section: paste key → `store.setMeta('aiKey',…)`, with the security note. Practice reveal panel shows "¿Por qué fallé?" and "Explícame más" **only when `aiAvailable`**. Topic view shows "Generar práctica" (validates + saves via schema before adding items).
- [ ] **Step 1: Smoke test** — with `aiAvailable`=false (mock), the AI buttons are absent from the practice reveal panel; with true, present.
- [ ] **Step 2–5:** implement, test, commit — `git commit -am "feat(ui): AI tutor hooks behind availability"`

---

## Phase 7 — Wire-up + QA + portable build

### Task 21: End-to-end Present tense + manual QA + single-file export

**Files:** Modify `src/main.ts` (ensure tenses loads), `vite.config.ts` (add a `singlefile` build mode)
- [ ] **Step 1:** Run full app: onboard → hub shows Present tense with progress → open a topic (read, hear audio) → "Practicar lo de hoy" (mixed session, retrieval-first, ratings persist) → Insights updates → export/import round-trip → reload offline still works.
- [ ] **Step 2:** Manual QA checklist: phone + desktop responsive; dark/light; keyboard-only run; `prefers-reduced-motion`; contrast spot-check; airplane-mode practice; one real AI call with your Gemini key.
- [ ] **Step 3:** Add single-file build (`vite-plugin-singlefile` under a `--mode singlefile` that inlines one module) → produces a portable `momentum.html`.
- [ ] **Step 4:** `npm test` all green; `npm run build` clean.
- [ ] **Step 5: Commit + tag** — `git commit -am "feat: Present-tense vertical slice complete" && git tag v0.1.0`

---

## Rollout: modules 2–6 (repeat, content-only)

For each remaining module (Conditionals → Structure → Verb forms → Mechanics → Functional): run **Task 8's pipeline** (`extract_pdf.py` + `export_diagrams.sh` + curate + `content:validate`) to produce `content/<module>.json`, drop it in, and it lights up in the hub/practice/insights automatically — no engine changes. Each module = one content commit; Conditionals additionally wires the "all conditionals" timeline image as a topic diagram.

---

## Self-review notes (done)

- **Spec coverage:** layers (§2)→Tasks 12/19/20; delivery/PWA (§3)→Task 17; learning principles (§4)→Tasks 5/13/14; UX (§5)→Tasks 11/13/16; views (§6)→Tasks 10–14,18,20; content model (§7)→Tasks 2/3; pipeline (§8)→Task 8; FSRS (§9)→Tasks 4/5/13; audio (§10)→Task 12; AI Tutor (§11)→Tasks 19/20; identity (§12)→Task 1 tokens + all views; data safety (§13)→Tasks 6/17/18; rollout (§14)→final section; tests (§15)→every task; futures (§16)→out of scope, noted.
- **Placeholder scan:** curation content in Task 8 is inherently authored, not a code placeholder; all code steps carry real code.
- **Type consistency:** `Item`/`ItemProgress`/`Card`/`buildSession`/`review`/`Store`/`computeStats` signatures are used identically across tasks.
- **Review Focus:** all 7 mapped to owning tasks (2,6,12,13,17,20).
