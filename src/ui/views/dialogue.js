// Dialogue view — bidirectional voice role-play. The learner picks a scenario,
// taps the mic and speaks; the transcript goes to tutor.chat() with the
// scenario's English-only priming, and the reply is spoken with speakSmart and
// shown as an English bubble with an on-demand Spanish translation. ONLINE
// realce: without SpeechRecognition, without a tutor, or offline, the view
// degrades to reading + listening to the scenario — never a dead-end. Pure DOM.
import { SCENARIOS } from '../../../content/scenarios.js';
import { SpeechError } from '../../audio/speech.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   scenario?: object|null, scenarios?: object[],
 *   tutor?: import('../../ai/provider.js').AITutorProvider|null,
 *   online?: boolean, recognitionOk?: boolean,
 *   speak?: (text: string) => any,
 *   recognize?: (opts?: any) => Promise<{ transcript: string, confidence: number }>,
 *   onPick?: (id: string) => void, onBack?: () => void,
 * }} [ctx]
 */
export function renderDialogue(container, {
  scenario = null, scenarios = SCENARIOS, tutor = null, online = true,
  recognitionOk = true, speak, recognize, onPick, onBack,
} = {}) {
  clear(container);
  const section = document.createElement('section');
  section.className = 'dialogue';
  section.setAttribute('data-view', 'dialogue');

  const h2 = document.createElement('h2');
  h2.textContent = 'Hablar';
  section.append(h2);

  if (!scenario) {
    section.append(scenarioPicker(scenarios, onPick));
    container.append(section);
    return;
  }

  // Scenario header + back to the picker.
  const bar = document.createElement('div');
  bar.className = 'dialogue-bar';
  const title = document.createElement('h3');
  title.className = 'dialogue-title';
  title.textContent = scenario.title?.es ?? scenario.id;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn ghost';
  back.setAttribute('data-action', 'back');
  back.textContent = '← Escenarios';
  back.addEventListener('click', () => (onPick ? onPick('') : onBack?.()));
  bar.append(title, back);
  section.append(bar);

  const canTalk = online && !!tutor && recognitionOk;
  if (!canTalk) section.append(offlineNotice({ online, tutor, recognitionOk }));

  // Conversation transcript — local state, appended incrementally (no re-render
  // so the thread survives across turns).
  const thread = document.createElement('div');
  thread.className = 'dialogue-thread';
  thread.setAttribute('data-role', 'thread');
  thread.setAttribute('aria-live', 'polite');
  section.append(thread);

  /** @type {{ role: string, text: string }[]} */
  const turns = [];
  const systemTurn = {
    role: 'system',
    text: `${scenario.system} Reply ONLY in English, one or two short A2-level sentences, and stay in character.`,
  };

  // Opening tutor line — shown, spoken, and part of the history.
  turns.push({ role: 'tutor', text: scenario.opening });
  thread.append(bubble('tutor', scenario.opening, { speak, tutor: canTalk ? tutor : null }));
  speak?.(scenario.opening);

  // Suggested phrases (guides) — never block improvising.
  section.append(suggestions(scenario.suggestions ?? [], speak));

  // Mic control + status line.
  const controls = document.createElement('div');
  controls.className = 'dialogue-controls';
  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'btn mic';
  mic.setAttribute('data-action', 'mic');
  mic.textContent = '🎤 Hablar';
  mic.disabled = !canTalk;
  const status = document.createElement('span');
  status.className = 'dialogue-status muted';
  status.setAttribute('data-role', 'status');
  status.setAttribute('role', 'status');
  controls.append(mic, status);
  section.append(controls);

  const setStatus = (msg) => { status.textContent = msg ?? ''; };

  mic.addEventListener('click', async () => {
    if (mic.disabled) return;
    mic.disabled = true;
    setStatus('Escuchando…');

    let transcript = '';
    try {
      const r = await recognize?.({ lang: 'en-US' });
      transcript = (r?.transcript ?? '').trim();
    } catch (err) {
      setStatus(err instanceof SpeechError ? err.message : 'No se pudo reconocer la voz.');
      mic.disabled = false;
      return;
    }
    if (!transcript) {
      setStatus('No te oí. Inténtalo otra vez.');
      mic.disabled = false;
      return;
    }

    turns.push({ role: 'user', text: transcript });
    thread.append(bubble('user', transcript, { speak: null, tutor: null }));
    setStatus('Pensando…');

    let reply = '';
    try {
      reply = (await tutor.chat([systemTurn, ...turns])) ?? '';
    } catch (err) {
      // Keep the user turn so Edgar can just speak again to retry.
      setStatus(err?.message ? `${err.message} Reintenta.` : 'La IA no respondió. Reintenta.');
      mic.disabled = false;
      return;
    }
    reply = reply.trim();
    if (!reply) {
      setStatus('La IA no respondió. Reintenta.');
      mic.disabled = false;
      return;
    }

    turns.push({ role: 'tutor', text: reply });
    thread.append(bubble('tutor', reply, { speak, tutor }));
    speak?.(reply);
    setStatus('');
    mic.disabled = false;
  });

  container.append(section);
}

/** One chat bubble. Tutor bubbles get a 🔊 listen button and an on-demand ES toggle. */
function bubble(role, text, { speak, tutor }) {
  const box = document.createElement('div');
  box.className = `bubble bubble-${role}`;
  box.setAttribute('data-role', 'bubble');
  box.setAttribute('data-speaker', role);

  const p = document.createElement('p');
  p.className = 'bubble-text';
  p.textContent = text;
  box.append(p);

  if (role === 'tutor' && speak) {
    const listen = document.createElement('button');
    listen.type = 'button';
    listen.className = 'btn ghost bubble-listen';
    listen.setAttribute('data-action', 'listen');
    listen.setAttribute('aria-label', 'Escuchar');
    listen.textContent = '🔊';
    listen.addEventListener('click', () => speak(text));
    box.append(listen);
  }

  if (role === 'tutor' && tutor) {
    const es = document.createElement('p');
    es.className = 'bubble-es muted';
    es.setAttribute('data-role', 'translation');
    es.hidden = true;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn ghost bubble-translate';
    toggle.setAttribute('data-action', 'translate');
    toggle.textContent = 'Ver en español';

    let loaded = false;
    toggle.addEventListener('click', async () => {
      if (!loaded) {
        toggle.disabled = true;
        es.hidden = false;
        es.textContent = 'Traduciendo…';
        try {
          const t = await tutor.chat([{ role: 'user', text: `Traduce al español, solo la traducción, sin comillas: "${text}"` }]);
          es.textContent = (t ?? '').trim() || '(sin traducción)';
          loaded = true;
          toggle.textContent = 'Ocultar español';
        } catch {
          es.textContent = 'No se pudo traducir.';
          es.hidden = false;
        }
        toggle.disabled = false;
        return;
      }
      es.hidden = !es.hidden;
      toggle.textContent = es.hidden ? 'Ver en español' : 'Ocultar español';
    });
    box.append(toggle, es);
  }

  return box;
}

function suggestions(list, speak) {
  const wrap = document.createElement('div');
  wrap.className = 'dialogue-suggestions';
  wrap.setAttribute('data-role', 'suggestions');
  if (!list.length) return wrap;

  const h = document.createElement('h4');
  h.className = 'muted';
  h.textContent = 'Puedes decir…';
  wrap.append(h);

  for (const s of list) {
    const row = document.createElement('div');
    row.className = 'suggestion';
    const en = document.createElement('span');
    en.className = 'suggestion-en';
    en.textContent = s.en;
    const es = document.createElement('span');
    es.className = 'suggestion-es muted';
    es.textContent = s.es;
    row.append(en, es);
    if (speak) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost';
      b.setAttribute('data-action', 'listen-suggestion');
      b.setAttribute('aria-label', 'Escuchar');
      b.textContent = '🔊';
      b.addEventListener('click', () => speak(s.en));
      row.append(b);
    }
    wrap.append(row);
  }
  return wrap;
}

function scenarioPicker(scenarios, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'scenario-picker';
  wrap.setAttribute('data-role', 'scenario-picker');

  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = 'Elige una situación para practicar hablando. Tú hablas, la IA te responde.';
  wrap.append(intro);

  const list = document.createElement('ul');
  list.className = 'scenario-list';
  for (const s of scenarios) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn scenario-card';
    btn.setAttribute('data-action', 'pick-scenario');
    btn.setAttribute('data-scenario', s.id);
    const t = document.createElement('strong');
    t.textContent = s.title?.es ?? s.id;
    const sub = document.createElement('span');
    sub.className = 'muted';
    sub.textContent = s.title?.en ?? '';
    btn.append(t, sub);
    btn.addEventListener('click', () => onPick?.(s.id));
    li.append(btn);
    list.append(li);
  }
  wrap.append(list);
  return wrap;
}

function offlineNotice({ online, tutor, recognitionOk }) {
  const note = document.createElement('div');
  note.className = 'dialogue-notice';
  note.setAttribute('data-role', 'offline-notice');
  note.setAttribute('role', 'note');
  const p = document.createElement('p');
  if (!recognitionOk) {
    p.textContent = 'Tu navegador no permite hablar (usa Chrome en Android). Puedes leer y escuchar el escenario.';
  } else if (!online) {
    p.textContent = 'El diálogo por voz necesita conexión. Puedes leer y escuchar el escenario mientras tanto.';
  } else if (!tutor) {
    p.textContent = 'Añade tu clave de Gemini en Ajustes para hablar con la IA. Puedes leer y escuchar el escenario.';
  } else {
    p.textContent = 'El diálogo por voz no está disponible ahora. Puedes leer y escuchar el escenario.';
  }
  note.append(p);
  return note;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
