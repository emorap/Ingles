// Text-to-speech via the Web Speech API. 100%-offline "realce": when the
// browser has no speechSynthesis (older/locked-down engines), everything
// degrades to a safe no-op and callers hide their audio buttons. No throws.

/** @returns {boolean} */
export function ttsAvailable() {
  return typeof globalThis.speechSynthesis !== 'undefined';
}

/** @returns {SpeechSynthesisVoice[]} */
export function listVoices() {
  return ttsAvailable() ? speechSynthesis.getVoices() : [];
}

/**
 * Speak `text`, cancelling any in-flight utterance first (no overlap).
 * @param {string} text
 * @param {{ voice?: string, rate?: number }} [opts]
 */
export function speak(text, opts = {}) {
  if (!ttsAvailable()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 0.95; // a touch slower — easier for learners
  const voice = listVoices().find((v) => v.name === opts.voice)
    ?? listVoices().find((v) => v.lang && v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
