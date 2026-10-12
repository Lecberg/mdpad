import { useSyncExternalStore } from 'react'

/** A tiny observable store: get / set(patch) / subscribe, plus a React hook. */
export interface Store<T> {
  get(): T
  set(patch: Partial<T>): void
  subscribe(listener: () => void): () => void
  use(): T
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  const store: Store<T> = {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    use: () => useSyncExternalStore(store.subscribe, store.get)
  }
  return store
}
