import { useSyncExternalStore } from "react";

// A value set from one part of the tree and read by another that has no
// common parent to hold it — the root layout's header and tab bar against
// the map page (lib/hooks/useMapHeaderSlot.ts, lib/hooks/useResultsSheetFull.ts).
// The server snapshot is the initial value, so the first client render
// matches the server's.
export interface ExternalStore<T> {
  get: () => T;
  /** Sets the value; readers re-render only when it changes. */
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
  getInitial: () => T;
}

export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set: (next) => {
      if (Object.is(value, next)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getInitial: () => initial,
  };
}

/** The store's current value, re-rendering when it changes. */
export function useExternalStore<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getInitial);
}
