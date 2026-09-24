# Bitácora — construcción de los 5 módulos de contenido

**Fecha:** 2026-09-24
**Cómo se construyó:** workflow multi-agente en paralelo — un agente **autor** por
módulo (lee sus PDFs + el estándar de oro `content/tenses.json`, escribe el módulo,
se autovalida con `scripts/validate_module.mjs`) seguido de un agente **revisor**
que profundiza la calidad y corrige en sitio. 10 agentes (modelo Sonnet 5), 0 errores
de ejecución, ~1.13M tokens, ~22 min.

**Puerta de calidad (objetiva, la corrí yo al integrar):**
- `scripts/validate_module.mjs` por módulo → los 5 pasan (`ok: true`).
- `scripts/validate_content.mjs` (todo el corpus) → los 6 módulos pasan.
- Suite completa `node --test` → **171/171, 0 fallos** (incluye el content guard:
  unicidad de ids en TODO el corpus (254 ítems), invariante learn-first, y agrupación
  por familias).

**Corpus resultante:** 6 módulos · 51 temas · 254 ítems de práctica.

---

## Incidencias de proceso (detectadas y corregidas por mí en la integración)

1. **Carrera de escritura sobre `content/index.json`.** Pese a que la instrucción
   pedía tocar solo `content/<id>.json`, varios autores editaron `index.json` en
   paralelo para poner su módulo en `available`. El resultado fue *last-write-wins*:
   solo quedaron `conditionals` y `verbforms` en `available`; `structure`,
   `modifiers` y `mechanics` quedaron en `coming-soon` aunque sus archivos existían
   y pasaban la validación. **Corregido:** reescribí `index.json` de forma
   determinista con los 6 módulos en `available`.
2. **Modelo real:** los subagentes corrieron en **Sonnet 5** (modelo por defecto de
   subagente), no en Opus. Calidad verificada igual por la puerta objetiva y la
   revisión bilingüe; no afecta el entregable.
3. **Offline-first completado:** agregué los 5 JSON nuevos al precache del service
   worker y subí la versión de caché `v2 → v3`, para que todo el corpus funcione sin
   conexión desde la primera visita (antes solo `tenses.json` estaba pre-cacheado).

---

## conditionals · Condicionales e hipótesis — 8 temas, 39 ítems
**Familias:** reales · irreales · extensiones.
**Metáforas:** máquina expendedora, bifurcación real, postal de universo paralelo,
puerta sellada al ayer, dominó que viaja en el tiempo, genio de las quejas, especiero
de condiciones, oración de esmoquin.

**Correcciones aplicadas por el revisor:**
- Error de concordancia de género: **"la especiero" → "el especiero"** (2 ocurrencias
  en el tema unless-and-conditions).
- Añadió `cnd-wish-hope`: practica **wish vs hope** (trampa de traducción literal de
  "ojalá no lloviera"), que la explicación mencionaba pero no se practicaba.
- Añadió `cnd-unless-provided`: practica **"provided that"**, explicado pero sin ítem.

**⚠️ Riesgo residual para que Edgar revise:** el tema *wish-if-only* cita una fuente
genérica ("General English grammar reference") en lugar de uno de tus 2 PDFs. El
contenido es correcto; confirma si te parece bien que ese tema no venga textualmente
de tus PDFs.

---

## structure · Estructura y voz — 8 temas, 40 ítems
**Familias:** voz · discurso · conexión.
**Metáforas:** cambio de escena entre bastidores, cambio de vestuario, eco con
retraso, nota plana del detective, relevo del mensajero, etiqueta de apodo vs. nota
adhesiva, semáforos del pensamiento, tarjeta de receta.

**Correcciones aplicadas por el revisor:** ninguna — el módulo ya cumplía la barra de
`tenses.json` sin necesitar ediciones. Gramática verificada línea por línea contra los
5 PDFs; español neutro colombiano sin españolismos.

**⚠️ Riesgo residual para que Edgar revise:** el punto *"whether ... or not"* en
reported-questions es una extensión razonable más allá de lo que dice literalmente el
PDF (regla estándar de inglés, pero confírmala si quieres rigor extra).

---

## verbforms · Formas verbales — 8 temas, 40 ítems
**Familias:** modales · gerundio/infinitivo · GET.
**Metáforas:** llavero, dos alarmas y un susurro, medidor de probabilidad, libreta del
detective, foto vs. letrero, disfraz de sustantivo, navaja suiza, camaleón social.

**Correcciones aplicadas por el revisor:**
- Traducción literal heredada del PDF: **"¿Podría tomar tu bolígrafo?" →
  "¿Podrías prestarme tu bolígrafo?"** (borrow ≠ take), español más natural.

**⚠️ Riesgo residual para que Edgar revise:** el tema *modals-deduction* fusiona en uno
las secciones separadas del PDF (deducción presente/pasada + arrepentimiento pasado).
Es una compresión razonable; solo tenlo presente.

---

## modifiers · Palabras y modificadores — 7 temas, 35 ítems
**Familias:** adjetivos · comparación · preposiciones.
**Metáforas:** sastre/coreógrafo, fila de alfombra roja, cajas/charcos, balanza de dos
platos, podio del ganador, mapa/reloj, cinta de regalo/etiqueta de envío.

**Correcciones aplicadas por el revisor:**
- Inconsistencia en el tema de orden de adjetivos: el ejemplo había perdido "cooking"
  respecto al ejemplo trabajado (OSASCOMP). **Restaurado "cooking" / "para cocinar".**
- Traducción torpe reescrita: **"un escritorio francés de madera, viejo" →
  "un escritorio viejo, francés y de madera"** (flujo más natural).

**⚠️ Riesgo residual para que Edgar revise:** es el **único módulo que usa el tipo de
ítem `order`** ("pon estas palabras en orden"), que la app renderiza como texto libre,
no como arrastrar/reordenar. Funciona y pasa validación, pero vale una prueba manual
para confirmar que se siente natural y no como un dictado estricto.

---

## mechanics · Mecánica del inglés real — 6 temas, 30 ítems
**Familias:** escritura · números · situaciones.
**Metáforas:** semáforos, cremallera, fósiles lingüísticos, línea de ensamblaje, podio
ordinal (medallas), GPS humano.

**Correcciones aplicadas por el revisor:**
- Falso cognado: **"colon/colones" → "los dos puntos"** para el signo ":" (3 lugares,
  con concordancia verbal). En español "colon" es el órgano (o una moneda), no el signo.

**⚠️ Riesgo residual para que Edgar revise:** algunos distractores (should've/should of,
we're/were, right/write) son trampas de escucha/ortografía internas del inglés, no
errores estrictos de interferencia del español. Son sólidos pedagógicamente y coinciden
con el estilo de `tenses.json`, pero no todos son de transferencia L1.

---

# Fase 2 — Pase de profundización (validación + ajuste de contenido)

**Fecha:** 2026-09-24
**Petición de Edgar:** *"valida los documentos, ajusta los diálogos, que no sean diálogos
pequeños o incoherentes, que den suficientes ejemplos, suficiente información, que no sea
algo pobre en conceptos y teoría así como en experiencia de usuario."*

**Diagnóstico objetivo antes de tocar nada** (para no inflar a ciegas): los 5 módulos
nuevos ya superaban la barra de oro (5 ejemplos/tema, ~1633–2274 chars de explicación,
`why` en cada ítem). El eslabón débil era el módulo original `tenses`: solo **3
ejemplos/tema**. El cross-linking (`related`) estaba delgado en todo el corpus
(promedios 1.4–2.1). Cero tablas de referencia. Cero `why` faltantes.

**Cómo se hizo:** workflow multi-agente en paralelo — 1 agente por módulo (6 en total,
Sonnet 5, esfuerzo alto), fase única *Profundización*, ~7.5 min, 0 errores. Mandato
**conservador con restricciones duras**: editar solo el propio archivo, NO tocar
`index.json` (lección de la carrera de Fase 1), **NUNCA renombrar/borrar/renumerar ids de
ítems** (ancla del repaso espaciado), no encoger contenido, sin relleno.

**Puerta de calidad (la corrí yo al integrar):**
- `scripts/validate_module.mjs` × 6 → todos `ok: true`.
- `scripts/validate_content.mjs` → 6 módulos pasan (`index.json module missing` = falso
  positivo esperado).
- Suite completa `node --test` → **171/171, 0 fallos**.
- **Diff contra baseline `/tmp/momentum-baseline/`**: 0 ids de ítems o temas
  renombrados/perdidos en los 6 módulos. Único ítem añadido: `cnd-inv-hadshe`.
- **Todos los `related` resuelven** dentro de su módulo.
- Lectura de muestras (present-simple, present-perfect-continuous): ejemplos con usos
  distintos, traducciones idiomáticas, pitfalls de error real del hispanohablante.

**Resultado por módulo:**
- **tenses** — subió los 14 temas de 3 → **5 ejemplos** (+28 frases, ancladas a los PDFs y
  cubriendo usos distintos). Reclasificó 2 bloques `callout` que ya nombraban un error a
  `pitfall` (regla de finished-time-word; "I've been knowing her") y escribió 2 pitfalls
  nuevos (omisión de -s en tercera persona; forzar verbos de estado al continuo).
  Reforzó `related` (promedio 2.93). Corrigió un typo de fuente: *"Future Tenses
  Masterclass.pdf" → "Future Tense Masterclass.pdf"* en los 6 temas de futuro.
- **conditionals** — +0 ejemplos (ya estaba). Reforzó `related` (bridges reales:
  zero↔unless, third↔wish). Llevó `formal-inversion` a paridad 4→5 ítems con
  **`cnd-inv-hadshe`** (usa el 5º ejemplo que estaba sin practicar).
- **structure** — +0 ejemplos. Solo 3 bridges de `related` (passive↔reported,
  passive-tenses↔connectors por registro formal).
- **verbforms** — +0 ejemplos. 1 bridge recíproco gerund-vs-infinitive↔get-phrasal.
- **modifiers** — +0 ejemplos. Reescribió `related` en los 7 temas (promedio 1.43 →
  2.71) + añadió **tabla OSASCOMP** de referencia en adjective-order (anclada al PDF).
- **mechanics** — +0 ejemplos. `related` a 2-3 por tema en los 6 + añadió **tabla de
  sufijos ordinales** (con la excepción 11/12/13) en dates-ordinal-podium.

**Offline:** subí la caché del service worker `v3 → v4` para que los usuarios que vuelven
re-precacheen el contenido enriquecido en el `activate` (en vez de recibirlo una carga
atrasada por stale-while-revalidate). La lista de precache no cambió (mismos 6 archivos).

**Corpus tras Fase 2:** 6 módulos · 51 temas · **255 ítems** (era 254; +1 por
`cnd-inv-hadshe`) · **todos los temas con ≥5 ejemplos**.

**⚠️ Riesgo residual para que Edgar revise:** las dos tablas nuevas (OSASCOMP en
modifiers, sufijos ordinales en mechanics) son el primer uso del bloque `table` en el
corpus fuera de `tenses`; pasan validación y la app las renderiza, pero vale una mirada
visual en vivo para confirmar que se ven bien en móvil.
