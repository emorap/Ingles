// Gemini text-to-speech adapter. Uses the learner's OWN Gemini key to turn a
// short English string into natural speech, returned as a playable WAV blob.
// The model streams raw 16-bit PCM (base64) with the sample rate in the mime
// type; we wrap it in a WAV container (wav.js) so the browser can play it.
// Every failure surfaces as the same AiError the text tutor uses, so the voice
// router can catch it and fall back to the browser voice. This is an ONLINE
// realce — never a dependency.
import { base64ToBytes, pcm16ToWav } from './wav.js';
import { AiError } from '../ai/gemini.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
const DEFAULT_TIMEOUT = 20000;

// A curated subset of Gemini's prebuilt voices (there are ~30). These read well
// for English learners; the settings picker offers them by name.
export const TTS_VOICES = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Orus'];

/**
 * Synthesize `text` to a WAV blob with the given prebuilt voice.
 * @param {string} key the learner's Gemini API key
 * @param {string} text English text to speak
 * @param {{ voice?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<{ blob: Blob, mime: string }>}
 */
export async function geminiTTS(key, text, { voice = 'Kore', timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await globalThis.fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiError(`La voz de la IA respondió ${res.status}. Revisa tu clave o inténtalo más tarde.`);
    const data = await res.json();
    const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData)?.inlineData;
    if (!inline?.data) throw new AiError('La IA no devolvió audio.');
    const rate = rateFromMime(inline.mimeType);
    const wav = pcm16ToWav(base64ToBytes(inline.data), { sampleRate: rate, channels: 1 });
    return { blob: new Blob([wav], { type: 'audio/wav' }), mime: 'audio/wav' };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err && err.name === 'AbortError') throw new AiError('La voz de la IA tardó demasiado.', err);
    throw new AiError('No se pudo generar la voz. ¿Estás conectado?', err);
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the sample rate out of a mime type like "audio/L16;codec=pcm;rate=24000". */
function rateFromMime(mime) {
  const m = /rate=(\d+)/.exec(mime ?? '');
  return m ? Number(m[1]) : 24000;
}
