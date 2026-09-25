// Settings view: theme / interface language / daily goal / voice controls,
// plus data safety — Export (download store.exportAll()) and Import (file →
// store.importAll) — and a reminder to back up when it's been a while. Pure
// button-group controls (touch-friendly, offline). All DOM, no innerHTML.

const BACKUP_INTERVAL = 7 * 86400000; // a week

/**
 * Export all progress as a downloadable JSON backup and stamp lastBackup.
 * @param {{ exportAll: () => Promise<string>, setMeta: (k: string, v: any) => Promise<void> }} store
 * @param {(filename: string, text: string) => void} download
 * @param {Date} [now]
 */
export async function runExport(store, download, now = new Date()) {
  const json = await store.exportAll();
  const stamp = now.toISOString().slice(0, 10);
  download(`momentum-backup-${stamp}.json`, json);
  await store.setMeta('lastBackup', now.getTime());
  return { ok: true, message: 'Copia de seguridad descargada.' };
}

/**
 * Restore a backup. Never corrupts existing data (store.importAll guards).
 * @param {{ importAll: (json: string) => Promise<{ ok: boolean, error?: string }> }} store
 * @param {string} text
 * @param {Date} [now]
 */
export async function runImport(store, text, _now = new Date()) {
  const r = await store.importAll(text);
  if (!r.ok) return { ok: false, message: `No se pudo importar: ${r.error ?? 'archivo no válido'}.` };
  return { ok: true, message: 'Progreso restaurado. Recarga la app para verlo.' };
}

/**
 * A gentle reminder to back up, or null when a recent backup exists.
 * @param {number | undefined} lastBackup epoch millis
 * @param {Date} [now]
 * @returns {HTMLElement | null}
 */
export function backupReminder(lastBackup, now = new Date()) {
  if (lastBackup && now.getTime() - lastBackup < BACKUP_INTERVAL) return null;
  const el = document.createElement('div');
  el.className = 'backup-reminder';
  el.setAttribute('data-role', 'backup-reminder');
  el.setAttribute('role', 'note');
  const p = document.createElement('p');
  p.textContent = lastBackup
    ? 'Ha pasado más de una semana desde tu última copia. Exporta tu progreso para no perderlo.'
    : 'Aún no has hecho una copia de seguridad. Exporta tu progreso para guardarlo a salvo.';
  el.append(p);
  return el;
}

const THEME_OPTIONS = [{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }];
const LANG_OPTIONS = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }];
const GOAL_OPTIONS = [5, 10, 15, 20].map((n) => ({ value: String(n), label: `${n} / día` }));

/**
 * @param {HTMLElement} container
 * @param {{
 *   store: any,
 *   settings?: { theme?: string, lang?: string, newPerDay?: number, voice?: string, ttsVoice?: string, lastBackup?: number, aiKey?: string },
 *   voices?: string[],
 *   ttsVoices?: string[],
 *   onChange?: (key: string, value: any) => void,
 *   download?: (filename: string, text: string) => void,
 *   now?: Date,
 * }} ctx
 */
export function renderSettings(container, { store, settings = {}, voices = [], ttsVoices = [], onChange, download = defaultDownload, now = new Date() }) {
  clear(container);
  const section = document.createElement('section');
  section.className = 'settings';
  section.setAttribute('data-view', 'settings');

  const h2 = document.createElement('h2');
  h2.textContent = 'Ajustes';
  section.append(h2);

  const toastArea = document.createElement('div');
  toastArea.className = 'toast-area';
  toastArea.setAttribute('data-role', 'toast-area');
  toastArea.setAttribute('aria-live', 'polite');

  const rem = backupReminder(settings.lastBackup, now);
  if (rem) section.append(rem);

  // Preferences
  section.append(buttonGroup('Tema', 'theme', THEME_OPTIONS, settings.theme ?? 'dark', (v) => onChange?.('theme', v)));
  section.append(buttonGroup('Idioma de la interfaz', 'lang', LANG_OPTIONS, settings.lang ?? 'es', (v) => onChange?.('lang', v)));
  section.append(buttonGroup('Meta diaria', 'new-per-day', GOAL_OPTIONS, String(settings.newPerDay ?? 10), (v) => onChange?.('newPerDay', Number(v))));

  const voiceOptions = [{ value: '', label: 'Voz automática' }, ...voices.map((v) => ({ value: v, label: v }))];
  section.append(buttonGroup('Voz (inglés)', 'voice', voiceOptions, settings.voice ?? '', (v) => onChange?.('voice', v)));

  // Voz natural (IA): Gemini TTS voices. Empty = the browser voice (robotic but
  // always offline). A chosen voice is used online with the learner's key, then
  // cached so it replays offline; without a key it silently falls back.
  if (ttsVoices.length) {
    const ttsVoiceOptions = [{ value: '', label: 'Voz del navegador' }, ...ttsVoices.map((v) => ({ value: v, label: v }))];
    section.append(buttonGroup('Voz natural (IA)', 'tts-voice', ttsVoiceOptions, settings.ttsVoice ?? '', (v) => onChange?.('ttsVoice', v)));
  }

  // Data safety
  const dataH = document.createElement('h3');
  dataH.textContent = 'Copia de seguridad';
  section.append(dataH);

  const actions = document.createElement('div');
  actions.className = 'settings-actions';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn';
  exportBtn.setAttribute('data-action', 'export');
  exportBtn.textContent = 'Exportar progreso';
  exportBtn.addEventListener('click', async () => {
    const r = await runExport(store, download, now);
    showToast(toastArea, r.message, r.ok ? 'ok' : 'error');
  });

  const importLabel = document.createElement('label');
  importLabel.className = 'btn ghost import-label';
  importLabel.append(document.createTextNode('Importar progreso'));
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.setAttribute('data-role', 'import-input');
  importInput.className = 'visually-hidden';
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    const text = await file.text();
    const r = await runImport(store, text, now);
    showToast(toastArea, r.message, r.ok ? 'ok' : 'error');
  });
  importLabel.append(importInput);

  actions.append(exportBtn, importLabel);
  section.append(actions);

  // AI Tutor (Gemini) — optional online realce. The key is the learner's own.
  section.append(aiTutorSection(store, settings, toastArea, onChange));

  section.append(toastArea);
  container.append(section);
}

/**
 * Section to paste / save the learner's own Gemini key, with a security note.
 * The key lives only in this device's IndexedDB (meta 'aiKey'), unencrypted.
 */
function aiTutorSection(store, settings, toastArea, onChange) {
  const wrap = document.createElement('section');
  wrap.className = 'settings-ai';
  wrap.setAttribute('data-role', 'ai-section');

  const h3 = document.createElement('h3');
  h3.textContent = 'Tutor IA (Gemini)';
  wrap.append(h3);

  const field = document.createElement('div');
  field.className = 'setting-group';

  const label = document.createElement('label');
  label.className = 'setting-label';
  label.textContent = 'Tu clave de Gemini';
  const input = document.createElement('input');
  input.type = 'password';
  input.className = 'text-input';
  input.setAttribute('data-role', 'ai-key');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('placeholder', 'AI...');
  input.value = settings.aiKey ?? '';
  label.append(input);
  field.append(label);

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn';
  save.setAttribute('data-action', 'save-ai-key');
  save.textContent = 'Guardar clave';
  save.addEventListener('click', async () => {
    const value = input.value.trim();
    await store.setMeta('aiKey', value);
    onChange?.('aiKey', value);
    showToast(toastArea, value ? 'Clave guardada en este dispositivo.' : 'Clave borrada.', 'ok');
  });
  field.append(save);
  wrap.append(field);

  const note = document.createElement('p');
  note.className = 'ai-note';
  note.setAttribute('data-role', 'ai-note');
  note.setAttribute('role', 'note');
  note.textContent = 'Tu clave se guarda solo en este dispositivo y se usa para '
    + 'hablar directamente con Google. No se cifra: evita usarla en un equipo '
    + 'compartido. El tutor es un extra opcional; la app funciona sin conexión.';
  wrap.append(note);

  return wrap;
}

function buttonGroup(label, role, options, current, onPick) {
  const group = document.createElement('div');
  group.className = 'setting-group';
  group.setAttribute('data-role', role);

  const legend = document.createElement('span');
  legend.className = 'setting-label';
  legend.textContent = label;
  group.append(legend);

  const choices = document.createElement('div');
  choices.className = 'setting-choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', label);
  for (const opt of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ghost';
    b.setAttribute('data-value', opt.value);
    b.setAttribute('aria-pressed', opt.value === current ? 'true' : 'false');
    b.textContent = opt.label;
    b.addEventListener('click', () => {
      for (const other of choices.querySelectorAll('[data-value]')) {
        other.setAttribute('aria-pressed', other === b ? 'true' : 'false');
      }
      onPick(opt.value);
    });
    choices.append(b);
  }
  group.append(choices);
  return group;
}

function showToast(area, message, kind) {
  clear(area);
  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.setAttribute('data-role', 'toast');
  toast.setAttribute('data-kind', kind);
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  area.append(toast);
}

function defaultDownload(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
