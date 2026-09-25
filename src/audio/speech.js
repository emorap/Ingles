// Foundation B — speech recognition wrapper. Turns ONE spoken utterance into
// text using the browser's SpeechRecognition (Chrome: window.SpeechRecognition
// || window.webkitSpeechRecognition). Chrome streams the audio to Google's
// servers, so this is an ONLINE realce — it needs internet, just like the AI
// tutor, and the offline core never depends on it. Every failure rejects with a
// typed SpeechError carrying a Spanish message and a `reason` the UI branches
// on — never a raw throw to the UI. The recognizer constructor is injectable so
// the decision logic is testable without a microphone.

export class SpeechError extends Error {
  /**
   * @param {'not-supported'|'denied'|'no-speech'|'network'|'timeout'|'aborted'|'unknown'} reason
   * @param {string} message @param {unknown} [cause]
   */
  constructor(reason, message, cause) {
    super(message);
    this.name = 'SpeechError';
    this.reason = reason;
    this.cause = cause;
  }
}

const MESSAGES = {
  'not-supported': 'Tu navegador no reconoce voz. Prueba con Chrome en Android.',
  denied: 'No diste permiso al micrófono. Actívalo para poder hablar.',
  'no-speech': 'No te oí. Toca el micrófono e inténtalo de nuevo.',
  network: 'El reconocimiento de voz necesita conexión.',
  timeout: 'Se acabó el tiempo. Toca el micrófono para reintentar.',
  aborted: 'Reconocimiento cancelado.',
  unknown: 'No se pudo reconocer la voz. Inténtalo de nuevo.',
};

/**
 * @param {any} [w] object to probe (defaults to globalThis); injectable for tests.
 * @returns {boolean}
 */
export function recognitionAvailable(w = globalThis) {
  return typeof (w?.SpeechRecognition || w?.webkitSpeechRecognition) === 'function';
}

/**
 * Listen once and resolve with the recognized text.
 * @param {{ lang?: string, timeoutMs?: number, Recognizer?: any }} [opts]
 * @returns {Promise<{ transcript: string, confidence: number }>}
 */
export function recognizeOnce({ lang = 'en-US', timeoutMs = 10000, Recognizer } = {}) {
  const Ctor = Recognizer || globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (typeof Ctor !== 'function') {
    return Promise.reject(new SpeechError('not-supported', MESSAGES['not-supported']));
  }
  return new Promise((resolve, reject) => {
    let done = false;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    // First outcome wins; later events (e.g. onend after onresult) are ignored.
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.abort?.(); } catch { /* ignore */ }
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new SpeechError('timeout', MESSAGES.timeout))),
      timeoutMs,
    );

    rec.onresult = (e) => {
      const alt = e?.results?.[0]?.[0];
      finish(() => resolve({
        transcript: (alt?.transcript ?? '').trim(),
        confidence: typeof alt?.confidence === 'number' ? alt.confidence : 0,
      }));
    };
    rec.onerror = (e) => {
      const reason = mapError(e?.error);
      finish(() => reject(new SpeechError(reason, MESSAGES[reason] ?? MESSAGES.unknown, e)));
    };
    rec.onend = () => finish(() => reject(new SpeechError('no-speech', MESSAGES['no-speech'])));

    try { rec.start(); } catch (err) {
      finish(() => reject(new SpeechError('unknown', MESSAGES.unknown, err)));
    }
  });
}

/** Map a SpeechRecognition error code to our reason vocabulary. */
function mapError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed': return 'denied';
    case 'no-speech': return 'no-speech';
    case 'network': return 'network';
    case 'aborted': return 'aborted';
    default: return 'unknown';
  }
}
