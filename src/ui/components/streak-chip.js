// Streak chip: 🔥 + consecutive-day count. Pure: returns a detached element.
/**
 * @param {number} days consecutive study days
 * @returns {HTMLElement}
 */
export function streakChip(days) {
  const n = Number(days) || 0;
  const chip = document.createElement('span');
  chip.className = 'streak-chip';
  chip.setAttribute('aria-label', `Racha de ${n} día${n === 1 ? '' : 's'}`);

  const flame = document.createElement('span');
  flame.className = 'streak-flame';
  flame.setAttribute('aria-hidden', 'true');
  flame.textContent = '🔥';

  const count = document.createElement('strong');
  count.textContent = String(n);

  chip.append(flame, count);
  return chip;
}
