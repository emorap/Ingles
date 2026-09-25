// Audio button (🔊): speaks `text`. Prefers an injected `speak` (the app's
// speakSmart router: cached → natural → browser voice); otherwise falls back to
// the classic browser voice. Only when NEITHER path can speak — no injected
// speak AND no browser TTS — is the button hidden and disabled, so the
// surrounding content stays fully usable offline.
import { speak, ttsAvailable } from '../../audio/tts.js';

/**
 * @param {string} text text to speak (English)
 * @param {{ voice?: string, label?: string, speak?: (text: string) => void }} [opts]
 * @returns {HTMLButtonElement}
 */
export function audioButton(text, opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'audio-btn';
  btn.setAttribute('data-role', 'audio');
  btn.setAttribute('aria-label', opts.label ?? 'Escuchar en inglés');
  btn.textContent = '🔊';

  const speakFn = opts.speak;
  if (!speakFn && !ttsAvailable()) {
    btn.setAttribute('hidden', '');
    btn.setAttribute('disabled', '');
    return btn;
  }
  btn.addEventListener('click', () => (speakFn ? speakFn(text) : speak(text, { voice: opts.voice })));
  return btn;
}
