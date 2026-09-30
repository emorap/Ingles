// Comparación pura y offline entre una frase objetivo en inglés y lo que el
// reconocedor entendió. Devuelve una señal ORIENTATIVA (no un puntaje fonético
// certificado): qué palabras del objetivo se reconocieron, cuáles probablemente
// se pronunciaron mal/se perdieron, y un score 0–100 = palabras ok / total.
// Usa una alineación por subsecuencia común más larga (LCS) para que una sola
// palabra saltada o de más no vuelva "off" a todas las siguientes.

/**
 * Normaliza una frase a una cadena comparable: minúsculas, sin marcas de acento,
 * contracciones unidas (don't → dont) y sin puntuación. El llamador la parte en
 * palabras. Unir contracciones evita que "don't" y "dont" del reconocedor
 * cuenten como palabras distintas.
 * @param {string} phrase
 * @returns {string}
 */
export function normalizeWords(phrase) {
  return (phrase ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')       // quita marcas de acento combinadas (café → cafe)
    .replace(/['’]/g, '')    // une contracciones (don't → dont)
    .replace(/[^a-z0-9\s]/g, ' ') // el resto de puntuación → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

/** Índices del objetivo (en orden) que aparecen como subsecuencia en `heard`. */
function alignedTargetIndices(target, heard) {
  const n = target.length;
  const m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      dp[i][j] = target[i - 1] === heard[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const idx = new Set();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (target[i - 1] === heard[j - 1]) { idx.add(i - 1); i -= 1; j -= 1; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i -= 1;
    else j -= 1;
  }
  return idx;
}

/**
 * @param {string} target la frase que el estudiante intentó decir (inglés)
 * @param {string} heard  la transcripción del reconocedor
 * @returns {{ score: number, wordsOk: string[], wordsOff: string[], marks: { word: string, ok: boolean }[] }}
 */
export function comparePronunciation(target, heard) {
  const t = normalizeWords(target).split(' ').filter(Boolean);
  const h = normalizeWords(heard).split(' ').filter(Boolean);
  // Palabras con caso/puntuación original para mostrarlas, alineadas 1:1 con `t`.
  // Una palabra separada por espacios puede normalizar a DOS tokens (guiones:
  // "long-term" → long, term) o a CERO (puntuación suelta: un "—"), así que
  // re-derivamos `orig` con la MISMA normalización: 1 token → conserva la
  // palabra original (con su caso/puntuación); ≠1 → emite los tokens. Sin esto
  // los chips se corren y un "—" se mostraría como palabra bien pronunciada.
  const orig = (target ?? '').trim().split(/\s+/).filter(Boolean)
    .flatMap((raw) => {
      const parts = normalizeWords(raw).split(' ').filter(Boolean);
      return parts.length === 1 ? [raw] : parts;
    });
  if (!t.length) return { score: 0, wordsOk: [], wordsOff: [], marks: [] };
  const ok = alignedTargetIndices(t, h);
  const marks = t.map((w, i) => ({ word: orig[i] ?? w, ok: ok.has(i) }));
  const wordsOk = marks.filter((mk) => mk.ok).map((mk) => mk.word);
  const wordsOff = marks.filter((mk) => !mk.ok).map((mk) => mk.word);
  const score = Math.round((wordsOk.length / t.length) * 100);
  return { score, wordsOk, wordsOff, marks };
}
