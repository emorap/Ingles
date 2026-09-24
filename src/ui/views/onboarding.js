// First-run onboarding: three short slides that set expectations — you learn
// by retrieving, and difficulty is the point ("cuesta = aprende") — then pick
// a daily goal. maybeOnboard/finishOnboarding own the meta flag; the view is
// pure (no store) and reports the chosen goal through onDone. No innerHTML.

const GOALS = [5, 10, 15];
const DEFAULT_GOAL = 10;

/** @typedef {{ getMeta: (k: string, def: any) => Promise<any>, setMeta: (k: string, v: any) => Promise<void> }} MetaStore */

/**
 * @param {MetaStore} store
 * @returns {Promise<boolean>} whether first-run onboarding should be shown
 */
export async function maybeOnboard(store) {
  return !(await store.getMeta('onboarded', false));
}

/**
 * Mark onboarding complete and store the initial daily goal.
 * @param {MetaStore} store
 * @param {{ newPerDay?: number }} [opts]
 */
export async function finishOnboarding(store, { newPerDay = DEFAULT_GOAL } = {}) {
  await store.setMeta('onboarded', true);
  await store.setMeta('newPerDay', newPerDay);
}

const SLIDES = [
  {
    title: 'Aprende recuperando',
    body: 'No solo vas a leer: la app te pedirá producir la respuesta. Recuperarla de memoria es lo que de verdad fija el aprendizaje.',
  },
  {
    title: 'Cuesta = aprende',
    body: 'Con repetición espaciada repasas justo antes de olvidar. Si te cuesta un poco recordar, ¡mejor! Ese esfuerzo es la señal de que estás aprendiendo.',
  },
  {
    title: 'Tu meta diaria',
    body: 'Elige cuántas tarjetas nuevas quieres cada día. Podrás cambiarlo cuando quieras en Ajustes.',
  },
];

/**
 * @param {HTMLElement} container
 * @param {(result: { newPerDay: number }) => void} onDone
 */
export function renderOnboarding(container, onDone) {
  clear(container);
  let index = 0;
  let goal = DEFAULT_GOAL;

  const section = document.createElement('section');
  section.className = 'onboarding';
  section.setAttribute('data-view', 'onboarding');

  const slidesWrap = document.createElement('div');
  slidesWrap.className = 'onboarding-slides';

  const slideEls = SLIDES.map((s, idx) => {
    const slide = document.createElement('article');
    slide.className = 'onboarding-slide';
    slide.setAttribute('data-role', 'slide');
    const h = document.createElement('h2');
    h.textContent = s.title;
    const p = document.createElement('p');
    p.textContent = s.body;
    slide.append(h, p);
    if (idx === SLIDES.length - 1) slide.append(goalChooser());
    slidesWrap.append(slide);
    return slide;
  });
  section.append(slidesWrap);

  const dots = document.createElement('div');
  dots.className = 'onboarding-dots';
  dots.setAttribute('aria-hidden', 'true');
  const dotEls = SLIDES.map(() => {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dots.append(dot);
    return dot;
  });
  section.append(dots);

  const advance = document.createElement('button');
  advance.type = 'button';
  advance.className = 'btn';
  advance.setAttribute('data-role', 'advance');
  advance.addEventListener('click', () => {
    if (index < SLIDES.length - 1) { index += 1; sync(); }
    else onDone?.({ newPerDay: goal });
  });
  section.append(advance);

  function goalChooser() {
    const wrap = document.createElement('div');
    wrap.className = 'goal-chooser';
    for (const g of GOALS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost goal';
      b.setAttribute('data-role', 'goal');
      b.setAttribute('data-value', String(g));
      b.textContent = `${g} / día`;
      b.addEventListener('click', () => { goal = g; syncGoals(); });
      wrap.append(b);
    }
    return wrap;
  }

  function syncGoals() {
    for (const b of section.querySelectorAll('[data-role="goal"]')) {
      b.setAttribute('aria-pressed', Number(b.getAttribute('data-value')) === goal ? 'true' : 'false');
    }
  }

  function sync() {
    slideEls.forEach((el, idx) => {
      if (idx === index) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    });
    dotEls.forEach((dot, idx) => dot.classList.toggle('active', idx === index));
    advance.textContent = index === SLIDES.length - 1 ? 'Empezar' : 'Siguiente';
    syncGoals();
  }

  sync();
  container.append(section);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
