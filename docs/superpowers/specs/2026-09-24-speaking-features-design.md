# Momentum — Funciones de voz y speaking · Diseño (spec)

**Fecha:** 2026-09-24
**Autor:** Edgar Mora + Claude
**Estado:** en revisión de Edgar (antes de escribir el plan de implementación)

## Intención (en palabras de Edgar)

> "el audio se escucha muy feo... que otras funcionalidades podemos agregarle, por
> ejemplo temas de un dialogo bidireccional yo hablo la ia me responde".

Edgar (colombiano, hispanohablante, **A2**) estudia inglés en Momentum. Hoy el audio
usa la voz robótica del navegador y no hay práctica oral. Este proyecto añade **cuatro
funciones de voz** para que Momentum deje de ser solo lectura+escritura y pase a
**escuchar y hablar** — sin romper su naturaleza *offline-first*.

**Éxito =** Edgar (1) oye una voz natural, (2) puede sostener un diálogo hablado con la
IA, (3) recibe coaching de pronunciación útil, y (4) practica escucha con una racha que
lo engancha — todo en su Android/Chrome, degradando con dignidad cuando falta internet.

**Decisiones ya tomadas por Edgar (2026-09-24):**
- **Voz offline = híbrido + cache.** Con internet → voz natural (Gemini TTS). Sin
  internet → voz del navegador (respaldo). Además se **guarda cada audio generado** para
  repetirlo offline sin gastar cuota.
- **Dispositivo = Android + Chrome** → `SpeechRecognition` completo; sin restricciones de
  plataforma para diálogo y pronunciación.
- **Feature 3 (pronunciación) = coaching cualitativo**, no puntaje fonético certificado
  (eso exigiría un servicio externo y salir de offline-first). Encaja con "Guiar, no
  bloquear".

## Restricciones globales (heredadas del repo — valen para todas las tareas)

- **NO-BUILD:** vanilla JS ESM + JSDoc. Tests con `node:test`/`node:assert/strict` bajo
  `src/**/*.test.js`. Comando: `node --test --test-timeout=8000 "src/**/*.test.js"`.
- **NO innerHTML** — construcción DOM pura (hay un hook que bloquea innerHTML). Vistas
  puras `render(el, props)`; inyección de dependencias; la raíz de composición es
  `src/ui/app.js` (`mountApp` + `renderRoute`).
- **Offline-first:** el núcleo funciona 100% sin conexión. Toda pieza de red (IA, voz
  natural, reconocimiento) es un **realce** que degrada sin romper nada. Nunca un throw
  sin captura; nunca un dead-end (redirigir, no bloquear).
- **NO renombrar/borrar ids de ítems SRS** existentes.
- **Publicar = merge a `main` + `git push origin main`** (GitHub Pages sirve estático; no
  hay Actions ni build). Single-file offline: `scripts/build_singlefile.py` → `momentum.html`.
- **sw cache:** subir la versión (`momentum-vN`) en cada cambio de shell/JS que deba
  re-precachearse; añadir archivos nuevos al `SHELL` si deben existir offline desde la
  primera visita.
- **Atribución de commits:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Arquitectura general

Cuatro funciones sobre **dos cimientos compartidos**. Se construye por **fases,
publicables una a una** (nada a medias), empezando por la queja concreta de Edgar.

```
                    ┌─────────────────────────────────────────┐
   CIMIENTOS        │  voice.js (router de voz)  speech.js     │
   (Fase 1 + 2)     │  gemini-tts.js  audio-store (IndexedDB)  │
                    └───────────────┬──────────────┬───────────┘
                        reutiliza    │              │  reutiliza
   FUNCIONES     ┌──────────────────▼──┐   ┌────────▼───────────────┐
                 │ F1 Voz natural       │   │ F2 Diálogo por voz     │
                 │ (Fase 1)             │   │ (Fase 2)               │
                 └──────────────────────┘   └────────────────────────┘
                 ┌──────────────────────┐   ┌────────────────────────┐
                 │ F3 Pronunciación     │   │ F4 Escuchar+Constancia │
                 │ (Fase 3)             │   │ (Fase 4)               │
                 └──────────────────────┘   └────────────────────────┘
```

**Reutilización (ya existe en el repo):**
- `tutor.chat(history)` en `src/ai/gemini.js` / contrato `src/ai/provider.js` — ya
  implementado, **solo falta exponerlo en la UI** (F2).
- `recordStudyDay(store, now)` en `src/engine/streak.js` — ya lleva la racha diaria (F4
  la reutiliza; no se reinventa).
- `audioButton(text, {voice})` en `src/ui/components/audio-button.js` — se re-cablea al
  router de voz nuevo (F1).
- Patrón de vistas: función pura `render(el, props)` + un `case` en el `switch` de
  `renderRoute` + un link en `buildNav` (F2, F4).
- `getTutor(store)` → provider o `null` (exige online + `aiKey`). `isOnline()`.

**Orden de fases:**
1. **F1 Voz natural** (+ cimiento audio). La queja de hoy; base de todo lo demás.
2. **F2 Diálogo por voz** (+ cimiento reconocimiento).
3. **F3 Pronunciación** (reutiliza reconocimiento).
4. **F4 Escuchar + Constancia** (mayormente local).

---

## Cimiento A — Motor de voz (router híbrido + cache)

**Archivos nuevos:** `src/audio/voice.js`, `src/audio/gemini-tts.js`; ampliar
`src/engine/db.js` con un object store `audio`.

**Contrato del router** (`voice.js`):
```
speakSmart(text, { voice, key, online }) : Promise<{ source: 'cache'|'gemini'|'browser' }>
```
Decisión en orden:
1. **Cache hit** → reproduce el blob guardado (funciona **offline**). `source:'cache'`.
2. **Online + hay key** → `geminiTTS(key, text, {voice})` → reproduce **y guarda** el
   blob. `source:'gemini'`.
3. **Si no** → `speak(text, {voice})` del Web Speech actual (robótica). `source:'browser'`.
4. Cualquier fallo de red en (2) → cae a (3). Nunca throw hacia la UI.

**`gemini-tts.js`** — adaptador nuevo (el `callGemini` actual solo lee texto):
- Modelo `gemini-2.5-flash-preview-tts`, endpoint `generateContent` con
  `generationConfig.responseModalities:["AUDIO"]` + `speechConfig` (voz p.ej. "Kore").
- La respuesta trae audio en `candidates[0].content.parts[0].inlineData` (base64, PCM
  16-bit 24kHz). Hay que envolver en cabecera **WAV** para reproducir con `Audio`/Web
  Audio. → **la primera tarea del plan es un spike** que confirme la forma exacta contra
  la API en vivo antes de codificar (la API es *preview*).
- Reusa el patrón de `callGemini`: `AbortController` + `AiError` con mensaje en español.

**Cache de audio** (`db.js` + helpers en `voice.js`):
- Object store `audio`, clave `` `${voice}::${text}` `` (el texto de ejemplo es corto y
  estable), valor `{ blob, mime, createdAt }`.
- Persistente (IndexedDB) → sobrevive recargas y funciona offline. Sin límite duro por
  ahora; F1 incluye un tope simple (LRU o cap por nº de entradas) si hiciera falta —
  decisión de tamaño diferida hasta medir.

**Errores / degradación:** sin `speechSynthesis` **y** sin cache **y** offline → el botón
de audio se oculta (como hoy). Toast discreto "voz básica sin conexión" solo si aplica.

**Pruebas** (`voice.test.js`, `gemini-tts.test.js`): `fetch` y `AudioContext`/`Audio`
mockeados (patrón de `src/test-utils/`). Casos: cache hit no llama red; online sin cache
llama Gemini y guarda; offline sin cache cae a browser; fallo de red cae a browser; WAV
bien formado desde base64 conocido.

---

## Cimiento B — Reconocimiento de voz

**Archivo nuevo:** `src/audio/speech.js`.
```
recognitionAvailable() : boolean
recognizeOnce({ lang='en-US', timeoutMs }) : Promise<{ transcript, confidence }>
```
- Envuelve `window.SpeechRecognition || window.webkitSpeechRecognition` (Chrome).
- **Nota importante:** el reconocimiento de Chrome envía audio a un servidor de Google →
  **requiere internet** (igual que la IA). Es un realce online; el núcleo sigue offline.
- Maneja: no soportado, permiso denegado, silencio/no-speech, error de red, timeout —
  cada uno con mensaje claro en español; nunca throw crudo a la UI.

**Pruebas** (`speech.test.js`): `SpeechRecognition` mockeado; resuelve con transcript;
rechaza tipado en permiso-denegado / no-speech / no-soportado.

---

## Fase 1 — 🔊 Voz natural

**Objetivo:** que el `audioButton` suene natural online, se cachee para offline y
degrade a la voz básica solo como último recurso.

**Cambios:**
- `audio-button.js` → usa `speakSmart` (recibe `key`/`online` vía deps o los resuelve).
- `app.js` `renderRoute` → inyecta `aiKey` + `isOnline()` a las vistas que muestran audio
  (topic/practice), igual que ya inyecta `voice`.
- `settings.js` → selector de **voz de Gemini** (Kore/Puck/…) además del selector de voz
  del navegador actual; meta nueva `ttsVoice`. Indicador sutil de fuente ("voz natural" /
  "voz básica").
- `sw.js` → bump de caché; si `momentum-vN` corresponde.

**Datos:** botón → `speakSmart(text,{voice:ttsVoice,key,online})` → cache/Gemini/browser.

**Pruebas:** unit del router (arriba) + test de `audio-button` (llama `speakSmart` con la
voz configurada; oculto si no hay ninguna vía disponible).

**Entregable:** publicable solo. Edgar oye voz natural en los ejemplos de cada tema.

---

## Fase 2 — 🗣️ Diálogo bidireccional por voz

**Objetivo:** Edgar habla → se transcribe → la IA responde en contexto → responde con voz
natural. Role-play guiado.

**Archivos nuevos:** `src/ui/views/dialogue.js` (vista pura), `content/scenarios.json`
(escenarios de role-play: pedir café, presentarte, direcciones…), test de ambos.

**Cableado:** link "Hablar" en `buildNav`; `case 'dialogue'` en `renderRoute` que resuelve
`getTutor(store)` + inyecta `speakSmart`/`recognizeOnce`.

**Flujo:**
1. Edgar elige un escenario (o charla libre). Se arma un `history` inicial con el rol del
   tutor (prompt de sistema del escenario).
2. Botón 🎤 → `recognizeOnce({lang:'en-US'})` → transcript.
3. `history.push({role:'user', text:transcript})` → `tutor.chat(history)` → respuesta.
4. `speakSmart(respuesta)` la dice; se muestra el turno en pantalla (burbujas EN + toggle
   traducción ES bajo demanda).
5. Se repite. Guías visibles (frases sugeridas) pero sin bloquear si Edgar improvisa.

**Consideraciones A2:** turnos cortos, el tutor reformula suave, ofrece la frase modelo si
Edgar se traba. **Sin internet:** la vista avisa que el diálogo por voz necesita conexión
(realce online) y ofrece igual leer/escuchar el escenario cacheado.

**Pruebas:** `dialogue.test.js` con tutor + reconocimiento + voz mockeados: un turno
completo agrega user+tutor al history y dispara la voz; sin tutor muestra el aviso offline.

---

## Fase 3 — 🎯 Feedback de pronunciación (coaching cualitativo)

**Objetivo:** Edgar dice una frase objetivo y recibe coaching útil — **nivel guía**, no un
número de examen (decisión tomada; honesto con las herramientas disponibles).

**Archivos nuevos:** `src/engine/pronunciation.js` (comparación pura, testeable),
integración en la vista de práctica o una mini-vista, test.

**Flujo:**
1. Frase objetivo en inglés (de un ítem/ejemplo). Botón 🎤 → `recognizeOnce`.
2. `pronunciation.js` compara **transcript vs objetivo** palabra por palabra (normaliza
   mayúsculas/puntuación; alineación simple) → marca las palabras que el reconocedor "no
   oyó" como probables fallos de pronunciación. Devuelve `{ score0to100, wordsOk, wordsOff }`
   como señal orientativa (no certificada).
3. Si hay tutor: `tutor` da **coaching en español** ("dijiste *tink*, era *think*: la /θ/
   se te fue a /t/, lengua entre los dientes"). Prompt nuevo enfocado en fonemas típicos
   del hispanohablante.
4. UI: resalta palabras ok/off, muestra el coaching, botón "reintentar". Nunca bloquea.

**Honestidad de alcance (documentada en la UI):** "esto es una guía basada en lo que el
reconocedor entendió, no un examen de pronunciación". Sin internet: no hay reconocimiento
→ aviso claro; el resto de la práctica sigue.

**Pruebas:** `pronunciation.test.js` (pura): match perfecto → score alto, sin wordsOff;
una palabra distinta → esa en wordsOff; normalización de puntuación/caso. Integración con
reconocimiento + tutor mockeados.

---

## Fase 4 — 🎧 Escuchar + Constancia

**Objetivo:** práctica de solo-escucha + racha que enganche.

**Escuchar:** nuevo tipo de ejercicio "listening" (oyes con `speakSmart`, eliges/escribes
lo que oíste) reutilizando `practice-card`/`session`. Se puede modelar como ítems `type`
existente (cloze/choice) con audio-primero, sin renombrar ids.

**Constancia:** **reutiliza `recordStudyDay`** (ya existe) y el `streak-chip`/header. Añade
un toque visual de logro (hitos 3/7/30 días) y quizá un recordatorio suave. Local, offline.

**Pruebas:** listening usa audio mockeado y valida como práctica normal; hitos de racha
sobre `recordStudyDay` (día siguiente +1, hueco reinicia) — reutiliza/expande los tests de
streak existentes.

---

## Transversal

- **Ajustes:** voz de Gemini (`ttsVoice`), toggles de las funciones nuevas si aplica.
- **Accesibilidad:** cada botón 🎤/🔊 con `aria-label`; estados (grabando/pensando/
  hablando) anunciados.
- **Matriz offline:** F1 funciona offline vía cache; F2/F3 avisan que necesitan conexión;
  F4 escucha usa cache, racha es local. El núcleo (leer/practicar/SRS) nunca depende de red.
- **sw:** bump de caché por fase que cambie shell/JS; añadir `content/scenarios.json` al
  `SHELL` (F2).

## Estrategia de pruebas

`node:test` con dobles para las APIs de plataforma (patrón `src/test-utils/`):
`fetch` (Gemini), `SpeechRecognition`, `speechSynthesis`, `Audio`/`AudioContext`,
IndexedDB (`idb-env`). La lógica pura (WAV desde base64, comparación de pronunciación,
router de decisión, hitos de racha) se testea directamente. La suite completa debe seguir
verde tras cada fase.

## Criterios de éxito

1. F1: el botón de audio suena natural online, repite offline desde cache, degrada a voz
   básica sin romper. Suite verde.
2. F2: un turno hablado completo (hablar→transcribir→responder→oír) funciona en
   Android/Chrome; avisa offline. Suite verde.
3. F3: coaching cualitativo con palabras ok/off y consejo en español; honesto sobre su
   alcance. Suite verde.
4. F4: práctica de escucha jugable + racha con hitos, todo offline. Suite verde.
5. Todas: NO innerHTML, offline-first intacto, 0 ids renombrados, publicado y revisable en
   vivo por Edgar.

## Riesgos y preguntas abiertas

- **API TTS de Gemini es *preview*** → forma de respuesta y nombres de voz pueden cambiar.
  Mitigación: spike como primera tarea del plan de F1.
- **Cuota/costo** de TTS con la llave de Edgar: el cache reduce llamadas repetidas; F1
  cachea agresivo. Medir uso real.
- **Reconocimiento requiere internet** (Chrome lo hace en servidor): F2/F3 son realces
  online por diseño; documentado.
- **Tamaño del cache de audio** en IndexedDB: empezar sin tope, medir, añadir LRU si crece.
- **Alcance de pronunciación:** heurística por transcript, no fonética real. Aceptado por
  Edgar; comunicado en la UI.

## Descomposición → planes

Este spec es la **visión completa**. Se implementa como **una fase = un ciclo
plan→implementación→publicación**, en orden F1→F2→F3→F4. El **primer plan cubre el
Cimiento A + Fase 1** (voz natural). Al terminar y publicar cada fase, se escribe el plan
de la siguiente. Cada fase deja software funcionando y revisable por Edgar.
