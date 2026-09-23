// Momentum bootstrap. Real mounting arrives in later tasks (app shell + views).
const app = document.getElementById('app');
if (app) {
  const main = document.createElement('main');
  main.style.padding = '2rem';
  const h1 = document.createElement('h1');
  h1.textContent = 'Momentum';
  const p = document.createElement('p');
  p.textContent = 'Sigue el impulso.';
  main.append(h1, p);
  app.append(main);
}
