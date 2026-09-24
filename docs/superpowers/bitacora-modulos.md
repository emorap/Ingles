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
