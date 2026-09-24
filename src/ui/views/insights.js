// Insights view: reads computeStats() output and shows retention, mastery,
// a 7-day due-forecast bar chart (pure CSS bars), and the weakest topics with
// a "Reforzar" button that launches a topic-filtered session. Pure DOM, no
// innerHTML. Fully offline — it only renders numbers already computed locally.

const DAY_LABELS = ['Hoy', 'Mañ', '+2', '+3', '+4', '+5', '+6'];

/**
 * @param {HTMLElement} container
 * @param {{
 *   stats: { retention: number, mastered: number, seen: number, forecast: number[], weakTopics: { topic: string, ratio: number }[] },
 *   onFocusWeak?: (topic: string) => void,
 *   titleFor?: (topic: string) => string,
 * }} ctx
 */
export function renderInsights(container, { stats, onFocusWeak, titleFor }) {
  clear(container);
  const section = document.createElement('section');
  section.className = 'insights';
  section.setAttribute('data-view', 'insights');

  const h2 = document.createElement('h2');
  h2.textContent = 'Tu progreso';
  section.append(h2);

  if (!stats || stats.seen === 0) {
    const empty = document.createElement('p');
    empty.className = 'insights-empty muted';
    empty.setAttribute('data-role', 'empty');
    empty.textContent = 'Aún no hay datos. Practica un poco y aquí verás tu progreso.';
    section.append(empty);
    container.append(section);
    return;
  }

  // Summary tiles: retention and mastered / seen.
  const tiles = document.createElement('div');
  tiles.className = 'insights-tiles';

  tiles.append(
    tile('Retención', `${Math.round(stats.retention * 100)} %`, 'retention'),
    tile('Dominados', `${stats.mastered} / ${stats.seen}`, 'mastered'),
  );
  section.append(tiles);

  // 7-day forecast bar chart.
  const forecastH = document.createElement('h3');
  forecastH.textContent = 'Próximos 7 días';
  section.append(forecastH);

  const chart = document.createElement('div');
  chart.className = 'forecast-chart';
  chart.setAttribute('data-role', 'forecast');
  chart.setAttribute('role', 'img');
  const max = Math.max(1, ...stats.forecast);
  stats.forecast.forEach((count, d) => {
    const col = document.createElement('div');
    col.className = 'forecast-col';

    const bar = document.createElement('div');
    bar.className = 'forecast-bar';
    bar.setAttribute('data-role', 'bar');
    bar.style.height = `${Math.round((count / max) * 100)}%`;
    bar.setAttribute('aria-label', `${DAY_LABELS[d]}: ${count} tarjetas`);

    const n = document.createElement('span');
    n.className = 'forecast-count';
    n.textContent = String(count);

    const label = document.createElement('span');
    label.className = 'forecast-label muted';
    label.textContent = DAY_LABELS[d];

    col.append(n, bar, label);
    chart.append(col);
  });
  section.append(chart);

  // Weak topics with a "Reforzar" CTA.
  if (stats.weakTopics.length) {
    const weakH = document.createElement('h3');
    weakH.textContent = 'Para reforzar';
    section.append(weakH);

    const list = document.createElement('ul');
    list.className = 'weak-topics';
    list.setAttribute('data-role', 'weak-topics');
    for (const { topic, ratio } of stats.weakTopics) {
      const li = document.createElement('li');
      li.className = 'weak-topic';
      li.setAttribute('data-topic', topic);

      const name = document.createElement('span');
      name.className = 'weak-topic-name';
      name.textContent = titleFor ? titleFor(topic) : topic;

      const pct = document.createElement('span');
      pct.className = 'weak-topic-ratio muted';
      pct.textContent = `${Math.round(ratio * 100)} %`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost';
      btn.setAttribute('data-action', 'reforzar');
      btn.textContent = 'Reforzar';
      btn.addEventListener('click', () => onFocusWeak?.(topic));

      li.append(name, pct, btn);
      list.append(li);
    }
    section.append(list);
  }

  container.append(section);
}

function tile(label, value, role) {
  const box = document.createElement('div');
  box.className = 'insight-tile surface';
  const v = document.createElement('strong');
  v.className = 'insight-value';
  v.setAttribute('data-role', role);
  v.textContent = value;
  const l = document.createElement('span');
  l.className = 'insight-label muted';
  l.textContent = label;
  box.append(v, l);
  return box;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
