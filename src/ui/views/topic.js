// Topic view: the "teach" screen. Bilingual explanation blocks (each English
// line has an audio button), optional diagrams, worked examples with audio,
// and a "Practicar este tema" CTA. Pure DOM construction, no innerHTML.
import { bilingualCallout } from '../components/bilingual-callout.js';
import { audioButton } from '../components/audio-button.js';

/**
 * @param {HTMLElement} container
 * @param {{ topic: any, onPractice?: (topicId: string) => void }} ctx
 */
export function renderTopic(container, { topic, onPractice }) {
  clear(container);
  const voice = topic.audio?.voice;

  const section = document.createElement('section');
  section.className = 'topic';
  section.setAttribute('data-view', 'topic');
  section.setAttribute('data-topic', topic.id);

  const header = document.createElement('header');
  const h2 = document.createElement('h2');
  h2.textContent = topic.title.es;
  const sub = document.createElement('p');
  sub.className = 'topic-subtitle';
  sub.setAttribute('lang', 'en');
  sub.textContent = topic.title.en;
  header.append(h2, sub);
  section.append(header);

  for (const block of topic.explanation ?? []) section.append(renderBlock(block, voice));

  for (const src of topic.diagrams ?? []) {
    const img = document.createElement('img');
    img.className = 'topic-diagram';
    img.setAttribute('loading', 'lazy');
    img.setAttribute('src', src);
    img.setAttribute('alt', `Diagrama: ${topic.title.es}`);
    section.append(img);
  }

  if (topic.examples?.length) {
    const h3 = document.createElement('h3');
    h3.textContent = 'Ejemplos';
    section.append(h3);
    const ul = document.createElement('ul');
    ul.className = 'topic-examples';
    for (const ex of topic.examples) {
      const li = document.createElement('li');
      li.setAttribute('data-role', 'example');
      const en = document.createElement('span');
      en.className = 'example-en';
      en.setAttribute('lang', 'en');
      en.textContent = ex.en;
      const es = document.createElement('span');
      es.className = 'example-es';
      es.setAttribute('lang', 'es');
      es.textContent = ex.es;
      li.append(en, audioButton(ex.en, { voice }), es);
      ul.append(li);
    }
    section.append(ul);
  }

  const practice = document.createElement('button');
  practice.type = 'button';
  practice.className = 'btn';
  practice.setAttribute('data-action', 'practice-topic');
  practice.textContent = 'Practicar este tema';
  practice.addEventListener('click', () => onPractice?.(topic.id));
  section.append(practice);

  container.append(section);
}

function renderBlock(block, voice) {
  if (block.kind === 'callout') return bilingualCallout(block.text, { voice, kind: 'callout' });
  if (block.kind === 'quote') return bilingualPara(block.text, voice, 'blockquote', 'topic-quote');
  if (block.kind === 'table') return renderTable(block);
  return bilingualPara(block.text, voice, 'div', 'topic-p'); // 'p' and unknown → paragraph
}

function bilingualPara(text, voice, wrapperTag, className) {
  const wrap = document.createElement(wrapperTag);
  wrap.className = className;
  const en = document.createElement('p');
  en.setAttribute('lang', 'en');
  const enText = document.createElement('span');
  enText.textContent = text.en;
  en.append(enText, audioButton(text.en, { voice }));
  const es = document.createElement('p');
  es.className = 'muted';
  es.setAttribute('lang', 'es');
  es.textContent = text.es;
  wrap.append(en, es);
  return wrap;
}

function renderTable(block) {
  const table = document.createElement('table');
  table.className = 'topic-table';
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of block.headers ?? []) {
    const th = document.createElement('th');
    th.textContent = h;
    htr.append(th);
  }
  thead.append(htr);
  const tbody = document.createElement('tbody');
  for (const row of block.rows ?? []) {
    const tr = document.createElement('tr');
    for (const cell of row) {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  return table;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
