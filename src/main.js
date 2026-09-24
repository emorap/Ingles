// Momentum bootstrap (composition root). Fetches + validates the module
// content, then mounts the app shell. All logic lives in tested units
// (validateContent, mountApp); this file only wires them to the browser.
import { mountApp } from './ui/app.js';
import { validateContent } from './engine/schema.js';

const root = document.getElementById('app');
if (root) {
  fetch('./content/tenses.json')
    .then((res) => res.json())
    .then((data) => {
      const result = validateContent(data);
      if (!result.ok) throw new Error('Contenido inválido: ' + JSON.stringify(result.errors));
      return mountApp(root, result.content);
    })
    .catch((err) => {
      const msg = document.createElement('main');
      msg.style.padding = '2rem';
      const h1 = document.createElement('h1');
      h1.textContent = 'Momentum';
      const p = document.createElement('p');
      p.textContent = 'No se pudo cargar el contenido: ' + (err?.message ?? err);
      msg.append(h1, p);
      root.append(msg);
    });
}
