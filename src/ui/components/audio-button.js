// Audio button (🔊): speaks `text` via TTS. When TTS is unavailable it is
// hidden AND disabled — the surrounding content stays fully usable offline.
import { speak, ttsAvailable } from '../../audio/tts.js';

/**
 * @param {string} text text to speak (English)
 * @param {{ voice?: string, label?: string }} [opts]
 * @returns {HTMLButtonElement}
 */
export function audioButton(text, opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'audio-btn';
  btn.setAttribute('data-role', 'audio');
  btn.setAttribute('aria-label', opts.label ?? 'Escuchar en inglés');
  btn.textContent = '🔊';

  if (!ttsAvailable()) {
    btn.setAttribute('hidden', '');
    btn.setAttribute('disabled', '');
    return btn;
  }
  btn.addEventListener('click', () => speak(text, { voice: opts.voice }));
  return btn;
}
