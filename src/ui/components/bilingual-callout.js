// Bilingual callout: English line (with an audio button) above its Spanish
// translation. Comprehensible input — the learner hears/reads EN, checks ES.
import { audioButton } from './audio-button.js';

/**
 * @param {{ en: string, es: string }} text
 * @param {{ voice?: string, kind?: string }} [opts]
 * @returns {HTMLElement}
 */
export function bilingualCallout(text, opts = {}) {
  const box = document.createElement('div');
  box.className = ['callout', opts.kind ? `callout-${opts.kind}` : ''].filter(Boolean).join(' ');
  box.setAttribute('data-role', 'callout');

  const en = document.createElement('p');
  en.className = 'callout-en';
  en.setAttribute('lang', 'en');
  const enText = document.createElement('span');
  enText.textContent = text.en;
  en.append(enText, audioButton(text.en, { voice: opts.voice }));

  const es = document.createElement('p');
  es.className = 'callout-es';
  es.setAttribute('lang', 'es');
  es.textContent = text.es;

  box.append(en, es);
  return box;
}
