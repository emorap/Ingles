import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Regression guard for the "near-empty stylesheet" bug: the app shipped with
// only design tokens + 3 primitive classes and no layout, so every view
// rendered as raw stacked text on a dark background. linkedom (the test DOM)
// does not evaluate CSS, so unit tests could not catch it. These checks read
// the stylesheet as text and assert the visual layer is actually present.
const css = readFileSync(fileURLToPath(new URL('./theme.css', import.meta.url)), 'utf8');
// Strip comments and collapse whitespace so checks don't depend on formatting.
const norm = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

/** Declaration body of the first rule whose selector text includes `sel`, or null. */
function body(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = norm.match(new RegExp('([^{}]*' + esc + '[^{}]*)\\{([^{}]*)\\}'));
  return m ? m[2] : null;
}

test('the app shell lays out its navigation (not raw stacked links)', () => {
  const nav = body('.app-nav');
  assert.ok(nav, '.app-nav must be styled');
  assert.match(nav, /display\s*:\s*(flex|grid)/, '.app-nav needs a flex/grid layout');
});

test('the hub arranges topic cards in a responsive grid', () => {
  const cards = body('.topic-cards');
  assert.ok(cards, '.topic-cards must be styled');
  assert.match(cards, /grid|flex/, '.topic-cards needs a grid/flex layout');
  assert.match(norm, /@media/, 'stylesheet needs at least one responsive breakpoint');
});

test('the practice card has real layout, not raw stacked text', () => {
  const card = body('.practice-card');
  assert.ok(card, '.practice-card must be styled');
  assert.match(card, /padding|max-width|gap|display/, '.practice-card needs spacing/layout');
});

test('the stylesheet styles the app, not just design tokens', () => {
  const ruleCount = (norm.match(/\{/g) || []).length;
  assert.ok(ruleCount >= 40, `expected a built-out stylesheet, found only ${ruleCount} rule blocks`);
});
