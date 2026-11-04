/** Minimal observable store, compatible with React's useSyncExternalStore. */
export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A read-only value worked out from other stores. */
export interface Derived<T> {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A value computed from `sources`, recomputed when any of them changes.
 * Listeners hear only real changes of the value (`Object.is`).
 */
export function createDerived<T>(compute: () => T, sources: { subscribe(listener: () => void): () => void }[]): Derived<T> {
  let value = compute();
  const listeners = new Set<() => void>();
  const update = () => {
    const next = compute();
    if (Object.is(next, value)) return;
    value = next;
    for (const listener of listeners) listener();
  };
  for (const source of sources) source.subscribe(update);
  return {
    get: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
