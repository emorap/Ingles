// The voice router: one entry point the UI calls to "say this English text",
// which picks the best available source and always degrades gracefully.
//
//   1. cached clip        → play it (works OFFLINE, no quota)          source: 'cache'
//   2. online+key+ttsVoice→ Gemini natural voice, then cache it        source: 'gemini'
//   3. otherwise          → the browser's Web Speech voice (robotic)   source: 'browser'
// An empty ttsVoice means the learner chose "Voz del navegador", so step 2 is
// skipped and a stored key (used by the text tutor) never spends TTS quota.
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

  // 1. Cached clip — works offline, costs nothing. A rejected read (idb
  //    transaction/connection failure) must NOT throw to the UI: swallow it and
  //    fall through, so the audio layer stays a realce, never a dependency.
  if (store) {
    try {
      const hit = await store.getAudio(cacheKey);
      if (hit?.blob) { await play(hit.blob); return { source: 'cache' }; }
    } catch {
      // unreadable cache → try the online/browser path instead
    }
  }

  // 2. Natural voice via Gemini — only when the learner has PICKED one (empty
  //    ttsVoice = the browser voice, so having a key for the text tutor never
  //    silently spends TTS quota). Play first, then cache best-effort: a full
  //    IndexedDB must never discard the clip we already fetched and paid for.
  if (online && key && ttsVoice) {
    try {
      const clip = await ttsFn(key, text, { voice: ttsVoice });
      await play(clip.blob);
      if (store) {
        try { await store.putAudio(cacheKey, { blob: clip.blob, mime: clip.mime }); }
        catch { /* cache full/unavailable: it already played, just skip caching */ }
      }
      return { source: 'gemini' };
    } catch {
      // network/quota/parse failure → browser voice
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
