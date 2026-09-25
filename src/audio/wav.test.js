import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, pcm16ToWav } from './wav.js';

const ascii = (bytes, start, len) =>
  String.fromCharCode(...bytes.slice(start, start + len));
const u32le = (bytes, off) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(off, true);
const u16le = (bytes, off) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(off, true);

test('base64ToBytes decodes a known vector', () => {
  // btoa(String.fromCharCode(1,2,3)) === 'AQID'
  assert.deepEqual([...base64ToBytes('AQID')], [1, 2, 3]);
});

test('base64ToBytes handles padding', () => {
  // btoa(String.fromCharCode(0,0,1)) === 'AAAB'
  assert.deepEqual([...base64ToBytes('AAAB')], [0, 0, 1]);
  // btoa('M') === 'TQ==' (single byte with padding)
  assert.deepEqual([...base64ToBytes('TQ==')], [77]);
});

test('pcm16ToWav wraps PCM in a well-formed 44-byte RIFF header', () => {
  const pcm = new Uint8Array([1, 2, 3, 4]); // 2 samples, 16-bit mono
  const wav = pcm16ToWav(pcm, { sampleRate: 24000, channels: 1 });

  assert.equal(wav.length, 44 + 4, 'header + data length');
  assert.equal(ascii(wav, 0, 4), 'RIFF');
  assert.equal(u32le(wav, 4), 36 + 4, 'RIFF chunk size = 36 + dataLen');
  assert.equal(ascii(wav, 8, 4), 'WAVE');
  assert.equal(ascii(wav, 12, 4), 'fmt ');
  assert.equal(u32le(wav, 16), 16, 'fmt subchunk size');
  assert.equal(u16le(wav, 20), 1, 'audioFormat = PCM');
  assert.equal(u16le(wav, 22), 1, 'numChannels');
  assert.equal(u32le(wav, 24), 24000, 'sampleRate');
  assert.equal(u32le(wav, 28), 48000, 'byteRate = rate*channels*2');
  assert.equal(u16le(wav, 32), 2, 'blockAlign = channels*2');
  assert.equal(u16le(wav, 34), 16, 'bitsPerSample');
  assert.equal(ascii(wav, 36, 4), 'data');
  assert.equal(u32le(wav, 40), 4, 'data length');
  assert.deepEqual([...wav.slice(44)], [1, 2, 3, 4], 'PCM copied after header');
});

test('pcm16ToWav defaults to 24kHz mono', () => {
  const wav = pcm16ToWav(new Uint8Array([0, 0]));
  assert.equal(u32le(wav, 24), 24000);
  assert.equal(u16le(wav, 22), 1);
});
