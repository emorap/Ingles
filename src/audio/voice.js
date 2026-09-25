// The voice router: one entry point the UI calls to "say this English text",
// which picks the best available source and always degrades gracefully.
//
//   1. cached clip   → play it (works OFFLINE, no quota)          source: 'cache'
//   2. online + key  → Gemini natural voice, then cache it         source: 'gemini'
//   3. otherwise     → the browser's Web Speech voice (robotic)    source: 'browser'
//
// A network/quota failure in step 2 falls through to step 3. speakSmart never
// throws: the audio layer is a realce, never a dependency. Dependencies
// (play/speakFn/ttsFn/online) are injectable so the decision logic is testable
// without a real AudioContext, SpeechSynthesis, or network.
import { speak } from './tts.js';
import { geminiTTS } from './gemini-tts.js';
import { isOnline } from '../ai/tutor.js';

/**
 * @param {string} text English text to speak
 * @param {{
 *   ttsVoice?: string, browserVoice?: string, key?: string, online?: boolean,
 *   store?: { getAudio: (k: string) => Promise<any>, putAudio: (k: string, c: any) => Promise<void> },
 *   play?: (blob: any) => Promise<void> | void,
 *   speakFn?: (text: string, opts?: any) => void,
 *   ttsFn?: (key: string, text: string, opts?: any) => Promise<{ blob: any, mime: string }>,
 * }} [opts]
 * @returns {Promise<{ source: 'cache' | 'gemini' | 'browser' }>}
 */
export async function speakSmart(text, opts = {}) {
  const {
    ttsVoice = '', browserVoice, key = '', online = isOnline(), store,
    play = playBlob, speakFn = speak, ttsFn = geminiTTS,
  } = opts;

  const cacheKey = `${ttsVoice}::${text}`;

  // 1. Cached clip — works offline, costs nothing.
  if (store) {
    const hit = await store.getAudio(cacheKey);
    if (hit?.blob) { await play(hit.blob); return { source: 'cache' }; }
  }

  // 2. Natural voice via Gemini, cached for next time.
  if (online && key) {
    try {
      const clip = await ttsFn(key, text, { voice: ttsVoice || undefined });
      if (store) await store.putAudio(cacheKey, { blob: clip.blob, mime: clip.mime });
      await play(clip.blob);
      return { source: 'gemini' };
    } catch {
      // fall through to the browser voice
    }
  }

  // 3. Browser voice — always available on this device, robotic but offline.
  speakFn(text, { voice: browserVoice });
  return { source: 'browser' };
}

/**
 * Play an audio blob via an <audio> element, cleaning up the object URL.
 * No-op when the platform lacks Audio/URL (e.g. node:test) — guarded like tts.js.
 * @param {Blob} blob
 */
function playBlob(blob) {
  if (typeof globalThis.Audio === 'undefined' || typeof globalThis.URL?.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
  audio.play?.().catch(() => URL.revokeObjectURL(url));
}
