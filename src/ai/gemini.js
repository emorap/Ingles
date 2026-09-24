// Gemini adapter for the AI tutor contract. Uses the learner's OWN API key
// (stored locally). Every call is time-boxed with AbortController and wrapped
// so failures surface as a typed AiError with a Spanish message the UI can
// show. generateItems runs the model's JSON through validateItem and drops
// anything malformed — the model is never trusted to produce valid items.
import { validateItem } from '../engine/schema.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const DEFAULT_TIMEOUT = 20000;

export class AiError extends Error {
  /** @param {string} message @param {unknown} [cause] */
  constructor(message, cause) {
    super(message);
    this.name = 'AiError';
    this.cause = cause;
  }
}

/**
 * @param {string} key the user's Gemini API key
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {import('./provider.js').AITutorProvider}
 */
export function createGeminiTutor(key, opts = {}) {
  const ask = (prompt) => callGemini(key, prompt, opts);
  return {
    explain: (topic, itemContext) => ask(explainPrompt(topic, itemContext)),
    whyWrong: (item, given) => ask(whyWrongPrompt(item, given)),
    chat: (history) => ask(chatPrompt(history)),
    async generateItems(topic, n) {
      const text = await ask(generatePrompt(topic, n));
      return parseItems(text);
    },
  };
}

/**
 * Low-level single-turn call. Rejects with AiError on HTTP error, timeout, or
 * network failure.
 * @param {string} key
 * @param {string} prompt
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function callGemini(key, prompt, { timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await globalThis.fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiError(`Gemini respondió ${res.status}. Revisa tu clave o inténtalo más tarde.`);
    const data = await res.json();
    return extractText(data);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err && err.name === 'AbortError') throw new AiError('La IA tardó demasiado en responder.', err);
    throw new AiError('No se pudo contactar la IA. ¿Estás conectado?', err);
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => p?.text ?? '').join('');
}

/** Pull a JSON array out of the model's reply, tolerating code fences / prose. */
function parseItems(text) {
  if (!text) return [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];
  let arr;
  try { arr = JSON.parse(body.slice(start, end + 1)); } catch { return []; }
  return Array.isArray(arr) ? arr.filter(validateItem) : [];
}

// --- Prompts -------------------------------------------------------------
// The learner is a Spanish speaker at A2 level. Explanations are in Spanish;
// examples and target language stay in English.

const LEARNER = 'El estudiante habla español y está aprendiendo inglés (nivel A2). Explica en español claro y breve; los ejemplos van en inglés.';

function explainPrompt(topic, itemContext) {
  const title = topic?.title?.en ?? topic?.id ?? 'este tema';
  return `${LEARNER}\nExplica "${title}" con 2-3 ejemplos en inglés y su traducción. ${itemContext ? `Contexto: ${JSON.stringify(itemContext)}.` : ''}`;
}

function whyWrongPrompt(item, given) {
  return `${LEARNER}\nEn el ejercicio "${item?.prompt?.en ?? ''}" la respuesta correcta es "${item?.answer ?? ''}" pero el estudiante escribió "${given}". Explica en español por qué su respuesta no es correcta y da la regla en una frase.`;
}

function chatPrompt(history) {
  const convo = (history ?? []).map((m) => `${m.role === 'user' ? 'Estudiante' : 'Tutor'}: ${m.text}`).join('\n');
  return `${LEARNER}\nEres un tutor de inglés paciente. Continúa la conversación.\n${convo}\nTutor:`;
}

function generatePrompt(topic, n) {
  const title = topic?.title?.en ?? topic?.id ?? 'the topic';
  return `${LEARNER}\nGenera ${n} ejercicios de práctica de inglés sobre "${title}".
Devuelve SOLO un array JSON, sin texto alrededor. Cada objeto debe tener exactamente:
{"id": string único, "topic": "${topic?.id ?? ''}", "type": "cloze" | "choice", "prompt": {"en": string, "es": string}, "answer": string, "accept": [string] (para cloze), "distractors": [string] (para choice), "why": {"en": string, "es": string}}.
La respuesta correcta debe estar incluida en "accept". No añadas comentarios.`;
}
