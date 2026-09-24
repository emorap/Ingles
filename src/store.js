// Tiny observable store: immutable snapshots, shallow-merge patches, sync
// subscriber notification. The app's single source of UI state.

/**
 * @template {object} T
 * @param {T} initial
 * @returns {{ get: () => T, set: (patch: Partial<T>) => void, subscribe: (fn: (s: T) => void) => (() => void) }}
 */
export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const fn of subs) fn(state);
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
