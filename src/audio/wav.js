// Turn raw PCM (what Gemini TTS returns as base64) into a playable WAV blob.
// Gemini's TTS audio is 16-bit signed little-endian PCM at 24 kHz mono, with no
// container — browsers can't play it directly, so we prepend a 44-byte RIFF/WAVE
// header. Pure functions, no DOM: unit-testable and safe to reuse anywhere.

/**
 * Decode a base64 string to bytes. Works in both the browser and node:test
 * (both expose `atob`); avoids Buffer so it stays isomorphic.
 * @param {string} b64
 * @returns {Uint8Array}
 */
export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Wrap 16-bit PCM bytes in a WAV (RIFF) container.
 * @param {Uint8Array} pcm  raw little-endian 16-bit PCM samples
 * @param {{ sampleRate?: number, channels?: number }} [opts]
 * @returns {Uint8Array} the complete WAV file bytes
 */
export function pcm16ToWav(pcm, { sampleRate = 24000, channels = 1 } = {}) {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataLen = pcm.length;

  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const writeAscii = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true); // chunk size
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1 size (PCM)
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLen, true);
  bytes.set(pcm, 44);

  return bytes;
}
