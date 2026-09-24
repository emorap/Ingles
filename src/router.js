// Hash router: `#/view/param` → { view, param }. Uses the browser's global
// location + hashchange, so no framework and it survives offline/reload.

/**
 * Parse the current hash and call fn now and on every hashchange.
 * `#/practice/tenses` → { view: 'practice', param: 'tenses' }; empty → hub.
 * @param {(route: { view: string, param?: string }) => void} fn
 */
export function onRoute(fn) {
  const parse = () => {
    const [, view = 'hub', param] = location.hash.split('/');
    fn({ view: view || 'hub', param });
  };
  addEventListener('hashchange', parse);
  parse();
}

/**
 * Navigate by rewriting the hash (drives every onRoute listener).
 * @param {string} view
 * @param {string} [param]
 */
export function go(view, param) {
  location.hash = `#/${view}${param ? '/' + param : ''}`;
}
