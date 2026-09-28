// Vista de práctica de pronunciación (coaching cualitativo). El estudiante elige
// un tema, ve sus frases de ejemplo, toca 🎤 y dice la frase; el reconocedor
// transcribe, comparePronunciation marca palabras ok/off + score orientativo, y
// si hay tutor, coachPronunciation da consejo en español. Realce ONLINE: sin
// reconocimiento, sin red o sin tutor, degrada a leer+escuchar la frase — nunca
// un dead-end. HONESTO: es una guía por lo que el reconocedor entendió, no un
// examen. DOM puro.
import { comparePronunciation } from '../../engine/pronunciation.js';
import { SpeechError } from '../../audio/speech.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   topic?: object|null, topics?: object[],
 *   tutor?: import('../../ai/provider.js').AITutorProvider|null,
 *   online?: boolean, recognitionOk?: boolean,
 *   speak?: (text: string) => any,
 *   recognize?: (opts?: any) => Promise<{ transcript: string, confidence: number }>,
 *   compare?: (target: string, heard: string) => any,
 *   onPick?: (id: string) => void, onBack?: () => void,
 * }} [ctx]
 */
export function renderPronounce(container, {
  topic = null, topics = [], tutor = null, online = true, recognitionOk = true,
  speak, recognize, compare = comparePronunciation, onPick, onBack,
} = {}) {
  clear(container);
  const section = document.createElement('section');
  section.className = 'pronounce';
  section.setAttribute('data-view', 'pronounce');

  const h2 = document.createElement('h2');
  h2.textContent = 'Pronunciar';
  section.append(h2);

  if (!topic) {
    section.append(topicPicker(topics, onPick));
    container.append(section);
    return;
  }

  // Cabecera + volver al picker.
  const bar = document.createElement('div');
  bar.className = 'pronounce-bar';
  const title = document.createElement('h3');
  title.className = 'pronounce-title';
  title.textContent = topic.title?.es ?? topic.id;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn ghost';
  back.setAttribute('data-action', 'back');
  back.textContent = '← Temas';
  back.addEventListener('click', () => (onPick ? onPick('') : onBack?.()));
  bar.append(title, back);
  section.append(bar);

  // Honestidad de alcance (spec).
  const honest = document.createElement('p');
  honest.className = 'pronounce-honest muted';
  honest.textContent = 'Es una guía basada en lo que el reconocedor entendió, no un examen de pronunciación.';
  section.append(honest);

  const canSpeak = online && recognitionOk;
  if (!canSpeak) section.append(offlineNotice({ online, recognitionOk }));

  const list = document.createElement('div');
  list.className = 'pronounce-list';
  for (const ex of topic.examples ?? []) {
    list.append(phraseCard(ex, { canSpeak, tutor, speak, recognize, compare }));
  }
  section.append(list);

  container.append(section);
}

function phraseCard(ex, { canSpeak, tutor, speak, recognize, compare }) {
  const card = document.createElement('div');
  card.className = 'phrase';
  card.setAttribute('data-role', 'phrase');

  const en = document.createElement('p');
  en.className = 'phrase-en';
  en.textContent = ex.en;
  const es = document.createElement('p');
  es.className = 'phrase-es muted';
  es.textContent = ex.es;
  card.append(en, es);

  const controls = document.createElement('div');
  controls.className = 'phrase-controls';

  const listen = document.createElement('button');
  listen.type = 'button';
  listen.className = 'btn ghost';
  listen.setAttribute('data-action', 'listen');
  listen.setAttribute('aria-label', 'Escuchar');
  listen.textContent = '🔊';
  if (speak) listen.addEventListener('click', () => speak(ex.en));

  const mic = document.createElement('button');
  mic.type = 'button';
  mic.className = 'btn mic';
  mic.setAttribute('data-action', 'mic');
  mic.textContent = '🎤 Decir';
  mic.disabled = !canSpeak;

  const status = document.createElement('span');
  status.className = 'phrase-status muted';
  status.setAttribute('data-role', 'status');
  status.setAttribute('role', 'status');

  controls.append(listen, mic, status);
  card.append(controls);

  const setStatus = (m) => { status.textContent = m ?? ''; };

  mic.addEventListener('click', async () => {
    if (mic.disabled) return;
    mic.disabled = true;
    setStatus('Escuchando…');
    // Limpia un resultado previo (reintento).
    card.querySelector('[data-role="result"]')?.remove();

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
      setStatus('No te oí. Toca 🎤 e inténtalo otra vez.');
      mic.disabled = false;
      return;
    }
    setStatus('');

    const cmp = compare(ex.en, transcript);
    card.append(resultBox(cmp, transcript, tutor, ex.en));
    mic.disabled = false; // reintentar cuando quiera
  });

  return card;
}

function resultBox(cmp, transcript, tutor, target) {
  const box = document.createElement('div');
  box.className = 'phrase-result';
  box.setAttribute('data-role', 'result');

  const score = document.createElement('p');
  score.className = 'phrase-score';
  score.setAttribute('data-role', 'score');
  score.textContent = `${cmp.score}/100`;
  box.append(score);

  // Palabras resaltadas ok/off.
  const words = document.createElement('p');
  words.className = 'phrase-words';
  for (const mk of cmp.marks) {
    const span = document.createElement('span');
    span.className = `word ${mk.ok ? 'ok' : 'off'}`;
    span.textContent = mk.word;
    words.append(span, document.createTextNode(' '));
  }
  box.append(words);

  const heard = document.createElement('p');
  heard.className = 'phrase-heard muted';
  heard.textContent = `Escuché: ${transcript}`;
  box.append(heard);

  if (tutor && typeof tutor.coachPronunciation === 'function') {
    const coaching = document.createElement('p');
    coaching.className = 'phrase-coaching';
    coaching.setAttribute('data-role', 'coaching');
    coaching.textContent = 'Analizando tu pronunciación…';
    box.append(coaching);
    tutor.coachPronunciation(target, transcript)
      .then((t) => { coaching.textContent = (t ?? '').trim() || 'Sin consejo esta vez.'; })
      .catch(() => { coaching.textContent = 'No se pudo generar el consejo. Reintenta.'; });
  }

  return box;
}

function topicPicker(topics, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'topic-picker';
  wrap.setAttribute('data-role', 'topic-picker');

  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = 'Elige un tema para practicar cómo suenan sus frases. Tú las dices, la IA te da consejos.';
  wrap.append(intro);

  const list = document.createElement('ul');
  list.className = 'topic-list';
  for (const t of topics) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn topic-card';
    btn.setAttribute('data-action', 'pick-topic');
    btn.setAttribute('data-topic', t.id);
    const strong = document.createElement('strong');
    strong.textContent = t.title?.es ?? t.id;
    const sub = document.createElement('span');
    sub.className = 'muted';
    sub.textContent = t.title?.en ?? '';
    btn.append(strong, sub);
    btn.addEventListener('click', () => onPick?.(t.id));
    li.append(btn);
    list.append(li);
  }
  wrap.append(list);
  return wrap;
}

function offlineNotice({ online, recognitionOk }) {
  const note = document.createElement('div');
  note.className = 'pronounce-notice';
  note.setAttribute('data-role', 'offline-notice');
  note.setAttribute('role', 'note');
  const p = document.createElement('p');
  if (!recognitionOk) {
    p.textContent = 'Tu navegador no permite hablar (usa Chrome en Android). Puedes leer y escuchar las frases.';
  } else if (!online) {
    p.textContent = 'La práctica de pronunciación necesita conexión. Puedes leer y escuchar las frases mientras tanto.';
  } else {
    p.textContent = 'La práctica de pronunciación no está disponible ahora. Puedes leer y escuchar las frases.';
  }
  note.append(p);
  return note;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
