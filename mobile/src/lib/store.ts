import { useSyncExternalStore } from 'react';

import { storage } from './storage';

type Listener = () => void;

export interface Store<T extends object> {
  get: () => T;
  set: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (l: Listener) => () => void;
  /** Hook. The selector must return a stable reference (select existing fields, don't build objects). */
  use: <S>(selector: (s: T) => S) => S;
}

/** Tiny external store (zustand-like) so we don't need another dependency. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  const get = () => state;
  const set: Store<T>['set'] = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const subscribe = (l: Listener) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const use = <S,>(selector: (s: T) => S): S =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    );
  return { get, set, subscribe, use };
}

/**
 * Persist selected keys of a store to AsyncStorage. Returns a promise that
 * resolves once the stored values have been merged back into the store.
 */
export function persistStore<T extends object>(
  store: Store<T>,
  key: string,
  keys: (keyof T)[],
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hydrating = true;

  const write = () => {
    const s = store.get();
    const out: Partial<T> = {};
    keys.forEach((k) => {
      out[k] = s[k];
    });
    void storage.setJSON(key, out);
  };

  store.subscribe(() => {
    if (hydrating) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, 250);
  });

  return storage.getJSON<Partial<T>>(key).then((saved) => {
    if (saved) {
      const patch: Partial<T> = {};
      keys.forEach((k) => {
        if (k in saved) patch[k] = saved[k];
      });
      store.set(patch);
    }
    hydrating = false;
  });
}
