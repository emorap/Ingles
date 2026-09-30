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

  // Honestidad de alcance (spec): es una guía por lo que la app logró escuchar,
  // NO un examen. Sin `muted` para que el aviso pese tanto como el resultado.
  const honest = document.createElement('p');
  honest.className = 'pronounce-honest';
  honest.textContent = 'Es una guía por lo que la app logró escuchar, no un examen de pronunciación.';
  section.append(honest);

  const canSpeak = online && recognitionOk;
  // Aviso cuando algo degrada: sin voz / sin red (bloquean grabar) o sin tutor
  // (se puede grabar y ver el score, pero sin coaching). Guía, no bloquea.
  if (!canSpeak || !tutor) section.append(offlineNotice({ online, recognitionOk, tutor }));

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
  en.lang = 'en'; // que el lector de pantalla use su voz inglesa en la frase modelo
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

  // Región viva: el resultado se anexa aquí para que un lector de pantalla lo
  // anuncie al aparecer (mismo patrón que el hilo de diálogo). Presente desde el
  // render; se vacía en cada reintento.
  const results = document.createElement('div');
  results.className = 'phrase-results';
  results.setAttribute('data-role', 'results');
  results.setAttribute('aria-live', 'polite');
  card.append(results);

  const setStatus = (m) => { status.textContent = m ?? ''; };

  mic.addEventListener('click', async () => {
    if (mic.disabled) return;
    mic.disabled = true;
    setStatus('Escuchando…');
    clear(results); // limpia un resultado previo (reintento)

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
    mic.disabled = false; // reactivar ANTES de construir el resultado (defensivo)
    results.append(resultBox(cmp, transcript, tutor, ex.en));
  });

  return card;
}

function resultBox(cmp, transcript, tutor, target) {
  const box = document.createElement('div');
  box.className = 'phrase-result';
  box.setAttribute('data-role', 'result');

  // Score HONESTO: cuántas palabras se reconocieron, NO una nota /100. El número
  // mide coincidencia con lo que el reconocedor entendió, no la calidad fonética
  // real; presentarlo como "N de M palabras" evita venderlo como un examen.
  const total = cmp.marks.length;
  const score = document.createElement('p');
  score.className = 'phrase-score';
  score.setAttribute('data-role', 'score');
  score.textContent = `Reconocí ${cmp.wordsOk.length} de ${total} ${total === 1 ? 'palabra' : 'palabras'}`;
  box.append(score);

  // Palabras resaltadas ok/off. El color se refuerza con subrayado (CSS) y, para
  // lectores de pantalla, con un marcador " (revisar)" en las que quedaron off
  // — nunca solo color (WCAG 1.4.1).
  const words = document.createElement('p');
  words.className = 'phrase-words';
  words.lang = 'en';
  for (const mk of cmp.marks) {
    const span = document.createElement('span');
    span.className = `word ${mk.ok ? 'ok' : 'off'}`;
    span.lang = 'en';
    span.append(document.createTextNode(mk.word));
    if (!mk.ok) {
      const tag = document.createElement('span');
      tag.className = 'visually-hidden';
      tag.lang = 'es';
      tag.textContent = ' (revisar)';
      span.append(tag);
    }
    words.append(span, document.createTextNode(' '));
  }
  box.append(words);

  const heard = document.createElement('p');
  heard.className = 'phrase-heard muted';
  heard.append(document.createTextNode('Escuché: '));
  const heardEn = document.createElement('span');
  heardEn.lang = 'en';
  heardEn.textContent = transcript;
  heard.append(heardEn);
  box.append(heard);

  if (tutor && typeof tutor.coachPronunciation === 'function') {
    const coaching = document.createElement('p');
    coaching.className = 'phrase-coaching';
    coaching.setAttribute('data-role', 'coaching');
    coaching.setAttribute('role', 'status'); // anuncia el cambio placeholder → consejo
    coaching.textContent = 'Buscando consejos para ti…';
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

function offlineNotice({ online, recognitionOk, tutor }) {
  const note = document.createElement('div');
  note.className = 'pronounce-notice';
  note.setAttribute('data-role', 'offline-notice');
  note.setAttribute('role', 'note');
  const p = document.createElement('p');
  if (!recognitionOk) {
    p.textContent = 'Tu navegador no permite hablar (usa Chrome en Android). Puedes leer y escuchar las frases.';
  } else if (!online) {
    p.textContent = 'La práctica de pronunciación necesita conexión. Puedes leer y escuchar las frases mientras tanto.';
  } else if (!tutor) {
    // Se puede grabar y ver qué palabras se entendieron sin clave; solo el
    // coaching de la IA necesita la clave de Gemini.
    p.textContent = 'Añade tu clave de Gemini en Ajustes para recibir consejos de la IA. Puedes grabar, escuchar y ver qué palabras se entendieron igual.';
  } else {
    p.textContent = 'La práctica de pronunciación no está disponible ahora. Puedes leer y escuchar las frases.';
  }
  note.append(p);
  return note;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
