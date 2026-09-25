import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from '../../test-utils/dom-env.js';
import { renderSettings, runExport, runImport, backupReminder } from './settings.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeStore() {
  const meta = new Map();
  return {
    meta,
    async exportAll() { return '{"format":"momentum-progress","progress":[]}'; },
    async importAll(text) {
      try { JSON.parse(text); } catch { return { ok: false, error: 'JSON no válido' }; }
      return { ok: true };
    },
    async getMeta(k, def) { return meta.has(k) ? meta.get(k) : def; },
    async setMeta(k, v) { meta.set(k, v); },
  };
}

beforeEach(() => installDom());

test('runExport downloads the backup JSON and records lastBackup', async () => {
  const store = fakeStore();
  const now = new Date('2026-09-23T12:00:00Z');
  let dl = null;
  const r = await runExport(store, (name, text) => { dl = { name, text }; }, now);
  assert.equal(r.ok, true);
  assert.equal(dl.text, '{"format":"momentum-progress","progress":[]}');
  assert.match(dl.name, /momentum-backup-2026-09-23\.json/);
  assert.equal(await store.getMeta('lastBackup', null), now.getTime());
});

test('runImport reports success for valid data and an error for malformed input', async () => {
  const store = fakeStore();
  assert.equal((await runImport(store, '{"format":"momentum-progress","progress":[]}')).ok, true);
  const bad = await runImport(store, '{not json');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /No se pudo importar/);
});

test('backupReminder: null when recent, a note when stale or never', () => {
  const now = new Date('2026-09-23T00:00:00Z');
  assert.equal(backupReminder(now.getTime(), now), null);
  const stale = backupReminder(now.getTime() - 8 * 86400000, now);
  assert.equal(stale.getAttribute('data-role'), 'backup-reminder');
  assert.ok(backupReminder(undefined, now), 'never backed up → reminder shown');
});

test('clicking Export triggers a download and shows a confirmation toast', async () => {
  const container = document.createElement('div');
  const store = fakeStore();
  let dl = null;
  renderSettings(container, {
    store, settings: {}, voices: [], onChange: () => {},
    download: (name, text) => { dl = { name, text }; }, now: new Date('2026-09-23T12:00:00Z'),
  });
  container.querySelector('[data-action="export"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.ok(dl, 'download invoked');
  const toast = container.querySelector('[data-role="toast"]');
  assert.ok(toast);
  assert.equal(toast.getAttribute('data-kind'), 'ok');
});

test('importing a malformed file shows an error toast', async () => {
  const container = document.createElement('div');
  renderSettings(container, {
    store: fakeStore(), settings: {}, voices: [], onChange: () => {}, download: () => {}, now: new Date(),
  });
  const input = container.querySelector('[data-role="import-input"]');
  Object.defineProperty(input, 'files', { value: [{ text: async () => '{bad json' }], configurable: true });
  input.dispatchEvent(new window.Event('change'));
  await tick(); await tick();
  const toast = container.querySelector('[data-role="toast"]');
  assert.ok(toast, 'toast shown');
  assert.equal(toast.getAttribute('data-kind'), 'error');
  assert.match(toast.textContent, /No se pudo importar/);
});

test('changing the daily-goal control reports the new value via onChange', () => {
  const container = document.createElement('div');
  let changed = null;
  renderSettings(container, {
    store: fakeStore(), settings: { newPerDay: 10 }, voices: [],
    onChange: (k, v) => { changed = { k, v }; }, download: () => {}, now: new Date(),
  });
  const btn15 = [...container.querySelectorAll('[data-role="new-per-day"] [data-value]')]
    .find((b) => b.getAttribute('data-value') === '15');
  btn15.dispatchEvent(new window.Event('click'));
  assert.deepEqual(changed, { k: 'newPerDay', v: 15 });
});

test('the natural-voice (IA) picker lists the Gemini voices and reports the choice', () => {
  const container = document.createElement('div');
  let changed = null;
  renderSettings(container, {
    store: fakeStore(), settings: { ttsVoice: '' }, voices: [], ttsVoices: ['Kore', 'Puck'],
    onChange: (k, v) => { changed = { k, v }; }, download: () => {}, now: new Date(),
  });
  const group = container.querySelector('[data-role="tts-voice"]');
  assert.ok(group, 'has a natural-voice picker');
  const puck = [...group.querySelectorAll('[data-value]')].find((b) => b.getAttribute('data-value') === 'Puck');
  assert.ok(puck, 'lists the Puck voice');
  // Empty value = fall back to the browser voice, always available offline.
  assert.ok([...group.querySelectorAll('[data-value]')].some((b) => b.getAttribute('data-value') === ''), 'has an automatic/browser option');
  puck.dispatchEvent(new window.Event('click'));
  assert.deepEqual(changed, { k: 'ttsVoice', v: 'Puck' });
});

test('AI Tutor section saves the pasted Gemini key and confirms', async () => {
  const container = document.createElement('div');
  const store = fakeStore();
  let changed = null;
  renderSettings(container, {
    store, settings: {}, voices: [], onChange: (k, v) => { changed = { k, v }; }, download: () => {}, now: new Date(),
  });
  const input = container.querySelector('[data-role="ai-key"]');
  input.value = 'MY-GEMINI-KEY';
  container.querySelector('[data-action="save-ai-key"]').dispatchEvent(new window.Event('click'));
  await tick();
  assert.equal(store.meta.get('aiKey'), 'MY-GEMINI-KEY');
  assert.deepEqual(changed, { k: 'aiKey', v: 'MY-GEMINI-KEY' });
  assert.ok(container.querySelector('[data-role="toast"]'));
});

test('AI Tutor section shows the security note about the key', () => {
  const container = document.createElement('div');
  renderSettings(container, {
    store: fakeStore(), settings: {}, voices: [], onChange: () => {}, download: () => {}, now: new Date(),
  });
  const note = container.querySelector('[data-role="ai-note"]');
  assert.ok(note);
  assert.match(note.textContent, /clave|Google|dispositivo/i);
});

test('shows a backup reminder when nothing has been backed up yet', () => {
  const container = document.createElement('div');
  renderSettings(container, {
    store: fakeStore(), settings: {}, voices: [], onChange: () => {}, download: () => {}, now: new Date(),
  });
  assert.ok(container.querySelector('[data-role="backup-reminder"]'));
});
