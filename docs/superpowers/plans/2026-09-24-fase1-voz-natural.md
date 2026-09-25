# Fase 1 — Voz natural (cimiento de audio) · Plan de implementación

> **Ejecución:** inline en esta sesión (Edgar dijo "Implementa!"), TDD por tarea,
> revisión final del branch y publicación. Edgar revisa el resultado en vivo.

**Goal:** que el botón de audio suene con voz natural (Gemini TTS) online, guarde el
audio para repetirlo offline, y degrade a la voz del navegador como respaldo — sin romper
nada offline.

**Architecture:** un router `speakSmart` decide cache → Gemini → navegador. `gemini-tts.js`
llama al modelo TTS y envuelve el PCM en WAV (`wav.js`). El audio se cachea en un object
store `audio` nuevo de IndexedDB. La UI se re-cablea vía una función `speak` inyectada
desde `app.js`. Spec: `docs/superpowers/specs/2026-09-24-speaking-features-design.md`.

**Tech stack:** vanilla ESM + JSDoc, `node:test`, `idb`, fetch, Web Audio/`Audio`.

## Global Constraints
- NO innerHTML (DOM puro). Offline-first: todo realce degrada, nunca throw a la UI.
- NO renombrar ids SRS. Tests bajo `src/**/*.test.js`. Suite completa verde al terminar.
- No puedo verificar el TTS en vivo (no tengo la llave de Edgar ni navegador) → el código
  degrada con gracia si la respuesta difiere; Edgar valida la voz real en la app.
- Publicar = push a main. Commits con `Co-Authored-By: Claude Opus 4.8 (1M context)`.

## Review Focus (entradas que ninguna prueba de tarea ejercita pero pueden morder)
- Respuesta TTS sin `inlineData` (modelo devuelve error/otro formato) → debe caer a
  navegador, no romper. (Task 2/4)
- `key` presente pero inválida (HTTP 400) → AiError capturado → navegador. (Task 4)
- Offline con cache vacío y sin speechSynthesis → botón oculto, resto usable. (Task 5)
- DB vieja (VERSION 2) de un usuario que vuelve → upgrade a 3 sin perder progreso. (Task 3)
- base64 con padding/longitud impar → decode robusto, sin corromper el WAV. (Task 1)

---

### Task 1: Codificador WAV (`src/audio/wav.js`) — puro
**Files:** Create `src/audio/wav.js`, `src/audio/wav.test.js`.
**Produces:** `base64ToBytes(b64): Uint8Array`, `pcm16ToWav(pcm: Uint8Array, {sampleRate?, channels?}): Uint8Array`.
- Test: base64 conocido → bytes correctos; WAV empieza en `RIFF`/`WAVE`, tiene `fmt `+`data`,
  longitud = 44 + pcm.length, sampleRate LE en offset 24, byte rate/block align correctos.
- Implementación: DataView, cabecera RIFF de 44 bytes, PCM copiado tras la cabecera.

### Task 2: Adaptador Gemini TTS (`src/audio/gemini-tts.js`)
**Files:** Create `src/audio/gemini-tts.js`, `src/audio/gemini-tts.test.js`.
**Consumes:** `pcm16ToWav`, `base64ToBytes` (Task 1); `AiError` (de `../ai/gemini.js`).
**Produces:** `TTS_VOICES: string[]`; `geminiTTS(key, text, {voice?, timeoutMs?}): Promise<{blob: Blob, mime: string}>`.
- Endpoint `gemini-2.5-flash-preview-tts:generateContent`; body con
  `generationConfig.responseModalities:["AUDIO"]` + `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
- Extrae `candidates[0].content.parts[].inlineData{data,mimeType}`; base64→PCM→WAV→Blob(`audio/wav`).
- `AbortController`+timeout; HTTP no-ok / abort / sin inlineData → `AiError` (mensaje ES).
- Test (fetch mock): inlineData conocido → Blob wav de tamaño esperado; 400 → AiError;
  abort → AiError; parts sin inlineData → AiError.

### Task 3: Cache de audio en IndexedDB (`src/engine/db.js`)
**Files:** Modify `src/engine/db.js` (VERSION 2→3, store `audio`, métodos), `src/engine/db.test.js` (o audio-cache.test.js).
**Produces:** `Store.getAudio(key): Promise<{blob,mime}|undefined>`, `Store.putAudio(key, {blob,mime}): Promise<void>`.
- `upgrade`: `if (!contains('audio')) createObjectStore('audio')` (idempotente; no toca progress).
- `exportAll` NO incluye `audio` (regenerable + pesado) — verificar en test.
- Test (idb-env): put→get round-trip; key ausente → undefined; export no trae audio;
  abrir una DB v2 preexistente y luego v3 conserva progress.

### Task 4: Router de voz (`src/audio/voice.js`)
**Files:** Create `src/audio/voice.js`, `src/audio/voice.test.js`.
**Consumes:** `geminiTTS` (T2), `Store.getAudio/putAudio` (T3), `speak` (`./tts.js`), `isOnline` (`../ai/tutor.js`).
**Produces:** `speakSmart(text, {ttsVoice?, browserVoice?, key?, online?, store?, play?, speakFn?, ttsFn?}): Promise<{source:'cache'|'gemini'|'browser'}>`.
- Orden: cacheKey=`${ttsVoice||''}::${text}`; cache hit→play(blob),'cache'; online&&key→ttsFn→putAudio→play,'gemini'; si no / si falla→speakFn(text,{voice:browserVoice}),'browser'.
- `play` default `playBlob` (guardado: no-op sin `Audio`/`URL`). Deps inyectables para test.
- Test: cache hit no llama red ni gemini; online+key+miss llama gemini y putAudio; offline→browser; gemini throw→browser; siempre resuelve (nunca throw).

### Task 5: Cablear UI (`audio-button.js`, `app.js`, `topic.js`, `bilingual-callout.js`, `settings.js`)
**Files:** Modify los 5 + tocar sus tests.
- `audio-button.js`: `audioButton(text, {voice?, speak?})` — usa `opts.speak` si viene; si no,
  el `speak` clásico. Oculto solo si `!ttsAvailable() && !opts.speak`.
- `app.js`: cargar `aiKey`+`ttsVoice` en mountApp (como `voice`); mantenerlos en `onChanged`;
  crear `deps.speak = (text) => speakSmart(text, {ttsVoice, browserVoice: voice, key: aiKey, online: isOnline(), store})`;
  pasar `deps.speak` a topic/practice; en settings pasar `ttsVoice` + `TTS_VOICES`.
- `topic.js`/`bilingual-callout.js`: aceptar y reenviar `speak` a `audioButton`.
- `settings.js`: selector "Voz natural (IA)" → meta `ttsVoice` con `TTS_VOICES`.
- Test: `audio-button` llama `opts.speak(text)` cuando viene; sigue ocultándose sin nada.

### Task 6: Offline + publicación
- `sw.js`: bump `v5→v6` (nuevos módulos JS entran al grafo cacheado on-demand; el bump
  purga caché viejo en activate).
- Suite completa verde; `validate_content` ok; rebuild `momentum.html`; push a main.
- Reporte a Edgar: qué probar en vivo (voz natural, repetir offline, cambiar voz en ajustes).
