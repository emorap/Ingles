// Accessible SVG progress ring. `percent` (0–100) drives the arc; `color` is
// the module accent. Pure: returns a detached <svg> the caller mounts.
const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {number} percent 0–100
 * @param {string} color stroke color (module accent)
 * @param {{ size?: number, stroke?: number }} [opts]
 * @returns {SVGElement}
 */
export function progressRing(percent, color, { size = 72, stroke = 8 } = {}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - p / 100);
  const c = size / 2;

  const svg = el('svg', {
    viewBox: `0 0 ${size} ${size}`, width: size, height: size,
    role: 'img', 'aria-label': `${Math.round(p)} %`, class: 'progress-ring',
  });
  svg.append(
    el('circle', {
      class: 'ring-track', cx: c, cy: c, r, fill: 'none',
      stroke: 'var(--color-muted)', 'stroke-width': stroke, opacity: '0.25',
    }),
    el('circle', {
      class: 'ring-value', cx: c, cy: c, r, fill: 'none',
      stroke: color, 'stroke-width': stroke, 'stroke-linecap': 'round',
      'stroke-dasharray': circumference, 'stroke-dashoffset': offset,
      transform: `rotate(-90 ${c} ${c})`,
    }),
  );
  return svg;
}

function el(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
