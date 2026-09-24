# Momentum — Flujo de aprendizaje "Aprende → Practica" + rollout de contenido (spec de fase)

> **Momentum** — *"Sigue el impulso."*
> Segunda fase de diseño. Refina la pedagogía (aprender el concepto **antes** de practicarlo) y arranca el rollout del corpus completo módulo por módulo, sobre el motor ya construido.

- **Fecha:** 2026-09-24
- **Autor:** Edgar Mora (con Claude)
- **Estado:** Diseño aprobado en conversación. Pendiente de revisión del spec por Edgar antes de escribir el plan de implementación.
- **Spec base (autoridad):** [`2026-09-23-momentum-design.md`](./2026-09-23-momentum-design.md). Esta spec **no la reemplaza**: la extiende. Todo lo no redefinido aquí sigue vigente (arquitectura en capas, motor FSRS, offline-first, IndexedDB, audio TTS, AI Tutor opcional, identidad visual, no-objetivos).

---

## 1. Por qué esta fase (el hallazgo)

La spec base ya planeó el rollout completo (§6, §14) y el modelo de contenido (§7). En la práctica solo se construyó la **rebanada vertical de Presente**. Al usar la app por primera vez, Edgar detectó dos cosas que la spec base no fijó con suficiente precisión:

1. **"No conozco los conceptos."** La app lo llevaba a **practicar** (`My brother ___ in London`) sin haber presentado primero el concepto. Faltaba hacer del **aprendizaje lo primero**, explícito y prominente.
2. **"Muy pesado, muy denso."** El material es profundo (bien), pero sin capas se siente abrumador. La solución **no es recortar profundidad**, es **estructurarla en capas** (esencia → matiz → ejemplos → errores → práctica).

Además, Edgar confirmó el **estándar de calidad**: el estilo "ventanas / lente / puente" del módulo de Presente (`content/tenses.json`) es el norte para **todo** el corpus.

**Principio rector de esta fase (palabras de Edgar):**

> **Guiar, no bloquear.** La app sugiere un orden y enseña antes de evaluar, pero **nunca** encierra al estudiante: puede saltar a cualquier módulo o tema, y puede ir directo a practicar si así lo quiere.

---

## 2. El cambio pedagógico central: "Aprende → Practica"

Cada **tema** deja de ser "un montón de tarjetas" y pasa a ser una **lección primero, práctica después**:

1. Al abrir un tema, lo **primero** que se ve es la **lección**.
2. Al final de la lección aparece un botón prominente **"Practicar este tema"**.
3. **Nunca** se evalúa un ítem de un tema cuyo concepto no se presentó antes en ese mismo tema.

**Pero sin bloquear:**
- Desde el Hub sigue existiendo el CTA global **"Practicar lo de hoy"** (sesión intercalada FSRS de toda la app) — acceso directo a práctica sin leer.
- Dentro de un tema, quien ya lo domina puede ir directo a practicar (no se le obliga a releer).
- La navegación libre (barra de navegación, buscador) nunca se restringe.

Esto es un **default pedagógico**, no un candado.

---

## 3. Modelo de navegación (guiar sin bloquear)

La app pasa de "un módulo con temas" a **varios módulos**. Jerarquía de drill-down:

```
Hub (módulos)  →  Módulo (temas)  →  Tema (lección)  →  Práctica
```

### 3.1 Hub — `#/`
- Muestra los **6 módulos** como tarjetas (color de acento por módulo, anillo de progreso agregado).
- Cada módulo lleva su **número de orden recomendado** (1→6) y una marca sutil de **"siguiente sugerido"** (el primer módulo con temas sin dominar).
- **Todos los módulos están siempre abiertos y tocables. Sin candados.**
- Conserva: buscador global (busca temas en **todos** los módulos), CTA "Practicar lo de hoy (N ítems · ~X min)", chip de racha.

### 3.2 Módulo — `#/module/<moduleId>` *(vista nueva)*
- Lista los **temas** del módulo, en orden recomendado y numerados, con estado por tema: **Por aprender · Aprendido · Practicando · Dominado**.
- Todos los temas tocables; sin candados.

### 3.3 Tema — `#/topic/<topicId>` (lección-primero)
- Renderiza la lección por capas (§4).
- Al abrirse, marca el tema como **"lección vista"** (§6).
- Termina con el botón **"Practicar este tema"** → `#/practice/<topicId>`.

### 3.4 Práctica — `#/practice` (intercalada) y `#/practice/<topicId>` (por tema)
- Sin cambios de motor (FSRS, retrieval-first, feedback + porqué, calificación). Ya existe.

**Invariante de diseño:** ningún módulo ni tema es inalcanzable; el orden es **recomendación visual**, no restricción de acceso.

---

## 4. Estructura de la lección por capas (profundidad digerible)

Cada tema se **redacta** con esta secuencia de capas — la respuesta directa a "denso pero sin perder profundidad":

1. **La idea en una frase** — la esencia, arriba y destacada. *Campo nuevo `coreIdea`.*
   *Ej: "El presente perfecto es un puente del pasado al ahora."*
2. **Las "ventanas"** — la explicación con metáforas, bilingüe EN/ES (`explanation[]`, ya existe).
3. **Ejemplos reales** EN/ES (`examples[]`, ya existe).
4. **Errores comunes** — el *porqué* de lo que suena mal (bloques `explanation` de tipo callout de advertencia; también emergen de los ítems con tag `error`).
5. **Practicar** — botón al cierre.

### 4.1 Extensión mínima del esquema de contenido

Sobre el esquema de la spec base §7, cada `topic` añade **un** campo obligatorio:

```jsonc
{
  "id": "present-perfect",
  "title": { "en": "...", "es": "..." },
  "coreIdea": {                         // NUEVO · requerido · la esencia en una frase
    "en": "Present Perfect is a bridge from the past into now.",
    "es": "El presente perfecto es un puente del pasado al ahora."
  },
  "source": "Present tense masterclass.pdf",
  "explanation": [ /* bloques: p | callout | callout-why | pitfall | table | quote */ ],
  "examples": [ { "en": "...", "es": "..." } ],
  "related": ["present-perfect-continuous"],
  "items": ["pp-saw", "pp-visited"]
}
```

- `coreIdea` es **obligatorio** en cada tema (lo valida una prueba, §8).
- Se añade el `kind: "pitfall"` a los bloques de `explanation` (callout de advertencia para "errores comunes"). El resto del esquema de ítems (spec base §7) no cambia.
- El módulo de Presente existente (`present-simple`, `present-continuous`, `present-perfect`, `present-perfect-continuous`) se **actualiza** para incluir `coreIdea` en sus 4 temas, sin tocar los `id` de ítems (no se pierde progreso SRS).

---

## 5. Arquitectura de contenido multi-módulo

### 5.1 Manifiesto — `content/index.json` *(archivo nuevo)*

```jsonc
{
  "version": 1,
  "modules": [
    { "id": "tenses",       "order": 1, "file": "tenses.json",
      "title": { "en": "Tense system", "es": "Sistema de tiempos" }, "accent": "#6366F1" },
    { "id": "conditionals", "order": 2, "file": "conditionals.json", "title": { ... }, "accent": "#8B5CF6" }
    // ... 6 módulos
  ]
}
```

- El manifiesto es la **única fuente del orden recomendado** y de qué archivos existen.

### 5.2 Carga

- Al arrancar: `main.js` carga `content/index.json`, luego **todos** los `content/<módulo>.json` listados (son texto, pequeños).
  - *Razón:* el Hub necesita progreso agregado de todos los módulos y el **session builder intercala ítems de varios módulos** (spec base §9). Cargar todo el JSON de texto es barato y mantiene el interleaving.
- **Assets pesados** (diagramas, audio HQ) siguen bajo demanda + cache del service worker (spec base §3, §13). Solo el JSON se precarga.
- El service worker cachea `index.json` + los `<módulo>.json` → offline tras primera visita.
- **Degradación:** si un `<módulo>.json` referenciado falla al cargar, la app registra el error, **omite ese módulo** y sigue con los demás (no pantalla en blanco).

---

## 6. Modelo de progreso (lección + SRS)

Complementa el estado SRS por ítem (spec base §13) con el estado de **lección**:

- Se persiste en IndexedDB, por `topicId`: `lessonViewedAt` (timestamp de la primera vez que se abrió el tema).
- **Estado derivado por tema** (para las etiquetas de §3.2):
  - **Por aprender:** sin `lessonViewedAt` y sin ítems practicados.
  - **Aprendido:** `lessonViewedAt` presente, aún sin práctica significativa.
  - **Practicando:** tiene ítems con repasos pero no todos maduros.
  - **Dominado:** todos los ítems del tema alcanzan madurez FSRS (umbral definido en el plan).
- **Anillo del módulo:** porcentaje agregado de sus ítems que están "maduros" (misma métrica que ya usa el anillo de tema).

Actualizar contenido no borra progreso (claves por `id`, spec base §7).

---

## 7. Mapa de módulos (aprobado por Edgar) — rollout

Refina la agrupación de la spec base §6 según lo acordado en esta conversación. Reutiliza los 6 acentos ya reservados en `theme.css`.

| # | Módulo | Acento | Contenido (PDFs del corpus) |
|---|--------|--------|------|
| 1 | ⏱ Sistema de tiempos | Índigo `#6366F1` | Present ✅ · Past · Future · (Haber/perfectos como apoyo) |
| 2 | 🔀 Condicionales e hipótesis | Violeta `#8B5CF6` | Complete Guide to Conditionals · Optional Extension |
| 3 | 🧱 Estructura y voz | Turquesa `#2DD4BF` | Passive Voice (×2 → usar la más completa) · Relative Clauses · Reported Speech |
| 4 | 🔧 Formas verbales | Cielo `#38BDF8` | Modal Verbs · -ING (gerundios) · Understanding "GET" · FOR vs TO |
| 5 | 🟢 Palabras y modificadores | Esmeralda `#10B981` | Comparatives/Superlatives (×2 → la Updated) · Adjectives/Adverbs/Countable · Adjective Order · Modifiers · Prepositions · Connectors |
| 6 | 💬 Mecánica del inglés real | Ámbar `#F59E0B` | Punctuation · Contractions · Silent Letters · Numbers · Dates · Directions |

- Los "cheat sheets" grandes (`English Grammar Cheat Sheet.pdf`, `Language cheet sheet graph.pdf`) se usan como **referencia/índice**, no como módulo suelto.
- **Las fronteras de los módulos 2–6 pueden ajustarse al leer cada PDF** (p. ej. Passive podría vivir en Tiempos). Se decide al construir cada módulo. Esta spec **no** los congela; solo el módulo 1 se construye en esta fase.
- Orden **recomendado** (columna #), nunca obligatorio (§3).

---

## 8. Alcance de la PRIMERA entrega (esta fase)

Módulo por módulo, empezando por **la base + completar Tiempos**:

### 8.1 Infraestructura de aprendizaje (habilita los 6 módulos)
- Manifiesto `content/index.json` + carga multi-módulo (§5).
- Hub de **módulos** con orden recomendado sin candados (§3.1).
- Vista de **módulo** nueva (§3.2).
- Vista de **tema lección-primero** con `coreIdea` destacado + botón "Practicar este tema" (§3.3, §4).
- Estado de **lección vista** + etiquetas de estado por tema (§6).
- Extensión de esquema: `coreIdea` (requerido) + bloque `pitfall` (§4.1).

### 8.2 Contenido: completar el módulo de Tiempos
- Actualizar los 4 temas de Presente existentes con `coreIdea` (sin tocar ids de ítems).
- **Redactar el tema de Pasado** desde `Past Tense Masterclass.pdf`, al estándar "ventanas": `coreIdea` + explicación con metáforas + ejemplos EN/ES + errores comunes + **5–8 ítems** de práctica (choice/cloze) con `why` y distractores realistas.
- **Redactar el tema de Futuro** desde `Future Tense Masterclass.pdf`, mismo estándar.
- Renombrar el módulo a "Sistema de tiempos / Tense system" (id `tenses` se conserva).

### 8.3 Fuera de alcance de esta entrega (rollout posterior)
- Módulos 2–6 (una fase por módulo).
- Audio HQ pregenerado, práctica de habla, sync automático (siguen como futuro, spec base §16).

---

## 9. Estrategia de pruebas (añadidos a la spec base §15)

Bajo el mismo stack sin-build (`node:test` / `node:assert`, linkedom, fake-indexeddb) y TDD:

- **Guard de contenido "ni práctica sin concepto, ni concepto sin práctica":** cada tema de cada módulo tiene `coreIdea` (EN y ES), al menos un bloque `explanation`, al menos un `example`, y **al menos un ítem** de práctica. *(Esta es la prueba que impide que se repita "no conozco los conceptos".)*
- **Guard del manifiesto:** cada módulo de `index.json` resuelve a un archivo existente; `order` es una permutación 1..N; los `id` de módulo y de ítem son únicos en todo el corpus.
- **Guard de navegación (guiar sin bloquear):** toda vista de módulo y tema es alcanzable por ruta; ningún módulo/tema queda gated; existe ruta directa a práctica (global y por tema).
- **Carga multi-módulo:** con un `<módulo>.json` inválido/ausente, la app carga los demás sin romper (degradación).
- **Progreso de lección:** abrir un tema fija `lessonViewedAt`; el estado derivado por tema se calcula correctamente en los cuatro casos.
- **Regresión visual (ya existe):** `theme.test.js` sigue verde; se extiende para las clases nuevas de la vista de módulo si las hay.
- Se conservan verdes todas las pruebas del motor/almacenamiento existentes (FSRS, session builder, normalización, export/import, offline).

---

## 10. Restricciones vigentes (recordatorio, de la spec base y del entorno)

- **Sin `innerHTML`** — construcción de DOM pura (hook de seguridad).
- **Sin toolchain de build** — ESM vanilla + JSDoc; deps vendorizadas; SW y manifest a mano.
- **Offline-first** — el núcleo nunca depende de la red.
- **Un commit por tarea** con la línea de atribución acordada; PR con la línea de atribución al cierre.
- Clave de IA local, sin cifrado real posible en cliente (documentado, no v1).

---

## 11. Decisiones abiertas (se resuelven al construir, no bloquean)

- Umbral exacto de "Dominado" (madurez FSRS) para las etiquetas de estado (§6).
- Ubicación final de Passive (Tiempos vs Estructura y voz) — se decide al leer los PDFs de Passive.
- Si el Hub muestra además un acceso rápido "seguir donde iba" (último tema abierto) — mejora opcional post-entrega.
